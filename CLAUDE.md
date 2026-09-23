# THE GRAY MAN — project notes

Marketing site for *The Gray Man*, a musical by Eric Sorrels — book, music
and lyrics — subtitled "A Musical in Three Hurricanes". Plain HTML, CSS and
JavaScript. No build step, no framework, no package manager.

Live at **https://graymanmusical.com**.

---

## The files

Two pages. `index.html` is the public site; `access.html` is the gated album.
Everything a visitor reads lives in `content.js`.

```
index.html          the public page: hero, weather, about, music, journey,
                    subscribe, contact
access.html         the gated album: password gate, then the vault
content.js          EVERY word on both pages, and a few settings
assets/css/style.css   the whole site's styling, one file
assets/js/
  main.js           pours content.js into both pages; the teaser videos;
                    the subscribe form; scroll reveals; hero fog
  weather.js        the Pawleys Island panel (index only)
  storm-track.js    the Journey's hurricane chart (index only)
  access.js         the password gate and the album player (access only)
  lyrics.js         the lyrics panel following the album (access only)
assets/audio/NN.mp3    one per track, numbered by position in the list
assets/lyrics/NN.lrc   timed words; NN.txt is the untimed fallback
assets/video/       the teasers, plus gitignored .mov masters
assets/img/         title artwork, hero photograph, video posters, share card
assets/downloads/   the four supporter downloads (still empty — see below)
cloudflare/weather-worker.js   the weather relay's source; runs at Cloudflare
tools/              Claude's working tools, not part of the site
CNAME               the custom domain, required by GitHub Pages
```

Each folder under `assets/` carries a plain-language note for Eric
(`PUT-…-HERE.txt`) explaining what goes in it. Those are published but
harmless. `READ-ME-FIRST.txt` and `cloudflare/HOW-TO-DEPLOY.txt` are
gitignored — they hold secrets and stay on Eric's disk.

---

## Working with Eric

Eric is not a developer. Explain things in plain language, name files rather
than jargon, and avoid asking him to run terminal commands unless there's no
alternative. He edits `content.js` himself and does everything else through
GitHub Desktop.

**He publishes, not you.** Commit freely; the push is his. GitHub Desktop
holds credentials this environment cannot reach, so `git push` will fail —
that's expected, not a fault to debug. End work by telling him what's waiting.

**How it reaches the world:** he pushes in GitHub Desktop → GitHub Pages
rebuilds, taking a minute or two → Cloudflare passes it through. Once he says
he's pushed, confirm it rather than assuming:

```
curl -s "https://graymanmusical.com/access.html?cb=$RANDOM" | grep -o '?v=[0-9]*' | sort -u
```

When that shows the number just committed, the push is live. Poll it a few
times if it still shows the old one; it is a build delay, not a failure.

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
- A `|` forces a line break. In a download button's label it always
  breaks; in a video's `credit` (under `music.videos`) it breaks only on
  phones (≤430px), where the line would otherwise run edge to edge.
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
| A lyrics file, added or changed | Bump `access.lyrics_version` in `content.js` |

**Find the current number with `grep -o '?v=[0-9]*' index.html | head -1`**
— don't trust a number written here; one was, and went stale five bumps
running. Bump both pages together — they must always match, or one page runs
new code against the other's cached copy.

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
| `--storm-red` | `#8A3D33` | **the one sanctioned exception** — see below |

`--storm-red` is the grease-pencil red of a plotted hurricane track. Eric
approved it 2026-08-15 for the Journey's advisory chart ONLY — its track
line, storm markers, and landfall stamp. It appears nowhere else on the
site, and nothing else steps outside duotone. Don't spread it.

**Type** — two faces, both from Google Fonts, loaded on both pages:

- `--font-display` — **Oswald** (500, 600). Headings and labels.
- `--font-body` — **Josefin Sans** (400–700). Everything else.
- `--font-mono` — system Courier, loaded from nowhere. The teletype voice,
  reserved for the advisory chart's small print: dates, coordinates, the
  key. Approved alongside the red as a section-only accent — it is not a
  third site-wide face.
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

**The news section IS the storm advisory chart.** The Journey renders the
show's development as a hurricane track: `assets/js/storm-track.js` builds
it from `content.js → news.phases` and draws the red line by scroll. The
`.news-item` styles still exist but dress only the no-JS fallback inside
`index.html`. The chart plots its SVG path by *measuring* the rendered
markers — never by assumed positions — and replots on resize and after
fonts load, so text edits and screen sizes need no re-tuning. Each phase's
`strength` number (1–6, commented in `content.js`) picks its marker and how
red the track runs; the key beside the track goes sticky in the right
gutter at ≥1200px.

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
  across twenty rows, because "Soon" and "0:02" are different widths.

- **The video's `controls` attribute is in the `<template>` markup and
  removed by JS.** That order matters: if the custom play button can't be
  set up, the ordinary controls are simply left in place. Normally they're
  removed so the poster is seen whole — the control bar sits exactly where
  a logo or caption falls — then come back the moment playback starts, and
  go away again if `play()` is refused.

- **`assets/js/access.js` runs its startup block last inside the IIFE.**
  Moving it earlier means auto-unlock fires before the player list exists,
  and the vault silently fails to build for returning visitors.

- **`.section` sets `overflow: hidden` AND `overflow: clip`, in that
  order.** Both lines matter. `hidden` alone turns every section into the
  thing sticky elements pin to, which silently unpins the advisory key;
  `clip` clips identically without doing that. Old browsers drop the
  `clip` line and fall back to `hidden`, losing only the pinning.

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

## Video

The Music section shows a **list** — `music.videos` in `content.js`, top to
bottom in the order written, newest first — built by `main.js` from the
`<template id="videoTemplate">` in `index.html`. Starting one video pauses
any other.

**Every video must be re-encoded before it goes on the site.** Masters out of
an editor are enormous and often HEVC, which Firefox and many Windows
browsers can't play at all. avconvert's presets are the wrong tool: they
don't let you set a bitrate and they overspend badly (Preset1280x720 put a
2-minute clip at 106 MB — over GitHub's 100 MB file limit). Use the tools in
`tools/`, compiled into the scratchpad, never into the repo:

```
swiftc -swift-version 5 -O tools/transcode-video.swift -o "$SCRATCH/transcode-video"
"$SCRATCH/transcode-video" master.mov "$SCRATCH/name.mp4" 720 1280 2200000
cp "$SCRATCH/name.mp4" assets/video/
```

Encode into the scratchpad, then copy. Fast-start makes the writer leave an
unoptimized `name.mp4.sb-xxxx` copy beside its output; written straight into
`assets/video/` that 32 MB leftover would get published.

The settings that worked: **720×1280 H.264 High at 2.2 Mbps** (tall clips;
the players display at most 380px wide, so 720 covers retina), keyframes
every 2s, fast-start, source AAC passed through. That lands a 112-second
clip at 32 MB. Eric's footage is grain- and scanline-heavy VHS styling,
which is where compression breaks first — at 1.6 Mbps it visibly smeared,
so check a grainy frame against the master, not a title card. Confirm
`ftyp → moov → mdat` order afterward, or playback waits for the whole file.

Posters: `tools/grab-frame.swift` pulls an exact frame (720 wide, JPEG
quality 0.82 ≈ 110 KB) into `assets/img/`, with a new filename per the cache
rule. The play button sits dead center, so pick a frame whose center isn't
a title card. Note the timestamp in `content.js` beside the poster — Eric
chooses posters by time.

Raw `.mov` masters are gitignored. An `.mp4` master is not — it would be
published — so tell Eric to move it out once the web copy exists.

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

The album is 20 tracks, expecting `assets/audio/01.mp3` … `20.mp3`, matched
line-for-line against the `tracks:` list in `content.js`. Tracks with no file
read "Soon" and disable themselves; play-through skips over them. Bonus tracks
are separated by `bonus_starts_at`.

### The album player

`access.js` builds one row per track, each with **its own `<audio>` element**
(`preload="metadata"`), so twenty players exist at once and the page asks the
server for twenty files on load. Tracks with no file fire `error`, get flagged
`data-missing`, read "Soon" and disable themselves — which is why a half-built
album still looks deliberate rather than broken.

- **Starting one track pauses every other**, so nothing ever doubles up.
- **When a song ends, the next one with audio starts**, skipping the gaps, so
  the album plays through like a record.
- **The timeline is a real `<input type="range">`**, not a drawn line: it can
  be dragged, nudged with the arrow keys, and read aloud. A `scrubbing` flag
  stops playback yanking the handle out from under a finger mid-drag, and the
  `input` handler moves the song as it goes — which is what the lyrics panel
  rides on.
- **Volume is one slider governing every track**, floating at the right edge,
  remembered in `localStorage`. It flips light over the paper section, and is
  hidden entirely at ≤620px, where a saved level is ignored in favour of full
  volume — a quiet level chosen on a laptop must not follow a listener to a
  phone with nothing on screen to undo it.

**Numbers come from position in that list, not from anything written down.**
So adding or deleting a track renumbers every track below it, and the files
on disk do not follow: `assets/audio/NN.mp3` and `assets/lyrics/NN.lrc` would
then belong to the wrong songs, silently. After any change to the list, check
which numbered files sit below the change and rename them — and move
`bonus_starts_at` by the same amount, or the bonus heading lands on the wrong
song. (Eric removed track 18 in September 2026; every file happened to be
numbered 17 or lower, so nothing needed renaming that time.)

**To open the vault while testing, don't type the password** — that is Eric's
to type. Set `sessionStorage` `tgm_early_access` to `open` in the preview and
reload; that is the same door a returning visitor comes back through.

---

## Lyrics

`assets/js/lyrics.js` runs the panel that follows the album, loaded **before**
`access.js` in `access.html` — deliberately, because `access.js` builds the
album the instant it runs for a visitor already through the gate, and the
panel has to be listening by then. The handover is `window.TGM_ALBUM` plus a
`tgm:album-ready` event carrying `{ number, title, audio }` per track; the
panel reads both, so load order can't silently break it.

When a track starts, it fetches `assets/lyrics/NN.lrc`, falls back to
`NN.txt`, then says there are none. Answers are kept per track for the visit,
and a stale one is dropped if the listener switches tracks mid-fetch.

**The `.lrc` reader handles** several timestamps on one line (a chorus written
once, stamped three times), an `[offset:…]` tag, `[ti:…]`-style tags, empty
timed lines as verse breaks, and word-by-word `<00:12.34>` timings, which are
stripped. An `.lrc` with no timings at all is shown as plain words.

**Following the song runs on `requestAnimationFrame`** while a track plays and
the panel is open — `timeupdate` fires far too rarely to land a line on the
beat. Seeking is covered separately by the audio's own `seeking`/`seeked`,
which is what keeps the words with the seek bar as it's dragged (the bar moves
the song live, so no extra hook is needed). Scrolling happens **inside the
panel only** — never `scrollIntoView`, which would drag the page too — and
stands down for four seconds after the listener scrolls it by hand.

**Layout, all in `style.css`:** one drawer rising from the lower left with the
Lyrics tab as its handle. At ≥1280px it sits in the margin beside the 720px
album column; from 621–1279px it docks along the bottom, its right edge held
clear of the volume slider by `right: calc(var(--lyrics-edge) + 4.25rem)`
(13px of daylight at the tightest point, 621px); at ≤620px it's a full-width
sheet, where the volume slider isn't shown anyway. Below 1280px the body gains
bottom padding so the end of the page can still be scrolled clear of it.

**The panel is an opaque ink card everywhere.** Only the small tab flips light
over the paper section, the way the volume panel does — a card that size
changing colour mid-scroll would be the opposite of quiet.

### The expanded view

The arrows button in the panel's corner opens the words out to fill the
screen — `.stage` in `access.html`, empty markup that holds nothing of its
own. Opening it **moves the panel element itself** into the stage and moves
it back on close, so the loader, the highlighter, click-to-seek and the
keyboard handling are all the same code in a different place, restyled by
`.stage …` rules. Nothing is duplicated and nothing has to be kept in step.

**The volume slider travels with it**, and this is the reason the design
works this way at all: in true full screen the browser paints *nothing*
outside the expanded element, so a fixed control left behind on the page
simply disappears, however high its `z-index`. Anything the listener still
needs has to be inside. Both moves are undone by a comment node left where
the element was, so the page comes back exactly as it was.

**The transport at the bottom moves `current.audio` and nothing else.** That
is why the album's own row for the track stays in step without being told —
both are working the one `<audio>` element. Its play button and seek bar
reuse `.track__play` and `.track__seek`, so they *are* the album's controls.

With nothing playing yet the stage's play button **starts the album** at
its first track that has audio, and says which one in its label. In full
screen the track list is out of sight, so this is the only way in.
`firstPlayable()` skips tracks flagged `data-missing`, which means the
transport is redrawn on any track's `error` — not only the one on show,
because a 404 changes which track the button would start. access.js sets
that flag from its own `error` listener, attached first and so already run
by the time this one fires.

**`isShowing()` is `isOpen || isExpanded`.** The words follow the song when
they are being read, which is a different question from whether the drawer
is open — the panel can be shut and the stage still up.

Full screen is asked for on top of the overlay and refused gracefully: the
request is made inside the click, where a browser will grant it, and a
rejection is swallowed. Leaving full screen by any route (Escape, F11, the
browser's own control) closes the stage, but only if it ever got in —
`wasFullscreen` guards that, because a refused request fires no event at all
and the stage is meant to survive it. Desktop only: the button is
`display: none` below 768px, and pulling the window narrower than that while
expanded closes the stage, since the way out would go with it.

Expanded, Escape leaves, Space stops and starts, and ←/→ step 5 seconds —
skipped when a button or slider already has the caret, which answers for
itself. The line being sung sits dead centre (`READING_LINE_EXPANDED`)
rather than a third of the way down, and the lines get a top gutter so the
first one can reach the middle.

**Screen readers get the track, not the song.** Changing tracks announces
"Lyrics: <title>" through a polite live region; lines are never announced, as
that would talk straight over the music. The lines are one tab stop with a
roving `tabindex` — arrows move, Enter jumps the song, Escape closes and
returns focus to the tab.

**Timing new lyrics:** `tools/lyric-timer.html`, which is **gitignored and
lives only on Eric's disk** — it runs by double-clicking and never needs to be
online. Load a song and its words, tap Space per line, download the `.lrc`.
Its wording is hardcoded rather than in `content.js`: it is Eric's tool, not
something a visitor sees, and it has to work with no site around it. If it
ever goes missing it can be rebuilt from this description; nothing on the
site depends on it.

---

## Hosting

GitHub Pages from the public repo `ericsorrels/ericsorrels.github.io`. Domain
registered at Cloudflare and **proxied through it (orange cloud)** — the A
records answer with Cloudflare addresses (`104.21.x`, `172.67.x`), not
GitHub's `185.199.x`, and responses carry `server: cloudflare`. Verify with
`dig +short graymanmusical.com` before assuming either way; this note was
wrong once. The orange cloud is load-bearing — it's what lets Worker routes
fire on the domain, so the weather relay depends on it.

**Cloudflare SSL/TLS must stay on "Full".** Flexible causes an endless
redirect loop whose symptom looks nothing like its cause.

Weather comes through a Cloudflare Worker (source in `cloudflare/`) that holds
one reading for ten minutes and serves it to everyone, keeping the API key off
the page. The OpenWeatherMap key is a Worker secret named exactly **`OWM_KEY`**.

**The site asks its own address for the weather — `/api/weather`.** Two
Cloudflare Routes on the worker (`graymanmusical.com/api/*` and
`www.graymanmusical.com/api/*`) hand those requests to the relay. This is
deliberate and worth protecting: strict office, school and hotel networks
block `workers.dev` wholesale, and the panel went dark on them. A network
that allows the site cannot single out the site's own path. Because it's
same-origin there is no CORS involved on the live site at all.

`weather.proxy_fallback_url` in `content.js` still holds the relay's direct
workers.dev address. It is tried only if `/api/weather` doesn't answer, which
covers previews and any window where the routes aren't in place. The worker's
allowed-origins list matters only for that fallback path.

**Local preview always shows the weather's error state** — `/api/weather`
404s against `python3 -m http.server`, and the workers.dev fallback rejects
`localhost:8420` because the deployed worker's origin list omits it. Expected,
not a bug. To check that layout with real data, drop a file of
OpenWeatherMap JSON at `api/weather` in the project root, then delete it.

There is no fallback key on the site any more. If the relay is down the panel
reads "out of reach" — graceful, but the weather is genuinely gone until it's
fixed. A **brand-new OpenWeatherMap key returns 401 for anywhere from a few
minutes to a couple of hours** before it activates; that looks exactly like a
mistyped key, so wait before debugging. Test the relay directly:

```
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://graymanmusical.com' https://gray-man-weather.withered-credit-543f.workers.dev
```

And the route the site actually uses:

```
curl -s -o /dev/null -w '%{http_code}\n' https://graymanmusical.com/api/weather
```

---

## Environment notes

- **Local preview:** `python3 tools/preview-server.py` (port 8420). Use it
  rather than `python3 -m http.server`, which cannot send part of a file:
  without ranges, dragging a track's seek bar throws the song back to the
  start, so anything to do with seeking — the lyrics keeping up, most of all
  — tests as broken when it isn't. It also sends `no-store`, so edits show on
  refresh. Opening `index.html` as a `file://` URL blocks `content.js`, so the
  page falls back to placeholder copy. Expected.
- **The sandbox can reach `graymanmusical.com`** — `curl -I` returns 200 and
  the Cloudflare headers. (An earlier note here said it couldn't; that was
  wrong, so test before believing either claim.) `api.github.com` and
  `ericsorrels.github.io` work too. Still ask Eric to confirm anything
  visual on the live page — reachability is not the same as rendering.
- `~/Downloads` is blocked by macOS privacy protection; `~/Desktop` works. Ask
  Eric to put files on the Desktop.
- **GitHub Desktop is usually open and watching this folder.** Now and then it
  holds the git index as it refreshes, and a commit fails with
  `index.lock … Operation timed out`. Nothing is broken and nothing is lost —
  check that no `.git/index.lock` is left behind, then run the same commit
  again. Don't delete a lock file that another process is genuinely using.
- No ffmpeg, HandBrake, PIL or Node. Available instead: `sips` for images,
  **`swiftc`** for anything AVFoundation can do (video encoding and exact
  frame grabs — see `tools/` and the Video section), and
  `osascript -l JavaScript` for AppKit image compositing and for
  syntax-checking `content.js` before committing. Spotlight's `mdls` often
  returns nothing for freshly added video; read the file's own headers.

---

## Verifying work

Load the page and measure. Several bugs here looked fine in a screenshot and
were wrong in the numbers — a title overlapping a form, 200px of dead padding,
a poster that was silently the cached previous file. Check computed styles and
element rectangles rather than trusting a glance.

`offsetParent` is null for fixed-position elements; use computed `display` to
test visibility.

---

## Where things stand (23 September 2026)

**Settled. Don't raise these again unless Eric does.**

- **`05.lrc` has one line with no timestamp** — "Waste a time, my ass.",
  between 2:58 and 3:04 — so it never appears in the panel. It was found,
  shown to Eric, and he is happy with how it reads. Leave it.
- **Track 20's title breaks mid-date on phones**, as
  "THE GRAY MAN_08-23-" / "24 (VOICE MEMO)", because browsers break at
  hyphens. Raised and waved off for now. If he ever wants it fixed: the
  non-breaking hyphen `‑` measures exactly the same width as `-` in Josefin
  Sans, so swapping the two in the date is invisible and never splits —
  but ordinary hyphens return if he retypes the title by hand.
- **`audio_version` is bumped only when a track already online is replaced**,
  never when one is added. It changes the address of *every* track, so a
  needless bump makes every listener re-download the whole album.
  `lyrics_version` is bumped for additions too — those files are a few
  kilobytes, so the cost is nothing and new words appear at once.

**Unfinished, in rough order of how much they matter.**

- **All four download buttons on the access page lead nowhere.** The Listening
  Guide, Digital Lyric Book, About Pawleys Island and full-album zip are named
  in `content.js` but `assets/downloads/` holds only its instructions file, so
  a supporter clicking any of them gets a 404 — checked live, 23 September
  2026. **Eric knows and is making the files; don't raise it again.** If they
  are still missing much later, the alternative is to have a button hide
  itself when its file is absent — download buttons are always drawn, so
  unlike the video and buy-access links, emptying a label won't do it.
- **Six tracks have no audio:** 04 September, Remember · 08 Eye of the Storm I
  · 09 Some Things Never Leave You · 14 Hurricane Chatter (2022) · 15 The Gray
  Man · 18 Eye of the Storm III. They read "Soon" and are skipped.
- **Three tracks have audio but no words:** 02, 12 and 13. Their panel says
  there are no lyrics, which is correct but not final.
- **The expanded lyrics view was never tested in real full screen.** The
  built-in browser pane refuses the Fullscreen API outright (`Permissions
  check failed`), so only the refused path — the overlay standing on its
  own — has been seen working. Everything else about the stage was
  measured. Ask Eric to confirm it in Chrome or Safari.
- **The stage's waiting line still reads "Press play on any track…"**,
  which in full screen names a track list the listener cannot see — though
  the stage's own play button now does exactly that. It is one line in
  `content.js` (`access.lyrics_waiting`) shared with the small panel, so
  changing it for the stage alone would need a second key. Eric's to
  reword if it bothers him.
- **No favicon**, on either page. Eric has declined twice; don't offer again.
- **The Gumroad product is live** and sells early access, but nothing connects
  a purchase to this page or its password — a buyer is still let in by hand.
  That is a setting on Gumroad's side, not something in this repo.

Always syntax-check `content.js` after editing it — one missing comma blanks
every word on the site. Evaluating it and printing the track list back is
better still: it proves the file parses *and* shows the numbering the site
will actually use.

**Check new album files before committing them.** Eric uploads audio and
lyrics in batches and asks whether they look right. Read the `.lrc` with the
same rules `lyrics.js` uses and report per file: how many sung lines and
verse breaks, first and last timestamp, whether times ascend, whether the
last one falls inside the song's length (`afinfo` gives the duration), that
it decodes as UTF-8, and any line carrying no timestamp — those simply never
appear, silently. Then confirm each number still points at the song it
should, and name any track that has audio but no words, or the reverse.
