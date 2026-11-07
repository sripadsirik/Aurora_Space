# Observed rocket positions

Aurora separates launch schedules, simulated previews, and observed positions.
Launch Library 2 supplies schedule/status records; those do not contain live
rocket latitude/longitude/altitude. A countdown cannot establish liftoff.

## Current connection status

No observed rocket-position provider is bundled or configured by default.
Following a mission watches its launch site/status and tries the optional position
input. An unavailable input stays unavailable: it never triggers the simulation.
The application does not claim worldwide live rocket, satellite onboard, or
military/missile telemetry.

The public [Launch Dashboard API](https://github.com/shahar603/Launch-Dashboard-API)
documents webcast/OCR telemetry for SpaceX, Rocket Lab and Arianespace. Its examples
include reconstructed geographic coordinates. These are not an automatic source
of measured positions for other operators, and its endpoint availability was not
verified in this session. Such reconstructed coordinates must not be relabeled as
observed positions. [Provider description](https://thespacedevs.com/networkpartners).

## Connect a verified position provider

Set `ROCKET_TELEMETRY_URL` in `backend/.env` to an operator-controlled HTTP(S)
endpoint implementing the contract below, then restart the gateway. This is a
provider integration point, not a supplied telemetry service. The gateway adds
`missionId=<Launch Library 2 UUID>` to the query and shares a one-second cache.
Client requests cannot choose a different upstream host. Do not place credentials
in frontend configuration. The current bridge expects an endpoint reachable by
the gateway without a separate bearer authentication handshake.

The provider returns a JSON object directly (the gateway adds its own envelope):

```json
{
  "missionId": "the-exact-launch-library-2-id",
  "positionType": "observed",
  "source": "Verified position provider name",
  "positions": [
    {
      "vehicleId": "stage-1",
      "observedAt": "2026-11-05T16:01:00.000Z",
      "latitude": 28.5,
      "longitude": -80.5,
      "altitudeM": 12000,
      "headingDeg": 90,
      "tiltDeg": 20,
      "phase": "ascent"
    }
  ]
}
```

The values above illustrate the schema; they are not a real mission observation.
`observedAt` is an absolute UTC source timestamp, not T+seconds or retrieval time.
`altitudeM` is WGS84 ellipsoid altitude in metres. Coordinates are WGS84 degrees.
Heading is clockwise from north; optional tilt is degrees from local vertical.
When attitude fields are absent, the model uses an illustrative upright attitude.
A generic model does not establish actual vehicle dimensions or attitude.

Only the exact watched mission is accepted. Invalid coordinates, wrong missions,
missing source labels, reconstructed/simulated `positionType`, timestamps over
90 seconds old, and timestamps over five seconds ahead are rejected. At most 16
vehicle tracks and 900 samples per vehicle are kept, bounded to 15 minutes.

Choose **Follow launch** to consume the feed, then choose a stage/vehicle if more
than one is present. One mission is watched at a time. Valid observations drive
the 3D model and its recorded path in both ascent and descent. The camera keeps
manual orbit/zoom. Display interpolation uses a one-second buffer, holds at the
last observation, and does not extrapolate or bridge gaps over 15 seconds. The
live state expires after 15 seconds without fresh samples; models disappear after
90 seconds. A lost airborne track does not jump back to the launch pad.

## Validation

`rocketTelemetry.test.ts` validates identity, source times, coordinates, descent,
interpolation and vehicle limits. `liveRocket.test.ts` feeds deterministic test
observations through the fetch/normalization/model pipeline and verifies descent
and failure behavior. These tests are fixtures, not evidence of a live provider.
`rocket_telemetry_test.go` checks server configuration, fixed-host mission binding
and shared caching without opening network ports.
