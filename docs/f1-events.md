# Formula 1 Events

Open **Events ↗** in Aurora's Earth navigation, or use `/?events=1`.

## Calendar and weekends

The Events workspace fetches the selected season from Jolpica. The year selector
shows the previous, current, and next calendar years. **Upcoming** filters to
remaining events; **Full season** includes completed races. Search by race, country,
or city. Every published practice, sprint qualifying, sprint, qualifying, and race
session appears in chronological order. Times default to the browser's timezone;
use the UTC switch to compare with an official timetable.

A next-year calendar with no published races stays empty, with a refresh action.
It never copies last year's dates into a new season. The 2025 and 2026 calendars
have bundled snapshots (retrieved November 20, 2026) as a fallback when the calendar
provider fails. A saved-calendar label identifies that fallback. Provider schedules
may change; refresh before relying on a session time.

## Historical replay

Historical OpenF1 sessions since 2023 are public. The current UI exposes the previous
calendar year as well as the current year, so choose **2025 → Full season → Las Vegas**
for a completed race. Select a weekend session, then **Watch real replay**.

The replay loads real position samples in bounded two-minute windows, continuing
through the session. Scrub the session timeline to load another window, then press
Play. Playback supports 0.5× through 8× speed. Select a driver in the timing tower or
click a car, then choose **Follow driver**. Earth, track, and overhead cameras are
available independently of telemetry.

The timing tower follows running order, gaps, laps, and tyre compounds where those
channels are available. Completed session results include practice best laps,
qualifying Q1/Q2/Q3 times, and race durations or finishing statuses. Driver speed,
throttle, brake, gear, RPM, weather, and race-control messages use the replay clock.
Unavailable channels display a dash rather than a generated value. Initial loading
can take tens of seconds because requests are queued to respect provider limits.

## Live sessions

Live OpenF1 access requires an OpenF1 subscription and a valid access token. Obtain
the token through [OpenF1](https://openf1.org/) and set it in the ignored
`backend/.env` file:

```dotenv
OPENF1_ACCESS_TOKEN=your_access_token
```

Run `npm start` after updating the token. The launcher loads `backend/.env` and
connects the browser to the gateway. The gateway sends the token only to OpenF1;
no secret is bundled into the frontend. Renew an expired token and restart the
gateway. `npm run demo` and the public static site can access public historical
sessions directly, but cannot use the server-side token for live data.

During a session, select it and choose **Watch live**. Positions and driver telemetry
refresh in bounded windows; timing, weather, and flags refresh separately. This is a
buffered polling feed, not a zero-delay broadcast. Network and provider latency add
to the playback delay. Stale, unavailable, and unauthorized feeds are identified.
Live credentials and a race in progress are required to validate authenticated live
operation; the historical replay path is independently testable at any time.

## 3D positioning and limits

The viewer uses Cesium's Earth, Esri satellite imagery, and geographic circuit
polylines from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits).
An original low-poly open-wheel GLB model is used for each car. Rebuild that model
with `python3 scripts/generate-f1-car.py` from the repository root.

OpenF1 position coordinates have an arbitrary local origin. Aurora fits that frame
to the circuit using a similarity transform with rotation, scale, translation, and
handedness search. It reports the fit residual and hides cars if a usable fit cannot
be found. The residual measures alignment to the circuit, not independently verified
GPS accuracy; symmetric layouts and partial laps can produce ambiguous fits. Layouts
may differ from the configuration used by a particular season. Missing layouts
still show the circuit's Earth location, with position rendering unavailable.

Cars interpolate between nearby position samples, stop extrapolating after two
seconds, and do not bridge gaps over 2.5 seconds. Heading is estimated from movement.
The source does not resolve exact lateral track placement. This is a sampled race
visualization, not a collision-accurate digital twin. Team colors are applied to the
original generic car; official team car designs and liveries are not included.

## Sources and validation

- [Jolpica API](https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md): calendars.
- [OpenF1 API documentation](https://openf1.org/docs/): session, results, location,
  telemetry, timing, tyres, flags, and weather. Independent fan data; follow the
  provider's access terms for public/commercial use.
- [Circuit geometry MIT license](../frontend/public/events/CIRCUITS-LICENSE.txt).
- `npm test`, `npm run build`, `npm run test:backend`, and
  `npm --prefix frontend run test:e2e -- events.spec.ts` cover the new data and UI paths.

A real 2025 Las Vegas replay was checked with provider data: all available drivers,
recorded positions, timing, speed/gear/throttle, and circuit registration. The
observed registration residual was approximately seven meters for the tested window;
this is a fit metric, not a claim of seven-meter absolute accuracy.
