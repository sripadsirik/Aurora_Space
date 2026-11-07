# Engineering validation — Mission Lab update

The original 2026-10-24 catalog audit below is historical evidence, not a fresh
measurement of the revised OMM pipeline. Current numerical methods, supported input
contracts and operational limits are in [Mission Lab](mission-lab.md). Reproducible
results are in [generated evidence](generated/mission-validation.json) and the
[independent trajectory/Pc cross-check](generated/independent-dynamics.json).

The implementation now supports OMM in ingestion, Go/Rust propagation, the browser,
and catalog audits. The mission lab validates position/full-state covariance,
computes short-encounter Pc, propagates optional full uncertainty through simulated
burns, compares candidates and records/export/replays investigations. These changes
do not resolve observational accuracy, catalog completeness or operational review.

The 2026-10-26 live integration run captured **19,559 objects**, including **5,371
OMM records**. Of 19,441 eligible backend/JavaScript comparisons, none exceeded the
100 m software diagnostic threshold; the maximum discrepancy was 7.62 m. The audit
withheld 118 records and retains their failures in its raw local output. Reference
SATCAT coverage remains partial: 16,123 undecayed Earth-orbit entries were absent,
including 864 six-digit identities. That denominator does not imply those entries
have available public GP data. Some provider requests returned HTTP 403 or no valid
records; cached elements are not relabelled as fresh observations.

See the [live audit summary](generated/live-catalog-summary.json),
[provider responses](generated/live-provider-results.json) and
[real-feed capture screenshot](generated/demo/live-feed-capture.png).
The complete snapshot and per-object audit remain in `.aurora/audits/` locally.
The test stack shared Kafka topics with a pre-existing stack; these numbers are
integration evidence, not an isolated end-to-end throughput benchmark.

---

# Engineering validation — 2026-10-24

Aurora is a public-data review application. It is not yet a validated collision-avoidance decision system.

## Reproducible catalog check

Run `node frontend/scripts/audit-catalog.mjs snapshot.json satcat.csv report.json` from the repository root. The snapshot is `{capturedAt, satellites}` from the application's catalog feed. The report records source hashes, element epochs, identity checks, classification coverage, propagation failures, and per-object backend versus satellite.js discrepancies at the same UTC.

Local evidence: `.aurora/audits/catalog-before.json` and `.aurora/audits/catalog-after.json`. SATCAT source: https://celestrak.org/pub/satcat.csv; schema: https://celestrak.org/satcat/satcat-format.php.

The post-change snapshot contained 18,955 objects. 18,737 matched authoritative SATCAT metadata (15,965 payloads, 2,680 debris objects, 92 rocket bodies); 218 were unmatched. Unknown classifications remain explicit; name-based inference is labelled separately.

91 objects were ineligible for current display under the audit checks. Among 18,864 eligible objects compared at the same timestamp, the largest backend/JavaScript position discrepancy was 6.42 metres, and none exceeded the diagnostic 100-metre threshold. Agreement between two propagators is not proof of real-world position accuracy. Raw audit results retain excluded objects and failures, including the large discrepancy for a SATCAT-decayed object.

## Trajectory reference frames

The default selected trajectory is an SGP4 TEME orbital path, rotated as a whole to Earth's orientation at the current UTC. Earth-fixed mode transforms each sample at its own UTC. An inclined geosynchronous orbit can therefore appear as a figure-eight in Earth-fixed coordinates. These modes must not be interpreted interchangeably.

The displayed position uses its current UTC prediction. Trajectories span one revolution, 25% past and 75% future; they are not artificially closed. Exported trajectory samples retain Earth-fixed coordinates and timestamps. A regression uses BEIDOU-2 IGSO-1, NORAD 36828, to check that the current-time path sample agrees with its displayed position. Near-geosynchronous classification uses orbital period rather than an instantaneous altitude boundary.

## Remaining acceptance gaps

- Catalog coverage is partial: the SATCAT undecayed Earth-orbit denominator included 16,363 objects absent from this snapshot, including 1,105 six-digit IDs. SATCAT membership does not imply public orbital elements are available. Full OMM ingestion and availability accounting remain necessary.
- No radar, optical, or operator ephemeris residuals have been measured. No all-object claim of observational accuracy is supported.
- Public TLE propagation has no covariance or maneuver modelling. An absence of matching public conjunction reports is not a clearance.
- Imported conjunction reports and covariance-presence checks support review; they do not constitute validated probability-of-collision computation or maneuver design.
- Space-weather measurements are environmental context. Per-spacecraft vulnerability requires operator-provided properties and validated models.

A mission handoff requires independent propagation benchmarks, catalog coverage and freshness acceptance criteria, CDM/covariance validation, operational failure handling, and operator review of decision thresholds.
