# Running-form research notes

Evidence base behind FormTwin's prototype heuristics (`src/lib/heuristics.ts`).
These are camera-based coaching signals informed by the literature — not
clinical measurements or validated injury prediction.

## Shortlisted signals (measurable from a side-on phone video)

| Signal | What the literature says | FormTwin metric |
| --- | --- | --- |
| Overstriding (foot/ankle landing ahead of pelvis at initial contact) | Classic 2D video flag: a vertical line through the lateral malleolus falling anterior to the pelvis at loading response indicates overstride (Souza 2016). Shorter strides reduce joint energy absorption and stress-fracture probability (Schubert 2014; Edwards 2009). | Foot placement |
| Step rate / cadence | Increasing step rate ~5–10% at constant speed consistently reduces vertical loading rate, braking impulse, ground reaction force and hip/knee/ankle energy absorption (Schubert 2014 systematic review; Adams 2018; Anderson 2022 meta-analysis). Prospective evidence linking preferred cadence to injury incidence is mixed (Luedke 2020). | Cadence |
| Knee flexion at initial contact | Injured runners across four common soft-tissue injuries land with a more extended knee and more dorsiflexed ankle at initial contact (Bramah 2018, AJSM). | Landing knee |
| Vertical oscillation of the centre of mass | Large vertical CoM displacement ("bounding") is a standard video-analysis flag (Souza 2016); reducing vertical oscillation lowers peak vertical GRF (Adams 2018). | Bounce |
| Trunk lean | A slight forward whole-body lean is typical; injured runners showed greater trunk forward lean at midstance (Bramah 2018). Both very upright and heavily hunched postures are coaching flags in evidence-based video analysis (Souza 2016). | Posture |
| Knee flexion range during stance/swing | Limited knee flexion during stance reduces shock absorption; it is one of the 14 measurements in the evidence-based 2D video analysis plan (Souza 2016). | Knee motion |
| Left/right asymmetry | Between-limb kinematic differences are used clinically as consistency/rehab flags; 2D sagittal measures of hip/knee/ankle are reliable surrogates for 3D capture (IJSPT 2023 implementation study). | Symmetry |

## Signals deliberately NOT scored (need views/data we don't have)

- Contralateral pelvic drop and hip adduction — strongest injury association
  (Bramah 2018: +1° pelvic drop ≈ 80% higher odds of being injured), but requires
  a **posterior** camera view; not measurable from a side-on clip.
- Foot-strike pattern (rearfoot vs forefoot) — reliably assessed on 2D video
  (Sports Health 2019 systematic review) but needs high frame rate / slow-motion
  capture to be trustworthy; heel/toe landmark depth from MediaPipe at normal
  frame rates is too noisy.
- Heel eversion, foot progression, heel whips, knee window — posterior view.
- Ground reaction forces, loading rate — require force plates; we only use
  their kinematic surrogates above.

## Fitbit-derived training insights (`src/lib/fitbit.ts`)

Summary-level signals available from the Fitbit Web API activity list
(`/1/user/-/activities/list.json`, OAuth 2.0 PKCE, scopes
`activity heartrate profile cardio_fitness`):

- **Pace** per run (Fitbit speed, or duration/distance fallback) and
  **pace consistency** — coefficient of variation of pace across recent runs.
- **Heart rate** — per-run average HR and time in heart-rate zones;
  higher-intensity zone share as a rough effort/intensity indicator.
- **Cadence** — steps/duration when step counts are logged for the run.
- **Volume** — weekly distance, per-run distance/duration/calories.

Not used (require extra Fitbit approval or aren't exposed at summary level):
per-second intraday HR/pace streams, GPS/TCX route + elevation data,
within-run pace variability. Fitbit summaries describe training load and
consistency — they cannot reproduce the video-based biomechanical metrics
above and are presented separately in the UI.

## Key sources

- Souza RB. *An Evidence-Based Videotaped Running Biomechanics Analysis.*
  Phys Med Rehabil Clin N Am, 2016. (14-measurement 2D video framework)
- Bramah C et al. *Is There a Pathological Gait Associated With Common Soft
  Tissue Running Injuries?* Am J Sports Med, 2018.
- Schubert AG et al. *Influence of Stride Frequency and Length on Running
  Mechanics: A Systematic Review.* Sports Health, 2014.
- Adams D et al. *Altering Cadence or Vertical Oscillation During Running:
  Effects on Running Related Injury Factors.* IJSPT, 2018.
- Anderson LM et al. *What is the Effect of Changing Running Step Rate on
  Injury, Performance and Biomechanics?* Sports Med Open, 2022.
- Xu Y et al. *Effects of Foot Strike Techniques on Running Biomechanics:
  A Systematic Review and Meta-analysis.* Sports Health, 2021.
- *Implementation of 2D Running Gait Analysis in Orthopedic Physical Therapy
  Clinics.* IJSPT, 2023. (2D sagittal-plane validity/reliability)
