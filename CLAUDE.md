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
  lyrics.js         the panel following the album, and every transport
                    that is not a track row: the stage's, the panel's
                    head, and the lock screen's (access only)
assets/audio/NN.mp3    one per track — GITIGNORED, on Eric's disk only
assets/lyrics/NN.lrc   timed words — GITIGNORED; NN.txt likewise
assets/notes/NN.md     liner notes, Markdown — GITIGNORED
assets/video/       the teasers, plus gitignored .mov masters
assets/img/         title artwork, hero photograph, video posters, share
                    card, the album sleeve (four sizes), and the two icon
                    files — see The artwork → The album sleeve, The icon
assets/downloads/   the supporter downloads — GITIGNORED (still empty)
cloudflare/weather-worker.js   the weather relay's source; runs at Cloudflare
cloudflare/vault-worker.js     the album's keeper; holds no secrets — see The vault
cloudflare/vault-schema.sql    the guest list's columns; no addresses, no secrets
tools/              Claude's working tools, not part of the site:
                    preview-server.py, transcode-video.swift,
                    grab-frame.swift, make-icon.swift, find-letter.swift
CNAME               the custom domain, required by GitHub Pages
```

The folders Eric puts files into — `audio`, `lyrics`, `notes`, `video`,
`downloads` — each carry a plain-language note for him (`PUT-…-HERE.txt`)
explaining what goes in it. `css`, `js` and `img` have none, because
nothing goes in them by hand. Those notes are published but harmless.
`READ-ME-FIRST.txt` and `cloudflare/HOW-TO-DEPLOY.txt` are gitignored —
they hold secrets and stay on Eric's disk.

**`assets/img/hero-ocean.png` is a 2 MB master that nothing references.**
Only `hero-ocean.jpg` is used, by `style.css`. The PNG is tracked, so it
is served publicly at its address for no reason — the same waste that
`album-cover.png` is gitignored to avoid. Left alone because deleting a
file of Eric's is his call, not something to do in passing. Worth
offering to remove or gitignore next time the subject comes up.

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
| An image | Give the new file a **new name**, then update wherever it is named — see below |
| An audio track already online | Bump `access.audio_version` in `content.js` |
| A lyrics file, added or changed | Bump `access.lyrics_version` in `content.js` |
| A notes file, added or changed | Bump `access.notes_version` in `content.js` |

**Find the current number with `grep -o '?v=[0-9]*' index.html | head -1`**
— don't trust a number written here; one was, and went stale five bumps
running. Bump both pages together — they must always match, or one page runs
new code against the other's cached copy.

**Never write the literal characters `?v=` into prose or a comment in
`index.html`.** That grep takes the first match in the file, so a comment
mentioning the tag becomes the answer and reports an empty version. It
happened once, in a comment about this very rule.

**An image is named in more than one place now**, so "update `content.js`"
is no longer the whole of it. Video posters and the share card are in
`content.js`; the album sleeve's `src` and both icon `<link>`s are in the
HTML; the sleeve's lock-screen sizes are `COVER_STEM` in `lyrics.js`.
`grep -rn "old-filename" --include="*.js" --include="*.html" --include="*.css" .`
before believing you have found them all.

The `?v=` tags apply only to the site's own files — never to the Google Fonts
link (Oswald and Josefin Sans) or anything else external. They are also no
use on a favicon: browsers hold those apart from everything else they
cache, which is why icons change by filename only.

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

### The downloads

They sit **above the album cover**, at the head of the same section, rather
than in the closing one where they started — moved 29 September 2026.
`.vault__back` lost its 5em top margin in the same move: that margin was
holding the link clear of the buttons, and the link is now alone in its
section with only the section's own padding around it.

**Three across on a desktop.** The column tracks were `minmax(240px, 1fr)`,
which fits only two in the 720px album column; 220px fits three.

**The labels have to stay short**, and this is the constraint to check
before changing one. Each column is 229px, leaving about 197px of it for
text, which holds roughly 15 letters of tracked capitals. A label longer
than that wraps, and because grid rows are as tall as their tallest item,
one long label makes *every* button in the row taller. That is what
happened to "About Pawleys Island and The Gray Man": its `|` had to move
from after "and" to before it just to keep the row at 73px rather than 94.
The three were shortened to "Listening Guide", "Lyric Booklet" and "About
the World" on 29 September 2026, and all three now hold one line at 53px
with no `|` needed at all.

Below that the grid falls to two columns, where three buttons leave one
over; `.downloads > :last-child:nth-child(odd)` then gives it the whole
row rather than leaving it beside a gap. **That rule is confined to the
two-column band by a media query, and the band's top end is 841px rather
than the 824px the arithmetic gives.** `vw` counts the scrollbar and the
element does not, so a browser reserving 15px for one reaches three
columns about 18px later. Erring high costs a slightly late switch; erring
low leaves a real browser with the stranded button this is here to
prevent. Measured across 1440 / 900 / 842 / 824 / 700 / 560 / 500 / 375 —
842 is exactly where the third column arrives.

### The album sleeve

`assets/img/album-cover.jpg` heads the album section of `access.html`,
**in place of the section label that used to say "THE ALBUM"** — the words
on the sleeve say it better, so `access.tracks_label` is gone from
`content.js` entirely. Centred, `min(100%, 400px)`, and it inherits the
3.5em of air the label had beneath it, so the track list is untouched.
No border: the sleeve carries a paper edge of its own and a frame around
a frame is one too many. The `width`/`height` attributes in the markup
are the file's real pixels, which is what stops the track list jumping as
it loads.

**Eric supplies a 2000px, ~5 MB PNG; the site gets a 900px JPEG.** The
page shows it at 400px, so the master is about 25× more than anyone needs
and would land on phones alongside twenty audio files. `album-cover.png`
is therefore **gitignored**, the same bargain as the video masters:

```
sips -s format jpeg -s formatOptions 82 --resampleWidth 900 \
  assets/img/album-cover.png --out assets/img/album-cover.jpg
```

That lands ~216 KB and holds the brush texture, the paper grain and the
spray. Check a detailed area against the master rather than a flat one.
Replacing the sleeve means a **new filename** per the cache rule for
images, and updating the `src` in `access.html`.

**`data-content-alt` does not run the asterisk convention.** `main.js`
applies `format()` — which turns `*stars*` into the show-title
treatment — only where it writes HTML. The alt path calls
`setAttribute('alt', …)` with the raw string, so stars written there are
read out loud as stars. `access.cover_alt` says so in its own comment.
(`hero.title` is an array of plain words, so the two existing alt slots
were never affected.)

### The icon

`assets/img/favicon-32.png` and `apple-touch-icon-180.png`, linked from the
head of both pages. They are the **G of GRAY lifted out of the title
artwork** and set on weathered paper mixed from the site's own palette —
`--paper` mottled toward `--paper-dim` and `--paper-shadow`, edges darkened
the way a handled sheet goes, paper-fibre grain over it. Duotone, like
everything else. Eric asked for this on 28 September 2026, having twice
declined a favicon before; that earlier note is gone and this is settled.

Built by `tools/make-icon.swift` — the G is a painted, halftoned letter, so
it cannot be set as type and the tool is the only way back to it:

```
swiftc -swift-version 5 -O tools/make-icon.swift -o "$SCRATCH/make-icon"
"$SCRATCH/make-icon" assets/img/gray-man-title.png out.png <size> [texture] [inset] [weight]
```

The letter is **found, not cropped by hand**: the tool takes the tight
bounding box of the ink inside a search rect. `tools/find-letter.swift`
prints where every line of type and every letter sits, which is how that
rect was set and how to re-point it if the artwork is ever re-exported.
Current reading, top-origin: THE `y 1202…1459`, GRAY `1493…2037`, MAN
`2078…2658`; the G is `x 657…1125, y 1493…2037`, with the R starting at
`x 1150`.

**Do not add a vertical flip when reading the artwork's pixels.** A bitmap
context's first row of memory is the top of the picture, so drawing
straight in gives a buffer whose y runs down the image — which is what
every reader in both tools assumes. A flip there inverts the axis, which
silently points the search rect at the wrong line of type *and* hands back
an upside-down G. Both happened.

**The two sizes are tuned differently on purpose.** At 180px the full
texture reads, so it gets `texture 1.0, inset 0.16, weight 1.0`. At 32px
the grain turns to mush and thin strokes break up, so the favicon gets
`texture 0.35, inset 0.10, weight 1.25` — less texture, tighter crop,
heavier strokes. Judge any change with `tools/`-built proofs at true size,
never at a comfortable magnification.

**Replacing either file means a new filename**, per the cache rule for
images, and updating the two `<link>` lines in both pages. A version tag on
the address does not shift a favicon reliably — browsers hold those apart
from everything else. For the same reason, don't write the literal
characters `?v=` into prose in `index.html`: the documented way to find the
current number is `grep -o '?v=[0-9]*' index.html | head -1`, and a comment
containing it becomes the first match.

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

Unlinked from the main site and `noindex`. **The album is not part of this
website.** Its audio, words, notes and downloads live in a private
Cloudflare R2 bucket, `grayman-vault`, which has no public address of its
own, and the only way to them is a Worker — `cloudflare/vault-worker.js` —
on the route `graymanmusical.com/vault-api/*`. See The vault below.

**Anything committed becomes a public URL at `graymanmusical.com/<path>`.**
A guide written for Eric with the password in it was committed and served
publicly for five days before anyone noticed. `READ-ME-FIRST.txt` and
`cloudflare/HOW-TO-DEPLOY.txt` are gitignored for that reason — they stay on
Eric's disk. Check any new documentation file for secrets before adding it.

### The vault

Set up 29 September 2026, replacing a gate that only ever ran in the
browser. Before it, `access.js` held a SHA-256 of the password and the
files sat in `assets/` on a public GitHub Pages site — so the album was
downloadable by anyone with the address, password or not, and also
straight from the public repo. That is what this closes.

**Nothing secret is in this repo.** The worker's source is committed on
purpose; it holds no password. The secrets live at Cloudflare and
nowhere else:

| Secret | What it is |
|---|---|
| `VAULT_PASSWORD` | the password handed out with an invitation |
| `SESSION_SECRET` | a long random string that signs session cookies |
| `RESEND_API_KEY` | lets the worker hand an email to Resend to deliver |

And two stores arrive as bindings: `VAULT`, the R2 bucket of album
files, and `MEMBERS`, a D1 database — see The guest list below.

#### Moving from one password to emailed codes — where this stands

Begun 29 September 2026, in the stages Eric set out. **Stages 1 and 2
are done; the password is still the only way in until Stage 3.**

- **Done — the guest list.** A D1 database `grayman-members`, bound as
  `MEMBERS`, one row per approved address. Its shape is in
  `cloudflare/vault-schema.sql`: `email` (trimmed, lowercased, and
  `COLLATE NOCASE` as a second guard), `source` (`manual` or
  `gumroad`), `added_at`, `last_login`. **D1 rather than KV** because
  the admin page must list everyone in order, and counting wrong code
  attempts needs an exact answer immediately, which KV's eventual
  consistency cannot give.
- **Done — sending mail.** Resend, whose DNS was already in place on
  the domain. `sendEmail()`, `normalizeEmail()` and `findMember()` are
  in the worker, along with `GET /vault-api/send-test?to=…`, which
  proves all three in one visit from a browser. Confirmed working
  29 September 2026.
- **Next — Stage 3:** replace the password box with an email box and a
  6-digit code. Then 4, the admin page behind Cloudflare Access; 5,
  Gumroad; 6, testing and `VAULT-GUIDE.md`.

**`send-test` is temporary and comes out in Stage 4**, when the admin
page takes the job over. Two things guard it and neither is a new
secret: a valid vault session, and the address being on the guest list
already — so it can never mail a stranger.

**The emails' wording lives in `cloudflare/vault-worker.js`, not
`content.js`.** That is the third deliberate exception to the
one-rule: this code runs at Cloudflare and has no way to read
`content.js`. Anything read on the *page* still belongs there.

**Comments in `cloudflare/vault-schema.sql` must be the `/* … */`
kind.** The D1 console runs a paste as a single line, so a `--` comment
swallows the rest of the file and D1 answers "Requests without any
query are not supported". That happened; it cost a round trip. Block
comments survive being flattened.

**To change the password**, edit `VAULT_PASSWORD` in the Cloudflare
dashboard — Workers & Pages → `grayman-vault` → Settings → Variables and
Secrets. Nothing in the repo changes and **no `?v=` bump is needed**,
because no part of the site knows the password any more. Sessions already
issued keep working; changing `SESSION_SECRET` instead signs everybody
out at once, which is the lever for a leaked session.

**How a visitor gets in.** The page POSTs the typed password to
`/vault-api/login`. The worker checks it and sets `tgm_vault`, a cookie
that is **HttpOnly** (no script can read it, including the site's own),
**Secure**, `SameSite=Lax`, and good for 30 days. It carries who it is
for and when it expires, signed with `SESSION_SECRET` — so nothing is
stored at Cloudflare's end and an edited cookie simply stops verifying.
On load the page asks `/vault-api/session` rather than trusting anything
it remembers. `tgm_vault_seen` in `localStorage` is only a hint that
stops the password screen flashing past a returning listener; it cannot
let anyone in.

**Everything is a 404, never a 403.** A refusal would confirm a file is
there. A track that exists and one that never did answer identically.

**Addresses.** `assets/audio/01.mp3` became `/vault-api/audio/01.mp3`;
the same for `lyrics/`, `notes/` and `downloads/`, which are the four
folder names inside the bucket. `content.js` download entries are now
written `downloads/name.pdf` — the `/vault-api/` is added by `access.js`.
`safeKey()` in the worker allows those four prefixes and nothing else,
which is also what stops `..` walking out of the vault.

**`Cache-Control: private` on every file is load-bearing.** Cloudflare
caches `.mp3` by default on extension. Without `private`, its edge could
hold a track and hand it to somebody carrying no cookie at all — which
would undo the whole thing.

**Adding or replacing a track now takes two steps, not one.** The file
goes in `assets/audio/` as before *and* into the bucket, or the track
reads "Soon". Same for lyrics and notes. `content.js` says so beside
each list.

**Still true, and Eric knows it:** a listener who has signed in can save
the files — their browser has to receive them to play them. This shuts
out strangers, search engines and GitHub; it does not stop a subscriber
keeping the mp3s.

**The files are gone from this repo and from its history**, removed with
`git filter-repo` on 29 September 2026 and force-pushed. 74 commits were
rewritten; four vanished entirely because they held nothing but audio and
lyrics (*Add the first three album tracks*, *Catch and Release*,
*Hurricane Charli*, *Songs and Lyrics for Access Page*). 71 MB and 24
audio blobs went — 24 rather than 18, because tracks 02, 12 and 13 had
superseded earlier versions still sitting in history. The files remain in
`assets/audio/` and `assets/lyrics/` on Eric's own disk, **gitignored**,
which is what the preview server reads.

**One thing this did not close.** GitHub keeps commits fetchable by their
exact ID after a force-push, so
`raw.githubusercontent.com/…/c675393…/assets/audio/01.mp3` still answers
200. Only GitHub Support can purge that. The repo has 0 forks and no
Wayback snapshot, so nobody plausibly holds those IDs — but it is not
zero, and it should not be described as if the files were erased.

**Cloudflare's edge cache outlived the deletion too**, which is worth
remembering for any future removal. `.mp3` is cached by extension, so the
site went on serving `assets/audio/01.mp3` for minutes after GitHub Pages
had stopped — `cf-cache-status: EXPIRED` was the tell, while `.lrc`
(not a cached extension) 404'd at once. Purging the Cloudflare cache is
part of removing a published file, not an optional extra.

**Previewing locally.** `tools/preview-server.py` answers `/vault-api/`
itself, from the folders under `assets/`, and says everyone is signed in
— there is no password between Eric and his own disk. Two switches exist
for testing the password screen, which a preview would otherwise never
show: `TGM_PREVIEW=locked` (the gate appears; "open sesame" is accepted)
and `TGM_PREVIEW=offline` (the relay never answers, so the page shows
`gate_offline`). Both are testing aids in a tool that is never published.

### The locked door

Under the password form, between it and the back link, the gate offers
**"No invitation?" and a Purchase Full Digital Access button** — added
29 September 2026, so someone who arrives without a password has somewhere
to go other than away. It shows on the wrong-password screen too, which is
when it is most use.

**The shop address is not written twice.** `#gateBuy` takes its `href` from
`music.early_access.url` — the same address the main page's button uses —
so there is one place to change it and no way for the two to drift apart.
Only the words are the gate's own (`access.gate_no_invite`,
`access.gate_buy`), because "Purchase Early Digital Access" beside a
password box is answering a different question from the one it answers
under the album on the main page. The whole block is `hidden` until that
address exists, the same rule the main page's button follows, so the site
never shows a way to buy that leads nowhere. It is wired in `main.js`
beside the main page's button, guarded on the element existing, since that
file runs on both pages.

**It cannot reuse `.cta__button`.** That one is paper on ink, for a dark
section; the gate is paper, so it would be invisible. `.gate__buy` is
outlined like the Enter button beside it but in `--gray-mid` rather than
full ink, so the two read as first and second choice instead of competing
— Enter is still the primary thing to do on that screen.

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
- **The singer is named under each title** — `.track__credit`, read from
  `access.track_artists` by the same rule the lock screen uses, so a song is
  never credited one way in the list and another way on a phone. It sits
  *inside* `.track__title` rather than beside it, which is what leaves the
  row's fixed flex columns alone (see the load-bearing rules). It is set in
  sentence case, not the site's usual tracked capitals: these are people's
  names, and twenty rows of them set that wide out-measure the titles they
  belong to. `--gray-mid`, and the colour is declared rather than inherited
  so `.track--playing` lifting the title to white leaves the credit quiet.
  **`creditFor()` is a deliberate second copy** of the one in `lyrics.js`:
  `lyrics.js` already depends on `access.js` for the album, and reaching
  back the other way for a three-line lookup would tie the two files
  together in both directions. Change one, change the other.

**Prev and next are not in this file.** `access.js` owns the rows, the
roll-on at the end of a song, and the volume. Everything else that moves
the album — the stage's transport, the panel's, and the lock screen's —
is in `lyrics.js`, because that is where `current` and the album array
live. Don't add a second copy here; see The transport in the head.

**Numbers come from position in that list, not from anything written down.**
So adding or deleting a track renumbers every track below it, and the files
on disk do not follow: `assets/audio/NN.mp3` and `assets/lyrics/NN.lrc` would
then belong to the wrong songs, silently. After any change to the list, check
which numbered files sit below the change and rename them — and move
`bonus_starts_at` by the same amount, or the bonus heading lands on the wrong
song. (Eric removed track 18 in September 2026; every file happened to be
numbered 17 or lower, so nothing needed renaming that time.)

**Renaming a track is the other half of that.** Titles are the key
`access.track_artists` is looked up by, so a rename has to happen in both
places or that song silently loses its singer. Numbers don't move on a
rename, so the files on disk are fine. (Eric renamed track 19 to
"I Will Reach For You (Demo)" on 28 September 2026, and both "Hurricane
Chatter" tracks — 02 and 14 — to "Weather Chatter" on 29 September. He
did both places each time.)

**To open the vault while testing, don't type the password** — that is
Eric's to type, and this environment has no copy of it. The local preview
server lets everyone through anyway, so nothing is needed. Against the live
site there is no way in without the password, which is the point.

---

## Lyrics, and the Liner Notes panel

The panel is named **Liner Notes** on the page, because it holds two views
of whatever is playing. The file, the folder and this section are still
called lyrics, which is the older name and not worth churning.

`assets/js/lyrics.js` runs the panel that follows the album, loaded **before**
`access.js` in `access.html` — deliberately, because `access.js` builds the
album the instant it runs for a visitor already through the gate, and the
panel has to be listening by then. The handover is `window.TGM_ALBUM` plus a
`tgm:album-ready` event carrying `{ number, title, audio }` per track; the
panel reads both, so load order can't silently break it.

When a track starts, it fetches `assets/lyrics/NN.lrc`, falls back to
`NN.txt`, then says there are none. Answers are kept per track for the visit,
and a stale one is dropped if the listener switches tracks mid-fetch.

**Pressing play opens the panel**, on any screen and for every track —
including the roll-on to the next one, so the words follow the album through.
`openForPlay()` hangs off each track's own `play` event, before the words are
asked for, so the panel is already travelling while the file is being found.
It stands down when the panel is already on screen (`isVisible()`), which is
what lets a listener shut it mid-song and have it stay shut until something
new starts — and what keeps a roll-on from disturbing the expanded stage.
It deliberately does **not** write to `tgm_lyrics`: the tab is still what
decides how the panel arrives on the next visit, and a press of play
shouldn't quietly overrule a listener who closed it.

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
Liner Notes tab as its handle — `access.panel_button`, which is deliberately
a different key from `lyrics_button`: the handle names the whole panel, the
tab inside names one view of it. At ≥1280px it sits in the margin beside the 720px
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

**The line shown before anything has played has a version for the stage** —
`lyrics_waiting_expanded`, because up there the track list the panel's own
line points at is behind the words. (There are three in all — the panel's,
the stage's and the phone's; they are set out together under The phone
sheet.) A `waiting` flag, true until the
first `show()`, is what lets opening and closing the stage swap between
them without ever overwriting "No lyrics for this track". On the stage the
status is absolutely centred rather than in the flow, which is safe
because the status and the words are never both on screen.

With nothing playing yet the stage's play button **starts the album** at
its first track that has audio, and says which one in its label. In full
screen the track list is out of sight, so this is the only way in.
`firstPlayable()` skips tracks flagged `data-missing`, which means the
transport is redrawn on any track's `error` — not only the one on show,
because a 404 changes which track the button would start. access.js sets
that flag from its own `error` listener, attached first and so already run
by the time this one fires.

**`isVisible()` is `isOpen || isExpanded`** — the panel can be shut and the
stage still up, and the words follow the song in either shape. That is a
different question from whether the drawer is open. (`isShowing()` adds one
more condition on top; see Liner notes below.)

Full screen is asked for on top of the overlay and refused gracefully: the
request is made inside the click, where a browser will grant it, and a
rejection is swallowed. **Confirmed working in Chrome and Safari**
(24 September 2026) — the built-in browser pane refuses the API outright
with `Permissions check failed`, so only the refused path can be tested
here, and that is not a fault to chase. Leaving full screen by any route (Escape, F11, the
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

### Liner notes — the panel's other tab

The head carries a `role="tablist"`: Lyrics and Notes, with the track
number after them. The choice is remembered in `localStorage` under
`tgm_lyrics_view`, Lyrics is the default, and because the whole panel is
what the stage lifts, the tabs work unchanged in the expanded view and in
the phone's slide-up sheet.

**Two panes, not one that is rebuilt.** `#lyricsScroll` and `#notesScroll`
both exist and one is `hidden`; switching only flips that. Each keeps its
own scroll position, and the lyrics keep their rendered lines, their
timings and their place in the song while the notes are on top. Only the
view being read is fetched — `loadView()` leaves a pane alone once
`wordsFor` / `notesFor` says it already holds the right track, so
switching back and forth costs nothing.

**Two questions, not one.** `isVisible()` is whether the panel is on
screen at all; `isShowing()` adds *and the words are the view*. The song
is only followed when `isShowing()`, because a hidden pane has no height
to measure the reading line against. Switching back to Lyrics calls
`remeasure()` for exactly that reason.

**Notes are Markdown** in `assets/notes/NN.md`, numbered like everything
else, with `notes_version` in `content.js` as their cache tag. The reader
in `lyrics.js` is deliberately small: paragraphs, `#`–`###` headings
(rendered h3–h5, since the track title is the h2 above), `*italic*`,
`**bold**`, `***both***`, and `---` for a rule. One Return is a line
break, two start a paragraph — what someone typing into TextEdit expects.
**Emphasis is asterisks only**: underscores are left alone on purpose so a
file name or an address survives intact instead of turning silently into
italics. Every line goes through `escapeHtml()` before any tag is added,
so nothing written in a note can become markup of its own.

Two things that look like details and are not. The notes pane fades only
at its foot — the lyrics' top fade would half-dissolve a first heading,
which reads as a fault in prose. And `.lyrics__tabs` wraps: at 1280px
exactly the panel is at its narrowest and the row has about 169px to
work in, where overflow would put the track number underneath the expand
button, an auto margin having no free space left to place it. That wrap
is also what lets the transport below take a line of its own up there.
**On a phone that same row does the opposite** — `flex-wrap: nowrap`,
because there is a second row's worth of controls in it and a break
would push them off the bottom of the head.

### The transport in the head

**Previous / play / next sit in the tab row, on every screen the panel
appears on.** They move the album's own `<audio>` elements — the same
ones the track rows move — so every play mark on the page agrees
without being told, exactly as the stage's transport does.
`playableFrom()` walks the album skipping anything access.js flagged
`data-missing`, which is how Next crosses a gap the same way the
end-of-song roll-on does; `firstPlayable()` is that same walk from the
top. Previous restarts the track past `RESTART_AFTER` (3s) and at the
first track, where there is nothing behind it. Next disables itself
when `nextPlayable()` comes back empty, which is the end of the album —
not the last row, since the last rows may have no files. Both step
buttons are disabled until something has played. The icons come from
`mark(path, size)`, so every play mark on the site is one drawing at
whatever size is asked for.

**None of this is gated in JavaScript** — it was phones-only by CSS
alone, and desktop was turned on by letting the rules through. Three
shapes, matching the panel's own three:

| Panel | Buttons |
|---|---|
| ≤620px, the sheet | 44px, inline at the right of the tab row |
| 621–1279px, docked | 28px, inline at the right of the tab row |
| ≥1280px, in the margin | 28px, **on a line of their own** |

At 1280px the panel is at its narrowest — 219px, leaving about 169px in
that row — and two words of letterspaced capitals plus three buttons do
not fit. So up there the transport takes `flex: 0 0 100%` and drops to
its own line. **Given a line rather than left to find one:** allowed to
wrap where it liked it sat beside the tabs above about 1700px and below
them under it, so the play button changed rows as a window was resized.
Its negative left margin is optical — it brings the first icon's edge
over the L of LYRICS instead of its button's box, which is 6.5px wider.

**`.stage .lyrics__transport` is `display: none`, and that is
load-bearing.** The stage does not draw its own copy of the panel; it
*lifts the panel into itself*, so without that rule these buttons would
travel in and sit above the stage's own transport. The stage is
otherwise untouched.

That 1280px override, like the phone ones, must sit **after** the base
rule in the file. Same specificity, and a media query adds none, so
source order is the whole of it — placed earlier it silently does
nothing, which is exactly what happened first time round.

### The phone sheet

Below 620px the panel covers the track list, so it carries two ways of
getting out of the way that it has nowhere else. Both are in
`lyrics.js`, both gated on `onPhone` (`max-width: 620px`) **and**
`isOpen && !isExpanded` — so neither can reach the panel on a computer
or the stage. `onSheet()` is that question asked once. (The transport
above used to be gated the same way, and is not any more.)

**There is no backdrop over the album, deliberately.** The list stays
scrollable behind the open sheet, and every listener on the page is
passive so it scrolls at full speed. What decides whether a touch
belongs to the panel is where it started and how it moved, nothing more.

**A tap on the page behind puts the sheet away.** Watched from
`touchstart`, not `click`: on a phone a click arrives after a scroll's
momentum settles, so a flick down the album would have closed the panel.
A touch counts as a tap only under `TAP_SLOP` (10px) and `TAP_TIME`
(300ms), and only when it did not land on the panel, the handle, or
anything in `INTERACTIVE` — a play button or seek bar does its own job
and the panel stays put. It closes through `setOpen(false, true)`, the
same door and the same saved preference as the handle.

**A swipe down the top edge puts it away too, following the finger.**
That edge is two elements — the head, and the Liner Notes handle riding
its corner — so `grip()` attaches the same five listeners to both and
they answer a thumb identically. Shut, the handle is the only one of
them on screen and `onSheet()` keeps it inert: a tap is still what
opens, and a tap is still what closes. The drag is published as one
custom property, `--lyrics-drag`, which the open rules for both the
sheet and its handle add to their own transforms — so the handle rides
the edge down without either of them knowing about the other, and the
JS never has to know where either sits.
`DRAG_GRIP` (8px) is how far a finger travels before the panel takes it,
which is what leaves a tap on a tab working; a gesture more sideways
than downward, or upward at all, is let go rather than fought for.
On release it closes past `DRAG_SHARE` (30% of the panel) **or** above
`FLICK` — 1.1 px/ms, set high on purpose, because a considered drag runs
at 0.2–0.8 and a lower bar closed the panel on gestures that were being
aimed rather than thrown. Speed is read from the lift, falling back to
the last two moves, since a flick usually ends exactly on its final
move and would otherwise measure as standing still. A drag that happened
swallows the click it would otherwise have fired on whatever it set off
from, once, on a 400ms fuse — which on the handle is load-bearing, not
tidiness: without it the toggle would fire straight after the drag and
put the panel back exactly where the swipe had just taken it from.

**That swallow is caught at the document, not on the handles.** At the
element a touch landed on, a capturing listener holds no priority —
every listener on the target runs in the order it was added, whatever
its phase, and the handle's own open-and-close was added long before.
From the document's capture phase the press is stopped before it
reaches either handle.

`html.lyrics-dragging` takes the transition off under the finger;
`html.lyrics-settling` gives the snap-back 0.42s rather than the
drawer's own 0.8s. That is the one place the site's slow motion is
shortened, and it earns it: direct manipulation that crawls home reads
as having stuck rather than having been let go. The opening and closing
slides keep their unhurried pace.

**The waiting line now has three versions**, because it points at a
different way in each time: `lyrics_waiting` in the panel beside the
list, `lyrics_waiting_expanded` on the stage, and `lyrics_waiting_phone`
on the sheet — the last two because the list is behind the words there,
and both of those carry a play button instead. `waitingLine()` picks;
returning null means the two views each use their own wording, which is
the computer case. It is re-asked on the media query's `change` **and**
on `resize`, which is not belt and braces: a reload landing mid-resize
left the page on the wrong side of the query with only the first.

**Testing this needs a real handset.** A desktop browser's touch
emulation fakes these badly — it never reproduces momentum scrolling or
the gap between a finger's last move and its lift, which is precisely
what the flick reading depends on. `python3 tools/preview-server.py
--phone` binds to the Wi-Fi instead of just this machine and prints the
address to type into a phone. Without the flag it stays on localhost,
which is what a preview should do.

### The lock screen — the transport nobody can see

The Media Session: the lock screen, Control Center, a car stereo over
Bluetooth, the squeeze of an AirPod stem. The browser treats these as one
thing, and so does this file — as a **fourth transport**, alongside the
stage's, the phone sheet's and the album's own rows. Like them it moves
`current.audio` and nothing else, and is painted from the same reading of
it, which is why none of its logic is new.

**It lives in `lyrics.js`, not `access.js`, and that is deliberate.**
Everything it needs — `current`, `album`, `goPrevious`, `goNext`,
`firstPlayable`, `RESTART_AFTER` — is already in that file's closure.
Putting it in `access.js` would mean exporting all of that across the
two, which is more code and more coupling than moving eighty lines to
where the state already is. `previoustrack` **is** `goPrevious`, so the
three-second restart rule is the same rule on a lock screen as under a
thumb, because it is the same function. The cost: this rides on
`lyrics.js` loading. It always does on `access.html`.

**`playPause()` was split into `startPlaying()` and `stopPlaying()`.** A
button on the page toggles — it is showing you which of the two it will
do. A phone sends `play` and `pause` as separate orders, and a toggle
there would stop a song that a stray `play` arrived for. `playPause()`
now calls the other two, so there is one copy of the work.

**`seekbackward` and `seekforward` are set to `null` on purpose.** Offer
to jump ten seconds and iOS gives the listener two jump buttons; decline,
and it gives them skip-track buttons instead, which is what an album
wants. `nexttrack` is also handed `null` at the end of the album, which
greys it out there the same way the panel's own Next greys out —
`drawTransport()` does both in the same breath.

**`setPositionState` is told when the truth changes, not per frame.** The
phone runs its own clock from a position and a playback rate, so it needs
a new reading on a seek, a pause, a new track — and nothing in between.
Measured: zero extra calls across 2.5s of plain playback. It throws if
the position runs past the duration, so the position is clamped and a
missing or infinite duration clears the state instead.

**The artwork is `COVER_STEM` plus `COVER_SIZES`** — 192, 384 and 512,
built from the gitignored master with the same `sips` line as the sleeve.
A phone picks the size it wants (Chrome takes the 192, so 19 KB rather
than the page's 216 KB copy). Replacing the cover means new filenames for
all four pictures, per the cache rule, so `COVER_STEM` changes here and
the `src` changes in `access.html`.

`access.media_album` and `access.media_artist` in `content.js` are the two
lines under the title. They are deliberately their own keys rather than
borrowed from `hero.byline_name`: what a lock screen calls the artist is
not always what a page calls the writer.

**`access.track_artists` credits the singer of each song**, and
`creditFor()` falls back to `media_artist` where a name is left blank —
which is most of them. It is **keyed by title, not by track number, and
that is the whole point.** Numbers here come from position in the list,
so adding one song renumbers every song below it; a list of singers
keyed by number would go on looking right while crediting all of them to
the wrong songs. A title moves with its song.

Every title on the album is pre-listed there with an empty value, so
Eric never has to type one — he fills in names between the quotation
marks. Renaming a song means renaming it in both places. A key matching
no song is otherwise a silent no-op, so `start()` warns once to the
console for each one; visitors never meet it, and anyone hunting the
fault finds it immediately.

All of it sits behind `hasMedia`, and every `setActionHandler` behind a
try/catch — a browser that has never heard of an action must not take the
page down with it.

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

- **Local preview:** `python3 tools/preview-server.py` (port 8420), or
  `--phone` to also answer the Wi-Fi and print the address for a handset —
  the only way to test the album page's touch gestures honestly. Use it
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

**A test fixture that stands in for the album must carry access.js's own
listeners.** A hand-built array of `<audio>` elements has no "starting one
pauses every other" and no end-of-song roll-on, because those are added in
`buildTrack()`. Without them two tracks play at once, and a helper that
reports "what is playing" by finding the first unpaused element answers
with the wrong one — which reads exactly like Next being broken when it is
not. That cost a wrong diagnosis once; the fix is two lines in the fixture.

**The built-in browser pane's screenshot coordinates are not CSS pixels.**
The frame is reported with every screenshot and is usually smaller than the
viewport, so a coordinate read off the page has to be scaled before it is
clicked. Clicking by `ref` from `find`/`read_page` sidesteps the whole
question and survives the page scrolling between measuring and clicking —
prefer it.

**The pane also cannot do true full screen** (`Permissions check failed`),
so only the refused path of the stage is testable here. Eric confirmed the
granted path works in Chrome and Safari; don't chase it.

---

## Where things stand (28 September 2026)

Live at `?v=57`. `audio_version: 3`, `lyrics_version: 3`, `notes_version: 1`,
`bonus_starts_at: 19`, twenty tracks.

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
- **The site has a favicon now.** Eric declined one twice and then asked
  for it on 28 September 2026. Settled; the old "don't offer again" note
  is gone.
- **The album section has no label.** "THE ALBUM" was replaced by the
  sleeve on 28 September 2026 and `access.tracks_label` deleted. The
  picture says it; don't put the words back.

**Done recently, so the shape of the album page is not what older notes
assume.** All of 24–28 September 2026: the expanded full-screen view, the
Liner Notes panel with its two tabs, the panel opening when a track
starts, the phone sheet's transport and its tap- and swipe-to-hide, the
same transport on desktop, the favicon and Apple touch icon, the album
sleeve heading the section, the lock screen through the Media Session,
and a named vocalist for every track. Each has its own section above.

**Unfinished, in rough order of how much they matter.**

- **All three download buttons on the access page lead nowhere.** Listening
  Guide, Lyric Booklet and About the World are named in
  `content.js` but `assets/downloads/` holds only its instructions file, so
  a supporter clicking any of them gets a 404. **Eric knows and is making
  the files; don't raise it again.** If they are still missing much later,
  the alternative is to have a button hide itself when its file is absent —
  download buttons are always drawn, so unlike the video and buy-access
  links, emptying a label won't do it. (There were four: the full-album zip
  was dropped on 29 September 2026. "Listening Guide" was briefly renamed
  "Liner Notes" the same day and put straight back — that name already
  belongs to the lyrics panel's handle, and one page should not have two
  different things under it.) **The three file names still read
  `listening-guide.pdf`, `digital-lyric-book.pdf` and
  `about-pawleys-island.pdf`**, which is no longer what two of the buttons
  say. Left deliberately: Eric may already be writing files under those
  names, and a button's label is a cheap thing to change where the name of
  a file he is making is not. Worth offering to line them up once the files
  exist.
- **Two tracks have no audio:** 09 Some Things Never Leave You · 15 The Gray
  Man. They read "Soon" and are skipped. (Eric added 04, 08 and 14 and
  replaced 02, 12 and 13 on 24 September 2026, bumping `audio_version` to 3
  — the whole album now runs at 127 kbps. He added 18 on 29 September;
  `audio_version` was deliberately *not* bumped, per the rule below.)
- **Three tracks have audio but no words:** 08, 13 and 18. Their panel says
  there are no lyrics, which is correct but not final. (02, 04, 12 and 14
  were written on 29 September 2026, `lyrics_version` to 3.)
- **No track has liner notes yet.** `assets/notes/` holds only its
  instructions, so every track's Notes tab reads "No notes for this track"
  — correct, and what a half-filled album should look like. Eric writes
  them one `.md` file at a time as he goes.
- **The Gumroad product is live** and sells early access, but nothing connects
  a purchase to this page or its password — a buyer is still let in by hand.
  That is a setting on Gumroad's side, not something in this repo. Since
  29 September 2026 the gate at least *points* at the shop (see The locked
  door below); it still cannot let anyone through.

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
