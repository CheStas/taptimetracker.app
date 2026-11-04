# Similar tools

Web research from 2026-10-21 for tools with the same or a similar interaction model: tap an activity to start it,
tapping another switches to it, only one runs at a time, and past times can be corrected. The list is ordered **from
most to least similar** to this project. Descriptions come from each tool's own listing or docs, plus third-party
summaries. Nothing was installed or tested.

**Takeaway:** no tool found combines all of the following:
- a self-hostable or static web page
- a touchscreen / wall-display layout
- "active since…" backdating that takes the time away from other activities
- offline storage per device

The closest matches are native mobile apps (TickTappy, aTimeLogger, Simple Time Tracker). Pomodoro / focus-timer apps
(added 2026-11-03, see [below](#pomodoro-and-focus-timer-apps)) overlap on tagging time and per-tag totals, but they
track timed work sessions, not the whole day as one active activity.

| # | Tool | Platform / model | Why it is similar | Main differences |
|---|---|---|---|---|
| 1 | [TickTappy](https://apps.apple.com/app/ticktappy/id6757327485) | iPhone, iPad, Mac, Watch; free + premium (sync) | Colored tag buttons: tap to start, **tap again to stop**, starting another tag **stops the running one**. **Start a timer in the past** (e.g. 30 min ago), quick time adjustment after start/stop, editing past entries, archiving tags without losing history, day/week summaries. Offline, no account. | Apple only; not a web page; no wall-display mode |
| 2 | [aTimeLogger](https://apps.apple.com/app/id576718804) | iOS (App Store listing) | Starts and stops an activity with **one tap**; pause/resume; optional simultaneous activities; reports. | Native app; several activities can run at once (optional); not a kiosk layout |
| 3 | [Simple Time Tracker](https://f-droid.org/en/packages/com.razeeman.util.simpletimetracker) ([source](https://github.com/Razeeman/Android-SimpleTimeTracker)) | Android + Wear OS; open source (GPL-3.0) | Starts activities with **one click** from a grid of activity buttons; record history, statistics, backups, home-screen widgets; a record can be divided and its activity changed. | Android only; not a web app |
| 4 | [Takt – Time Tracking](https://apps.apple.com/app/id6758586452) | iOS | **One tap** to start, stop or **switch** activities; the start time of a running entry can be moved. | Apple only; segmented entries can't be adjusted after a while |
| 5 | [ATracker PRO](https://apple.co/32b8qMr) | iOS | Starts and stops task tracking with **one tap**; reports per task. | Native app; switching and pause behavior not described |
| 6 | [Timeular](https://timeular.com/) / [TimeFlip2](https://www.capterra.co.uk/software/1061612/timeflip2) | Physical 8- or 12-sided tracker die + app; subscription | Same "one active activity" idea as a **physical device**: flip the die to switch activity, turn it off or double-tap to stop. Forgotten time is fixed in a calendar-like editor. | Needs hardware; cloud account; no on-screen buttons ([comparison](https://www.timedoctor.com/blog/timeular-vs-timeflip/)) |
| 7 | [Clockify Kiosk](https://clockify.me/features/kiosk) | Web, on a shared device; free feature of Clockify | A **shared-device / kiosk** web page: people clock in and **switch projects or tasks** and breaks; reports in Clockify ([help](https://clockify.me/help/track-time-and-expenses/clock-in-and-out-via-kiosk)). | Built for teams (PIN/QR sign-in); cloud only; no per-activity button board |
| 8 | [TimeTagger](https://github.com/almarklein/timetagger) | Web app; open source (GPL-3.0), self-host or hosted | Web-based, with an **interactive timeline** for editing records; tags instead of projects; daily/weekly/monthly **targets**; reports (PDF/CSV); Pomodoro mode ([overview](https://www.linuxlinks.com/timetagger-web-based-time-tracking-solution/)). | Python server; not a big-button touch board; no tap-to-switch |
| 9 | [Timery](https://apps.apple.com/app/id1425368544) for [Toggl Track](https://toggl.com/track/) | iOS/Mac client for Toggl (cloud) | **Saved timers started with one click**; editing and splitting entries; in Toggl you drag a block to change its start or stop time ([guide](https://clockk.com/alt/does-toggl-have-a-timer)). | Cloud account; desktop/phone UI; free tier is limited |
| 10 | [MarsiaLi/tracker](https://github.com/MarsiaLi/tracker) | Static web page (vanilla JS, Bootstrap), localStorage mode | Closest **tech stack**: plain JS, browser storage, one card per activity with start/stop and an hours total. | No automatic switching, per-day totals view or backdating |
| 11 | [wk-timer](https://github.com/silas229/wk-timer) | Offline PWA (Next.js), IndexedDB | Similar **storage approach** (offline, IndexedDB, survives reloads). | A start/stop/lap stopwatch, not an activity board |
| 12 | [Kimai](https://www.kimai.org/), [solidtime](https://www.solidtime.io/), [Super Productivity](https://super-productivity.com/) | Open-source web/desktop trackers | General time tracking with projects/tasks, timers and reports; self-hostable or local-first ([comparison](https://super-productivity.com/blog/best-open-source-time-tracking-apps-2026/)). | Project/billing oriented; no one-tap activity board |
| 13 | [Chess.com Chess Clock](https://f-droid.org/packages/com.chess.clock/), [GNOME Chess Clock](https://apps.gnome.org/Chessclock/) | Android / Linux | The **chess-clock interaction** this app is modelled on: big buttons, one tap hands the clock to the other side. | Two players, counts down, no logging, totals or history |

## Pomodoro and focus-timer apps
Web research from 2026-11-03. Pomodoro apps are a related family: you pick a task or tag, run a timer (usually a
25-minute countdown, then a break), and the app reports focus time per task or tag. TimeTagger (#8) and Super
Productivity (#12) above also have a Pomodoro mode. As above, the list is ordered **from most to least similar**, and
descriptions come from store listings, vendor pages and third-party reviews; nothing was installed or tested.

**How they differ from this project in general:**
- They record **sessions**: time counts only while a timer runs. This project records the **whole day**, with one
  activity active (or idle) at any moment.
- The timer is usually a **fixed countdown** with breaks as a separate state. Here the clock counts up, and a break is
  just another activity, or idle.
- Correcting the past is mostly limited to editing the length of the session that just ended. There is no "active
  since…" that takes time away from other activities.
- Most are phone/desktop apps with cloud accounts. None has a touch-board or wall-display layout with one button per
  activity.

| # | Tool | Platform / model | Why it is similar | Main differences |
|---|---|---|---|---|
| P1 | [TickTick Focus](https://blog.ticktick.com/2020/05/06/brand-new-focus-experience-ticktick/) | Part of the TickTick task app (web, mobile, desktop); free + premium | A focus session is **attached to a task**. Besides the Pomo countdown there is a **stopwatch (count-up) mode**. The **duration can be edited** on the completion page if you forgot to stop the timer (6.4.10, [patch note](https://adaptiva.com/patch-library/1000005406_patch_for_ticktick)). Totals by day, week and month, plus most productive hours ([review](https://clickup.com/learn/?p=71010)). | A to-do app first; cloud account; one session at a time, not a day timeline; no button board |
| P2 | [Flow](https://apps.apple.com/app/id1423210932) (Yugen) | Mac menu bar + iOS; free + Pro | **Tags** sort sessions, with **color-coded per-tag statistics** and filtering by tag; session presets per tag; CSV/TXT export (tags included); Apple Calendar sync; full-screen breaks. | Apple only; countdown intervals; Pro needed for custom durations and export |
| P3 | [Forest](https://apps.apple.com/app/id866450515) | iOS, Android, browser extension; paid app + in-app purchases | **Tags** with notes per session, time distribution per tag (daily/weekly), and a timeline of past sessions. | Gamified (a tree grows; leaving the app kills it); countdown of 10–120 min; aims at blocking the phone, not logging the day |
| P4 | [Focus To-Do](https://apps.apple.com/app/id1258530160) | iOS, Android, Windows, Mac, Chrome extension; free + premium (sync) | Pomodoro timer plus task list, with reports of **time distribution per project** and a trend chart of completed tasks against focus time; offline mode is listed ([listing](https://alternativeto.net/software/focus-to-do-pomodoro-techniqueand-task/about)). | Task/project oriented; countdown sessions; manual entry not documented |
| P5 | [Pomofocus](https://pomofocus.io/) | Web page; free + premium | A **web** Pomodoro timer: tasks with estimated pomodoros, one-click task templates, focus-time reports. Premium adds **time per project**, yearly reports and **CSV export** ([listing](https://www.trustradius.com/products/pomofocus/details)). | Reports need an account (cloud); countdown sessions; not a touch board |
| P6 | Flowtime / Flowmodoro timers: [Flowtime Timer](https://chromewebstore.google.com/detail/jnbjellpampgpcliefjjaffaafcfmnoh) (Chrome), [flowmodor](https://www.github.com/flowmodor/flowmodor) (open source), [Flowmodoro](https://apps.apple.com/us/app/-/id6756621130) (iOS) | Browser extension, web, iPhone | The Pomodoro variant closest to this app's clock: the work timer **counts up** until you stop, and the break is earned from it (often work ÷ 5). The Chrome extension also tracks **time per task** ([technique](https://www.memtime.com/blog/how-to-make-the-flowtime-technique-work)). | Built around breaks; one task at a time with little history or editing |
| P7 | [Toggl Track Pomodoro](https://support.toggl.com/how-to-enable-the-pomodoro-timer) | Setting in the Toggl Track desktop app (Windows, macOS) | A full time tracker (see #9) where Pomodoro is only a **break reminder** on top of the running timer: work and break lengths, auto-start ([overview](https://toggl.com/features/pomodoro-timer)). | Cloud account; no long breaks ([note](https://github.com/kyleawayan/pomodoro)) |
| P8 | [focus-tracker](https://github.com/Georj01/focus-tracker) | React PWA, offline | Similar **stack and storage idea**: a browser app with a Pomodoro timer, tasks and local statistics that works offline. | A small project; Pomodoro sessions, no activity board or backdating |
| P9 | [Pomatez](https://itsfoss.com/pomatez/) | Desktop (Linux .deb/.rpm/AppImage/Snap, Windows, Mac); open source (MIT) | Runs on **Linux desktops** like this app; built-in task list, full-screen breaks, special breaks at fixed times (e.g. lunch), always-on-top ([source](https://github.com/zidoro/pomatez)). | No per-task time totals; countdown only |
| P10 | [Solanum](https://apps.gnome.org/Solanum/), [GNOME Pomodoro](https://gnomepomodoro.org/) | GNOME desktop (Linux); open source (GPL-3.0) | Native Linux timers, offline, no account ([Solanum review](https://ostechnix.com/solanum-a-pomodoro-timer-for-gnome-desktops/)). | Timer only: no tasks, tags or per-activity totals |

## Ideas worth borrowing
- **TickTappy:** "pin" a timer so it keeps running alongside the active one; a quick-adjust prompt right after a switch;
  a "jump back 5 min" shortcut.
- **Simple Time Tracker:** divide a record into two parts.
- **TimeTagger:** daily/weekly/monthly targets; CSV/PDF export.
- **Clockify Kiosk:** one shared screen for several people (per-user sign-in).
- **Pomodoro / Flowtime apps:** an optional break reminder after an activity has run for N minutes without a switch
  (Toggl Pomodoro mode); a suggested break length earned from the last stretch of work (Flowtime, work ÷ 5).
- **TickTick:** a "forgot to stop" prompt that offers to cut a long-running activity back to a chosen end time.
- **Flow / Forest:** per-tag (here: per-category) colored bars in the statistics; CSV export with the tags.
- **Pomofocus:** an estimate per activity for today ("3 × 25 min") shown next to the actual time.
