# THE GRAY MAN — project notes

Marketing site for *The Gray Man*, a musical by Eric Sorrels — book, music
and lyrics — subtitled "A Musical in Three Hurricanes". Plain HTML, CSS and
JavaScript. No build step, no framework, no package manager.

Live at **https://graymanmusical.com**.

---

## Working with Eric

Eric is not a developer. Explain things in plain language, name files rather
than jargon, and avoid asking him to run terminal commands unless there's no
alternative. He edits `content.js` himself and does everything else through
GitHub Desktop.

**He publishes, not you.** Commit freely; the push is his. GitHub Desktop
holds credentials this environment cannot reach, so `git push` will fail —
that's expected, not a fault to debug. End work by telling him what's waiting.

---

## The one rule: all copy lives in content.js

Every word a visitor reads comes from `content.js`. Markup carries
`data-content="section.key"` slots that the scripts fill in; the text sitting
in the HTML is only a fallback for when JavaScript doesn't run.

**Never hardcode copy into `index.html` or `access.html`.** Add a slot.

Two deliberate exceptions, both commented in place:

- **Link-preview tags** in `index.html` must be literal, because the services
  that build previews read raw HTML and never run scripts.
- **The password** is never stored as text anywhere — see below.

Helper conventions inside `content.js`:

- `*Asterisks*` around words render them in the show-title treatment.
- A `|` in a download button's label forces a line break there.
- An empty string `""` hides whatever it controls — a video, a button, a
  contact line. Nothing on the site ever shows a link that leads nowhere.

---

## Cache discipline — read this before changing any asset

Eric lost real time three separate times to browsers serving stale files.
Three different rules, because three different mechanisms:

| Changing… | Do this |
|---|---|
| `content.js`, any `.js`, `style.css` | Bump `?v=N` in **both** `index.html` and `access.html` |
| An image | Give the new file a **new name** and update `content.js` |
| An audio track already online | Bump `access.audio_version` in `content.js` |

The `?v=` tags apply only to the site's own files — never to Google Fonts or
anything external.

---

## Layout conventions

- **Duotone only.** Aged paper `#EDE8DD` and ink `#1B1A17`, greys between. No
  saturated colour anywhere.
- **Motion is slow and atmospheric.** Long fades, gentle drift. Nothing
  bouncy, nothing quick.
- Sections alternate paper and ink. A section that *fades in* from the one
  above carries `section--from-ink` / `section--from-paper` and deep top
  padding to clear the gradient. A section that carries straight on from the
  one above has neither, and a CSS rule gives it shorter padding — that rule
  keys off the absence of the gradient classes, so reordering sections keeps
  the spacing honest.
- Fixed flex bases on the track rows, not content sizing, or the columns go
  ragged across 21 rows.

**Page order:** hero → weather → about → music → news → storm → contact.
The nav's "Contact" points at `#storm`, so a visitor lands on the signup with
the representation details just below.

---

## The artwork

`assets/img/gray-man-title.png` is the real hand-painted title, not type.
Earlier font experiments are all superseded.

The PNG sits on a large canvas with the lettering occupying only the middle —
roughly 60% of its width, and 31%–69% of its height. Both places it appears
crop that empty space with **negative margins on the image inside a
fixed-width wrapper**. The wrapper matters: percentage margins resolve against
the container's width, so applied directly to a full-width parent they scale
with the browser window and drag the title over whatever is beneath it. That
bug shipped once. If the artwork is ever re-exported, those percentages need
remeasuring.

The hero photograph is portrait, so `background-position: center 62%` pins the
wave crest to 62% of hero height on any screen width.

---

## Early access page (`access.html`)

Password-gated, unlinked from the main site, and `noindex`. The password is
stored **only as a SHA-256 hash** in `assets/js/access.js` — changing it means
regenerating that hash, not editing a string.

**This is a courtesy gate, not security, and Eric knows it.** The repo is
public and GitHub Pages serves every file, so anything under `assets/` is
downloadable by anyone who knows the address, password or not.

The album is 21 tracks, expecting `assets/audio/01.mp3` … `21.mp3`, matched
line-for-line against the `tracks:` list in `content.js`. Tracks with no file
read "Soon" and disable themselves; play-through skips over them. Bonus tracks
are separated by `bonus_starts_at`.

---

## Hosting

GitHub Pages from the public repo `ericsorrels/ericsorrels.github.io`. Domain
registered at Cloudflare, DNS-only (grey cloud) A records to GitHub's
addresses.

**Cloudflare SSL/TLS must stay on "Full".** Flexible causes an endless
redirect loop whose symptom looks nothing like its cause.

Weather comes through a Cloudflare Worker (source in `cloudflare/`) that holds
one reading for ten minutes and serves it to everyone, keeping the API key off
the page. Its allowed-origins list does not include localhost in the deployed
copy, **so the weather panel shows its error state in local preview — that is
expected, not a bug.** Simulate a reading to check that layout.

---

## Environment notes

- **Local preview:** `python3 -m http.server 8420` from the project root.
  Opening `index.html` as a `file://` URL blocks `content.js`, so the page
  falls back to placeholder copy. Expected.
- **This sandbox cannot reach `graymanmusical.com`.** `api.github.com` and
  `ericsorrels.github.io` do work. Verify DNS with `dig`, verify what's
  published through the GitHub API, and ask Eric to confirm the live page.
- `~/Downloads` is blocked by macOS privacy protection; `~/Desktop` works. Ask
  Eric to put files on the Desktop.
- No ffmpeg, HandBrake, PIL or Node. Available instead: `sips` for images,
  `avconvert` for video, `qlmanage -t` to pull a still frame from a clip, and
  `osascript -l JavaScript` for AppKit image compositing and for syntax-checking
  `content.js` before committing.

---

## Verifying work

Load the page and measure. Several bugs here looked fine in a screenshot and
were wrong in the numbers — a title overlapping a form, 200px of dead padding,
a poster that was silently the cached previous file. Check computed styles and
element rectangles rather than trusting a glance.

`offsetParent` is null for fixed-position elements; use computed `display` to
test visibility.

Always syntax-check `content.js` after editing it — one missing comma blanks
every word on the site.
