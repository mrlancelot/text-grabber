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
- `options.html` / `options.js` — settings page for picking/changing the save folder.
- `idb.js` — small IndexedDB helper for persisting the chosen folder handle across browser sessions.
- `popup.css` — styling for the on-page popup.

## Limitations

- Chrome may periodically require you to reconfirm folder write permission (e.g. after a browser restart) — this is a browser security behavior, not a bug. Just click **Change save folder** and re-pick the same folder.
- Detection is purely URL-pattern based; sites not in the list above won't trigger the popup.
