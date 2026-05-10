## What is currently going wrong

1. **Funny mouth/lip faces are being suppressed**
   - The current `genuineSmile` veto can accidentally treat a wide, symmetric silly mouth as “good”, then reduces the same mouth distortion that should raise the score.

2. **Jawline chaos is under-detected**
   - The scorer mostly looks for chin compression, but not enough for jaw skew, jaw jut, lower-face twisting, or side-to-side jaw displacement.

3. **Eye chaos is too narrow**
   - It detects wide/squinted eyes and mismatch, but does not strongly reward brow-lowering, one-eye squint, angry eyes, bug eyes, or eyebrow asymmetry together.

4. **Live arena confidence is weaker than debug mode**
   - `/scorer` has bounding-box confidence and partial-face gating, but `useChaosPipeline` only uses consecutive hit frames. This means live scoring can be less accurate and more unstable.

5. **Stability can hide real performance spikes**
   - The EMA/dead-band stops jitter, but it can also make fast weird faces feel under-rewarded. The system needs separate fast attack and slow release.

6. **No shared diagnostic path**
   - The debug page and arena use similar but not identical detection rules, so fixes can look good in one page and bad in another.

## Fix plan

### Step 1: Unify face confidence and no-face handling
- Create a shared confidence helper inside the scoring pipeline path.
- Use the same rules in live arena and debug:
  - full landmark set required
  - face bounding box must be large enough
  - partial/out-of-frame faces reduce confidence or trigger `NO FACE DETECTED`
  - low confidence disables score/readouts

### Step 2: Replace the smile veto with a “composed face” credit
- Stop using `genuineSmile` to zero out mouth distortion.
- Only lower the score when the face is genuinely calm/composed:
  - symmetric smile
  - low mouth distortion
  - low eye chaos
  - low jaw chaos
  - low motion
- Funny smiles, smirks, tongue/gape, lip stretching, and weird symmetric faces will still score high.

### Step 3: Add stronger mouth/lip performance features
- Add explicit channels for:
  - lip pucker/narrow mouth
  - wide stretched mouth
  - open gape/tongue-out proxy
  - lopsided mouth corners
  - grimace/frown mouth
- Combine these into a new `mouthChaos` score that drives high scores much harder.

### Step 4: Add stronger eye/brow performance features
- Add explicit channels for:
  - one-eye squint
  - both-eyes squint
  - bug eyes
  - brow asymmetry
  - angry lowered-brow expression
  - surprise raised-brow expression
- Combine these into a new `eyePerformance` score.

### Step 5: Add real jaw/lower-face chaos
- Add explicit channels for:
  - jaw lateral skew
  - chin tuck/compression
  - jaw jut/protrusion proxy
  - lower-face squash
  - jawline asymmetry
- Use this as a major score driver so “jawline messed up” clearly increases score.

### Step 6: Rebalance scoring weights
- Make the score mostly performance-based:
  - mouth/lips: high impact
  - eyes/brows: high impact
  - jaw/lower face: high impact
  - motion/commitment: medium impact
  - static structure/aesthetic: low impact
- Target behavior:
  - no face: no score/readouts
  - neutral: 2–4
  - composed/good-looking: 1–3
  - mild weird face: 4–6
  - strong silly face: 6–8
  - extreme distortion: 8–10

### Step 7: Improve responsiveness without jitter
- Use fast attack / slow release smoothing:
  - score rises quickly when distortion appears
  - score falls gradually when the face relaxes
  - tiny movement still gets ignored
- Keep peak/commitment bonuses so sustained weird faces beat one-frame noise.

### Step 8: Make live arena use the corrected score consistently
- Broadcast the exact displayed local score, rounded consistently.
- Keep opponent score as the received broadcast value so both screens match.
- Ensure no-face broadcasts `0` plus no active readouts.

### Step 9: Add temporary debug visibility for tuning
- Log or expose the main channels during testing:
  - mouth chaos
  - eye performance
  - jaw chaos
  - emotion intensity
  - confidence
  - final target score
- This makes it obvious which facial movement is not being detected.

### Step 10: Validate against the expected cases
- Test these scenarios in `/scorer` and `/arena/1v1`:
  - neutral face stays low/stable
  - composed smile does not spike
  - angry face scores higher
  - one-eye squint scores higher
  - lip pucker/wide mouth scores higher
  - jaw tuck/skew scores higher
  - face out of frame shows no-face state
  - held same face does not fluctuate heavily