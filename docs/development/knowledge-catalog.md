# Knowledge catalog corrections — 2026-10-06

Sources: [official maps](https://ff.garena.com/en/maps/), [weapons](https://ff.garena.com/en/weapons/), [characters](https://ff.garena.com/en/chars/). Public catalog snapshot collected on 2026-10-05.

- Map labels use the 64 featured points published for seven maps. Leaflet coordinates are converted into the same 1000 × 1000 coordinate system as each map image, including the original label anchor offset. The original bold font supports Cyrillic; label size and coordinates scale together with the map. Labels are Russian, without additional banners or branding.
- Existing landing-location IDs remain stable for saved results. The result-entry location catalog remains broader than the featured clickable points in the official atlas. Additional points must have verified coordinates before they are displayed on the map; never generate positions by list order.
- The official weapon list contains 80 entries (the initial page response contains only 12). All 80 are included locally with images, 11 category filters, translated feature tags and supplied numeric statistics. Descriptions are short original category summaries. Unspecified zero statistics are omitted rather than guessed.
- All 60 existing character entries use full-body artwork from their official detail pages, replacing cropped list thumbnails. Cards fit the entire image and place subtitles below it. Images remain lazily loaded from the official CDN, as before; catalog navigation and text stay on this site.
- No database migration or external write is required. To update the snapshot, verify public sources and commit catalog changes; the site does not crawl the source during normal page requests.

Validation: catalog integrity (unique 80 weapon IDs, all point/location mappings), all map tabs, font loading, all weapon filters, search and expandable statistics, desktop/mobile layout, and existing site verification.
