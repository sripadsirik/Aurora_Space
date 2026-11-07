# AURORA · Mission Lab

A space situational-awareness platform with a reproducible encounter-analysis lab.
Inspect orbital uncertainty, simulate eleven maneuver candidates, compare fuel and
collision probability when supported by full covariance, screen supplied nearby
objects, and export an integrity-checked investigation archive.

## Access AURORA

**[Open the free public demo](https://sripadsirik.github.io/Aurora_Space/)** —
use it in your browser without an account or installation. The GitHub Pages site
hosts the demo frontend with sample data. Live satellite, aircraft, launch and
camera feeds require the backend described below.

**[Browse the public source code](https://github.com/sripadsirik/Aurora_Space)**
to inspect the implementation, download a ZIP through **Code → Download ZIP**, or
fork the repository. No GitHub account is needed to view or clone the code.

### Run the latest version locally

Install **Git** and **Node.js 22.12+**, then run:

```sh
git clone https://github.com/sripadsirik/Aurora_Space.git
cd Aurora_Space
npm run demo
```

Open **[http://localhost:5173](http://localhost:5173)**. The launcher installs
frontend dependencies automatically. Select **Mission lab**, or open
**[Mission Lab directly](http://localhost:5173/?mission=1)**. The complete synthetic
workflow works without API keys or a backend. Press **Ctrl+C** to stop.

### Run with live public data

Also install **Go 1.21+** and **Docker Desktop**, start Docker Desktop, then run
this from the cloned repository:

```sh
npm start
```

Open **[http://localhost:5173](http://localhost:5173)**. This starts the frontend,
gateway, orbital engine, ingestion services and Kafka. Space-Track credentials
are optional for conjunction data; see [startup and configuration](#start-everything-in-one-terminal).
The feed-status badge shows whether data is demo, live, mixed, stale or offline.

### Contribute

[Report bugs or request features](https://github.com/sripadsirik/Aurora_Space/issues),
or fork the repository, make your changes on a branch, and
[open a pull request](https://github.com/sripadsirik/Aurora_Space/pulls) against
`main`. Run `npm run check` before submitting code changes; see the verification
commands and guides below for browser and numerical checks.

## Mission Lab guides

- [Mission Lab guide, numerical models and demo walkthrough](docs/mission-lab.md)
- [Reproducible performance and numerical evidence](docs/generated/mission-validation.json)
- [Independent SciPy cross-check](docs/generated/independent-dynamics.json)
- [Example engineering report](docs/generated/example-engineering-report.md)
- [Bundled replay archive](frontend/public/scenarios/pathfinder.json)
- [Recorded workflow](docs/generated/demo/video.webm) and [desktop preview](docs/generated/demo/encounter-desktop.png)
- [Live OMM catalog integration audit](docs/generated/live-catalog-summary.json)

**Verification:** `npm run check` · `npm run test:e2e` · `npm run validate:mission`.
CI runs frontend checks, browser workflows, Go race tests and Rust reference tests.

The live pipeline now ingests CelesTrak OMM JSON and supports six/nine-digit NORAD
identities without serializing through TLE fields. Existing TLE records remain
supported. The mission lab is an engineering simulator; supported assumptions and
observational-validation limits are documented with the results.

---

<img width="3439" height="1324" alt="image" src="https://github.com/user-attachments/assets/7a1ce02b-cdef-4798-92fc-942788287ffb" />

<img width="3439" height="1326" alt="image" src="https://github.com/user-attachments/assets/9d90889a-121c-43eb-a8bc-6b21b88294dc" />

## Space Situational Awareness Platform

![Status](https://img.shields.io/badge/status-in%20development-cyan?style=for-the-badge)
![Rust](https://img.shields.io/badge/Rust-engine-orange?style=for-the-badge&logo=rust)
![Go](https://img.shields.io/badge/Go-ingestion%20and%20gateway-00ADD8?style=for-the-badge&logo=go)
![Kafka](https://img.shields.io/badge/Apache%20Kafka-streaming-231F20?style=for-the-badge&logo=apache-kafka)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![CesiumJS](https://img.shields.io/badge/CesiumJS-3D%20globe-6CADDF?style=for-the-badge)

AURORA is a real-time space situational awareness dashboard that combines live orbital data, conjunction alerts, and space weather inside a Cesium-based 3D UI.

Current backend split:

- `backend/engine/` is the default Go orbital propagation service used by `npm start`.
- `backend/gateway/` and `backend/ingestion/*` are still Go services.
- `backend/engine-rust/` is an optional Rust propagation service (`npm start -- --engine=rust`).

## Launch

```bash
npm start
```

One terminal for the frontend, backend, Kafka and monitoring. Open http://localhost:5173.
For a preview requiring only Node.js: `npm run demo`. See [startup and configuration](#start-everything-in-one-terminal).

## Stack

### Frontend
- React 18
- TypeScript
- Vite
- CesiumJS
- Zustand

### Backend
- Rust orbital engine (`rdkafka`, `sgp4`, `tokio`, Prometheus)
- Go gateway (`gorilla/websocket`)
- Go ingestion services for CelesTrak, NOAA, and Space-Track
- Apache Kafka
- Prometheus + Grafana
- Docker Compose for local infra

## Data Sources

| Source | Purpose | Required |
| --- | --- | --- |
| CelesTrak | TLEs for satellite propagation | Yes |
| NOAA SWPC | Space weather feed | Yes |
| Space-Track | Conjunction/CDM feed | Optional |

## Space Weather Scales

The space weather utilities model all three of NOAA SWPC's
[space weather scales](https://www.swpc.noaa.gov/noaa-scales-explanation) in
`frontend/src/utils/spaceWeatherScales.ts`. The Space Weather panel surfaces all three
scales — the G and R levels alongside the S level derived from the feed's proton-flux
reading — and leads with a combined NOAA status line (see `summarizeNoaaScales`) that
highlights the most severe active scale:

| Scale | Driver | Levels | Helpers |
| --- | --- | --- | --- |
| G (geomagnetic storm) | Planetary Kp index | G1–G5 | `kpToGScale`, `kpToGScaleInfo`, `gScaleColor` |
| R (radio blackout) | Peak GOES X-ray flux | R1–R5 | `xrayClassToRScale`, `xrayClassToRScaleInfo`, `rScaleColor` |
| S (solar radiation storm) | Peak ≥10 MeV proton flux (pfu) | S1–S5 | `protonFluxToSScale`, `protonFluxToSScaleInfo`, `sScaleColor` |

Each scale exposes a metadata table (`geomagneticStormScale` / `radioBlackoutScale` /
`solarRadiationStormScale`) with a severity code, short label, and one-line operational impact,
plus a colour map that escalates from quiet green to extreme red. `G0`/`R0`/`S0` denote
sub-storm quiet conditions.

`summarizeNoaaScales` (`frontend/src/utils/noaaScaleSummary.ts`) resolves a space-weather
snapshot into all three current levels and picks the single most severe one (`peak`), breaking
ties in G → S → R order. It backs the panel's compact NOAA status line.

## Orbit Summary

Derived orbital characteristics for a satellite come from the pure helpers in
`frontend/src/utils/orbitSummary.ts`, which build on the orbital-mechanics primitives in
`frontend/src/utils/orbit.ts`:

| Helper | Returns |
| --- | --- |
| `getOrbitalPeriodMinutes` | Orbital period in minutes |
| `getRevolutionsPerDay` | Revolutions completed per 24-hour solar day (mean motion) |
| `getGroundTrackShiftDegrees` | Westward ground-track longitude shift per orbit |
| `describeOrbitRegime` | Regime label, altitude band, and usage note for LEO/MEO/GEO |
| `summarizeOrbit` | All of the above plus circular orbital velocity in one struct |

Circular orbital speed comes from `circularOrbitalVelocityKms` in `orbit.ts` (the vis-viva
relation `v = sqrt(mu / r)`), and `formatOrbitalPeriod` in `frontend/src/utils/format.ts`
renders a period in minutes as a compact `Hh Mm` (or bare `Mm`) string. All values are derived
from the same deterministic orbit radius so they stay mutually consistent.

## Orbital Energy

Energy and dynamics figures for a satellite's orbit come from the pure helpers in
`frontend/src/utils/orbitalEnergy.ts`, which build on the same orbital-mechanics primitives in
`frontend/src/utils/orbit.ts` as the orbit summary above:

| Helper | Returns |
| --- | --- |
| `specificOrbitalEnergyMJ` | Specific orbital energy in MJ/kg (`-mu / 2r`, negative for a bound orbit) |
| `escapeVelocityKms` | Escape velocity at the orbit radius (`sqrt(2 mu / r)`) |
| `specificAngularMomentumKm2s` | Specific angular momentum in km²/s (`sqrt(mu r)`) |
| `escapeDeltaVKms` | Impulsive prograde delta-V from the circular orbit to escape |
| `orbitalEnergyProfile` | All of the above bundled into one `OrbitalEnergyProfile` for a `Satellite` |

Escape velocity is always a factor of `sqrt(2)` above the circular orbital speed at the same
radius, so `escapeDeltaVKms` reduces to `(sqrt(2) - 1) * v_circular`. `formatOrbitalSpeed` and
`formatSpecificEnergy` in `frontend/src/utils/format.ts` render the speeds (`7.66 km/s`) and the
specific energy (`-29.3 MJ/kg`) for display. Every figure derives from the same deterministic
orbit radius, so it stays mutually consistent with the periods and speeds reported elsewhere.

## Solar Wind Pressure

The solar-wind ram pressure and the dayside magnetopause compression it drives come from the
pure helpers in `frontend/src/utils/solarWindPressure.ts`, using the proton density and bulk
speed the space-weather feeds already report:

| Helper | Returns |
| --- | --- |
| `solarWindDynamicPressure` | Ram (dynamic) pressure in nPa (`Pdyn = k · n · v²`) |
| `magnetopauseStandoffRe` | Subsolar magnetopause standoff in Earth radii (scales as `Pdyn^(-1/6)`) |
| `isMagnetopauseInsideGeo` | True when the boundary is compressed to or inside geostationary orbit (6.6 Rₑ) |
| `dynamicPressureLevel` | Qualitative band (`quiet` / `nominal` / `elevated` / `extreme`) |
| `solarWindPressureProfile` | All of the above bundled into one `SolarWindPressureProfile` for a `SpaceWeather` snapshot |

Pressure balance between the ram pressure and the compressed dipole field fixes the standoff
distance, so a fast, dense stream squeezes the boundary inward — nominal quiet wind (~2 nPa)
sits near 10.5 Rₑ, while a strong CME shock can push it inside geostationary orbit and expose
GEO assets to the magnetosheath. `formatDynamicPressure` and `formatMagnetopauseStandoff` in
`frontend/src/utils/format.ts` render the pressure (`1.34 nPa`) and the standoff (`10.5 Rₑ`) for
display, and the heliosphere overlay's L1 DSCOVR panel surfaces both, highlighting the standoff
when the boundary drops inside GEO.

## Solar Wind Coupling

How hard the solar wind couples into geomagnetic activity comes from the pure helpers in
`frontend/src/utils/solarWindCoupling.ts`, using the bulk speed and IMF Bz component the
space-weather feeds already report:

| Helper | Returns |
| --- | --- |
| `geoeffectiveElectricField` | Rectified dawn-dusk electric field in mV/m (`Ey = V · Bs`, `Bs = max(0, -Bz)`) |
| `couplingLevel` | Qualitative band (`closed` / `weak` / `moderate` / `strong`) |
| `isStrongGeomagneticCoupling` | True at or above the strong-coupling threshold (5 mV/m) |
| `solarWindCouplingProfile` | All of the above bundled into one `SolarWindCouplingProfile` for a `SpaceWeather` snapshot |

Only a southward IMF reconnects with the magnetosphere, so only the southward part of the field
is geoeffective — a northward or zero Bz reads as `closed` and drives no coupling. When the field
does turn south, the wind sweeps a motional electric field across the dayside that feeds the ring
current and sets storm intensity, so a fast stream carrying a strongly southward field pushes the
coupling into the `strong` band. `formatGeoeffectiveField` in `frontend/src/utils/format.ts`
renders the field for display (`3.20 mV/m`), and the heliosphere overlay's L1 DSCOVR panel
surfaces it alongside the ram pressure and magnetopause standoff, highlighting it under strong
coupling.

## Coverage Footprint

How much of Earth a satellite can see or serve comes from the pure geometry helpers in
`frontend/src/utils/coverageFootprint.ts`. Each takes an altitude in kilometres and an optional
minimum ground elevation angle (defaulting to `0`, the geometric horizon):

| Helper | Returns |
| --- | --- |
| `earthCentralAngleDeg` | Earth central angle from the sub-point to the coverage edge |
| `coverageRadiusKm` | Surface radius of the coverage circle |
| `slantRangeToHorizonKm` | Line-of-sight range to the coverage edge |
| `coverageAreaKm2` | Surface area of the coverage cap |
| `earthCoverageFraction` | Fraction of Earth's surface in view (0-1) |
| `isWithinCoverage` | Whether a ground point at a given angular separation is in view |
| `getCoverageFootprint` | All of the above bundled into one `CoverageFootprint` for a `Satellite` |

Raising the minimum elevation angle narrows the footprint (a station needs the satellite higher
above its horizon), while higher orbits widen it: a single geostationary satellite sees roughly
42% of the globe down to the horizon. All figures derive from the same central angle, so they
stay mutually consistent.

## Ground-Station Passes

How long a ground station can talk to a satellite on a single revolution comes from the pure
geometry helpers in `frontend/src/utils/satellitePasses.ts`. They combine the coverage-cap
geometry (`coverageFootprint.ts`) with the orbital period (`orbit.ts`), and each takes an optional
minimum ground elevation angle (defaulting to `0`, the geometric horizon):

| Helper | Returns |
| --- | --- |
| `maxPassSweepDeg` | Horizon-to-horizon true-anomaly arc swept during an overhead pass |
| `passOrbitFraction` | Share of a full revolution (0-1) spent above the horizon |
| `maxPassDurationSeconds` | Longest per-revolution contact window, in seconds |
| `maxPassDurationMinutes` | The same contact window, in minutes |
| `theoreticalMaxDailyContactSeconds` | Upper bound on daily contact if every revolution were a zenith pass |
| `summarizePass` | All of the above bundled into one `PassSummary` for a `Satellite` |

A pass is longest when the ground track carries the satellite straight overhead: it rises at one
edge of the coverage cap, climbs to the zenith, and sets at the opposite edge, sweeping twice the
Earth central angle. The figures are idealised upper bounds — they assume a directly overhead pass
and ignore Earth's rotation beneath the orbit — so they size the *maximum* contact window rather
than a typical one. Raising the elevation mask always shortens the pass, and higher orbits lengthen
it as both the coverage cap and the orbital period grow.

## Orbital Eclipse

How much of each orbit a satellite spends in Earth's shadow versus sunlight comes from the pure
geometry helpers in `frontend/src/utils/eclipse.ts`. They use the standard cylindrical-shadow
model, parameterised by altitude and the orbit's *beta angle* — the angle between the orbital
plane and the Earth-Sun line:

| Helper | Returns |
| --- | --- |
| `eclipseFraction` | Fraction of the orbit spent in shadow for a given beta angle (0-0.5) |
| `sunlightFraction` | Fraction of the orbit spent in sunlight (0.5-1) |
| `maxEclipseFraction` | Worst-case shadow fraction, at beta angle `0` |
| `eclipseCutoffBetaDeg` | Beta angle above which the orbit stays fully sunlit |
| `eclipseDurationMinutes` | Minutes per orbit spent in shadow |
| `sunlightDurationMinutes` | Minutes per orbit spent in sunlight |
| `summarizeEclipse` | All of the above bundled into one `EclipseSummary` for a `Satellite` |

The eclipse is longest when the Sun lies in the orbital plane (`betaDeg = 0`) and shrinks as the
beta angle rises, vanishing once it reaches `eclipseCutoffBetaDeg` (equal to `asin(R / (R + h))`),
beyond which the orbit rides clear of the shadow for the whole revolution. A 550 km orbit spends
roughly 37% of each orbit in shadow, while a geostationary satellite spends under 5%. Durations
derive from the same spherical Earth radius as the shadow geometry, so the eclipse and sunlight
minutes always sum to the orbital period.

## Catalog Statistics

Summary figures for the whole tracked catalog come from the pure helpers in
`frontend/src/utils/catalogStats.ts`, which aggregate over a `Satellite[]`:

| Helper | Returns |
| --- | --- |
| `countByOrbitType` | Object counts per LEO/MEO/GEO regime |
| `countByRiskLevel` | Object counts per nominal/watch/warning/critical level |
| `averageAltitudeKm` | Mean catalog altitude in kilometres |
| `averageVelocityKms` | Mean catalog velocity in kilometres per second |
| `totalConjunctions` | Sum of per-object active conjunction counts |
| `countElevatedRisk` | Objects at or above a given risk threshold (default `watch`) |
| `summarizeCatalog` | All of the above bundled into one `CatalogSummary` struct |

The breakdown helpers always return every regime or risk level (defaulting to zero), and the
averages return `0` rather than `NaN` for an empty catalog, so summary displays render a stable
set of rows regardless of the catalog contents.

## Catalog Filtering and Search

Common catalog queries are collected as pure, non-mutating helpers in
`frontend/src/utils/catalogFilters.ts`, so panels no longer re-implement the same
`Satellite[]` filters inline:

| Helper | Returns |
| --- | --- |
| `filterByOrbitType` | Satellites in one LEO/MEO/GEO regime |
| `filterByRiskLevel` | Satellites carrying exactly one risk level |
| `filterByOwner` | Satellites for an owner (case-insensitive, whitespace-trimmed) |
| `filterByAltitudeRange` | Satellites within an inclusive altitude band |
| `searchCatalog` | Free-text match on name or NORAD id |
| `filterElevatedRisk` | Satellites at or above a risk threshold (default `watch`) |
| `sortByAltitudeDesc` | Satellites ordered highest-to-lowest altitude |
| `sortByConjunctionCountDesc` | Satellites ordered by most active conjunctions |

Every helper returns a new array and never mutates its input, so the results are safe to
derive directly from store state. `filterByAltitudeRange` normalises swapped bounds,
`searchCatalog` returns a copy of the catalog for a blank query, and `filterElevatedRisk`
reuses the same `RISK_LEVELS` ordering as `countElevatedRisk` in `catalogStats` so the list
and the count never disagree.

## Catalog Operators

Owner-level breakdowns of the catalog come from the pure helpers in
`frontend/src/utils/catalogOwners.ts`, complementing `filterByOwner` in `catalogFilters` with
a way to enumerate, rank, and summarise the operators behind a `Satellite[]`:

| Helper | Returns |
| --- | --- |
| `normalizeOwner` | An owner label trimmed and case-folded for grouping |
| `canonicalOwner` | An owner's display label; blank collapses to `UNKNOWN_OWNER` |
| `countByOwner` | Object counts keyed by operator |
| `uniqueOwners` | Distinct operators sorted case-insensitively |
| `topOwnersByCount` | Operators ranked by fleet size (optional top-N limit) |
| `conjunctionsByOwner` | Per-operator sum of active conjunction counts |
| `topOwnersByConjunctions` | Operators ranked by total active conjunctions |
| `ownerShare` | An operator's fraction of the catalog, in `[0, 1]` |
| `ownerRank` | 1-based leaderboard position of an operator, or `null` |
| `elevatedRiskByOwner` | Per-operator counts of objects at or above a risk threshold |
| `summarizeOwners` | The aggregates bundled into one `OwnerSummary` struct |

Operators are grouped by their normalised label so spacing and capitalisation differences never
split one operator across several buckets, while the first spelling encountered is kept as the
display key. Blank owner fields collapse into a single `UNKNOWN` bucket, which a blank argument
and an explicit `UNKNOWN` both address. Both ranking helpers break count ties alphabetically so
the ordering is deterministic; `elevatedRiskByOwner` reuses `filterElevatedRisk` from
`catalogFilters` and omits operators with nothing flagged; and `ownerShare` returns `0` (and
`ownerRank` `null`) rather than `NaN` for an empty catalog or an absent operator.

## Conjunction Risk Tiers

Conjunction warnings are ranked by collision probability into four risk tiers, defined once in
`frontend/src/utils/conjunctionRisk.ts` and shared by the globe overlays and every conjunction
panel so the boundaries never drift apart:

| Tier | Collision probability | Operational meaning |
| --- | --- | --- |
| `critical` | > 1e-3 | Maneuver recommended |
| `warning` | > 1e-4 | Monitoring required |
| `watch` | > 1e-6 | Track, no action yet |
| `nominal` | ≤ 1e-6 | No action required |

`classifyConjunctionRisk` maps a probability to its tier, and `isActionableConjunctionRisk`
reports whether it reaches the `warning` band or higher. Thresholds live in the exported
`CONJUNCTION_RISK_THRESHOLDS` constant. `conjunctionRiskTextClass` turns a tier into the shared
Tailwind text-colour class used by the conjunction tables, so the active-conjunctions and
intel-analysis panels colour their rows from a single source of truth.

## Panel Display Helpers

Presentation logic that used to live inline in the HUD panels is factored into small pure
helpers so it can be unit-tested and reused:

| Helper | Module | Returns |
| --- | --- | --- |
| `formatCmeArrival` | `cmeDisplay.ts` | The CME card's arrival status line (miss, arrived, or countdown) |
| `cmePrimaryImpacts` | `cmeDisplay.ts` | The escalating primary-impact list for an impacting CME |
| `countStormExposedAssets` | `stormExposure.ts` | LEO / GEO / debris tallies for the storm at-risk panel |
| `kpSparklineColor` | `spaceWeatherScales.ts` | Traffic-light colour for a single Kp sample on a sparkline |

`cmePrimaryImpacts` adds power-grid stress at predicted Kp 7 and satellite-charging risk at Kp 8,
and `getStormAssetRiskCounts` treats its categories as non-exclusive so an object can be counted as
both LEO and debris.

`classifyConjunctionFleetSeverity` collapses a whole fleet of conjunctions into a single
`critical | warning | elevated | clear` severity — `critical` when any conjunction is
individually critical (see `isCriticalConjunction`), `warning` when any remaining conjunction is
actionable by probability, `elevated` when conjunctions are tracked but none reach those tiers,
and `clear` for an empty fleet. The ops warning badge derives its colour from this severity via
`conjunctionFleetSeverityColor` in `frontend/src/utils/colors.ts`, so the escalation logic lives
in one place instead of being re-derived inline.

The remaining conjunction presentation helpers are shared the same way: `conjunctionRowTextClass`
(`colors.ts`) returns the Tailwind text-colour class used to shade each row of the active
conjunctions table by risk level, and `formatConjunctionWarningLabel` (`format.ts`) builds the
pluralised badge label (for example `1 ACTIVE CONJUNCTION WARNING` versus
`3 ACTIVE CONJUNCTION WARNINGS`).

## Storm Impact Panel Helpers

The Storm Impact panel derives its at-risk asset tally and its Kp-history sparkline from two pure
utility modules rather than inline component logic, so both are unit-tested independently of React.

`frontend/src/utils/stormExposure.ts` counts, in a single pass over a `Satellite[]`, how many
objects fall into each geomagnetic-storm exposure bucket. The buckets overlap by design — one
object can land in more than one — because each reflects a hazard operators track separately:

| Bucket | Criterion | Hazard |
| --- | --- | --- |
| `leoDrag` | Altitude below 2000 km | Increased atmospheric drag |
| `geoCharging` | Altitude above 35000 km | Surface charging near GEO |
| `debris` | Owner is `DEBRIS` | Accelerated orbital decay |

The thresholds live in the exported `STORM_EXPOSURE_THRESHOLDS` constant, and objects exactly on a
boundary are excluded (the comparisons are strict).

`frontend/src/utils/sparkline.ts` turns a numeric series into SVG sparkline geometry. The SVG
y-axis grows downward, so the series minimum sits at the bottom edge and the maximum at the top;
values outside the configured `[min, max]` range are clamped into the drawing area:

| Helper | Returns |
| --- | --- |
| `sparklineY` | Vertical pixel position for a single value |
| `sparklinePoints` | Evenly spaced `{ x, y, value }` points across the width |
| `sparklinePath` | An SVG `path` `d` string linking the points |
| `buildSparkline` | Points and path in one pass |
| `sparklineThresholdY` | Vertical position of a horizontal reference line |

## Conjunction Statistics

Summary figures for the active conjunction feed come from the pure helpers in
`frontend/src/utils/conjunctionStats.ts`, which aggregate over a `ConjunctionWarning[]`:

| Helper | Returns |
| --- | --- |
| `countConjunctionsByRisk` | Object counts keyed by derived risk tier |
| `countActionableConjunctions` | Number of `warning`/`critical` conjunctions |
| `closestApproach` | The smallest-miss-distance conjunction (or `null`) |
| `soonestTca` | The earliest-TCA conjunction (or `null`) |
| `highestProbabilityConjunction` | The most probable conjunction (or `null`) |
| `averageMissDistanceKm` | Mean miss distance in kilometres |
| `summarizeConjunctions` | All of the above bundled into one `ConjunctionSummary` |

Risk tiers reuse `classifyConjunctionRisk` / `isActionableConjunctionRisk` from
`conjunctionRisk.ts`, so a panel header derived from these helpers stays consistent with the
per-row colours in the conjunction panels. Extremes return `null` and averages return 0 for an
empty feed, so every figure is safe to render without a guard.

## Historical Event Statistics

Summary and query figures for the historical-events feed come from the pure helpers in
`frontend/src/utils/historicalEventStats.ts`, which aggregate over a `HistoricalEvent[]`:

| Helper | Returns |
| --- | --- |
| `countByEventType` | Event counts keyed by category (`solar_storm` / `conjunction` / `satellite_loss`) |
| `sortByDate` | A date-ordered copy (oldest-first by default, `"desc"` for newest-first) |
| `filterByEventType` | Events of a single category, in input order |
| `eventsInDateRange` | Events whose date falls within an inclusive `[start, end]` window |
| `strongestGeomagneticEvent` | The highest-`kpIndex` event (or `null`) |
| `earliestEvent` / `mostRecentEvent` | The oldest / newest event by date (or `null`) |
| `summarizeHistoricalEvents` | All of the above bundled into one `HistoricalEventSummary` |

Every helper leaves its input array unmutated. Extremes return `null` for an empty feed (and
`strongestGeomagneticEvent` also skips events with no `kpIndex`), and `countByEventType` always
reports every category, so a timeline header derived from these helpers renders a stable set of
rows without guards.

## CME Library Statistics

Summary figures for the modelled CME library come from the pure helpers in
`frontend/src/utils/cmeStats.ts`, which aggregate over a `MockCME[]`:

| Helper | Returns |
| --- | --- |
| `isImpactingCme` | Whether a CME reaches Earth (direct hit or glancing blow) |
| `countImpactingCmes` | Number of Earth-directed ejections, excluding clean misses |
| `isPendingCme` | Whether a CME is inbound and not yet arrived |
| `nextArrival` | The soonest inbound CME (or `null`) |
| `fastestCme` | The highest-speed ejection (or `null`) |
| `peakPredictedKp` | Highest predicted Kp across the feed |
| `averageConfidence` | Mean forecast confidence as a percentage |
| `summarizeCmeLibrary` | All of the above bundled into one `CmeLibrarySummary` |

Clean misses (`impactStatus` of `NO IMPACT — MISS`) are excluded from the impact and arrival
figures but still counted in `total` and considered for `fastestCme`, since speed is a physical
property of the ejection. Extremes return `null` and numeric aggregates return 0 for an empty
feed, so a HUD or panel header can render every figure without a guard.

## Conjunction Lead Time

Where `conjunctionStats.ts` groups the feed by *severity*, the pure helpers in
`frontend/src/utils/conjunctionLeadTime.ts` group it by *lead time* — how soon each
conjunction's time of closest approach (TCA) is, relative to a supplied `now`:

| Helper | Returns |
| --- | --- |
| `leadTimeMinutes` | Signed minutes from `now` to a TCA (negative once passed) |
| `classifyConjunctionLeadTime` | The `passed`/`imminent`/`soon`/`upcoming`/`later` bucket |
| `countConjunctionsByLeadTime` | Object counts keyed by lead-time bucket |
| `conjunctionsWithinMinutes` | The conjunctions whose TCA falls in the next N minutes |
| `nextLeadTimeMinutes` | Lead time to the soonest upcoming conjunction (or `null`) |
| `summarizeConjunctionLeadTime` | All of the above bundled into one `ConjunctionLeadTimeSummary` |

The window boundaries live in `CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES` (≤ 1 hour is
`imminent`, ≤ 6 hours `soon`, ≤ 24 hours `upcoming`), and `CONJUNCTION_LEAD_TIME_BUCKETS`
lists the tiers most-urgent-first for stable rendering. Every bucket is always present in
the counts and an all-passed or empty feed yields a `null` next lead time, so a timeline or
HUD header can render from these helpers without a guard.

## Aurora Visibility

The `auroraKp` reading only says *how strong* the aurora is; the pure helpers in
`frontend/src/utils/auroraVisibility.ts` turn that into *where* it can be seen. As
geomagnetic activity rises the auroral oval expands toward the equator, so a higher Kp
lets lower latitudes catch the show. The module follows NOAA SWPC's approximate
Kp-to-viewing-latitude guidance:

| Helper | Returns |
| --- | --- |
| `auroraBoundaryLatitude` | Overhead oval edge (geomagnetic latitude) for a Kp, interpolated |
| `auroraVisibilityMargin` | Signed degrees between an observer and that boundary |
| `classifyAuroraChance` | The `overhead`/`horizon`/`none` visibility tier |
| `minimumKpForOverhead` | Smallest Kp that puts the aurora overhead at a latitude (or `null`) |
| `summarizeAuroraVisibility` | All of the above bundled into one `AuroraVisibilitySummary` |

`AURORA_BOUNDARY_LATITUDES_BY_KP` holds the reference boundary for each integer Kp 0–9, and
`AURORA_HORIZON_ALLOWANCE_DEG` models how far equatorward of that edge a bright aurora can
still be glimpsed low on the poleward horizon. Observer latitude is compared by magnitude, so
the helpers work for either hemisphere, and non-finite inputs fall back to a safe result
(`none`/`null`) rather than throwing.

## Moonlight

Knowing the aurora reaches your latitude still leaves out a decisive factor: a bright sky
washes out faint aurora, and the Moon is the dominant natural source of that glare on a clear
night. The pure helpers in `frontend/src/utils/moonlight.ts` turn a date into the Moon's phase
and how much its light is likely to interfere, tracking the synodic (new-Moon-to-new-Moon)
cycle from a known new-Moon epoch:

| Helper | Returns |
| --- | --- |
| `moonAgeDays` | Days since the most recent new Moon, in `[0, 29.53)` |
| `moonPhaseFraction` | Position in the synodic cycle, `0` (new) → `0.5` (full) → `1` |
| `moonIlluminatedFraction` | Fraction of the disk sunlit, `0` (new) to `1` (full) |
| `moonPhaseName` | The named phase (`New Moon`, `Waxing Crescent`, … `Waning Crescent`) |
| `classifyMoonlight` | The `dark`/`moderate`/`bright` interference tier for an illuminated fraction |
| `summarizeMoonlight` | All of the above bundled into one `MoonlightSummary` |

`MOONLIGHT_DARK_MAX_ILLUMINATION` and `MOONLIGHT_BRIGHT_MIN_ILLUMINATION` set the tier
boundaries, and `MOONLIGHT_LEVEL_LABELS` gives each tier its observer-facing copy. The phase
model ignores libration and orbital-eccentricity effects that shift each phase by a few hours —
well within the precision needed to plan a night out — and invalid dates fall back to a safe
result (`NaN`/`null`/`dark`) rather than throwing.

### Moonlight Interference

Being *above the horizon* is not the same as being *visible*: a bright Moon floods the sky
with scattered light that washes out faint aurora. The pure helpers in
`frontend/src/utils/auroraMoonlight.ts` turn the Moon's illuminated fraction (`0` at new Moon,
`1` at full) into a viewing outlook and fold it back into the aurora chance:

| Helper | Returns |
| --- | --- |
| `moonIlluminationFraction` | The reading normalised to `[0, 1]` (non-finite → new Moon) |
| `classifyMoonlightInterference` | The `dark`/`dim`/`bright`/`washed-out` interference tier |
| `moonlightSeverity` | A perceptual sky-glow weight (illuminated fraction squared) |
| `adjustAuroraChanceForMoonlight` | Demotes a faint `horizon` glow to `none` under a bright Moon |
| `summarizeMoonlight` | All of the above bundled into one `MoonlightSummary` |

`MOONLIGHT_INTERFERENCE_THRESHOLDS` holds the illuminated-fraction cut points between tiers and
`MOONLIGHT_INTERFERENCE_LABELS` supplies panel copy. The adjustment keeps the physical
asymmetry that vivid `overhead` aurora survive any Moon while a subtle horizon glow does not, so
the HUD can warn "great storm, but the Moon will drown it out" from a single tested source.

## Repo Layout

```text
Aurora_Space/
|- frontend/                 React + TypeScript + Cesium app
|- backend/
|  |- gateway/               Go WebSocket gateway
|  |- ingestion/
|  |  |- celestrak/          Go TLE ingestion service
|  |  |- noaa/               Go space weather ingestion service
|  |  `- spacetrack/         Go conjunction ingestion service
|  |- engine-rust/           Primary Rust propagation engine
|  |- engine/                Legacy Go propagation engine
|  |- shared/                Shared Go Kafka/types helpers
|  |- bin/                   Built local binaries
|  `- .env.example           Backend env template
`- infra/
   |- docker-compose.yml     Kafka, Zookeeper, Prometheus, Grafana
   `- prometheus/            Prometheus scrape config
```

## Start everything in one terminal

Install **Node.js 22.12+**, **Go 1.21+**, and **Docker Desktop**. From the repository root:

```bash
npm start
```

Open **http://localhost:5173**. The launcher installs frontend dependencies if needed,
starts Docker Desktop on macOS, waits for Kafka, builds the Go services, starts the
orbital engine and ingestion feeds, and connects the frontend automatically. All logs
appear in the same terminal. **Ctrl+C stops the services and containers started by
that session**; containers that were already running are left running.

Grafana and Prometheus use ports 3001 and 9090 when available, and the next available
port if another application is using them. The launcher prints their actual URLs.
Grafana's local login is `admin / aurora`. Infrastructure ports bind to localhost.

```bash
npm run demo                # 3D preview with sample data; only Node.js required
npm run status              # View the active session and its URLs
npm stop                    # Stop the session from another terminal
npm start -- --engine=rust   # Optional Rust engine; requires Rust, CMake and a C/C++ compiler
```

`make start`, `make run`, and `./aurora.sh` are aliases for the same launcher.
Per-service logs are saved to `.aurora/logs/`, and compiled Go binaries go into
`.aurora/bin/`. Running the launcher a second time reports the existing session.
A service that exits unexpectedly causes the rest of that session to stop.
Set `AURORA_PORT` to change the frontend port; Vite won't silently switch ports.

### Optional configuration

No configuration files or accounts are required for the demo. The globe ships with
Natural Earth imagery. To enable detailed imagery, terrain and buildings, add:

```env
# frontend/.env
VITE_CESIUM_ION_TOKEN=your_real_cesium_ion_token
```

If ion services are unavailable, bundled Earth imagery remains available. For live
conjunction data, copy `backend/.env.example` to `backend/.env` and set
`SPACETRACK_USERNAME` and `SPACETRACK_PASSWORD`. These credentials stay in the backend.
The launcher safely parses the file without executing it as a shell script. Existing
shell environment variables take precedence. It sets the frontend WebSocket address
from `WS_PORT` automatically; demo mode explicitly disconnects the live backend.

The status badge distinguishes **DEMO**, **MIXED**, **LIVE**, **STALE** and **OFFLINE**
data. Public feeds may take time to arrive or be unavailable. Starting the stack does
not guarantee that all upstream providers are responding.

### Explore the 3D view

- **View / V** opens graphics quality, scene layers and camera destinations.
- **Earth**, **Night edge** and **North pole** frame different perspectives; **H** returns home.
- Select a satellite in the globe or search, then **Follow / F** to keep it in frame.
- Enable **Selected satellite footprint** for its idealized geometric horizon coverage.
- **Immerse / 0** hides the dashboard. The visible **Exit immersive** button brings it back.
- Drag to orbit, scroll to zoom and right-drag to tilt. Slow camera rotation is opt-in.
- **Smooth**, **Balanced** and **Cinema** trade rendering cost for detail and bloom.
  Settings are remembered between visits; reduced-motion preferences disable automatic rotation.

Satellite positions and selected orbit paths use **SGP4 with the actual TLE**
carried by the backend. Paths cover one revolution (¼ past, ¾ future), with
Earth rotation applied at every sample; they are open trajectories rather than
invented closed circles. TLEs older than 14 days have no predicted path. The
selection card shows the element epoch. These are orbit estimates, not measured
telemetry or maneuver-aware collision predictions.

Catalog objects use spacecraft silhouettes; selecting one reveals a highlighted
3D spacecraft, station, rocket body or debris model. These original procedural
models are representative, with illustrative attitude and enlarged screen size.
The quality setting limits catalog markers to keep the globe readable; every
object remains searchable. Regenerate models with `node scripts/generate-spacecraft.mjs`.
Demo satellites remain explicitly simulated. Live conjunction connectors show
current positions and the provider's reported TCA, not a predicted collision point.

**Conjunctions:** Space-Track public CDMs are queried by report age (72 hours)
and upcoming TCA (next 7 days), never a fixed historical limit. Successive reports
for the same object pair within a 30-minute TCA window are merged, keeping the
newest. Expired events disappear automatically. Missing distance/probability is
excluded rather than fabricated as zero. The UI shows report issue and fetch
stamps; an empty feed is not an all-clear. Live mode never fills conjunctions
with sample alerts. Bulk fetches are cached across restarts for eight hours,
following [Space-Track's API guidelines](https://www.space-track.org/documentation).

### Free public demo

**[Open the public demo](https://sripadsirik.github.io/Aurora_Space/)** with no
account or installation. The GitHub Pages workflow publishes `frontend/dist`
when frontend changes reach `main`. Pages hosts the demo frontend; the
Go/Rust/Kafka backend still needs its own host. To use live feeds locally, follow
[Run with live public data](#run-with-live-public-data).
A repository secret named `VITE_CESIUM_ION_TOKEN` is optional. Use a token restricted
to the app's assets and deployment URL because frontend tokens are public.

## Frontend Tests

The frontend uses [Vitest](https://vitest.dev/) for unit tests, currently covering the
pure utility modules (`format`, `env`, `colors`, `orbit`, `orbitSummary`, `catalogStats`,
`catalogFilters`, `coverageFootprint`, `eclipse`, `helio`, `spaceWeatherScales`, `conjunctionRisk`,
`conjunctionStats`, `historicalEventStats`, `stormExposure`, `sparkline`, `cmeDisplay`, `cmeStats`,
`conjunctionLeadTime`, `auroraVisibility`, `moonlight`, `solarWindPressure`), the Zustand store, and the mock datasets under `src/data/mock/`
(satellite catalog, conjunctions, CME library, historical events, and the space weather
snapshot).

```powershell
cd frontend
npm install
npm test          # run once
npm run test:watch  # re-run on change
```

Tests live alongside the code they exercise in `__tests__/` directories and run in a
Node environment with Cesium available through `vite-plugin-cesium`.

## Backend Services

| Service | Path | Runtime | Default Port |
| --- | --- | --- | --- |
| Gateway | `backend/gateway/` | Go | `8080` WebSocket, `2112` metrics |
| CelesTrak ingestion | `backend/ingestion/celestrak/` | Go | `2115` metrics |
| NOAA ingestion | `backend/ingestion/noaa/` | Go | `2113` metrics |
| Space-Track ingestion | `backend/ingestion/spacetrack/` | Go | `2116` metrics |
| Rust engine | `backend/engine-rust/` | Rust | `2117` metrics |
| Go engine | `backend/engine/` | Go | `2114` metrics |

## Kafka Topics

| Topic | Producer | Consumer |
| --- | --- | --- |
| `aurora.satellites.tle` | CelesTrak ingestion | Rust engine / Go engine |
| `aurora.satellites.positions` | Rust engine / Go engine | Gateway |
| `aurora.conjunctions.raw` | Space-Track ingestion | internal processing |
| `aurora.conjunctions.alerts` | Space-Track ingestion | Gateway |
| `aurora.spaceweather.raw` | NOAA ingestion | internal processing |
| `aurora.spaceweather.processed` | NOAA ingestion | Gateway |

## Useful URLs

- Frontend: `http://localhost:5173`
- WebSocket: `ws://localhost:8080/ws`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

## Current Notes

- The one-command launcher uses the Go engine by default; Rust is selectable.
- Optional Rust builds require a host C/C++ toolchain and CMake.
- `backend/bin/` holds local binaries and should stay local-only.

## License

MIT

## Signed Interplanetary Electric Field

How strongly the solar wind couples to the magnetosphere comes from the pure helpers in
`frontend/src/utils/interplanetaryElectricField.ts`, using the bulk speed and IMF Bz the
space-weather feeds already report:

| Helper | Returns |
| --- | --- |
| `interplanetaryElectricField` | Signed dawn-dusk field in mV/m (`Ey = -v · Bz`; positive when the IMF is southward) |
| `geoeffectiveElectricField` | Half-wave rectified field — only a southward IMF couples, so a northward interval reads as `0` |
| `electricFieldLevel` | Qualitative band (`quiet` / `moderate` / `strong` / `extreme`) keyed off the geoeffective field |
| `couplingLabel` | Short status label (`WEAK` / `MODERATE` / `STRONG` / `EXTREME COUPLING`) for a band |
| `electricFieldProfile` | All of the above bundled into one `ElectricFieldProfile` for a `SpaceWeather` snapshot |

The dawn-dusk motional field is the classic measure of solar-wind/magnetosphere coupling: a
southward IMF reconnects and imposes a cross-tail electric field that drives convection, the ring
current, and the auroral electrojets, while a northward field leaves the magnetosphere closed and
contributes no forcing. `formatSignedElectricField` in `frontend/src/utils/format.ts` renders the field
(`1.60 mV/m`, keeping the sign) for display, and the heliosphere overlay surfaces both a coupling
status row and the coupling field in its L1 DSCOVR panel, highlighting it when the IMF turns
southward.

The alternative merging-field bands (`quiet`, `moderate`, `strong`, `extreme`) are available in `frontend/src/utils/solarWindMerging.ts`; the existing geoeffective coupling bands remain in `solarWindCoupling.ts`.

## Dawn-Dusk Coupling Bands

How hard the solar wind couples into the magnetosphere comes from the pure helpers in
`frontend/src/utils/dawnDuskCoupling.ts`, combining the bulk speed and the interplanetary Bz the
same feeds report into the dawn-dusk (merging) electric field:

| Helper | Returns |
| --- | --- |
| `dawnDuskElectricField` | Total motional field in mV/m (`E = k · V · B`) |
| `geoeffectiveElectricField` | The southward-only part that actually drives dayside reconnection (0 when Bz points northward) |
| `couplingLevel` | Qualitative band (`quiet` / `elevated` / `high` / `extreme`) |
| `solarWindCouplingProfile` | All of the above bundled into one `SolarWindCouplingProfile` for a `SpaceWeather` snapshot |

Only a southward Bz reconnects efficiently with Earth's northward dayside field, so a northward
field couples weakly no matter how fast the wind. The bands are anchored on the Burton et al.
(1975) ring-current injection threshold (~0.5 mV/m), below which the ring current decays faster
than the wind can feed it. `formatElectricFieldMvM` in `frontend/src/utils/format.ts` renders the
field (`5.58 mV/m`) for display, and the heliosphere overlay's L1 DSCOVR panel surfaces the
geoeffective field, colour-coded by coupling band.

## Live globe, object layers and inspectors

Run `npm start`. The upper-left explorer opens **Satellites**, **Aircraft**,
**Rockets**, or **Earth** in one inspector at a time. **Layers** independently
shows/hides satellites, aircraft, and rockets/launch sites. Each row's **Only**
button isolates it; **Show all layers** restores all three. Balanced satellite
coverage is the default to keep the Earth readable; Full catalog is available.

Objects use recognizable silhouettes at wide zoom and representative 3D meshes
up close, with bounded model counts. Click overlapping objects to choose from a
named list. Hover reveals names. Satellite details use the same rounded inspector
style as the catalog, with current SGP4 measurements, sources, and export controls.
Click the header's feed-status tag for provider names, data age and record counts.

**Aircraft** uses public adsb.lol observations in the area beneath the camera
(250 nautical miles), regional presets across several continents, or the worldwide
public military-tagged feed. Pan anywhere and select **Scan area beneath camera**.
This is receiver coverage, not every flight worldwide. Military aircraft that do
not broadcast publicly and missiles are not supplied. Callsign route lookups from
adsbdb are listed departure/destination metadata, not confirmed routes or predicted
landings. Unknown routes stay unknown.

Aircraft move at render cadence using a constant-speed/heading estimate bounded
to 30 seconds, with a two-second blend for small observation corrections. Old
tracks freeze after 30 seconds and disappear after 90. Selected trails join actual
observations recorded during this session. Geometric altitude is preferred;
barometric fallback is labeled. The camera uses Cesium's entity tracking utility
with an Earth-aligned frame. Orbit and wheel zoom remain available while following;
Home releases the camera. Satellite follow also stays engaged through zoom buttons.

**Rockets** lists up to 30 recent/upcoming Launch Library 2 missions starting 24
hours before now. Published status, time precision, launch window, site and webcast
are preserved. **Follow launch** watches one mission at a time while the page is
open, starting at the same low, close pad angle as the preview. It watches the
provider's countdown/status and leaves manual orbit/zoom available. It does not
start a synthetic ascent at the scheduled launch time. The feed has no live rocket
ascent/descent coordinates, verified flight path or recovery location.

**Preview simulated liftoff** explicitly starts a generic 180-second eastward
ascent with a 3D rocket, exhaust and illustrative trail. Pause, restart, scrub,
change speed or detach the camera. The persistent banner identifies a simulation;
it is not a replay or live telemetry. Terrain is resolved before the preview starts.
The model, attitude and profile are representative rather than mission-specific.

**Earth** searches streets/cities through OpenStreetMap Nominatim or navigates
explicit `latitude, longitude` coordinates offline. **Street map** adds detailed
OpenStreetMap road tiles; **Satellite imagery** restores the existing base imagery.
Tiles load only for the interactive view, without download/prefetch features.
The gateway caches searches,
identifies the app and limits Nominatim to one outbound request per second;
there is no autocomplete. Imagery/terrain/buildings depend on Cesium coverage and
the configured ion token. This is overhead navigation, not street photography.
Search attribution: [OpenStreetMap](https://www.openstreetmap.org/copyright).

**Earth → Streets & cameras** connects IDOT / Travel Midwest, Lake County PASSAGE,
Caltrans, TfL, Fintraffic, Transport for NSW and Singapore LTA. Pick a camera on
the globe or in the list. **Show more cameras** exposes every matching view;
directional views at the same intersection can share a map marker. Illinois
shortcuts include Deerfield, Aurora, Naperville, Eola Road, Wacker and Willis Tower.

**Live video only** filters for published streams. FOX 32's official Willis Tower
and Chicago River players provide scenic live views, and Caltrans HLS streams
play where supplied and available. Cameras without video remain explicitly labeled
**Snapshot**. Failed direct streams fall back to the provider image; embedded
players have reload and provider-page links. Snapshots refresh each minute at the
provider's own capture cadence, with supplied capture times and stale/error status.
Only published provider media is accepted. New York Street and McCoy Drive have
no feeds in the catalogs checked; their shortcuts explain the coverage gap.
See [camera coverage and verification](docs/camera-coverage.md).

The gateway shares 10-second aircraft, five-minute launch and camera-catalog
caches across viewers (one minute for Singapore; five minutes for other cameras).
Failed providers retain original timestamps and back off.
Large satellite snapshots use bounded WebSocket chunks with HTTP recovery. Live
mode starts with an empty satellite catalog until real data arrives; sample
satellites remain confined to demo mode. Data attribution: adsb.lol (ODbL), adsbdb,
The Space Devs, OpenStreetMap and LTA / data.gov.sg.

Validation commands:

- `npm --prefix frontend test` — feed, motion, tracking and application logic.
- `npm --prefix frontend run build` — TypeScript and production bundle.
- `npm --prefix frontend run test:e2e:aerospace` — deterministic aircraft/launch workflow.
- `npm --prefix frontend run test:e2e` — Mission Lab and Earth/inspector UI workflows.
- `cd backend && go test -race ./...` — gateway, provider cache and backend tests.
- `npm run test:launcher` — stack supervision and port handling.

For a real-provider smoke check after starting the stack, run
`node frontend/scripts/verify-live-aerospace.mjs`. It saves timestamped observations
and screenshots under `docs/generated/aerospace/`; existing files in that directory
are historical evidence, not proof that the latest UI changes were browser-tested.

### Feed-status hover and observed rocket input

Hover/focus the header's status tag for the compact source/age/count table,
with the satellite catalog total first. Click pins it on touch devices. Cached
snapshot deliveries preserve their source times, so a connected socket cannot
make stale positions/weather appear current. Provider 429 responses preserve the
last good data and honor `Retry-After`; error details remain visible.

The optional observed-position bridge can drive a watched rocket's ascent and
descent from mission-matched WGS84 samples. It is **not connected to a verified
provider by default**. Setup, schema, limits and data provenance are documented in
[Observed rocket positions](docs/rocket-telemetry.md). Simulation remains explicit.
