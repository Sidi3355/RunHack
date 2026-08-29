# Side-view guard re-test (commit 5010d35)

Dev server http://localhost:5173. Videos: /tmp/run32799.mp4 (head-on), /tmp/side5149.mp4 (side-view, normal speed), fallback /tmp/run46653.mp4 (slow-mo side view). Record.

## T1: Head-on clip triggers guard
- Upload /tmp/run32799.mp4. Select Cadence, Bounce, Landing knee cards in turn.
- PASS: each shows score 65 and message "This signal needs a side-on clip — try filming from the side with the whole body in frame." No "~92 steps/min" or "57% of leg length" claims anywhere (headline included).

## T2: Side-view clip passes guard with sane values
- Upload /tmp/side5149.mp4 (no reload needed). Select Cadence, Bounce, Landing knee.
- PASS: guard message absent; cadence shows a numeric spm (slow-mo would be low; normal speed expect ~120-200; anything 60-250 acceptable as "sane", NOT -1/0/1000+); bounce % of leg length ≤ ~20%; landing knee bend a plausible angle (0-60°).
- If 5149 turns out not side-on (guard shows), fall back to /tmp/run46653.mp4 and accept legitimately low cadence, verifying guard passes.

## T3: Sample mode
- View sample analysis → PASS: 7 cards, none showing the side-on guard message, sane values (synthetic side-on).

## T4: Console
- PASS: no uncaught errors.
