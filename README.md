# Pave

A Chrome extension that helps you save jobs, autofill applications, tailor resumes, and track your job search with optional on-device AI.

**Your next step, made easier.**

## Branding

The app icon is a road design by [Slidicon](https://www.flaticon.com/authors/slidicon)
from [Flaticon](https://www.flaticon.com/free-icon/road_3016235), used with
attribution. See [icon sizes and credits](icons/README.md).

Pave keeps the existing database and settings identifiers so renaming the app
preserves your data. New exports use `pave-backup`; backups exported before the
rename still import. Reload this extension from `chrome://extensions` to see the
new name and icon, then refresh any open job pages.

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

The form is never submitted. To see why a field was or wasn't filled, turn on **Debug logs** in settings: each step prints to the page console with a `[Pave]` prefix, and each Gemini Nano call prints to the service worker console. Set up your profile (LinkedIn "Save to PDF" or Markdown), resume file and personal answers on the settings page. Answers you type into custom questions are saved and reused.

## Tailored resumes (experimental)

Click **Tailor Resume** on the on-page card.
- Gemini Nano picks and orders your existing skills and bullets **by id**, so it can't invent any, and writes a short summary.
- The job's title, company and requirements are read from the page structure (`lib/jobpage.js`), using `JobPosting` JSON-LD when present.
- Every number and capitalized term in the summary must appear in your profile. Otherwise it retries once, then falls back to "{latest title} with {years} years of experience in {top skills}".

The result is a single-column DOCX (`lib/docx.js`):
- On an application form, it's **attached to the resume field right away**, without running Autofill.
- The card shows the file name with a **Download** button so you can open and review it.
- The job is saved to **Applications** with its tailored resume. Autofill on that job also uses the tailored file instead of your base resume.
- **Re-tailor Resume** generates it again.

**Applications** (settings) lists only the jobs you saved, using Save Job or Tailor Resume. From there you can open the posting, download or re-tailor the resume, or remove the job.

## AI models

**AI & Privacy → AI model** lists every model. A radio button picks which one autofill and tailoring use. All of them run on this device.

- **Gemini Nano**
  - Built into Chrome, about 4 GB, and shared with other sites and extensions.
  - **Download** starts it from the settings page, because Chrome only allows that after a click, and shows its progress.
  - Chrome manages Nano's storage. **Details** opens `chrome://on-device-internals`.
- **Downloadable models** run through [WebLLM](https://github.com/mlc-ai/web-llm) on your GPU (WebGPU with 16-bit shader support):

  | Model | Tier | Download |
  |---|---|---|
  | Qwen 2.5 0.5B | Fast | ~0.3 GB |
  | Llama 3.2 1B | Balanced | ~0.7 GB |
  | Llama 3.2 3B | Quality | ~1.8 GB |

  - **Downloading:** the weights download once from Hugging Face into the browser cache, and **Delete** removes them.
  - **Bundled code:** the engine code and each model's compiled library are bundled in `vendor/web-llm/`, because MV3 forbids remote code.
  - **Where it runs:** inference runs in an offscreen document (`offscreen.html`), so the model stays loaded between requests.
  - **Routing:** `ai.js` sends every request to whichever model is selected, with the same JSON-schema answers either way.

## Without AI

On devices that can't run any model, autofill still fills:
- everything in your profile and personal answers;
- answers you've saved before, including near-identical questions (marked for review);
- your profile summary in "about you" or "additional information" boxes (marked for review);
- date pickers and resume uploads.

Labels like "Name", "Phone", "Country" and "State" resolve from the field's own label, `name`, `id` and placeholder. Fixing or filling a field yourself teaches it that mapping (`tgFieldUser`).

The card says when AI is off. Optional fields it couldn't fill show up as "skipped" instead of disappearing.

## Job page helpers

On a posting, the card shows chips read from the page (`lib/signals.js`):
- **Salary.** From the page's structured `JobPosting` data, or a currency range in the text.
- **Remote, hybrid or on-site.**
- **Visa sponsorship.** Whether it's offered, or explicitly not.
- **A "warning signs" chip** for:
  - a listing that's old or expired;
  - a personal email contact;
  - requests to move to WhatsApp or Telegram;
  - mentions of paying for equipment or fees;
  - no company named.

If you've already saved or applied to the same job, possibly on another site (matched by company and title), the card says so and when.

## Tracking

Each saved job has a status: Saved, Applied, Interviewing, Offer or Rejected, with a dated history.
- **After autofill**, the card offers **Mark as applied**.
- **Reminders:** applied jobs get Chrome notifications after 7 and 14 days (`chrome.alarms`) to follow up.
- **"No reply in 3+ weeks":** applied jobs with no update in 3 weeks are flagged.
- **Applications summary:** the top of **Applications** shows applications in the last 7 days, reply rate, average days to a reply, follow-ups due, and replies by site.

## Data & Privacy

Settings → **Data & Privacy**:
- shows what's stored and how much space it uses;
- **exports** everything (profile, answers, saved jobs, resumes, settings) to one JSON file, optionally encrypted with a password (PBKDF2 + AES-256-GCM);
- **imports** it back;
- **erases everything**, including downloaded models.

Nothing is sent to any server. The only downloads are models you choose to get.

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
- `tailor.js` — resume tailoring with the selected AI model.
- `offscreen.html` / `offscreen.js` — hosts a downloaded WebLLM model.
- `lib/models.js` — downloadable model list and which model is active.
- `lib/signals.js` — salary, workplace, sponsorship and warning signs from a posting.
- `lib/jobpage.js` — reads title, company, years and must/nice requirements from a job page.
- `lib/docx.js` — minimal DOCX writer (stored zip, no dependencies).
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
