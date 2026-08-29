# FormTwin bugfix re-test plan

Dev server running at http://localhost:5173. Record browser session.

## T1: Three sequential uploads without reload (timestamp fix)
1. Load landing, upload /tmp/run32799.mp4 → PASS: reaches Results.
2. Click "← New analysis", upload /tmp/run609.mp4 WITHOUT reload → PASS: reaches Results, no error banner, no "Packet timestamp mismatch" in console.
3. Click "← New analysis", upload /tmp/run46653.mp4 WITHOUT reload → PASS: reaches Results, no error banner.
4. Console check → PASS: zero MediaPipe INVALID_ARGUMENT/timestamp errors.

## T2: run609 posture unreliable wording (during step 2)
- On run609 Results: PASS if headline observation is NOT posture nonsense (no "93° lean"); Posture card shows 65 with "We couldn't reliably measure your torso…" wording when selected, OR sane numbers; headline observation picked from reliable metric.
