# Text Grabber

A Chrome extension that pops up on job posting pages (like Rakuten's cashback popup) and, with one click, saves the full page text to a local folder of your choice.

## What it does

1. Detects when you land on a job posting page from a known list of job boards/ATS platforms.
2. Shows a small popup in the bottom-right corner of the page.
3. Click **Save** the page's text (title, URL, timestamp, and full visible text) is written to a `.txt` file in a folder you pick once and it remembers from then on.

## Supported sites

- LinkedIn (`linkedin.com/jobs/view/*`)
- Indeed (`indeed.com/viewjob*`)
- Greenhouse (`boards.greenhouse.io`, `job-boards.greenhouse.io`)
- Lever (`jobs.lever.co`)
- Workday (`*.myworkdayjobs.com`)
- Ashby (`jobs.ashbyhq.com`)
- SmartRecruiters (`jobs.smartrecruiters.com`)
- iCIMS (`*.icims.com/jobs/*`)
- Workable (`apply.workable.com`)
- BambooHR (`*.bamboohr.com/careers/*`)
- Jobvite (`jobs.jobvite.com`)

More can be added by extending the `matches` list in `manifest.json`.

## Autofill

Click **Autofill** in the popup on an application form, or press **Alt+Shift+F** on any site. Fields are filled from your profile and personal answers; Gemini Nano (on-device, nothing leaves your machine) resolves unclear fields and drafts open-ended answers.

- Green ring: filled from your profile or answers.
- Yellow ring: chosen or drafted by the AI, please review.
- Coral ring: required and still empty.
- Dashed blue ring: being filled right now.

The form is never submitted. To see why a field was or wasn't filled, turn on **Debug logs** in settings: each step prints to the page console with a `[TG]` prefix, and each Gemini Nano call prints to the service worker console. Set up your profile (LinkedIn "Save to PDF" or Markdown), resume file and personal answers on the settings page. Answers you type into custom questions are saved and reused.

## Installation

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Visit a job posting on any supported site — the save popup should appear.

## Choosing where files are saved

The first time you click **Save**, Chrome's folder picker opens (via the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)) so you can choose a destination folder. That choice is remembered for future saves. You can change it anytime from the extension's settings page (click the toolbar icon, or right-click it → **Options**).

Note: browsers don't allow extensions to silently write to an arbitrary OS path for security reasons, so a folder must be explicitly granted via this picker — there's no way around that one-time step.

## How it works

- `content-script.js` — injects the on-page popup and extracts the page text on click.
- `background.js` — service worker that writes the file (via a saved directory handle) or, if no folder is set / permission needs re-confirming, opens the settings page.
- `options.html` / `options.js` — settings app (profile, answers, resume, saved answers, AI, jobs folder, debug).
- `idb.js` — small IndexedDB helper for persisting the chosen folder handle across browser sessions.
- `popup.css` — field highlight outlines injected into job pages.
- `ui/` — shared tokens, controls, card panel and settings styles (editorial line-art: white surfaces, hairlines, pill buttons, yellow accent), icons, and bundled fonts (`ui/fonts`: Unbounded and IBM Plex Sans, both OFL).

## Theme

Editorial line-art: white surfaces, 1px black hairlines, rounded cards, pill buttons, one yellow accent. Inspired by poster-style agency sites — flat, no shadows, no gradients.

**Palette** (tokens in `ui/tokens.css`)

| Token | Hex | Use |
|---|---|---|
| `--label` | `#111111` | Text, hairlines, primary (black) buttons |
| `--cell` | `#FFFFFF` | Card and window surfaces |
| `--bg` | `#EDEDED` | Settings page backdrop |
| `--fill` | `#F2F2F2` | Hover rows, expanded details, progress track |
| `--yellow` | `#FFD166` | Accent: hover fills, switch on, arrow chip, bottom bar, "review" |
| `--green` | `#06D6A0` | "Filled" status, success banner |
| `--red` | `#FF7F50` | "Needs you" status, badges, destructive buttons |
| `--blue` | `#118AB2` | "Pending" highlight, nav icon circles |

Colored fills always carry black text — white fails contrast on all four accents (black passes: 4.8–13:1). Focus rings are black.

**Type**

- Display: Unbounded SemiBold (`--font-display`) — titles, primary button, pill label.
- Text: IBM Plex Sans Regular/Medium (`--font`) — everything else; small labels are uppercase with 0.04em tracking (`.caption`).
- Fonts are bundled in `ui/fonts` (both OFL). The in-page card registers them with `FontFace` at document level because `@font-face` inside a shadow root isn't reliable; the settings page uses `@font-face` in `ui/settings.css`.

**Shapes**

- Borders: `--line` (1px solid black), `--dash` (1px dashed) for dividers and drop zones.
- Radii: cards 20px, groups `--radius` 16px, fields 10px, buttons/chips/nav items fully rounded.
- Primary button: black pill with a yellow `→` circle on the right. Secondary: outlined pill, yellow on hover.
- Icon circles: `.tile`, color via `--tile` (defaults to yellow). Stroke icons in `ui/icons.js` at 1.6px.
- Light only (`color-scheme: light`); `prefers-reduced-motion` zeroes `--dur`.

**Files**

- `ui/tokens.css` — tokens and type scale, shared by the card (`:host`) and settings page (`:root`).
- `ui/controls.css` — buttons, fields, switch, segmented, select, groups/rows, badge, chip, banner, spinner, tile.
- `ui/panel.css` — the in-page card and collapsed pill (shadow DOM).
- `ui/settings.css` — settings page layout.
- `popup.css` — field highlight rings on the host page (hardcodes the palette since it's outside the shadow DOM).

## Limitations

- Chrome may periodically require you to reconfirm folder write permission (e.g. after a browser restart) — this is a browser security behavior, not a bug. Just click **Change save folder** and re-pick the same folder.
- Detection is purely URL-pattern based; sites not in the list above won't trigger the popup.
