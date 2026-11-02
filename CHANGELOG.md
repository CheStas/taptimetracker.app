# Changelog

## [0.7.0](https://github.com/CheStas/taptimetracker.app/releases/tag/v0.7.0) (2026-11-02)

First tagged release. It covers everything built so far; later entries list only what changed since the
previous release.

### Features

* **tracking:** tap an activity to switch to it, tap the active one to stop; today's total, per-activity totals and
  the current run; backdate a switch ("active since…", "stop all since…")
* **tracking:** switches shorter than a configurable minimum (default 1 min) go to the next or previous activity
* **sessions:** edit the sessions of any day from the activity popup or the Summary
* **summary:** Day, Week, Month or Custom period with a calendar picker, figure tiles, timeline or per-day rows,
  share per activity or per category, live while an activity runs
* **profiles:** separate workspaces with their own activities, days, summary, settings and backup file
* **groups:** sort activities into groups and switch groups on or off for the main screen
* **categories:** dimensions such as Focus or Company; the Summary can group time by any of them
* **themes:** 7 built-in themes, fixed or following system light/dark; import VS Code, base16, Alacritty and iTerm
  themes; 16 color slots per theme so activities recolor with the theme
* **main screen:** Tiles, Rows or Circles layout, size by today's usage, unused activities in a strip, optional
  timeline, group totals and footer; phone layout with a More menu
* **data:** stored locally in IndexedDB; export/import JSON per profile, optional auto-export on day close
* **device:** keeps the screen on (setting), full screen and kiosk modes via `scripts/start.sh`, single-file HTML build
* **site:** landing, privacy and terms pages; app under `app/` (installable), sandboxed demo at `app/?demo`;
  similar-apps page; SEO metadata and sitemap
* **site:** anonymous usage stats (Umami) with opt-out, feedback form
