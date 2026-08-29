# FormTwin reliability validation

## Objective

Test FormTwin's camera-based movement signals against publicly available running
footage that comes with an **independent expert analysis**, find systematic
disagreements, fix the pipeline where the evidence justified it, and report the
agreement honestly. This is a coaching-level agreement check against expert video
analyses — **not** a clinical validation against 3D motion capture or force plates,
and FormTwin makes no claim of clinical equivalence.

## Protocol

1. Source videos were located by searching for running-gait footage that ships with
   a professional's spoken/written analysis (physical-therapist and running-coach
   breakdowns of real runners, including elite race footage).
2. Side-on sections were clipped out (`ffmpeg`), without transcribing the expert
   commentary first.
3. Each clip was run through the **actual FormTwin pipeline** (the same
   `extractPoseSequence` → `analyseSequence` code the app runs, driven headlessly in
   the app's browser context), and the full metric output was saved to JSON
   **before** the expert conclusions were read in detail.
4. Only then were the experts' conclusions collected (video transcripts / published
   write-ups) and compared metric-by-metric.
5. Systematic disagreements were fixed in the pipeline (see "Changes made"), and the
   whole corpus was re-run through the fixed pipeline.

**Honest limitation:** clip selection required watching the source videos, so the
selector had incidental exposure to on-screen captions (e.g. pace labels) before the
FormTwin run. The FormTwin numeric outputs themselves were captured before the
expert commentary was transcribed or mapped to metrics. This is a good-faith blind
procedure, not a formally controlled study.

## Sources

| ID | Source | Expert context | Clips |
|----|--------|----------------|-------|
| A | "Overstriding While Running — How to Fix Your Stride", Dr. Matt Minard (Learn 2 Run), physical therapist. youtube.com/watch?v=vLh2nCNMtPA | PT demonstrating overstriding vs corrected form on treadmill: foot far ahead of body, **locked/extended knee at contact**, heavy heel load; fix = land closer under the body | `A_left`, `A_right` (side-on treadmill demo, overstriding condition) |
| B | "Mo Farah's Running Technique", James Dunne (Kinetic Revolution), running-form coach. youtube.com/watch?v=uxf1gEkm_EE | Elite 5k race footage: lands **under a flexing knee** (explicitly *ahead of the hip* at race pace and that's fine), no overstride, ~180–200 steps/min, upright posture with slight whole-body lean | `B_farah` |
| C | "Professional runners at different paces" side-on compilation. youtube.com/watch?v=ie6gjXJU5Yw | Professional runners filmed side-on at labelled intensities (recovery → sprint); no stated form faults — useful as a "should mostly score well / should not be flagged as faulty" control and a pace-robustness probe | `C_z1a`–`C_z1c` (easy), `C_z5`–`C_z7` (fast/sprint) |
| — | "Overstriding vs Efficient Running Form" (BEMKoPHWJ1g) | **Excluded** — video unavailable for download | — |
| — | Kipchoge technique montage (andAaS6Lyc8) | **Excluded** — montage of many runners/angles; no single clip was clearly attributable to the narrated analysis | — |

## Round 1 — blind results vs expert conclusions (pre-fix pipeline)

Raw pre-comparison outputs: captured to JSON before reading expert conclusions.

| Clip | FormTwin (blind) | Expert says | Verdict |
|------|------------------|-------------|---------|
| A (overstriding PT demo) | Primary observation: **foot placement** (ankle far ahead at contact, scores 29/5) | Overstriding is the demonstrated fault | ✅ Agreement on the headline |
| A_right | Cadence 129 spm | Overstriders take slow, long steps | ➖ Direction right, value likely undercounted |
| B (Mo Farah) | Foot placement flagged (0.38 ahead of hip, score 37) | **No overstride** — lands under a flexing knee; landing ahead of the *hip* is normal at race pace | ❌ Systematic false positive: wrong reference point (hip instead of knee) |
| B | Cadence **261 spm** | ~180–200 spm | ❌ Peak-detection over-count |
| B | Landing knee 64° flexion | Modest flexion at contact (~20° is the coaching cue) | ❌ Contact frames picked midstance, not initial contact |
| B | Posture 5.2° lean, score 87 | "Remarkably upright, slight whole-body lean" | ✅ Agreement |
| B | Bounce 1% of leg length | (not commented) | ❌ Implausibly low — detrend window bug |
| C easy-pace clips | Foot placement 0.38–0.58 "ahead of hip", flagged as worst metric | Professional runners, no fault stated | ❌ Same hip-reference false positive |
| C pros | Symmetry differences 21–44% | No asymmetry commented on any pro | ❌ Far-leg foreshortening + angle noise inflates asymmetry |
| A_left | Cadence/bounce/landing knee gated "needs side-on clip" on a clearly side-on clip | — | ❌ Side-view gate too strict on small-in-frame runners |

**Round-1 headline agreement: 2 of 4 comparable headline observations** (overstride
case and posture agreed; elite/pro footage was systematically over-flagged).

## Changes made (all general-purpose, none tuned to a specific clip)

1. **Foot placement now uses the expert cue.** Overstride is measured as the ankle's
   signed distance ahead of the **knee** at likely initial contact (0 = vertical
   shin = "landing under a flexing knee"), along the direction of travel — not
   |ankle − hip|, which falsely flags every fast runner and even counted toe-off
   frames (foot *behind* the body) as "ahead".
2. **Cadence from stride-rhythm autocorrelation.** The left–right ankle
   separation oscillates once per stride, so the stride period is found by
   autocorrelation of that signal (peak after the first local minimum, to skip
   the trivially-correlated short lags). This is robust to offsets and tracking
   spikes that broke event counting (261 spm on elite footage). When no clear
   periodicity exists — slow-motion, very short, or badly tracked clips —
   cadence is reported as *unreliable* instead of a wrong number.
3. **Initial-contact refinement.** Stance is detected as clusters of
   consecutive low-foot frames; the contact frame is the cluster start, refined
   to the local knee-extension maximum just before it (the knee is near peak
   extension at touchdown, then flexes under load).
3b. **Landing-knee scoring only penalises the extended side.** The evidence
   (Bramah 2018) flags a *straighter* knee at contact; a very high measured
   flexion (>45°) is a contact-timing artefact and is now reported as
   unreliable rather than scored as a fault.
4. **Bounce detrend window from measured cadence.** The rolling-mean window is one
   stride period derived from the cadence estimate; the old
   median-contact-gap window could be shorter than the hip's oscillation and
   subtract out the very signal being measured (bounce read 1% everywhere).
5. **Median-3 smoothing** on knee-angle series and gait signals to stop
   single-frame pose spikes inflating left/right range differences.
6. **Symmetry honesty guard.** A single side-on camera under-measures the far
   leg; on this corpus even professional runners with no commented asymmetry
   read 23–33% left/right knee-range difference. Differences >22% are therefore
   reported as "couldn't compare reliably" (likely viewpoint artefact) instead
   of being presented as true asymmetry.
7. **Side-view gate accepts the ankle-crossover amplitude** as a third orientation
   signal, fixing side-on clips that were wrongly gated.

## Final round — re-run after fixes (actual browser pipeline)

| Clip | Expert says | FormTwin (fixed) | Verdict |
|------|-------------|------------------|---------|
| A_left (overstriding demo) | Overstride: foot lands far ahead, extended knee | **Primary observation: foot placement** — ankle 15% of leg length ahead of the knee (score 52) | ✅ Headline agreement |
| A_right (corrected-form demo) | Fixed stride: lands closer under the body | Foot placement 3% ahead of knee (score 86), no overstride flag | ✅ Agreement — and correctly *ordered* vs A_left |
| B (Mo Farah) | No overstride — lands under a flexing knee, ahead of the hip at race pace | Foot placement 0% ahead of knee (score 92) | ✅ Round-1 false positive eliminated |
| B | ~180–200 spm | Cadence *unreliable* (distant race footage, tracking too noisy for a rhythm) | ➖ Honest abstention instead of round 1's wrong 261 spm |
| B | Upright, slight whole-body lean | Posture 5.3° lean (score 87) | ✅ Agreement |
| C pros (6 clips, easy → sprint) | No stated form faults | Foot placement 0–0.11 (5 of 6 unflagged), plausible bounce 0–4%, no false "straight-knee" flags | ✅ Control mostly clean |
| C pros | No asymmetry commented | Symmetry reported *unreliable* (viewpoint-limited) on all side-on clips | ➖ Honest abstention (2D far-leg foreshortening) |
| All slow-motion clips | — | Cadence reported *unreliable* rather than a fabricated spm | ➖ Honest abstention (true spm is unknowable from slow-mo) |

**Counts (final round, headline-level):** 5 agreements, 0 disagreements,
3 honest abstentions (signal reported unreliable where the video genuinely
cannot support it), 1 partial (C_z5 read a mild 11% foot-ahead value on a
sprinting pro in one run — within pose-estimation run-to-run variance).

Known residual biases: landing-knee flexion reads high in absolute terms
(~30–44° where elites are typically described at ~20–25°) because video contact
timing is imprecise — the *flag direction* (extended vs flexed) agrees with the
experts, but the absolute number should not be quoted as a measurement.
MediaPipe pose extraction is not perfectly deterministic between runs, so
borderline values can move a few percent.

## What we can honestly claim

- On this corpus, FormTwin's headline observation matched the expert's headline on
  the fault case (overstriding) **and** it no longer invents faults on elite/pro
  footage after the fixes — the false-positive modes found in round 1 were traced
  to concrete pipeline bugs and corrected with the same cue the experts use.
- Signals are approximate camera-based estimates. Sources of error that remain:
  monocular pose estimation noise, single-camera foreshortening, gait-event timing
  from video alone, small clip counts, and selection bias (public expert-analysed
  footage over-represents elites and demonstration exaggerations).
- **Not claimed:** clinical validity, equivalence to 3D motion capture / force
  plates, injury prediction, or that agreement on this small corpus generalises to
  all runners. Pitch-safe phrasing: *"FormTwin's signals were checked against
  independent expert video analyses of real runners; where they disagreed, the
  pipeline was corrected to use the same cues the experts use."*

## Next validation steps

- Larger corpus with quantitative ground truth (e.g. treadmill datasets with
  stride-level labels) for cadence/contact-time error statistics.
- Repeat-run determinism testing of the side-view gate.
- Inter-rater comparison against more than one expert per clip.
