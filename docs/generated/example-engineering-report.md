# AURORA · Mission analysis
The 85-metre encounter
Scenario: SYNTHETIC · pathfinder-crossing-001
Epoch: 2026-10-26T12:00:00.000Z · Frame: GCRF
Source: AURORA deterministic fixture
Synthetic states constructed in mission/scenario.ts; no real spacecraft event is represented.
Model: aurora-analysis-1.2.1

## Baseline encounter
Miss distance: 85.000 m
Relative speed: 7004.808 m/s
Computed 2D Pc: 7.25070287e-4
Combined hard-body radius: 6 m
Quadrature difference: 1.626e-18

## Maneuver trade study
Candidate | Δv m/s | Ideal fuel kg | Miss m | TCA offset s | Displacement m | Screening threshold flags | Computed Pc
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---:
Coast · no burn | 0.000 | 0.000000 | 85.000 | 0.000 | 0.000 | 0 | 7.25070266e-4
Retrograde · 0.25 m/s | 0.250 | 0.004780 | 1930.376 | -0.123 | 2075.779 | 0 | 1.37485060e-35
Prograde · 0.25 m/s | 0.250 | 0.004780 | 1848.959 | 0.123 | 2075.588 | 0 | 2.36738033e-30
Retrograde · 0.50 m/s | 0.500 | 0.009560 | 3817.577 | -0.246 | 4151.749 | 0 | 2.24721094e-125
Prograde · 0.50 m/s | 0.500 | 0.009560 | 3736.678 | 0.246 | 4150.984 | 0 | 6.25555061e-115
Retrograde · 1.00 m/s | 1.000 | 0.019119 | 7592.471 | -0.493 | 8304.262 | 0 | < 1e-300 (numerical floor)
Prograde · 1.00 m/s | 1.000 | 0.019119 | 7513.827 | 0.491 | 8301.204 | 0 | < 1e-300 (numerical floor)
Radial − | 1.000 | 0.019119 | 3220.643 | -0.239 | 3623.761 | 0 | 3.43980527e-67
Radial + | 1.000 | 0.019119 | 3212.845 | 0.239 | 3624.675 | 0 | 1.61148537e-67
Normal − | 1.000 | 0.019119 | 111.919 | -0.020 | 157.329 | 0 | 5.85371354e-4
Normal + | 1.000 | 0.019119 | 111.351 | 0.020 | 157.329 | 0 | 6.33280698e-4

## Decision
Status: MANEUVER · Retrograde · 0.25 m/s at T−45 min
Action threshold 1.0e-4 · goal 1.0e-6
- Baseline Pc 7.3e-4 exceeds the 1.0e-4 action threshold.
- Pc 7.3e-4 → 1.4e-35 · miss 1.93 km · 4.8 g propellant · all 2 screening objects clear.
- Lowest Δv of 8 full-RK4 candidates meeting the 1.0e-6 goal.
- Linear estimate: 0.067 m/s along-track at T−45 min; latest qualifying grid time T−10 min. Verify a designed candidate with the full model.

## Trade space (linearized)
Linear map agrees with 11 full RK4 candidates within 1.521 m (0.4121% relative).
Burn lead | Along-track min Δv m/s | Radial min Δv m/s | Normal min Δv m/s
---: | ---: | ---: | ---:
T−5 min | — | -0.9669 | —
T−10 min | -0.6766 | -0.4946 | —
T−15 min | -0.3482 | -0.3430 | —
T−20 min | -0.2143 | -0.2723 | —
T−25 min | -0.1484 | -0.2351 | —
T−30 min | -0.1119 | -0.2155 | —
T−35 min | -0.0901 | -0.2070 | —
T−40 min | -0.0763 | -0.2065 | —
T−45 min | -0.0674 | 0.2092 | —
T−50 min | -0.0614 | 0.2025 | —
T−55 min | -0.0575 | 0.2009 | —
T−60 min | -0.0548 | 0.2046 | —
T−65 min | -0.0532 | 0.2150 | —
T−70 min | -0.0523 | 0.2346 | —
T−75 min | -0.0519 | 0.2693 | —
T−80 min | -0.0520 | 0.3329 | —
T−85 min | -0.0524 | 0.4662 | —
T−90 min | -0.0530 | 0.8582 | —
T−95 min | 0.0536 | — | —
T−100 min | -0.0540 | — | —
T−105 min | -0.0540 | -0.5169 | —
T−110 min | -0.0534 | -0.3633 | —
T−115 min | -0.0520 | -0.3001 | —
T−120 min | -0.0501 | -0.2747 | —

## Model assumptions
- States: GCRF; metres and m/s; epoch 2026-10-26T12:00:00.000Z.
- Baseline Pc: independent Gaussian position errors, constant covariance, circular combined hard-body radius, short rectilinear encounter. No cross-correlation.
- Candidate trajectories: RK4 J2, step ≤ 10 s, instantaneous RTN impulse. No drag, solar pressure, third bodies or finite burns.
- Candidate Pc requires both full 6D state covariances. Central finite-difference state transitions transport uncertainty; independent isotropic Gaussian burn error is added. Missing inputs yield unavailable Pc. Nonlinear uncertainty and cross-correlation are not modeled.
- Secondary screening covers 2 explicitly supplied objects from burn to epoch + 180 s; deterministic distance threshold, not catalog-wide clearance.
- Fuel uses ideal rocket equation with configured mass and specific impulse. Displacement is a geometry metric, not a validated service-coverage impact.
- Covariance positive definiteness verifies mathematical validity, not observational realism.
- Trade space: burn lead 5–120 min × single-axis Δv within budget, linearized by forward-difference impulse sensitivities. Miss distances are compared against full RK4 candidates; this check does not validate map probabilities. It guides design; recommendations use full RK4 candidates only.
- Decision: maneuver evaluated when baseline Pc exceeds 1e-4; a candidate qualifies at Pc ≤ 1e-6 with no screening flag or boundary minimum, ranked by Δv. A review aid, not command authorization.

## Analyst notes
Bundled reproducible demonstration. Synthetic crossing encounter.

Import the companion JSON archive to reproduce these results. This report contains simulation trade studies, not spacecraft command authorization.
