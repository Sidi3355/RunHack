# FormTwin MVP Test Plan

Environment: Vite dev server at http://localhost:5173 (running). Test videos in /tmp. Record browser session.

## T1: Upload → analysis → results (primary flow)
- Click "ANALYSE MY RUN", pick /tmp/run609.mp4 in file chooser.
- PASS: Analyzing screen with progress % + stage text; completes and lands on Results without console errors.
- Results shows: headline observation banner (cyan), 4 metric cards (Posture/Foot placement/Knee motion/Symmetry) with overall score, coaching card with "What we noticed"/"Try this"/"Why", disclaimers.

## T2: Video overlay tracks runner
- Play the original video; screenshot mid-play; scrub the video scrubber via real drag (screenshot while held).
- PASS: skeleton lines visibly aligned with runner limbs (within plausible error) at 2+ different timestamps.

## T3: 3D twin animates + orbit/scrub
- Observe twin at two play timestamps (screenshots differ, limbs in running pose). Drag to orbit (screenshot mid-drag with rotated camera). Use twin scrubber; pause/play button toggles.
- PASS: pose visibly changes over time; camera angle changes with drag.

## T4: Metric card selection
- Click "Foot placement" card.
- PASS: card gets cyan border; joints highlighted cyan in both 3D twin and video overlay; video seeks to a representative frame (timestamp changes).

## T5: Ghost toggle
- With Foot placement selected, click "Show me the fix — ghost overlay".
- PASS: translucent green ghost skeleton appears in 3D twin; button text changes to "✓ Showing illustrative coaching cue (ghost)"; explanatory note about illustrative cue appears.

## T6: View sample analysis
- Back to landing (logo/reset), click "View sample analysis".
- PASS: results render with animated twin, metric cards & coaching; NO video section shown.

## T7: Unsupported file error
- Create /tmp/notavideo.mp4 (text file with .mp4 ext, bypasses video/* filter). Upload it.
- PASS: returns to landing showing amber error banner with graceful message (no crash/blank screen).

## T8: Mobile viewport ~390x844
- Set viewport via devtools device toolbar or window resize; view landing and results.
- PASS: no horizontal overflow, cards stack, controls usable.

## T9: Console check
- After all flows, review console.
- PASS: no uncaught errors/red exceptions (CDN warnings OK).
