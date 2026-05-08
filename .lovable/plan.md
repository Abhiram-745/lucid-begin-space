## UNMOG Realtime Scoring — System Plan

A complete architecture for the realtime "chaos scoring" engine: webcam capture, ML feature extraction, scoring, multiplayer comparison, instant-win triggers, and persistence. All scoring runs **client-side first** for sub-100ms feedback; the backend is for sync, persistence, and matchmaking.

---

### 1. High-Level Architecture

```text
 ┌────────────────┐        WebRTC P2P (video/audio)        ┌────────────────┐
 │   Player A     │ <────────────────────────────────────> │   Player B     │
 │  (browser)     │                                        │  (browser)     │
 │                │                                        │                │
 │ Camera ─► MediaPipe FaceLandmarker ─► Feature Extractor │  (same stack)  │
 │                       │                                 │                │
 │                       ▼                                 │                │
 │                 ChaosScorer (heuristic)                 │                │
 │                       │                                 │                │
 │                       ▼                                 │                │
 │              local UNMOG_SCORE (60Hz)                   │                │
 └───────┬────────────────────────────────┬────────────────┘
         │ score ticks (10Hz)             │ score ticks (10Hz)
         ▼                                ▼
 ┌──────────────────────────────────────────────────────────┐
 │           Supabase Realtime (WebSocket channel)          │
 │   • match_id room, score broadcast, event bus            │
 └─────────┬────────────────────────────────────────────────┘
           │ persist on round_end / instant_win
           ▼
 ┌──────────────────────────────────────────────────────────┐
 │   Postgres: matches, rounds, frame_scores, highlights    │
 │   Edge Function: finalize-match (winner, ELO, clip ref)  │
 └──────────────────────────────────────────────────────────┘
```

Why client-first scoring: streaming raw landmarks to a server kills latency and costs. The server only sees aggregated scores + key events.

---

### 2. Capture Pipeline (Frontend)

- `getUserMedia({ video: {fps:30}, audio:true })` → `MediaStream`.
- Mirror stream into:
  - `<video>` element (display + MediaPipe input)
  - `RTCPeerConnection` (sent to opponent)
  - `AudioContext` analyser node (for audio features)
- Matchmaking + signaling via Supabase Realtime channel (offer/answer/ICE).

---

### 3. ML Feature Extraction (per frame, ~30 FPS)

**Library:** `@mediapipe/tasks-vision` `FaceLandmarker` (already installed).
- 468 landmarks + 52 ARKit-style **blendshapes** + face transformation matrix.

**Per-frame features** (normalized 0–1 by face bounding box):

| Feature | Source | Calc |
|---|---|---|
| `asymmetry` | landmarks | mean abs diff of mirrored L/R landmark pairs |
| `mouth_distortion` | mouth landmarks | (mouth width × openness) vs neutral baseline |
| `eye_chaos` | eyelid landmarks + blendshapes | abs(eyeBlinkLeft − eyeBlinkRight) + wide-open spike |
| `chin_compression` | jaw + neck landmarks | shrink ratio of chin→neck distance |
| `head_angle` | transformation matrix | combined yaw+pitch+roll magnitude |
| `brow_chaos` | browInner/Outer blendshapes | sum of brow blendshape activations |
| `tongue_out` | `tongueOut` blendshape | direct value (huge bonus weight) |
| `cheek_puff` | `cheekPuff` blendshape | direct value |

**Per-frame audio features** (Web Audio API `AnalyserNode`):
- `rms_energy` — loudness
- `pitch_variance` — autocorrelation over rolling 500ms
- `spectral_flatness` — noisiness (screams, weird sounds)

---

### 4. Temporal Layer (rolling buffer, ~60 frames = 2s)

For each feature, maintain:
- **velocity** = |x(t) − x(t−1)|
- **volatility** = std-dev over window
- **commitment** = fraction of frames in window where intensity > 0.6

Derived signals:
- `motion_instability` = mean velocity of all landmarks (head movement chaos)
- `expression_volatility` = mean volatility across blendshapes
- `sustain_bonus` = commitment × peak_intensity (rewards holding the bit)

---

### 5. Scoring Function

```text
raw = w1·asymmetry        + w2·mouth_distortion  + w3·eye_chaos
    + w4·chin_compression + w5·head_angle        + w6·brow_chaos
    + w7·tongue_out       + w8·cheek_puff
    + w9·motion_instability + w10·expression_volatility
    + w11·audio_energy    + w12·pitch_variance
    + w13·sustain_bonus

UNMOG_SCORE = smooth(exaggerate(clamp(raw, 0, 1)))  × 1000
```

- **smooth**: EMA, α≈0.25 (responsive but not jittery)
- **exaggerate**: `pow(x, 0.7)` so mid-range looks rewarding on screen
- Suggested weights heavily favor `tongue_out`, `chin_compression`, `cheek_puff`, `sustain_bonus` — these are the visually committed bits.

Output cadence: compute at 30Hz, broadcast at 10Hz.

---

### 6. Instant-Win Triggers

Run a parallel **Event Detector** on each player's local pipeline:

| Trigger | Detection | Result |
|---|---|---|
| **Opponent laugh** | sustained `mouthSmile` blendshape > 0.7 for ≥800ms **AND** opponent audio RMS spike > threshold | Other player instant win, +500 bonus |
| **Look-away / leave frame** | no face detected ≥ 2s | Forfeit |
| **Mega-chaos combo** | ≥4 features simultaneously > 0.8 for 1s | "MEGA UNMOG" 2× multiplier for 3s |
| **Double chin lock-in** | chin_compression > 0.85 for 1.5s | +200 bonus, screen-shake FX |

Each player detects their **opponent's** laugh from the incoming WebRTC video (run a second, lighter FaceLandmarker on the remote `<video>` element). This avoids self-reporting cheating.

---

### 7. Multiplayer & Realtime Sync

**Supabase Realtime channel** `match:{match_id}`:

Broadcast events (client → channel → opponent + server listener):
- `score_tick` `{ player_id, score, features_summary, t }` — 10Hz
- `instant_win` `{ winner_id, reason }`
- `round_start`, `round_end`
- `forfeit`

Presence: tracks both players connected; auto-end on disconnect.

---

### 8. Persistence (Supabase Postgres)

Tables (RLS on every one):
- `matches` — players (uuid[]), started_at, ended_at, winner_id, mode
- `rounds` — match_id, round_number, duration, winner_id, final_scores (jsonb)
- `frame_scores` — round_id, player_id, t_ms, score (downsampled to 5Hz to keep volume sane)
- `highlights` — round_id, player_id, t_ms, type ('mega_unmog'|'double_chin'|'laugh_trigger'), clip_url
- `player_stats` — user_id, elo, wins, losses, peak_score
- `user_roles` — separate table per security guidelines

**ELO update**: standard ELO with K=32 in `finalize-match` Edge Function called on `round_end`.

**Clip storage**: client records last 5s of local canvas via `MediaRecorder` on highlight events → uploads webm to Supabase Storage bucket `highlights/`.

---

### 9. Edge Functions

- `finalize-match` — validates final scores from both clients (sanity-check vs broadcast history), writes winner, updates ELO.
- `matchmaker` — pairs waiting players from a `queue` table, creates match row, returns match_id + signaling channel.
- `report-cheat` — flags impossible score curves (e.g. constant 1.0).

---

### 10. Anti-Cheat / Sanity

- Server only trusts the **opponent-reported** instant-win for laugh detection (cross-validation).
- Reject final scores if score curve never dips, or if features arrive without matching landmark hashes.
- Min 5 face-detected frames per second required, else mark frames invalid.

---

### 11. Build Order

1. **Scorer module** (already exists at `src/lib/chaos-scorer.ts`) — extend with full feature set + temporal buffer.
2. **Opponent-face analyzer** for laugh detection on remote video.
3. **Supabase tables + RLS + realtime channel**.
4. **Matchmaking queue + signaling**.
5. **Live arena page** wiring scorer → channel → UI scoreboards + instant-win FX.
6. **Highlight recorder + upload**.
7. **`finalize-match` Edge Function + ELO**.
8. **Leaderboard reads from `player_stats`**.

---

### Technical Notes

- All ML stays in-browser (`@mediapipe/tasks-vision` WASM + GPU delegate). No server inference, no per-frame upload.
- Score broadcast is throttled to 10Hz to stay well under Supabase Realtime limits (~100 msgs/s/channel).
- `frame_scores` table is for replay/debug only; do not store landmark data (privacy + size).
- Heuristic weights live in a single `SCORING_WEIGHTS` constant so they can be tuned without touching logic — this is the "tuning surface" that replaces a trained model in v1.
- v2 upgrade path: log `(features[], reaction_score)` pairs from real matches → train a small MLP that outputs a single chaos probability, swap in behind the same `ChaosScorer` interface.