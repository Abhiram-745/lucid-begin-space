import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  AudioTracker,
  TemporalTracker,
  extractSpatial,
  extractEmotion,
  extractStructure,
  scoreFromFeatures,
  type ChaosBreakdown,
} from "./chaos-scorer";

let visionLoader: Promise<Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>> | null = null;
function getVision() {
  if (!visionLoader) {
    visionLoader = FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );
  }
  return visionLoader;
}

async function createLandmarker(): Promise<FaceLandmarker> {
  const vision = await getVision();
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
  });
}

export interface PipelineState {
  ready: boolean;
  breakdown: ChaosBreakdown | null;
  hasFace: boolean;
  oppMouthProxy: number; // exposed so an EventDetector can read opponent smile
}

export interface PipelineOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** If a MediaStream is provided, audio is analyzed (local player only). */
  audioStream?: MediaStream | null;
  /** Called after every score update with the latest breakdown. */
  onTick?: (b: ChaosBreakdown) => void;
}

export function useChaosPipeline(opts: PipelineOptions): PipelineState {
  const { videoRef, audioStream, onTick } = opts;
  const [ready, setReady] = useState(false);
  const [breakdown, setBreakdown] = useState<ChaosBreakdown | null>(null);
  const [hasFace, setHasFace] = useState(false);
  const [oppMouthProxy, setOppMouthProxy] = useState(0);

  const temporal = useRef(new TemporalTracker());
  const audioTracker = useRef(new AudioTracker());
  const prevScore = useRef(0);
  const rafRef = useRef(0);
  const lastT = useRef(-1);

  // Set up audio analyser
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const timeBuf = useRef<Float32Array | null>(null);
  const freqBuf = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!audioStream) return;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(audioStream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    audioCtx.current = ctx;
    analyser.current = an;
    timeBuf.current = new Float32Array(an.fftSize);
    freqBuf.current = new Uint8Array(an.frequencyBinCount);
    return () => {
      try { ctx.close(); } catch {}
      audioCtx.current = null;
      analyser.current = null;
    };
  }, [audioStream]);

  useEffect(() => {
    let cancelled = false;
    let landmarker: FaceLandmarker | null = null;

    createLandmarker().then((lm) => {
      if (cancelled) return;
      landmarker = lm;
      setReady(true);
    });

    const loop = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !landmarker) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (video.currentTime === lastT.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastT.current = video.currentTime;

      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const lm = result.faceLandmarks?.[0];
        if (lm && lm.length > 400) {
          setHasFace(true);
          const spatial = extractSpatial(lm as any);
          const emotion = extractEmotion(lm as any);
          const structure = extractStructure(lm as any);
          const temp = temporal.current.update(spatial, lm as any);

          // audio
          let audio = { energy: 0, pitchVariation: 0, spectralEntropy: 0, spike: 0 };
          if (analyser.current && timeBuf.current && freqBuf.current) {
            analyser.current.getFloatTimeDomainData(timeBuf.current as unknown as Float32Array<ArrayBuffer>);
            analyser.current.getByteFrequencyData(freqBuf.current as unknown as Uint8Array<ArrayBuffer>);
            audio = audioTracker.current.update(
              timeBuf.current,
              freqBuf.current,
              audioCtx.current?.sampleRate ?? 48000,
            );
          }

          const b = scoreFromFeatures(spatial, temp, audio, undefined, prevScore.current, emotion, structure);
          prevScore.current = b.score;
          setBreakdown(b);
          setOppMouthProxy(spatial.mouthDistortion);
          onTick?.(b);
        } else {
          setHasFace(false);
        }
      } catch {
        // mediapipe occasionally throws on un-warmed frames
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef, onTick]);

  return { ready, breakdown, hasFace, oppMouthProxy };
}