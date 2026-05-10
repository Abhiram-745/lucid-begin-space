/**
 * Instant-win + bonus event detector.
 *
 * Reads the per-frame ChaosBreakdown for the LOCAL player and the most recent
 * landmark snapshot for the OPPONENT (decoded from incoming WebRTC video) and
 * fires events:
 *   - "opponent_laugh"   -> local player wins (other person broke)
 *   - "double_chin_lock" -> bonus
 *   - "mega_unmog"       -> 2x multiplier
 *   - "no_face"          -> opponent left frame -> forfeit
 */
import type { ChaosBreakdown } from "./chaos-scorer";

export type InstantEvent =
  | { type: "opponent_laugh"; t: number }
  | { type: "double_chin_lock"; t: number }
  | { type: "mega_unmog"; t: number }
  | { type: "no_face"; t: number };

export class EventDetector {
  private smileFramesOpp = 0;     // sustained opponent smile counter
  private chinFrames = 0;
  private megaFrames = 0;
  private noFaceFrames = 0;
  private cooldown: Record<string, number> = {};

  /** Call every frame. `oppSmile` is 0..1 (opponent mouth-distortion proxy). */
  step(local: ChaosBreakdown, oppSmile: number, oppHasFace: boolean, audioSpike: number): InstantEvent[] {
    const out: InstantEvent[] = [];
    const now = performance.now();
    const fire = (e: InstantEvent, ms: number) => {
      if ((this.cooldown[e.type] ?? 0) > now) return;
      this.cooldown[e.type] = now + ms;
      out.push(e);
    };

    // Opponent laugh = sustained mouth distortion + audio spike
    if (oppSmile > 0.55 && audioSpike > 0.2) this.smileFramesOpp++;
    else this.smileFramesOpp = Math.max(0, this.smileFramesOpp - 2);
    if (this.smileFramesOpp > 24) {
      fire({ type: "opponent_laugh", t: now }, 5000);
      this.smileFramesOpp = 0;
    }

    // Double chin lock-in
    if (local.spatial.chinCompression > 0.78) this.chinFrames++;
    else this.chinFrames = Math.max(0, this.chinFrames - 2);
    if (this.chinFrames > 45) {
      fire({ type: "double_chin_lock", t: now }, 4000);
      this.chinFrames = 0;
    }

    // Mega-chaos combo: 4+ channels above 0.75 simultaneously
    const s = local.spatial;
    const high = [s.asymmetry, s.mouthDistortion, s.eyeChaos, s.chinCompression, s.headAngle]
      .filter((v) => v > 0.75).length;
    if (high >= 4) this.megaFrames++;
    else this.megaFrames = Math.max(0, this.megaFrames - 1);
    if (this.megaFrames > 30) {
      fire({ type: "mega_unmog", t: now }, 4000);
      this.megaFrames = 0;
    }

    // Opponent no face
    if (!oppHasFace) this.noFaceFrames++;
    else this.noFaceFrames = 0;
    if (this.noFaceFrames > 60) {
      fire({ type: "no_face", t: now }, 8000);
      this.noFaceFrames = 0;
    }

    return out;
  }

  reset() {
    this.smileFramesOpp = 0;
    this.chinFrames = 0;
    this.megaFrames = 0;
    this.noFaceFrames = 0;
    this.cooldown = {};
  }
}