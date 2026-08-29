# FormTwin

**Don't just give me a score. Show me.**

FormTwin turns a short side-on phone clip of you running into an explainable 3D
movement twin — with the exact moments and joints behind every observation, and
one concrete coaching cue.

**Live demo:** https://dist-xvjybtwi.devinapps.com

## How it works

1. **Record / upload** a 5–10 s side-on running clip (film from the side, whole
   body in frame).
2. **Pose extraction runs entirely on your device** — MediaPipe Pose Landmarker
   (33 landmarks per frame) in the browser. The raw video never leaves your
   phone/laptop.
3. FormTwin computes **7 research-grounded movement signals** and shows the
   evidence: skeleton overlay on your video, an animated 3D movement twin, and
   the representative frame for each observation.
4. A coaching layer turns the derived metrics (never the video) into one
   actionable cue.

## The 7 signals

| Signal | What it measures | Grounding |
|--------|------------------|-----------|
| Posture | Torso lean from vertical (avg + stability) | Souza 2016; Bramah 2018 |
| Foot placement | Ankle ahead of the knee at contact — the 2D overstride cue ("land under a flexing knee") | Souza 2016; Schubert 2014 |
| Knee motion | Knee-angle range per stride, both legs | Souza 2016 |
| Symmetry | Left/right knee-range difference | IJSPT 2023 |
| Cadence | Steps/min from ankle crossovers | Schubert 2014; Anderson 2022 |
| Bounce | Hip vertical oscillation vs leg length | Souza 2016; Adams 2018 |
| Landing knee | Knee flexion at initial contact | Bramah 2018 |

Every score card shows a "Why this score" line with its target band and source.
Signals that can't be trusted for a given clip (wrong camera angle, hidden
limbs, implausible values) are flagged **unreliable** instead of being shown as
fact. Full rationale in [RESEARCH.md](RESEARCH.md); blind-validation study
against independent expert gait analyses in [VALIDATION.md](VALIDATION.md).

## Features

- Animated 3D movement twin (Three.js / react-three-fiber) — orbit, scrub, play
- Video + skeleton overlay with metric-linked joint highlighting and
  jump-to-key-frame
- "Show me the fix" illustrative correction ghost
- Movement Snapshot with transparent heuristic scoring
  ([src/lib/heuristics.ts](src/lib/heuristics.ts))
- Personalization: age / experience / goal pace feed research-backed insights
- Journey: local history of past analyses with expandable progress charts
- Fitbit integration (OAuth PKCE): pace, pace consistency, HR, effort zones
- Exports: original video, skeleton-overlay video, PNG/PDF results card
- Sample-analysis mode for demoing without a good clip

## Privacy

Your movement stays yours. Video analysis happens on your device — only
derived movement metrics are used for coaching. History and profile live in
your browser's local storage.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS v4 · @mediapipe/tasks-vision ·
Three.js / @react-three/fiber

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc -b
npm run build      # production build
```

Optional generative coaching: deploy with the included `api/coach.ts`
serverless endpoint and set `OPENAI_API_KEY` (server-side only — never exposed
to the browser). Without it, the app uses a clearly-labelled deterministic
coaching fallback.

## Disclaimer

FormTwin is a prototype coaching tool and is not a medical device or a
substitute for professional medical advice. All signals are approximate
camera-based estimates, not clinical measurements — see
[VALIDATION.md](VALIDATION.md) for what has and hasn't been validated.
