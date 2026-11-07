# AURORA Mission Lab

A reproducible orbital encounter investigation that ends in a decision: inspect
uncertainty, receive a recommended maneuver, explore a 2,952-encounter trade space of
burn time × Δv, promote any point in it to a full nonlinear simulation, screen
explicitly supplied nearby objects, replay trajectories, and export the complete
analysis inputs and an engineering report.

Run `npm run demo`, open the printed URL and choose **Mission lab**. A direct link
is `/?mission=1`. The complete synthetic investigation runs locally without accounts,
Kafka, API keys or network data. The existing live catalog remains available in OPS.

Review the saved [decision and trade space](generated/demo/trade-space-desktop.png),
[desktop encounter](generated/demo/encounter-desktop.png),
[trade study](generated/demo/maneuvers-desktop.png),
[mobile view](generated/demo/encounter-mobile.png) and
[automated workflow recording](generated/demo/video.webm). The recording is a short
browser-test walkthrough; the three-minute presentation outline is below.

## The demonstration

The bundled **85-metre encounter** is explicitly synthetic. Two objects cross near
550 km altitude at approximately 7 km/s relative speed. A Gaussian position-error
model produces a baseline Pc around 7.25e-4 with a combined 6 m hard-body radius.

1. Open Encounter geometry. The decision banner states the outcome: baseline Pc
   7.3e-4 exceeds the 1e-4 action threshold, and a 0.25 m/s retrograde burn at
   T−45 min reaches Pc 1.4e-35 against a 1e-6 goal. Inspect the baseline uncertainty
   ellipses and report history; distinguish supplied values from calculated metrics.
2. Scroll to Orbit replay, press play and scrub the scenario clock. The Earth view
   uses computed inertial trajectories; marker positions interpolate visualization
   samples. Numerical closest approach uses a separate refined calculation.
3. Open Maneuver trade study. The trade-space map shows Pc for every burn time from
   T−5 to T−120 min against signed Δv on one axis; the mint line is the Pc-goal
   boundary and white markers are full RK4 candidates. The side chart shows the
   minimum Δv that reaches the goal versus burn time: along-track cost falls from
   0.68 m/s at T−10 min to about 0.05 m/s beyond an orbit, while radial
   effectiveness oscillates with orbital phase and normal never reaches the goal.
   Click any cell, for example +0.10 m/s at T−95 min, to simulate it with full RK4;
   it joins the table and, if it qualifies with less Δv, becomes the recommendation.
   Compare coast, three magnitudes of prograde/retrograde burns, and positive/negative
   radial and normal burns. Select any row or use the maneuver designer for any RTN
   impulse and burn time.
4. Inspect Δv, ideal propellant mass, closest approach, calculated Pc when supported,
   position displacement and additional-object screening results. Normal burns in
   this example provide much less separation than along-track burns.
5. Change burn lead, Δv budget, mass, specific impulse, burn execution uncertainty,
   Pc action threshold, Pc goal, integration step or the force model, and recompute.
6. Open Evidence & replay. Record analyst rationale, start/stop a feed capture,
   disconnect/reconnect the feed, and scrub captured messages in the inspector.
7. Export the archive and engineering report. Import the archive into a fresh lab
   session to recompute the same analysis. Alter an input without updating its hash
   and the integrity check rejects the file.

A three-minute presentation can spend 45 seconds on the encounter, 75 on trade-offs,
30 on failure handling and 30 on reproducibility. Explain assumptions alongside the
results. Do not imply that the synthetic objects represent an actual satellite event.

## Coordinate and unit contract

| Data | Convention |
| --- | --- |
| Live GP propagation | SGP4; WGS72; TEME position in km internally |
| Live rendered positions | TEME rotated by GMST; metres; polar motion omitted |
| Mission state vectors | Common GCRF or EME2000 frame; position m, velocity m/s |
| Position covariance | Same mission inertial frame; m² |
| Full state covariance | Order x, y, z, vx, vy, vz; m² / m²/s / m²/s² blocks |
| Mission clock | Explicit ISO UTC epoch and offsets in seconds |
| Burn specification | Instantaneous impulse in primary radial/transverse/normal basis |
| Hard-body model | Sum of two positive, explicitly supplied spherical radii |

The mission model does not relabel a TLE/TEME state as GCRF. Public catalog selection
and CDM import remain separate sources: a live orbital marker alone cannot supply
an operational uncertainty model.

## Numerical methods

**Encounter probability.** Project the sum of independent position covariances into
the plane perpendicular to relative velocity. Validate symmetry and positive
definiteness, then integrate the 2D Gaussian over a circular hard-body disk using
composite Simpson quadrature. Compare 64×64 and 128×128 grids. Reject unsupported
slow encounters (<10 m/s), epochs more than 30 s from linearized closest approach,
excessive radius-to-uncertainty ratio and failed convergence. This is a short,
rectilinear-encounter model; long-duration correlated encounters need another method.

**Trajectories.** Fixed-step fourth-order Runge–Kutta with either central gravity or
central gravity plus J2. μ = 3.986004418e14 m³/s², equatorial radius = 6,378,137 m,
J2 = 1.08262668e-3. J2 uses the fixed inertial z-axis approximation. Integrate the
supplied epoch state backwards to burn time, apply the RTN impulse, and integrate
forward. Earth-intersecting trajectories stop with an error. Candidate closest
approaches are refined within bracketing intervals by golden-section minimization.
Minimum-at-window-boundary results are flagged.

**Candidate probability.** When both full 6×6 state covariances are available, central
finite differences calculate the position state-transition map through the burn and
propagation. Map covariance with ΦPΦᵀ. Add independent isotropic Gaussian velocity
execution error at burn time, transported to the candidate encounter. Recompute Pc
using the candidate relative state and transported covariance. The configured burn
sigma is an analyst assumption, not an inferred spacecraft capability. Position-only
imports cannot support this calculation. Blank burn uncertainty makes maneuver Pc
unavailable. Underflowed probabilities display as below numerical range rather than
an exact zero-risk claim. Nonlinear error distributions, process noise, correlations
and covariance realism are outside this model.

**Trade space.** For each burn lead from 5 to 120 minutes in 5-minute steps, the
primary is integrated back from epoch, and forward-difference impulse sensitivities
(h = 0.01 m/s) map an RTN impulse to the primary position at linearized TCA. Each of
41 signed Δv values per axis shifts the baseline encounter-plane miss vector; the
baseline combined covariance plus the mapped isotropic burn execution error gives a
2D Pc (32 × 32 Simpson grid, bounded against 64 × 64 by test). Cells whose Gaussian
underflows across the whole disk are assigned 0 without quadrature, which is the
value the quadrature would return. The minimum Δv per lead brackets the first
qualifying grid magnitude and bisects. Every analysis reports the linear map's miss-distance
agreement with all full RK4 candidates (1.5 m, 0.41% for the example). The map
guides design only: recommendations and table values use full RK4 candidates.
Miss-distance agreement does not validate map probabilities. Coast is checked first:
if it already meets the Pc goal, the minimum is zero and the chart states that no
impulse is needed. Clicking a zero-impulse heatmap cell selects the coast candidate.

**Decision.** If baseline Pc is at or below the action threshold (default 1e-4), the
status is monitor. Otherwise a burn qualifies when its candidate Pc is at or below
the goal (default 1e-6), no screening object is below the distance threshold and its
minimum is not at the search boundary. The lowest-Δv qualifying candidate is
recommended for review. Unavailable candidate Pc yields insufficient data; no
qualifying burn yields no feasible candidate. Both thresholds are scenario inputs
and travel in the hashed archive. This is a review aid, not command authorization.

**Designed maneuvers.** Up to 20 analyst-designed RTN impulses with their own burn
leads (after the encounter window, up to 120 minutes) are stored in the scenario,
validated against the Δv budget, and simulated, probability-mapped and screened with
the same code as the standard candidates. The replay clock follows the selected candidate’s burn time, so its displayed
trajectory always covers the active clock range.

**Screening.** Compare each candidate with every object explicitly supplied in the
scenario, from burn time through the end of the encounter window, using the same
integrator and local minimum refinement. Threshold flags are deterministic distances,
not additional-object collision probabilities. The example contains two screening
objects. A CDM import initially contains none. This is not a full-catalog clearance.

**Costs.** Ideal rocket equation from configured wet mass and specific impulse.
Position displacement at the original epoch illustrates trajectory disruption; it
does not quantify constellation service coverage, attitude, power or communications.

## Import and replay

- Mission JSON: `aurora-mission-v1` with strict finite values, unique IDs, UTC epoch,
  common frame, covariance checks and bounded computation parameters.
- Archive JSON: `aurora-archive-v1`, model version, canonical JSON SHA-256,
  scenario, notes, selected candidate, replay position and optional captured feeds.
  The checksum establishes file integrity, not source authenticity or an analyst's
  digital signature. Unsupported model versions are rejected rather than silently
  recomputed with changed algorithms. `aurora-analysis-1.2.0` adds the trade space,
  decision and designed maneuvers while reproducing 1.1.0 candidate results
  unchanged, so 1.1.0 archives remain importable; others are rejected.
- CDM: one CCSDS KVN document; GCRF/EME2000 states in km and km/s, RTN covariance in
  m² / m²/s / m²/s². Full lower-triangular state covariance is optional; a partial
  velocity covariance is rejected. Input radii are explicit analyst assumptions.
  XML and arbitrary provider JSON are not supported. Source text remains in archive.
- Feed capture: starts with the dashboard snapshot, then appends validated arriving
  messages. Maximum 300 events or 20 MB; recording stops visibly without discarding
  earlier events. Archive import is bounded at 30 MB. No uploaded files leave the tab.
- Feed replay: folds captured messages in recorded order, with recorded UTC stamps.
  The inspector displays the reconstructed catalog/report counts and weather presence.
  It does not replace the mission's epoch states or masquerade as a live feed.

## Validation and reproduction

```sh
npm ci --prefix frontend
npm test
npm run test:backend
npm run build
npm run validate:mission
cd frontend && npx playwright install chromium && npm run test:e2e
```

Optional independent cross-check, from the repository root:

```sh
python3 -m venv .venv-validation
.venv-validation/bin/pip install -r scripts/validation-requirements.txt
.venv-validation/bin/python scripts/validate-dynamics.py
```

Run `npm run validate:mission` before the Python check. The Python program reads
exported candidate states and imports no application code. It uses SciPy DOP853,
independent closest-approach optimization, finite differences and adaptive Gaussian
disk quadrature. The reports in `docs/generated/` record tolerances and errors.

| Evidence | Coverage |
| --- | --- |
| Vallado reference fixture | 93 states, five cases: near-Earth, drag, deep-space, eccentric resonance and near-geosynchronous |
| Go/Rust/JS reference tests | Published TEME positions; JS also checks velocity; OMM initialization and large IDs |
| NASA CARA Omitron reference | Circular hard-body probability compared within 0.1% relative tolerance |
| Analytic tests | Circular orbit closure, energy conservation, Gaussian disk integral and free-drift covariance |
| Numerical tests | Step refinement, backward/forward propagation, rotation invariance, coast identity, extra-object encounter detection |
| Independent dynamics | All eleven candidate states, refined TCA and probability against SciPy |
| Trade space and decision | Linear map vs full RK4 (<1%), zero-Δv identity, grid quadrature vs 64 × 64, minimum-Δv verified by full RK4 and mapped covariance, monotone lead cost, monitor/maneuver/no-feasible/insufficient-data paths, designed-maneuver identity with standard candidates |
| Input tests | Bad units/frames, indefinite/partial covariances, missing inputs and tampered archives |
| Resilience tests | Bounded capture, deterministic replay and slow-client disconnection; Go race detector |
| Browser tests | Desktop/mobile workflow, recommendation, trade-space click-to-simulate, designed-maneuver removal, parameters, worker execution, capture, export/import, integrity rejection |

Reference datasets are bundled and do not require live providers during tests.
The source archive URL and SHA-256 are retained in the fixture. The vendored Go SGP4
core has its original MIT license and an adapter-specific attribution README.

## Performance evidence

`npm run validate:mission` publishes hardware, runtime, memory, 50 mission-analysis
samples and 30 catalog-propagation cycles with p50/p95/p99 timings. The propagation
workload repeats five reference element sets to make 20,000 synthetic entries;
it measures propagation throughput, not real catalog coverage or full-stack latency.

```sh
cd backend
go test ./gateway -run '^$' -bench BenchmarkBroadcast -benchmem
```

That benchmark fans a small weather payload to 100 bounded in-memory client queues;
it excludes network writes. Browser frame measurements are separately identified as
local development-server measurements. No throughput number is claimed to validate
real-world orbital accuracy or operational readiness.

## Architecture

```text
CelesTrak OMM ── Go ingestion ── Kafka ── Go / optional Rust SGP4 ── Gateway
                                                                   │
                                                        bounded WebSocket queues
                                                                   │
                                           existing catalog + bounded feed capture

CDM / scenario / archive ── validation ── isolated analysis worker
                                           │
                            encounter + RK4 + covariance mapping + screening
                                           │
                          linearized trade space ── decision (full RK4 only)
                                           │
                          Mission Lab + replay + report / hashed archive
```

The gateway disconnects clients whose send queues fill, records the metric
`aurora_websocket_slow_clients_disconnected_total`, and serves its latest snapshots
when they reconnect. Mission computations run in a disposable Web Worker; importing
a new scenario terminates the old worker. The globe unmounts while the lab is open.

CelesTrak records publish in bounded batches of 500, avoiding a separate Kafka batch
timeout for every object. Delivery retries are at least once; the engine retains the
latest epoch by object ID. Gateway freshness uses source propagation timestamps so
historical Kafka replay does not acquire a new observation time. A new consumer group
can take time to catch up with retained history. Set `ENGINE_CONSUMER_GROUP` and
`GATEWAY_CONSUMER_GROUP` to distinct names when testing alongside another stack;
they still share the same topics and producers. The launcher checks every listening
port and verifies its gateway instance identifier before reporting readiness.

## Operational boundary

This is an engineering simulator and review tool. Public elements and synthetic or
imported uncertainty models do not establish observational accuracy. Mission use
would require operator ephemerides, realistic covariances, validated spacecraft and
force models, broader screening, mission-specific constraints, coordination and
independent operational review. Those external data and approvals are not fabricated.

Sources: [Vallado verification](https://celestrak.org/publications/AIAA/2006-6753/),
[CelesTrak OMM](https://celestrak.org/NORAD/documentation/gp-data-formats.php),
[NASA CARA reference software](https://github.com/nasa/CARA_Analysis_Tools),
[NASA conjunction guidance](https://www.nasa.gov/cara/).

## Workspace reliability

The 1.2.1 workspace uses a typographic AURORA identity, a compact recommendation
summary with expandable reasoning, responsive stage navigation, and a selected-
candidate replay clock. It respects reduced-motion preferences.

Worker results are paired with the exact scenario input object and retry attempt.
Changing inputs immediately removes the previous recommendation and report. A failed
computation displays its error and a retry action; it cannot export stale analysis
under the new inputs. Regression browser tests hold a recomputation pending, inject a
worker failure, and check recovery and the resulting report.

The 1.1.0 compatibility archive is a frozen test fixture under
`frontend/src/mission/fixtures/`, separate from the regenerated public example.
Model 1.2.1 fixes zero-cost trade-space handling while preserving the trajectory
and candidate-probability calculations supported by 1.1.0 and 1.2.0.
