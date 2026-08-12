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

## The voice

Copy is written in the weather of the show, never in the language of a
website. The storm is the metaphor for everything, including the plumbing.

- "Reading the sky…" — not *Loading*.
- "The island's weather is out of reach just now." — not *Error*.
- "Subscribe below for advisories, updates, and warnings from *The Gray Man*."
- "Delivered by Substack. Ignore at your own risk."
- "Enter" — the scroll cue on the hero.

Section headings are all **"The ___"**: The Legend, The Music, The Journey.
Representation is the one exception, because it's a plain business heading
and shouldn't be dressed up.

**The nav labels deliberately do not match the section headings.** The menu
reads About / Music / News / Contact while the sections read The Legend /
The Music / The Journey / Representation. Eric was shown this and said to
leave it — short menu words scan faster. It is not a bug; don't "fix" it.

When writing new copy, match the register. When in doubt, write the plainer
line and let Eric make it stranger.

---

## Cache discipline — read this before changing any asset

Eric lost real time three separate times to browsers serving stale files.
Three different rules, because three different mechanisms:

| Changing… | Do this |
|---|---|
| `content.js`, any `.js`, `style.css` | Bump `?v=N` in **both** `index.html` and `access.html` |
| An image | Give the new file a **new name** and update `content.js` |
| An audio track already online | Bump `access.audio_version` in `content.js` |

**`?v=` currently stands at 25.** Bump both pages together — they must always
match, or one page runs new code against the other's cached copy.

The `?v=` tags apply only to the site's own files — never to the Google Fonts
link (Oswald and Josefin Sans) or anything else external.

---

## The look

Eric's brief, in his words: **a vintage found artifact from the South
Carolina coast — weathered, cinematic, quiet.** Black-and-white coastal
photography. The title in distressed hand-painted brush; every other word in
clean, wide-letterspaced uppercase sans-serif. Nothing bouncy or
modern-feeling. When a choice is open, pick the quieter one.

**Duotone only. No saturated colour anywhere on the site.** The full palette,
all of it in use — don't invent new values, use the variable:

| Variable | Hex | Where |
|---|---|---|
| `--paper` | `#EDE8DD` | aged paper, the light sections |
| `--paper-dim` | `#E2DCCA` | recessed paper surfaces |
| `--paper-shadow` | `#D3CCB8` | paper edges and rules |
| `--ink` | `#1B1A17` | the dark sections, body text on paper |
| `--ink-soft` | `#35322C` | secondary text |
| `--ink-faint` | `#5C584E` | captions, small print |
| `--gray-mid` | `#8B8579` | the middle tone, dividers, disabled states |

**Type** — two faces, both from Google Fonts, loaded on both pages:

- `--font-display` — **Oswald** (500, 600). Headings and labels.
- `--font-body` — **Josefin Sans** (400–700). Everything else.
- `--tracking-wide: 0.28em` and `--tracking-wider: 0.4em`. The wide uppercase
  treatment carries half the identity — reach for the token, not a new value.

**Texture** — three opt-in classes, each a pseudo-element, so any section
can take them without extra markup:

- `.texture-grain` — SVG fractal-noise paper grain, `opacity 0.35`, `overlay`.
- `.texture-halftone` — the printer's screen: `radial-gradient(circle, ink
  0.5px, transparent 0.9px)` on a `3px` grid, `opacity 0.05`, `multiply`.
  Eric asked for this twice — denser and lighter than the first attempt, then
  applied site-wide. Fine newsprint grain, never visible dots.
- `.texture-vignette` — edge darkening, used on the hero.

**Motion is slow and atmospheric.** Long fades, gentle drift. Nothing bouncy,
nothing quick.

---

## Layout conventions

Sections alternate paper and ink. A section that *fades in* from the one
above carries `section--from-ink` / `section--from-paper` and deep top
padding to clear the gradient. A section that carries straight on from the
one above has neither, and a CSS rule gives it shorter padding — that rule
keys off the absence of the gradient classes, so reordering sections keeps
the spacing honest.

**Page order:** hero → weather → about → music → news → storm → contact.
The nav's "Contact" points at `#storm`, so a visitor lands on the signup with
the representation details just below.

---

## Load-bearing rules that look deletable

Each of these fixed a real bug and reads like clutter to anyone who wasn't
there. Leave them alone.

- **`[hidden] { display: none !important; }`** in `style.css`. The password
  gate is a flexbox, and `display: flex` overrides the `hidden` attribute —
  without this the gate stays on screen after unlocking.

- **Fixed flex bases on the track rows.** `.track__num` at `0 0 1.6em`,
  `.track__timeline` at `0 0 clamp(70px, 14%, 130px)`, `.track__time` at
  `0 0 3.6em`, and only `.track__title` flexing. Content sizing goes ragged
  across 21 rows, because "Soon" and "0:02" are different widths.

- **The video's `controls` attribute is in the HTML and removed by JS.**
  That order matters: no-JS visitors still get a working player, while
  everyone else gets the custom play button over an uncovered poster frame —
  the browser's control bar sits exactly where the logo falls. Controls come
  back the moment playback starts, and go away again if `play()` is refused.

- **`assets/js/access.js` runs its startup block last inside the IIFE.**
  Moving it earlier means auto-unlock fires before the player list exists,
  and the vault silently fails to build for returning visitors.

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
stored **only as a SHA-256 hash** — `PASSWORD_FINGERPRINT` near the top of
`assets/js/access.js`. The password itself is written nowhere in this repo,
deliberately. Ask Eric for the value; never commit it.

**To change the password** — Eric asks, and it takes about two minutes:

```
printf '%s' 'TheNewPassword' | shasum -a 256
```

Paste that hash over `PASSWORD_FINGERPRINT`, then **bump `?v=` in both
`index.html` and `access.html`**. Skipping the bump is the whole trap: browsers
go on running the cached `access.js` with the old fingerprint, and the password
appears not to have changed at all.

Unlock state lives in `sessionStorage`, not `localStorage`, so it's forgotten
when the browser window closes. Nobody holds a lingering pass — change the
password and everyone is asked for the new one on their next visit.

**This is a courtesy gate, not security, and Eric knows it.** The repo is
public and GitHub Pages serves every file, so anything under `assets/` is
downloadable by anyone who knows the address, password or not. Changing the
password closes the gate to people holding the old one; it does not make the
album unreachable, and it does not remove anything from git history.

**Anything committed becomes a public URL at `graymanmusical.com/<path>`.**
A guide written for Eric with the password in it was committed and served
publicly for five days before anyone noticed. `READ-ME-FIRST.txt` and
`cloudflare/HOW-TO-DEPLOY.txt` are gitignored for that reason — they stay on
Eric's disk. Check any new documentation file for secrets before adding it.

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
the page. The relay lives at
`https://gray-man-weather.withered-credit-543f.workers.dev`, set as
`weather.proxy_url` in `content.js`; the OpenWeatherMap key is a Worker secret
named exactly **`OWM_KEY`**.

Its allowed-origins list is `graymanmusical.com`, `www.graymanmusical.com`,
`ericsorrels.github.io` and `localhost:8420` — but **the localhost entry
exists only in the repo copy, not the deployed one, so the weather panel shows
its error state in local preview. That is expected, not a bug.** Simulate a
reading to check that layout.

There is no fallback key on the site any more. If the relay is down the panel
reads "out of reach" — graceful, but the weather is genuinely gone until it's
fixed. A **brand-new OpenWeatherMap key returns 401 for anywhere from a few
minutes to a couple of hours** before it activates; that looks exactly like a
mistyped key, so wait before debugging. Test the relay directly:

```
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://graymanmusical.com' https://gray-man-weather.withered-credit-543f.workers.dev
```

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
