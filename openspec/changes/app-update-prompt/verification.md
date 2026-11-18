# Production verification (task 3.2), 2026-11-18

A Playwright script opened a production lobby on the version current at the time. It reloaded once so the installed service worker controlled the page, as for a returning player, then set a marker on the page and kept the tab open. Every 75 seconds it simulated the player switching away and back, which is one of the moments the app checks for a new version.

| Time (UTC) | Server version | Page |
| --- | --- | --- |
| 19:44:47 | `93bbc56` | lobby open, bundle `index-Cwi-EbW1.js` |
| 19:47:27 | `a47949f` (docs-only deploy) | unchanged: no new app version, so nothing to install |
| 19:51:28 | `07c366e` (client change) | reloaded itself once (marker gone); bundle `index-CSz8zFc7.js`; no notice left |

Output: `RESULT reloadedItself=true … serverVersion=07c366e… noticeLeft=0`

The idle lobby picked up the deploy without the tab being closed. A deploy that only changes documentation does not prompt or reload anyone.
