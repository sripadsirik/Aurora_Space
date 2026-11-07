# Worldwide aircraft and public camera coverage

Open **Aircraft → Worldwide** for the complete set of recent, located airborne
observations returned by OpenSky. It is the default aircraft feed. The gateway
shares a one-minute cache between viewers, preserves source observation times,
and respects OpenSky's quota-reset response. Coordinates without a recent
observation are excluded. Positions are estimated for at most 30 seconds and
hidden after 90 seconds without a fresh observation. The full catalog stays in
state; the renderer creates aircraft only in the visible area, plus the selected
aircraft. Regional adsb.lol queries and public military-tagged data remain in the
coverage selector.

This is receiver-network coverage, not every aircraft on Earth. OpenSky's public
anonymous quota is 400 credits/day and a worldwide request costs four credits;
continuous minute updates can exhaust the allowance after about 100 requests.
When exhausted the gateway observes `X-Rate-Limit-Retry-After-Seconds` and shows
the outage instead of presenting stale coordinates as live. No key is bundled.
[OpenSky documentation](https://openskynetwork.github.io/opensky-api/rest.html).

Open **Earth → All connected networks** for public camera catalogs. Filters and
place shortcuts affect both map markers and the list. The list shows up to 150
matches, while all matching locations are plotted. Search uses street names
published by the providers. Selected markers display the street name on the map.

| Network | Connected source |
| --- | --- |
| Illinois and Midwest | IDOT's public Travel Midwest catalog; four ordered pages of 1,000 records, with an explicit warning if additional pages exist |
| California | Caltrans CWWP2, districts 1–12 |
| London | TfL JamCams, available cameras only |
| Finland | Fintraffic Digitraffic, active weather-camera presets |
| New South Wales | Transport for NSW public road cameras |
| Singapore | LTA / data.gov.sg traffic images |

Sources are fixed on the server. Image URLs are restricted to each publisher's
known image hosts. A failed network does not discard other networks; cached data
is retained with an error indicator. Metadata refresh is not image capture time:
unknown capture timestamps remain unknown. Illinois's reported image age and
staleness flags are displayed separately. Images refresh every minute in the
selected preview, but their actual cadence is controlled by the publisher.

Illinois shortcuts cover Naperville, Aurora, Chicago, nearby roads at UIC and
UIUC, Deerfield, and **Milwaukee Ave (IL 21) & Inverrary Ln**. The latter has
published north and south views at 42.16080856, -87.91899109. Provider labels
(`IL 21 at Inverrary`) are preserved in the detail card. These are road-condition
snapshots, not private or enforcement-camera access.

Direct links:

- `http://localhost:5173/?cameras=all`
- `http://localhost:5173/?cameras=illinois&area=inverrary`
- `http://localhost:5173/?cameras=illinois&area=deerfield`
- Substitute `naperville`, `aurora`, `chicago`, `uic`, or `uiuc` for other shortcuts.

UIC's [official Falcon Cam page](https://today.uic.edu/uic-falconcam/) is linked
separately. UIUC's [campus-camera page](https://illinois.edu/community/campus-cams/)
reported its cameras unavailable when checked on November 5, 2026. Campus camera
availability is not inferred from nearby road coverage.

Public camera coverage remains partial worldwide. Rocket ascent/descent still
requires a verified observed-position provider; see [rocket telemetry](rocket-telemetry.md).

Validation: `npm test`, `npm --prefix frontend run build`, `go test ./gateway`
(from `backend`), and `npm --prefix frontend run test:e2e:aerospace`.
