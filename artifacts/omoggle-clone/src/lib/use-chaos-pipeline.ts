import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/** Lightweight silliness score from MediaPipe landmarks (0–10). Feels responsive without full chaos-scorer bundle. */
export type ChaosBreakdown = {
  score: number;
  traits: { good: Array<{ label: string; v: number }>; bad: Array<{ label: string; v: number }> };
  audio: { spike: number };
};

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Face landmark indices (MediaPipe Face Landmarker). */
const I = {
  forehead: 10,
  chin: 152,
  mouthTop: 13,
  mouthBot: 14,
  mouthL: 61,
  mouthR: 291,
  nose: 1,
  lEyeOut: 33,
  rEyeOut: 263,
  lBrow: 107,
  rBrow: 336,
};

function scoreLandmarks(lm: Array<{ x: number; y: number }>): ChaosBreakdown {
  const eyeSpan = dist(lm[I.lEyeOut], lm[I.rEyeOut]) || 1e-6;
  const mouthOpen = dist(lm[I.mouthTop], lm[I.mouthBot]) / eyeSpan;
  const mouthWide = dist(lm[I.mouthL], lm[I.mouthR]) / eyeSpan;
  const jawDrop = dist(lm[I.forehead], lm[I.chin]) / eyeSpan;
  const browRaise = dist(lm[I.lBrow], lm[I.rBrow]) / eyeSpan;

  const chaosRaw =
    mouthOpen * 4.2 +
    mouthWide * 2.1 +
    Math.max(0, browRaise - 0.35) * 3 +
    Math.max(0, jawDrop - 0.85) * 1.4;

  const score = Math.max(0, Math.min(10, chaosRaw * 2.4));

  const traits: ChaosBreakdown["traits"] = { good: [], bad: [] };
  if (mouthOpen > 0.12) traits.bad.push({ label: "Mouth chaos", v: mouthOpen });
  if (mouthWide > 0.45) traits.bad.push({ label: "Wide grimace", v: mouthWide });

  return {
    score,
    traits,
    audio: { spike: 0 },
  };
}

export function useChaosPipeline(opts: {
  videoRef: RefObject<HTMLVideoElement | null>;
  audioStream: MediaStream | null;
}) {
  const { videoRef, audioStream } = opts;
  const [hasFace, setHasFace] = useState(false);
  const [breakdown, setBreakdown] = useState<ChaosBreakdown | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const rafRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (!cancelled) landmarkerRef.current = lm;
      } catch {
        if (!cancelled) landmarkerRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!audioStream?.getAudioTracks().length) {
      analyserRef.current = null;
      return;
    }
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(audioStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
    } catch {
      analyserRef.current = null;
    }
    return () => {
      try {
        audioCtxRef.current?.close();
      } catch {
        /* noop */
      }
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, [audioStream]);

  useEffect(() => {
    const tick = () => {
      const video = videoRef.current;
      const lm = landmarkerRef.current;
      if (!video || video.readyState < 2 || !lm) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (video.currentTime === lastVideoTimeRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastVideoTimeRef.current = video.currentTime;

      let audioSpike = 0;
      const analyser = analyserRef.current;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        audioSpike = Math.min(1, sum / (data.length * 255));
      }

      try {
        const result = lm.detectForVideo(video, performance.now());
        const face = result.faceLandmarks?.[0];
        if (face?.length) {
          const b = scoreLandmarks(face);
          b.audio = { spike: audioSpike };
          setHasFace(true);
          setBreakdown(b);
        } else {
          setHasFace(false);
          setBreakdown(null);
        }
      } catch {
        setHasFace(false);
        setBreakdown(null);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef]);

  return { hasFace, breakdown };
}
