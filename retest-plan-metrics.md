# FormTwin new-metrics test plan (commit 4d8b65b)

Dev server at http://localhost:5173. Videos in /tmp. Record.

## T1: Upload real clip → 7 metric cards with plausible values
- Upload /tmp/run32799.mp4 via ANALYSE MY RUN (GTK dialog: double-click file).
- PASS: Results shows 7 cards: Posture, Foot placement, Knee motion, Symmetry, Cadence, Bounce, Landing knee, each with 0-100 score.
- PASS: Select Cadence card → detail shows steps/min roughly 150-200 spm (or explicit "needs a few clear strides" unreliable wording); NOT 0 or >300.

## T2: New cards select, highlight, seek
- Tap Cadence, then Bounce, then Landing knee cards.
- PASS for each: card gets cyan border, detail text below grid updates to that metric, video seeks (timestamp changes), cyan joint highlight appears on twin/video (ankles+feet for cadence, hips for bounce, knees for landing knee), no error banner/blank screen.

## T3: Sample analysis with 7 cards
- ← New analysis → "View sample analysis".
- PASS: 7 cards render with scores; synthetic banner; no crash.

## T4: Coaching cue renders
- PASS: "What we noticed" / "Try this" / "Why" present on results (both upload and sample).

## T5: Console
- PASS: no uncaught errors (benign GL/context logs OK).
