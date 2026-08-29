# Bounce fix round 2 re-test (commit fa5eb62)

Dev server http://localhost:5173. Record. Evidence: metrics.ts:308-340 (stride-period detrend, oscRatio>0.25 unreliable, new message).

## T1: run609 (side-on slow-mo) Bounce
- Upload /tmp/run609.mp4, select Bounce card.
- PASS: Bounce detail shows EITHER a value ≤ ~20% of leg length OR "We couldn't reliably measure your vertical bounce in this clip." NEVER a 50%+ claim. Headline observation is NOT a bounce-nonsense claim (previous run showed "bounce vertically more than expected" with 53%).

## T2: run32799 (head-on) Bounce still guarded
- Upload /tmp/run32799.mp4, select Bounce.
- PASS: "We couldn't reliably measure your vertical bounce from this camera angle." + side-on message; score 65.

## T3: Sample mode Bounce sane
- View sample analysis, select Bounce.
- PASS: no unreliable message; value ≤ ~20% (or score high with plausible detail).

## T4: Console — no uncaught errors.
