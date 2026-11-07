# Public camera coverage

Checked November 5, 2026. Counts are observations of the providers' catalogs and
will change as cameras are added, removed or unavailable.

| Area | Verified coverage and behavior |
| --- | --- |
| Deerfield / Lake County | The IDOT mirror contains 59 Deerfield-named directional views. The direct PASSAGE catalog adds 44 image URLs absent from that mirror across Lake County, including four directions at IL 43 / Lake Cook. Duplicate images are merged, preserving IDOT image-age metadata when available. |
| Eola Road | 20 published directional views at Bilter-Ferry, Diehl, Molitor-Metea, Aurora-Indian Trail and Liberty. The Eola shortcut filters by road name and proximity. |
| Aurora / Naperville | Existing public road cameras remain available through city shortcuts. Lists can load all matches instead of stopping at 150. |
| New York Street / McCoy Drive | No named feeds found in the connected public catalogs. Shortcuts explain this gap without substituting nearby markers for cameras on these roads. This does not imply that physical cameras do not exist. |
| Willis Tower | FOX 32's official live scenic player, located at Willis Tower on South Wacker Drive. The stream played at 1280px width during verification, but its view was obscured. |
| Chicago River / Wacker area | FOX 32's official live scenic player; playback verified at 1280px width. The marker denotes the approximate viewing area, not a surveyed camera location or every Wacker intersection. |

## Sources

- [IDOT / Travel Midwest public camera layer](https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0): 3,789 directional records across the four fetched pages; the final page did not report truncation.
- [Lake County PASSAGE public catalog](https://www.lakecountypassage.com/rest/cctv): 490 camera locations with directional image filenames. Served through the gateway's fixed `/api/earth/cameras/illinois-passage` endpoint.
- [FOX 32 Chicago camera page](https://www.fox32chicago.com/weather-cameras): published WMVision embed players for Willis Tower and the Chicago River. Embedding preserves the provider's handling of expiring video credentials; no signed stream URLs are stored.
- [Caltrans District 4 catalog](https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json): publishes `streamingVideoURL` alongside snapshots. HLS availability varies; the sampled I-580 / SR-24 endpoint returned 404 during verification.
- [Travel Midwest camera FAQ](https://travelmidwest.com/Help/FAQs): camera data is supplied by individual agencies; the site does not own or control their feeds.

## Playback and validation

Caltrans HLS uses native browser playback when supported, with lazy-loaded hls.js
otherwise. Switching cameras, selecting a snapshot or closing the workspace
unmounts the player and stops its media. Fatal HLS errors show a snapshot fallback.
Snapshots are never presented as continuous video. Camera entry update times are
never treated as image capture times.

Validated with the Earth parser/filter tests (10 tests), gateway tests, a production
build, and two Playwright browser scenarios covering selection, Chicago embeds,
live-video filtering, empty road coverage, pagination past 150 entries, Eola
filtering, and failed-video snapshot fallback. The two Chicago provider players
were also checked in a real Chromium browser: both reached readyState 4 with
advancing playback time and no media error.
