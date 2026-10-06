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
assets/audio/album.m4a the whole album as ONE recording — GITIGNORED,
                       on Eric's disk only. See The album player.
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
VAULT-GUIDE.md      the vault explained for Eric — published, holds no secrets
tools/              Claude's working tools, not part of the site:
                    preview-server.py, transcode-video.swift,
                    grab-frame.swift, make-icon.swift, find-letter.swift,
                    shrink-pdf.swift, join-album.py
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
- A `|` forces a line break, but **only where something has been built
  to honour it** — it is not a feature of `format()`, and a bar in an
  ordinary slot prints as a bar. Three places do:
  - a download button's label, which always breaks;
  - a video's `credit` (under `music.videos`), which breaks only on
    phones (≤430px), where the line would otherwise run edge to edge;
  - any `[data-content]` element carrying **`data-content-breaks`** in
    the markup, which always breaks. That attribute is opt-in for a
    reason: putting the replacement inside `format()` would reach every
    slot on both pages and turn the video credit's phones-only break
    into one that happens on every screen. Used by `access.thanks`.
  Nothing in an ordinary slot can be HTML — `format()` escapes the
  string before it does anything else — so `data-content-breaks` is how
  a line break gets into copy at all.
- **`[words](https://address)` makes a link, but only in an element
  carrying `data-content-links`** — opt-in for the same reason the
  breaks are: `format()` runs on every slot on both pages, and square
  brackets are ordinary punctuation everywhere else. Added 4 October
  2026 for the pre-save link in `access.thanks`, the only slot that
  uses it. The text is escaped by `format()` first, so nothing in
  `content.js` can become markup; `main.js` then adds the one tag. Only
  a full `http(s)` address with no space, quotation mark or angle
  bracket in it is accepted, which is also what keeps it from breaking
  out of the `href` it is written into; anything else is left on the
  page as typed. It opens in a new tab and is dressed as `.prose-link`,
  a copy of `.contact-link`.
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
reads About / Music / Journey / Contact / Early Access while the sections
read The Legend / The Music / The Journey / Representation. Eric was shown
this and said to leave it — short menu words scan faster. It is not a bug;
don't "fix" it. (He changed "News" to "Journey" himself on 3 October 2026,
so that one now does match; the key in `content.js` is still `nav.news`
and the section's id is still `#news`, which is not worth churning.)

**The menu has a fifth item, Early Access, and it is the one that leaves
the page** — it goes to `access.html`. Added 3 October 2026 with the
line under the buy button (see below). It sits last, after Contact, the
way a sign-in ends any menu, so the four that move about the page stay
together.

**Five items needed the menu closed up on a phone.** At the site's full
tracking EARLY ACCESS broke onto a second line at 375px and the row ran
from one edge of the glass to the other. Below 520px the links drop to
0.56rem and 0.16em tracking with `white-space: nowrap`, and are spread
by `justify-content: space-between` rather than a fixed gap — one rule
for every handset rather than one per width. Measured: one row at 375
(18px between words), at 320 (8px, after a 340px rule gives up some
margin), and at 520/521 either side of the switch. **`nowrap` is the
part that must not go.** A sixth item will not fit a phone; a label
much longer than "Early Access" will not either.

**"Already have access? Enter here." sits under the buy button in the
Music section**, `#haveAccess`, words from `music.have_access`. It is a
line with a link in it and deliberately not a second button — the
filled button is the one thing the page asks a new visitor to do. It
is the other half of the gate's "No invitation?", so each door points
at the other. Outside `#earlyAccess` on purpose: that block hides when
there is no shop address, and the way in does not depend on a shop.
Emptying `have_access.link` hides the whole line (`main.js`).

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
| A download already online | Bump `access.downloads_version` in `content.js` |
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

- **`novalidate` on the gate's email form.** `type="email"` is what
  gives a phone a keyboard with an `@` on it, which is worth keeping —
  but it also makes the browser refuse the submit and show its own
  terse popup, so `access.gate_bad_email` never appears and the site
  answers in a voice that isn't its own. `novalidate` keeps the
  keyboard and hands the judging back to `access.js`. Tested: without
  it, a mistyped address produced **no message at all** from the page.

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

**PDFs are shrunk before they go in, with `tools/shrink-pdf.swift`.**

```
swiftc -swift-version 5 -O tools/shrink-pdf.swift -o "$SCRATCH/shrink-pdf"
"$SCRATCH/shrink-pdf" in.pdf out.pdf 0.92
```

The booklet arrived on 30 September 2026 at **101.8 MB** and went in
at **9.9 MB — a tenth**, with every image at its original pixel
dimensions and every lyric page still selectable text. That is a file a
supporter downloads over a phone connection, so the size is the point.
**A second master, replacing the first, was compressed the same way on
2 October 2026** — 101,750,945 bytes down to 9,860,883, 9.7%, in under
two seconds, and indistinguishable from its master at 3x zoom on
painted texture. Same 38 pages, same 42 images, same two pages losing
selectability. The settings did not need revisiting.

**It went in under a NEW NAME, `the-gray-man-lyric-booklet.pdf`**,
because replacing a download means renaming it — see the rule below
and the comment in `content.js`. The longer name is also better on a
supporter's disk, where `lyric-booklet.pdf` says nothing about whose
it is. **The old `lyric-booklet.pdf` has to be deleted from the bucket
by hand**; nothing removes it, and left there it is simply an old copy
nobody links to.

**`listening-guide.pdf` needed no compression at all** when it was
added on 2 October 2026: 22 square pages at 12.38in, **no embedded
images whatever**, all vector text, 165 KB. Probe before reaching for
the tool — there was nothing there to do. (`file` reports it as 8
pages; that reads the linearization hint and is wrong. The PDFKit
probe's 22 is right.)

**It was replaced on 3 October 2026 and the new one is 4.8 MB** —
thirty times the first, because it carries a background image now
where the first was bare vector text. **Left uncompressed, and that is
Eric's decision, not an oversight.** He said so plainly when the size
was raised. Don't quietly shrink it, and don't re-raise it.

**The lesson from that exchange is worth more than the file.** The
instinct was to build a probe and measure before saying anything; Eric
already knew what had changed and what he wanted, and the measuring
was in his way. **When a download arrives and its size has moved, say
what the size is and ask, rather than investigating first.** The probe
is cheap to write when it is actually wanted.

**The reason it shrinks so far is the compression, not the resolution.**
The 42 images were stored as lossless Flate — what a design tool
exports — and were already only ~130 dpi, so there was nothing to gain
by downsampling and everything to gain by re-encoding as JPEG. **Check
which problem you have before reaching for a DPI setting.** The probe
worth rebuilding walks the page resources with `CGPDFDictionary…` and
prints each image's pixel size, filter and effective dpi.

**Never shrink a PDF by rendering its pages to bitmaps.** 33 of the
booklet's 38 pages carry real text; rendering turns all of it into
fuzzy, unselectable pixels. A Quartz filter — the machinery behind
Preview's "Reduce File Size" — touches images and leaves text and
vectors alone. Verified at 3x zoom on painted texture: no visible
difference between 0.92 and the master. Quality 0.85 and 0.92 came out
within 100 KB of each other, so there is no reason to go below 0.92.

**Known and accepted: two pages lose selectable text.** Where text sits
over artwork with transparency it gets flattened — visually identical,
but no longer selectable. On the booklet that was the title page and
the last, both display type nobody selects. Grafting the original pages
back costs 4.3 MB and **does not restore the text**, because
`PDFDocument.write` re-flattens them. That was measured; don't try it
again.

**Eric's master stays next to the web copy**, as
`lyric-booklet-MASTER-do-not-upload.pdf` — the same bargain as the video
masters. `assets/downloads/*` is gitignored entirely, so neither is ever
published, but only the short name goes into the bucket.


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

#### The sleeve turns over

Added 3 October 2026. The cover on one side, **the credits on the
other** — `assets/img/album-credits.jpg`. Press the left or right of
the picture to turn it, the middle to open it larger over the page,
where it goes on turning. A finger swipes it either way and the arrow
keys do the same. `assets/js/sleeve.js`, which touches nothing else.

**Four pictures, two sizes each.** The 900px copies are what the page
shows (211 KB each, both fetched on load so the turn is instant); the
2000px copies are fetched **only if somebody opens it**, named in
`data-full` on each `<img>`. Confirmed: a page load pulls the two
small ones and neither large one. The large cover is 693 KB and the
large credits 414 KB, which is why they wait.

```
sips -s format jpeg -s formatOptions 82 --resampleWidth 900 \
  album-credits-2000.jpg --out album-credits.jpg
```

**The credits picture needs its resolution, unlike the cover.** It is
a page of small type — the sponsor list at the foot is the smallest
of it — so an opened sleeve at 900px would be a picture of words
nobody can read. That is the whole reason the large copies exist.

**Its `alt` is the longest line in content.js on purpose.** The
picture *is* words, so "a page of credits" would tell somebody
reading with their ears nothing at all. `access.credits_alt` says who
sang, who played, who recorded and who paid for it. **Keep it in step
if the credits are ever redrawn** — nothing will warn you.

**The carousel is switched on from JavaScript (`sleeve--live`), never
assumed by the stylesheet.** With the file missing or JavaScript off,
both pictures simply sit one above the other — checked by taking the
class off. Nothing is hidden behind a control that cannot work, which
matters more here than usual: the credits would otherwise be
unreachable rather than merely awkward.

Three smaller things, each with a reason:

- **A swipe is swallowed so it cannot also fire the button beneath
  it.** The press zones cover the picture, so a finger drawn across
  the left of it would otherwise turn the sleeve twice. Same bargain
  the lyrics sheet strikes, on the same 400ms fuse.
- **`touch-action: pan-y` on the frame**, and `sleeve.js` lets go of
  any gesture more up-and-down than across. The page must go on
  scrolling under a finger that started on the picture. Tested: a
  vertical drag turns nothing.
- **The marks are shown outright under `(hover: none)`.** A touch
  screen cannot hover, and an arrow nobody can see is worse than a
  quiet one — swiping is natural down there but nothing on screen
  would say the picture had another side.

**Both pictures are PUBLIC, at `graymanmusical.com/assets/img/…`**,
the same as the cover always has been. `assets/img/` is not behind the
vault and never has been. The credits name private individuals in the
sponsor list; that was raised with Eric on 3 October 2026 rather than
decided quietly.

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

**There are four videos now, across both pages.** The Music section's
list of two, and two on `access.html` — a welcome film under the
album's heading, and a behind-the-scenes film at the foot after the
bonus tracks, with the thank-you line beneath it. Both access-page
films were added 30 September 2026.

All four are built by the same `buildVideo()` in `main.js` — the play
button, the poster, the caption rules and the hide-itself-on-error
behaviour are one piece of code. What is duplicated is the
`<template id="videoTemplate">` markup, deliberately: two small copies
beat one shared file that neither page owns. **Change a player and you
must change both templates.**

The access page's two are `content.js → access.welcome_video` and
`access.thanks_video`, each one object rather than a list, and emptying
a `file` removes that film. The page names them in `main.js` as a
two-row `pageFilms` table; a third would be one more row.

**`buildVideo()` pushes to `players` itself.** Pushing again at the
call site gives that player two copies of the pause-others listener.
That was written and caught before it shipped; it is the obvious
mistake to make when adding a film.

**One "nothing talks over anything else" block, run once after every
player exists.** It does two jobs: films pause each other, and a film
pauses any sounding `<audio>` — because the album is right there and a
film talking over a song is the one thing that must not happen. The
audio half works by finding `<audio>` elements rather than reaching
into `access.js`, so `main.js` needs to know nothing about how the
album is built. On the main page the audio loop finds none. **Tested in
all three directions:** film pauses film, film pauses album track, and
the main page's own one-at-a-time still holds.

**And the fourth direction, since 3 October 2026: a song starting
pauses any film.** The pre-launch review found the rule ran one way
only — a track pressed while the welcome film was talking played
straight over it, confirmed in the preview. The fix is a *capturing*
`play` listener on the document: a media element's `play` does not
bubble, but a capturing listener up at the document still sees it, and
that is what lets `main.js` catch the album's element without that
element existing yet when `main.js` runs (access.js builds it when the
vault opens). Tested both ways after: film pauses album, album pauses
film.

**Probe every master before assuming anything.** Both of Eric's
masters needed a different thing, and neither announced it:

| | `Access-Welcome.mov` | `TGM BHS.mov` |
|---|---|---|
| came in as | HEVC 1080×1920, 11.2 Mbps, **84 MB** | H.264 **2160×3840**, 44 Mbps, LPCM audio, **618 MB** |
| the trap | HEVC is unplayable in Firefox and on much of Windows | uncompressed audio, which mp4 barely carries |
| went out as | 17.1 MB, avc1 720×1280 | 31 MB, avc1 720×1280, AAC 125 kbps |

Both are 2.2 Mbps with `ftyp → moov`, and each encoded in about ten
seconds. `mdls` is useless on fresh video; the probe worth keeping is a
few lines of AVFoundation printing codec, natural size, frame rate and
bitrate for every track.

**`tools/transcode-video.swift` now encodes audio to AAC unless the
source is already AAC**, in which case it is still passed through
untouched. It says which it did. Before this it passed *everything*
through, and `TGM BHS.mov` would have shipped with **30 MB of LPCM** —
more than the whole video budget — that a good share of browsers play
as silence. Channel count is read from the source rather than assumed,
because asking the encoder for two channels it hasn't got fails at
`startWriting`. The AAC-passthrough path was regression-tested against
the welcome film after the change.

**Settled 30 September 2026: the access page's films stay in colour.**
The site is duotone and the teasers are near-monochrome VHS, so these
are the first saturated colour on either page — and the welcome film
also carries burned-in social-media captions in a rounded sans. It was
raised, and Eric's answer was that he wants **the video note kept
separate from the world's aesthetic for now**. Don't re-raise it, and
don't quietly grade a film toward the palette.

**The album runs straight into its closing film, and the padding at
that seam is overridden.** Two ink sections meet there with no gradient
between them, so `.section`'s deep padding — which exists to clear a
fade — was 230px of nothing and made the album look as though it had
stopped. Cut to about 100px by `#vault .section--from-paper`
(padding-bottom) and `#vault .section--contact` (padding-top), kept in
`vh` so it still breathes on a tall screen. **The `#vault` scope is
load-bearing:** the main page's contact section carries the same
`section--contact` class, and there the air is doing its job after the
Journey. Checked after the change — index's contact is still 90px and
its two `--from-paper` sections still 139.86px.

**The welcome film sits on the turn from paper to ink, and the
downloads follow close under it.** Eric asked for both on 3 October
2026. Before it the film sat on flat paper, then 144px of the paper
section's bottom padding, then the ink section's 240px fade behind
200px of padding: **344px from the foot of the film to the word
DOWNLOADS, now 92** (93 on a phone). The fade needs that room when
words have to keep out of it; a film is a picture with its own edge,
so the fade runs behind it instead.

How it is built, in `style.css` beside `.vault__welcome`:

- The fade is on the **paper** section, 420px up from its foot
  (`--welcome-fade`), ending at full ink exactly where the section
  does. It starts 45% down the film on a computer and 29% on a phone,
  so the heading is always on clean paper. The album section below
  drops its own fade and most of its top padding.
- **Both rules hang on `:has(.video:not([hidden]))`.** With the film
  emptied in `content.js`, or hidden because its file failed, the
  section is a label and a heading, and a fade from its foot would put
  ink words on a dark ground. Then neither rule applies and the page
  is exactly as it was. Tested by hiding the figure: 144px and 200px
  come back, and the ink section's own fade with them. A browser
  without `:has()` gets that same older arrangement.
- **The album section is pulled up one pixel over the paper one, and
  that is load-bearing.** The two meet at a fraction of a pixel
  (924.22), each is drawn part-way into the row they share, and what
  is left of the row shows the body's background — paper. Between
  paper and ink that never showed, because the fade *began* on paper.
  With ink on both sides it was a pale hairline right across the page.
  `margin-top: -1px` covers the row; the padding gives the pixel back.
  **The same thing may be true of the album → closing-film join**,
  also ink on ink at a fractional height (3262.81); it has not been
  seen there and was left alone.
- **`--welcome-fade` is read by two scripts.** The volume panel
  (`access.js`) and the Liner Notes handle (`lyrics.js`) flip from
  their paper dress to their ink one where the paper section ends —
  which is now the *dark* end of a fade, so they sat as pale chips on
  near-black for the last of the scroll. Both subtract half the fade
  (`fadeMiddle()`, a three-line copy in each) and flip at its middle.
  Unset means 0, which is the old behaviour. Change the 420 and both
  follow without being told.

Scoped under `#vault`; the main page's sections were measured after
and are untouched.

**The thank-you under the closing film is four lines, broken where
Eric put the bars, on every screen.** Set 4 October 2026: the thanks,
"Be sure to pre-save the album" with those last words linked to the
DistroKid pre-save page, "And spread the word…", and A HURRICANE IS
COMING! in capitals he typed himself. The earlier wording named
Spotify and Apple Music with nothing to tap; this is that gap closed.

**Holding four lines on a phone took a rule, because the first line
did not fit.** At the prose's ordinary 15.2px it is 331px wide and a
375px phone has 315, so it broke again and left MAN! on a row alone.
`.vault__thanks p` now takes `min(<the usual clamp>, 3.75vw)`: the
longest line is 21.76 × the font size and the column is 84% of the
screen, so 3.86vw is the most that fits and 3.75 leaves a few pixels.
It bites only below about 405px. Measured: four rows at 320 (12px),
375 (14.06px), 430 and 1280 (15.2px, untouched). The title also
carries `white-space: nowrap` so that if anything ever does wrap, it
wraps before THE GRAY MAN rather than through it. **If the words
change, the 21.76 changes with them — measure the new longest line
rather than guess.**

**The behind-the-scenes film carries a Carolina Theatre Workshop mark
burned into its corner.** The main page's teaser credits them properly
through `credit.text` / `credit.url`. This one's credit fields are
empty — mentioned to Eric, left for him to fill if he wants the credit
spelled out in words as well as in the corner of the picture.

---

## Early access page (`access.html`)

`noindex`, and **linked from the main page since 3 October 2026** — a
fifth menu item and a line under the buy button; until then it was
unlinked. That costs nothing: the gate is what protects the album, not
the address being hard to find. **The album is not part of this
website.** Its audio, words, notes and downloads live in a private
Cloudflare R2 bucket, `grayman-vault`, which has no public address of its
own, and the only way to them is a Worker — `cloudflare/vault-worker.js` —
on the route `graymanmusical.com/vault-api/*`. See The vault below.

**`.gitignore` denies whole folders now, and listing extensions is
what went wrong.** Until 2 October 2026 the rules named extensions —
`assets/audio/*.mp3`, `assets/notes/*.md` — so anything saved in
another format fell straight through. Eric's eighteen liner notes
arrived as `.txt`, **all eighteen were staged for commit**, and only a
check of what was about to go in caught them. They are personal
writing about his own life, and they would have been readable at
`graymanmusical.com/assets/notes/01.txt` by anyone. Nothing had ever
been committed, so there was no history to purge — this was a near
miss, not an incident.

The four private folders now read *deny everything, allow back the one
`PUT-…-HERE` note by name*. **Keep that shape.** It fails safe: a
`.wav`, an `.m4a`, an `.rtf`, a `.zip` — anything Eric drops in a
folder is ignored without anyone having to think of it first. Verified
against all six of those after the change, and that the four
instruction files are still tracked. `assets/video/` is deliberately
NOT in this list: its `.mp4` web copies are meant to be public and
only the `.mov` masters are ignored.

**Always read what `git add` actually staged before committing**, not
just what you expected it to. That is what caught this.

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
| `SESSION_SECRET` | a long random string. It signs session cookies **and** the stored hashes of codes in flight, so changing it signs everybody out and voids any unused code |
| `RESEND_API_KEY` | lets the worker hand an email to Resend to deliver |
| `ADMIN_EMAIL` | the one address allowed to open the admin page |
| `GUMROAD_TOKEN` | reads Eric's own sales, to confirm a purchase |
| `GUMROAD_PRODUCT` | which product grants access — its permalink or id |
| `GUMROAD_PING_SECRET` | the long random word in the address Gumroad posts to |

There was a third, `VAULT_PASSWORD`, until 29 September 2026. Nothing
reads it now.

And two stores arrive as bindings: `VAULT`, the R2 bucket of album
files, and `MEMBERS`, a D1 database — see The guest list below.

#### Moving from one password to emailed codes — where this stands

Begun 29 September 2026, in the stages Eric set out. **Stages 1, 2 and
3 are done: the password is gone and the gate is email plus a code.**

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
  in the worker. Confirmed working 29 September 2026. (A temporary
  `send-test` route proved it and was removed in Stage 4, the admin
  page having taken the job.)
- **Done — the gate.** Email in, six digits back, `?v=58`. The
  password is gone from the worker, from the page and from
  `content.js`. Two more tables, `codes` and `throttle`.
- **Done — the admin page**, at `/vault-api/admin`. See The admin page
  below.
- **Done — Gumroad.** A purchase adds an address; a refund or
  chargeback takes it away. See Gumroad below.
- **Done — `VAULT-GUIDE.md`**, the whole thing in plain words for
  Eric: how signing in works, adding and removing people, how Gumroad
  connects, the secrets by name only, a table of what to do when
  something breaks, and where the free plans run out. **It is
  published** at `graymanmusical.com/VAULT-GUIDE.md` and was checked
  for secrets before committing — it describes nothing the worker's own
  source does not already say. Keep it that way, or gitignore it.
- **Dashboard steps that belong to these stages and are Eric's to do** —
  check they happened rather than assuming. Rotating `SESSION_SECRET`,
  which ends every session issued under the old password; deleting the
  `VAULT_PASSWORD` secret, which nothing reads; adding `ADMIN_EMAIL`,
  `GUMROAD_TOKEN`, `GUMROAD_PRODUCT` and `GUMROAD_PING_SECRET`; setting
  up the Cloudflare Access application; pasting the Ping address into
  Gumroad; and pressing **Watch refunds and disputes** on the admin
  page. Until the rotation, anyone who signed in with the password is
  still inside on a 30-day cookie.
**All six stages are done, 30 September 2026.** Five of Stage 6's six
tests passed outright. The sixth — Gumroad — failed on the product
identifier, was diagnosed and fixed, and its adding half then passed;
its refund half is untested by choice, recorded under Settled below.

**Verified against the live site 29 September 2026**, from outside with
no session: `/vault-api/` audio, lyrics, downloads, `admin` and
`admin/list` all 404; `session` 401; the old `assets/audio/…` and
`assets/lyrics/…` addresses still 404; the Gumroad doorbell 404s on a
wrong secret, an empty secret and a GET. At the gate: a mistyped
address 400 `bad-email`, an unknown address 200 `{ok:true}` — the same
answer an approved one gives — a code with no row 401 `expired`, three
digits 401 `wrong`, and a code pasted as `12 34 56` reaching the
`expired` branch, which is the proof the spaces were stripped before it
was judged.

**Testing the gate from this machine spends Eric's own allowance.**
`curl` here goes out over his home connection, so it lands in the same
per-IP bucket he does — twelve code requests an hour. Five were used
on 29 September. Leave headroom, say so when any are spent, and note
that a malformed address costs nothing because it is refused before the
brake.

**Where the free plans actually run out**, in the order they would
bite. Worked out 29 September 2026, when Eric asked whether a guest
list over 50 would start costing money. It would not: **Cloudflare
Access seats are consumed only by people who authenticate through
Access, which is Eric alone on the admin page.** Supporters never touch
it — that is the reason the vault has its own front door rather than
putting listeners behind Access, which would have capped the album at
50 people.

| | Free allowance | What spends it |
|---|---|---|
| Resend | **100 emails/day**, 3,000/month | one per sign-in — the tightest |
| Workers | 100,000 requests/day | every track, seek and page load |
| D1 | 5M reads, 100k writes a day | a read per page load |
| Access seats | 50 | Eric, and nobody else |

The one to plan around is Resend's 100 a day. Ordinary use is nowhere
near it — people sign in once and stay in for thirty days — but an
announcement to a few hundred supporters could put half of them through
the gate in one afternoon, and codes 101 onward would simply not send.
Resend Pro is $20 for the month it is needed. Going over the Workers
limit returns Error 1027 rather than a bill.

**Eric took Resend Pro on 3 October 2026 for the launch month**, with
90 addresses on the guest list and the site going live on Monday
6 October. The 100-a-day line above is the free plan and does not
apply while Pro runs; a sign-in per device is one email, and a device
stays in for 30 days on its cookie. **Worth checking in early November
whether Pro is still wanted** — once the launch wave has signed in,
ordinary use is far under the free cap and the free plan is enough.

**The emails' wording lives in `cloudflare/vault-worker.js`, not
`content.js`.** That is the third deliberate exception to the
one-rule: this code runs at Cloudflare and has no way to read
`content.js`. Anything read on the *page* still belongs there.

#### Codes landing in spam — diagnosed and fixed

A code sent to a `mac.com` address went to Junk, reported
30 September 2026. **The cause was no DMARC record on the domain
at all** — confirmed by querying `_dmarc.graymanmusical.com` against
three resolvers and getting nothing back. SPF and DKIM were both
already correct, which is why this was easy to miss: the mail was
properly signed, but nothing published the policy tying the signature
to the domain, and Apple/iCloud is the strictest of the big providers
about exactly that. Eric had deferred DMARC during Stage 2 ("skip
DMARC for now"); this is that bill arriving.

Fixed the same day through **Cloudflare → Email → DMARC Management**,
which publishes the record and keeps the aggregate reports in its own
dashboard rather than mailing XML to Eric. Live record:

```
v=DMARC1; p=none; rua=mailto:…@dmarc-reports.cloudflare.net
```

**Verified: mail-tester.com scored the real code email 10/10** — SPF,
DKIM and DMARC all passing. The way to re-run that test is worth
keeping: add mail-tester's throwaway address to the guest list on the
admin page, request a code to it from `access.html`, read the score,
then remove it. That tests the mail the worker actually sends rather
than a theory about it.

**How the three records fit together, so none of them gets "tidied".**

| Record | Where | Leave alone because |
|---|---|---|
| SPF | `send.graymanmusical.com` | Resend's own; the envelope sender is on this subdomain, so this is the SPF that is actually checked |
| SPF | `graymanmusical.com` (root) | belongs to Email Routing — mail coming *to* Eric. **Never add Resend to it**; it is not consulted for the codes, and it risks the 10-lookup limit |
| DKIM | `resend._domainkey.graymanmusical.com` | signs as the root domain, so it aligns strictly with the From header |

Alignment passes on both counts: DKIM `d=` is the root domain
(strict), and the envelope's `send.` subdomain shares the
organizational domain with the From header (relaxed SPF).

**Two things on Cloudflare's DMARC page that look like faults and are
not.** *SPF policy: Soft fail* is the root record's `~all`, and
Cloudflare wants `-all` — but that record is not what the codes are
judged against, so changing it buys nothing and adds something that
can break. *BIMI: Fail* is the brand logo beside the sender name in
Gmail; it needs a Verified Mark Certificate at roughly $1,000–1,500 a
year and has no bearing on inbox placement. Ignore both.

**Still to do, and it is Eric's:** move the policy from `p=none` to
`p=quarantine` once the reports have had a week or two to show nothing
legitimate is failing. Raised 30 September 2026.

**What a 10/10 does not cover.** mail-tester grades configuration and
content, not reputation. The domain has almost no sending history, and
a burst of near-identical short emails each containing a number is,
to a filter, the shape of a new spam operation. It settles as real
people receive the mail. A mailbox that has already binned one code
also carries a per-user signal that no DNS record overrides — the cure
there is **Not Junk** plus adding the sender to Contacts, which is
also the right thing to tell anyone who writes for help.

**Comments in `cloudflare/vault-schema.sql` must be the `/* … */`
kind.** The D1 console runs a paste as a single line, so a `--` comment
swallows the rest of the file and D1 answers "Requests without any
query are not supported". That happened; it cost a round trip. Block
comments survive being flattened.

**To give somebody access**, add their email address to the `members`
table — by hand in the D1 console, or from Gumroad once that is wired
up. **To take it away**, delete the row. Nothing in the repo changes
and **no `?v=` bump is needed**: no part of the site knows who is on
the list. Deleting a row stops new codes but does not end a session
already issued; changing `SESSION_SECRET` signs *everybody* out at
once, which is the lever for a session thought to have leaked, and it
also voids any code still in flight.

**How a visitor gets in.** Two steps, both POSTs.

1. `/vault-api/request-code` with an address. The worker applies the
   brake, then answers `{ok:true}` **and only then** looks the address
   up and posts a six-digit code to it — through `ctx.waitUntil`, so
   the reply has already gone. That is what makes an approved address
   and an unapproved one take the same time as well as say the same
   words.
2. `/vault-api/verify-code` with the address and the digits. Right, and
   the worker sets `tgm_vault`, a cookie that is **HttpOnly** (no
   script can read it, including the site's own), **Secure**,
   `SameSite=Lax`, and good for 30 days. It carries who it is for and
   when it expires, signed with `SESSION_SECRET` — so nothing is stored
   at Cloudflare's end and an edited cookie simply stops verifying.

**The session's subject is now the email address**, where under the
password it was the single word `invite` for everybody. That is what
makes it possible to know, or later to revoke, one person.

On load the page asks `/vault-api/session` rather than trusting
anything it remembers. `tgm_vault_seen` in `localStorage` is only a
hint that stops the gate flashing past a returning listener; it cannot
let anyone in.

**The codes.** Six digits, ten minutes, one use, five wrong guesses
before the code is torn up rather than merely counted. **Only a hash is
stored**, signed with `SESSION_SECRET` and bound to the address — a
plain hash of six digits is worth nothing, since a million guesses is
no work at all. One live code per address: asking again replaces the
last one, which is why a code sent less than a minute ago is left alone
rather than replaced, and why the wrong-code line says to use the
newest email. The brake counts per address and per internet address, in
`throttle`, and **errs toward letting people in** — if D1 is
unreachable it does not refuse anybody, because a supporter locked out
by a database wobble is worse than a few extra guesses at something
that expires in ten minutes.

**Saying "that isn't an address" is deliberate, and is the one thing
the gate does say plainly.** It is about what was typed, not about who
is on the list, so it gives nothing away — and without it somebody who
fat-fingered their own address would wait forever for an email that was
never coming.

**The gate's words are set large, and that is deliberate — don't quietly
shrink them back toward the site's small print.** Eric asked for it on
30 September 2026. Both instructions (`.gate__hint`, which covers the
email step and the code step's "Type the six digits here") run at
`clamp(1.05rem, 2vw, 1.3rem)`, roughly half again what they were, and
`.gate__sent` and `.gate__error` sit a step below them at
`clamp(0.95rem, 1.7vw, 1.12rem)`. The hierarchy is the point: what to do
leads, what was sent and what went wrong follow. **`.gate__error` was
raised in the same pass although only the instructions were asked for** —
left at its old size it became the smallest thing on a screen where it is
the only line a stuck visitor reads.

Tracking stayed at `0.1em` rather than being loosened: it is in `em`, so
the site's wide treatment holds its proportion as the size grows. What
did have to change is the measure. These paragraphs had none, and at the
new size a sentence ran in one thin line across a desktop — so each is
capped in `em` (30 / 28 / 26) and carries **`text-wrap: balance`**, which
evens the lines rather than filling one and orphaning what is left. That
is there so the wording stays Eric's to change without the measure
needing re-tuning; a browser that has never heard of it simply wraps as
before.

### The admin page

`/vault-api/admin`, added 29 September 2026. Eric's view of the guest
list: who is on it, where each came from, when they last signed in, a
box to paste a batch of addresses into, a Remove beside each row, and a
button that posts him a real code by the real route.

**Two locks, and they are independent.** Cloudflare Access on
`graymanmusical.com/vault-api/admin*` stops a request at the edge; and
`requireAdmin()` insists on a valid vault session whose subject is
`ADMIN_EMAIL`. Access is configuration and configuration can be edited,
expire, or be aimed at the wrong path — and if it lapsed, the first
lock would be gone with nothing to say so. The second is in the file,
cannot be switched off from a dashboard, and rests on a signature the
worker made itself. Signing in to `access.html` first is therefore part
of reaching the admin page, not a quirk.

**The `Cf-Access-Authenticated-User-Email` header is deliberately not
read.** Access sets it, and it is tempting. But a header is only as
good as what stands in front of it: with Access off, or on a path it
does not cover, anyone could send that header themselves and be
believed. The cookie cannot be forged without `SESSION_SECRET`.

**Picking addresses out of the list, added 1 October 2026 and live.**
Eric deployed it and confirmed the copying works. A tick
box on every row, one at the top of the table that takes the lot, and
**Copy selected addresses**. The count says how many are chosen, and a
redraw after Add or Remove clears the ticks — `draw()` calls `tally()`
at the end for exactly that, so the box at the top never claims to
speak for a list it is no longer describing. The header box goes
half-ticked when only some are chosen.

**It copies to the clipboard rather than opening a mail window, and
that is not laziness.** A `mailto:` link puts the addresses in a URL,
every browser and mail client caps how long a URL may be, and the ones
that do not simply drop the overflow — so a long guest list would
silently lose its tail. That is the worst way for this to fail,
because nothing would look wrong. The clipboard has no such limit.

**The page says to paste into BCC, in bold, and that line is the point
of the feature.** Addresses in the To line are shown to everyone who
gets the message — the whole guest list, handed to all of it. Eric is
emailing people who paid him; leaking their addresses to each other is
the one mistake here that cannot be taken back.

**Settled 1 October 2026: Eric said he will always and only paste into
BCC.** Take him at his word and don't lecture him about it again. The
line stays on the page regardless — it is there for a tired evening a
year from now, not because anyone doubts him.

**There is a fallback for a refused clipboard**: a read-only box
appears below, filled and pre-selected. Tested by making both
`navigator.clipboard.writeText` and `document.execCommand` fail.

**Your own row has a tick box even though it has no Remove button.**
There is nothing odd about sending yourself the announcement, and it is
the easiest way to see what everyone else got.

**The list can be put in order of last sign-in, added 5 October 2026 at
Eric's asking.** Two quiet words above the table, *Date added* and
*Last signed in*. The second puts the most recent sign-in at the top
and everybody who has never signed in at the bottom.

- **It sorts in the page, on a copy.** The worker still sends the list
  newest-added first and that order is kept exactly as it arrived, so
  *Date added* is always there to go back to. No route changed and
  nothing new is asked of D1.
- **It sorts on the full moment, not the day the table shows**, so two
  people who signed in on the same day are still in the right order.
  Those who have never signed in keep the order they had, newest-added
  first — the sort is stable and returns 0 for a pair of nevers.
- **A change of order keeps the ticks; a change of who is on the list
  still clears them.** `show(keepTicks)` is the difference. Sorting is
  the one redraw where losing a half-made selection would be a
  nuisance with no reason behind it; Add and Remove clear them as they
  always have, for the reason given above.
- **The choice is remembered** in `localStorage` under
  `tgm_admin_order`, in that browser only.
- **Words above the table rather than arrows on the column headings**,
  because the Added column is hidden at ≤620px and its heading would
  go with it, leaving a phone with no way back to the default order.

Tested by writing the admin page into the preview pane with a stand-in
`fetch` — the way to exercise this page from here, since the real one
needs Eric's session: seven rows in the worker's order, then by
sign-in (two on the same day in the right order, the nevers last and
undisturbed), ticks surviving the sort, cleared by an Add, the default
order restored, and the choice still there when the page was reopened.
One row at 430px with no sideways scroll.

**Under the heading there is a count of who has signed in and who
never has, added 6 October 2026 at Eric's asking**: "**62** have signed
in · **28** never have", beneath "On the list — 90 people".
`countSeen()` uses the same test the table uses to print "never" —
`day()` of the last sign-in — so the line and the rows cannot disagree,
and the two numbers always add up to the heading's. It is drawn inside
`draw()`, so it moves with every Add and Remove and is untouched by a
change of order. Singulars are handled ("1 has", "1 never has"), and an
empty list shows nothing rather than two noughts. Counted in the page
from the list already fetched; no route changed. Tested with the same
stand-in as the sort: 7 people as 5 and 2, matching two rows reading
"never"; 8 as 5 and 3 after an Add; back to 5 and 2 after removing a
never; one person each way; an empty list.

**Deployed by Eric and checked the same day, 5 October 2026**: the
usual handful — `session` 401, the admin page and its list 404 to
anyone without his session, every vault file 404, the doorbell 404 on
a wrong secret, a malformed address 400. **That check proves the paste
went in whole; it cannot show the sort itself**, which sits behind his
sign-in. Until he has said it looks right on the real page, describe
it as deployed and tested against a stand-in, not as seen working.

**Its wording is hardcoded, not in `content.js`** — a tool of Eric's,
like `tools/lyric-timer.html`. No visitor sees it and it must work with
no site around it, so it loads no fonts and no libraries.

**Pasting a list takes almost any shape.** Anything with an `@` in it
is pulled out — one per line, commas, a spreadsheet column,
`Name <a@b.com>` out of a mail client — and the names and headings
around it are passed over without comment. Something with an `@` that
*isn't* an address is reported back rather than dropped silently,
including `someone@` with the domain missed off; that is why the
extractor allows nothing after the `@`. Addresses already on the list
keep their `source`, `added_at` and `last_login`, so pasting the same
list twice is harmless.

**Removing somebody now actually removes them.** `handleSession()`
checks on every page load that the subject is still on the list, since
a session lasts thirty days and otherwise a removed person would go on
walking in until their cookie ran out. It is asked there and **not** on
every file, where it would sit in the middle of seeking — so someone
removed while the page is already open keeps playing until they reload.
Rotating `SESSION_SECRET` is the instant, everybody-at-once lever. Like
the brake, it **fails open**: if D1 cannot be reached, a listener is
left alone rather than thrown out of an album they paid for.

**Eric's own row has no Remove button**, because the worker refuses to
delete `ADMIN_EMAIL` — it would lock him out of the page — and offering
a button only to say no is worse than not offering it.

### Gumroad

Set up 29 September 2026. A purchase puts an address on the guest list;
a refund or chargeback takes it off again.

**A ping is a rumour, not news.** Gumroad's webhook arrives unsigned —
nothing in the message proves Gumroad sent it — so **nothing in it is
believed**. The long random word in the address
(`GUMROAD_PING_SECRET`) is a doorbell, not a password: it stops
strangers ringing, but anyone who ever learned it could ring too. All a
ping does is name an address worth asking about. The answer comes from
`GET /v2/sales` on a connection the worker opened itself.

**One handler for every event, and it does not care which.** Sale,
refund, dispute, dispute won, cancellation all mean "something changed
for this address, go and look". `reconcile()` asks what is true now and
makes the list agree, so an event arriving twice, out of order, or not
at all does no harm. That is also why the worker does not need to tell
the events apart, which matters because Gumroad sends them all to the
same address in the same shape.

**It fails safe, not open.** `hasLiveSale()` answers `true`, `false` or
**`null` — could not tell** — and `null` changes nothing. Every failure
returns `null`: an unreachable API, a 500, `success:false`, a junk
body, a missing token. Taking away access somebody paid for because an
API had a bad minute is the one outcome worth going out of the way to
prevent. **Tested, all five.**

**Gumroad never overrules Eric.** The delete says
`AND source = 'gumroad'`, so an address he added by hand survives
Gumroad reporting a refund, or no sale at all — a comped listener may
well have never bought anything. **Tested.**

**Revoking access is not refunding, and Gumroad does not announce it.**
They are separate acts — Gumroad will not even let you revoke a fully
refunded purchase — and revoking sends no webhook at all, so nothing
moves by itself. Eric hit this on 30 September 2026, revoking a
$0 test purchase (a free sale cannot be refunded) and finding the
address still on the list. That is the design working, not a fault: the
worker watches for refunds, chargebacks and disputes. The lever is
**Make the list match Gumroad** on the admin page, which runs
`reconcile()` by hand — and it is offered whichever way the answer
went, so it removes as readily as it adds.

**`revoked()` checks three spellings**, because the field is **not in
Gumroad's API reference** and a name guessed wrongly fails in silence.
It accepts `true` or the string `"true"` and nothing else — not merely
truthy, since the string `"false"` is truthy and reading that as
revoked would throw out somebody who paid. Asking for a field that does
not exist is simply false, so the wrong guesses cost nothing. **If a
revoked sale still reads as counting, the real field name is in the
raw dump** the admin page now prints beside each sale; fix it there
rather than adding a fourth guess.

**Sales come in by Ping, the rest by subscription.** The Ping setting
in Gumroad's own settings fires on sales only; `refund`, `dispute`,
`dispute_won` and `cancellation` have to be registered through
`PUT /v2/resource_subscriptions`. The admin page's **Watch refunds and
disputes** button does that, so it never needs a terminal. Registering
twice is harmless.

**A sale that did not reach the list by itself, 5 October 2026 —
investigated, and it was not the referrer.** A buyer who arrived from a
link on Instagram (`referrer: https://l.instagram.com/`, paid by Link,
with a discount code and a tip) bought at 16:11:54Z and was not on the
list two hours later; Eric added him by hand. He asked whether
Instagram had broken the ping. **It had not, and cannot.** What was
established, and how:

- **Our worker reads one field of a ping, `email`.** A ping built to
  Gumroad's own shape with the Instagram referrer, `url_params[fbclid]`
  and the rest was run through the worker's source beside an ordinary
  one: both added the buyer. The real sale's JSON matches
  `GUMROAD_PRODUCT` and counts.
- **Gumroad sends the ping the same way whatever the referrer** — read
  from its public source (`antiwork/gumroad`): the referrer is one
  more field in the form, and a tracked link adds a `url_params` hash.
  The ping goes out **10 seconds after the purchase commits**, so "the
  sale was not visible yet" is unlikely; the sales API's `email`
  filter is a plain database query, not a search index.
- **Cloudflare let both shapes through to the worker** when posted
  from here with Ruby-style user agents — though Gumroad's servers are
  data-centre addresses and may be treated differently, so this does
  not rule out a block. **Cloudflare → Security → Events is the place
  to look** for one around the time of a missed sale.

**The real weakness is ours, and it is not about Instagram:
`handleGumroad` says 200 before it has done anything, then tries
once.** If that one try fails — Gumroad's API answering 500 or 429, a
D1 write refused — the buyer is not added, nothing is logged, and
because Gumroad was told "got it" it never sends the ping again. All
three were reproduced against stand-ins. **Which of them happened on
5 October cannot be known**: the worker keeps no record. Gumroad's
side: 5-second timeout, retries only on 499/500/502/503/504 and
connection failures, at +1, +3 and +10 minutes, and **drops any other
answer (a 403, a 404) with no retry at all**.

**Nobody was locked out by it**, which is the part to tell Eric first:
the backup path below asks Gumroad when an unlisted address requests a
code, so that buyer would have been let in the moment he tried. What
lags is the *list on the admin page*, not the door.

**Fixed 5 October 2026, at Eric's word: the lookup happens before the
answer, and the answer says whether it worked.** `handleGumroad` now
awaits `reconcile()` for up to `PING_PATIENCE_MS` (3.5s, inside
Gumroad's 5) and replies:

| What happened | Answer | So Gumroad… |
|---|---|---|
| records agree with the ping, or the ping claims nothing | 200 | is done |
| could not find out — API error, D1 threw | **503** | re-sends at +1, +3, +10 min |
| still working when patience ran out | **503** | re-sends; the first try finishes in `waitUntil` regardless |
| records disagree with the ping — sale not listed yet, refund not landed | **503** | re-sends, by when they agree |

**The ping is still a rumour.** `pingClaims()` reads `refunded`,
`disputed` and `dispute_won` out of it for ONE purpose — deciding
whether to ask again — and nothing in a ping is ever written anywhere.
`reconcile()` decides who is on the list, from records the worker
fetched itself, exactly as before.

**`pingClaims()` returning `null` is load-bearing, three times over.**
Gumroad pings this address for *every* sale on Eric's account, so a
sale of some other product would otherwise disagree with the records
for ever and earn three pointless retries each time. It returns null —
"no reason to expect anything", answer 200 — for a ping about another
product, for Gumroad's own test ping (`test=true`), and for Eric
buying his own product, which carries the same flag. **A second
product on the account is exactly when this matters; don't simplify it
away.**

**`sameProduct()` is now the one place a product is matched** — the
sales lookup, the admin page's check and the ping all call it, where
there were two hand-copied tests before and would have been three.

**`chargedback`, not `chargebacked`.** The sales API's field is the
former; the worker looked for the latter, which Gumroad uses in its
licence JSON but not here, so the test never fired. No harm came of
it — a chargeback also sets `disputed`, caught on the next line — and
both spellings are now checked. `access_revoked` is confirmed as the
real name of the revoked field; the raw dump showed it.

**Tested against stand-ins, 25 doorbell cases plus 15 regressions**, by
the same method as before — the worker's own source run in the preview
pane with a fake D1 and `fetch`. The ones that were silently lost
before now answer 503 and succeed on the re-send: sale not on record
yet, API 500, a refused write, a refund not yet landed. A 5-second API
answers 503 at 3.5s **and the buyer is still added by the attempt left
running**. Unchanged: wrong secret and GET → 404; no email or an
unreadable body → 200; a refund never removes someone Eric added by
hand; a partial refund leaves the sale standing; the gate still gives
every address `{ok:true}`.

**Two cases answer 503 with nothing to wait for, and that is
accepted.** `GUMROAD_PRODUCT` set to the shop's custom name (the known
trap) and a sale ping re-sent for a sale since revoked both disagree
with the records permanently, so each earns its three retries and then
stops. Harmless, and for the first it is arguably better than the
silence it replaces.

**Not known, and said so to Eric:** that Gumroad never penalises an
address for answering 503. Its public source shows only the three
retries and no disabling — but that is the repository, read on
5 October 2026, not a promise about what runs.

**This is a worker change and nothing else.** No `?v=` bump: no part
of the site knows about it. It is live only once Eric pastes
`cloudflare/vault-worker.js` into Cloudflare; run the usual
post-deploy check after. **The doorbell cannot be tested from outside
without the secret** — a wrong one must still 404.

**Deployed by Eric and checked the same day, 5 October 2026.**
`session` 401; `admin`, `admin/list`, the album, a lyric, a note and
both PDFs 404; the doorbell 404 on a wrong secret, an empty one, a GET
and a full ping-shaped POST; a malformed address 400 `bad-email`; a
two-digit code 401 `wrong` (refused before the brake, so it spends
nothing). **What that check cannot show is the fix itself working** —
only a real ping carries the real secret. The proof is the next
genuine sale appearing on the admin page tagged GUMROAD without help;
until one has, describe this as deployed, not as verified.

**The two comments in the worker that dated this change said
6 October; it was the 5th.** They were left as deployed at first,
because correcting a comment would have made the repo differ from what
was running for the sake of a date, and were put right later the same
day when the worker next changed for a real reason — the admin page's
sort order.

**The backup path is what makes a missed webhook survivable.** If
somebody asks for a code and is not on the list, `postCode()` asks
Gumroad about them before giving up, and lets them in if they have a
live sale. A webhook that never arrived becomes a few seconds' delay
rather than a locked door and an email to Eric. It is safe *there*
specifically because `postCode()` already runs after the browser has
been answered, so however long Gumroad takes cannot show through as a
difference between a known address and an unknown one.

**`GUMROAD_PRODUCT` may be either the permalink or the id**, matched
against `product_permalink`, `product_id` and `short_product_id`, and
the permalink comes back as a full URL so a bare slug is matched on the
end of it too.

**But the custom permalink is a trap, and it cost a failed test.**
Gumroad's sales API reports a product's **original** perma id — a
random slug — **not** the custom permalink the creator set and put in
the shop address. So `GUMROAD_PRODUCT` set to the pretty name out of
`sorrels7.gumroad.com/l/earlyaccess` can match nothing at all, and the
symptom is perfectly silent: the ping arrives, the sale is real, the
API confirms it, and the worker decides it was for some other product
and does nothing.

**Always use the `product_id`. This is settled, not suspected.** Eric's
Stage 6 Gumroad test failed exactly this way, and the admin page's own
check confirmed it on 30 September 2026: the sale was real, the address
was right, the product did not match. His first guess had been that a
100%-off purchase is not a real sale — it is, and Gumroad records free
sales normally, charging no fee. Setting `GUMROAD_PRODUCT` to the
`product_id` the check reported is the fix.

**That is what `Why didn't somebody get in?` on the admin page is
for.** `gumroadLookup()` asks Gumroad about one address and reports
every sale it returns with the identifiers laid out and a verdict per
sale, rather than the worker's silent yes-or-no. If there is no sale
for that address it lists the ten most recent instead, emails masked,
so the identifiers Eric's products actually use can be read off. It
judges nothing and changes nothing; **Put it right** next to it runs
`reconcile()` by hand once the cause is understood. Failures say why —
a 401, an unreachable API, no token — rather than reporting "no sales",
which would look exactly like a real answer.

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
reads "Soon". Same for lyrics, notes and downloads. `content.js` says
so beside each list. The folder on the Mac is what the preview server
reads and Eric's working copy; the bucket is what a visitor gets.
Neither half warns you that the other is missing.

| | on the Mac | in the bucket | bump |
|---|---|---|---|
| the album | `assets/audio/album.m4a` | `audio/album.m4a` | `audio_version` — **replacing only**, and it is 109 MB |
| lyrics | `assets/lyrics/NN.lrc` | `lyrics/NN.lrc` | `lyrics_version` — either |
| notes | `assets/notes/NN.md` | `notes/NN.md` | `notes_version` — either |
| a download | `assets/downloads/x.pdf` | `downloads/x.pdf` | none — see below |

**Uploading to the root of the bucket instead of into a folder is the
mistake to look for first** when a file that exists still 404s.
`safeKey()` serves only the four prefixes, so a loose object at the top
level is invisible. R2 has no real folders — the prefix *is* the name —
so either click into the folder before uploading or put `notes/` in
front of the name; `notes/` and `downloads/` did not exist at all until
the first file went into them.

**Downloads carry `downloads_version` now**, added 2 October 2026 at
Eric's request, and that closes what used to be a live edge. Until
then a download's address was `vaultUrl(item.file)` and nothing else
while the worker sent `max-age=3600`, so a PDF swapped in under the
same name went on being handed out for up to an hour — and the rule
was to rename the file on every replacement. **That rule is gone:
bump the number instead.** `the-gray-man-lyric-booklet.pdf` still
carries the name it was given that morning under the old rule, which
is worth keeping on its own merits — it is what lands in a supporter's
Downloads folder. Adding a download for the first time still needs no
bump.

**Adding a file changes nothing in the repo**, so there is nothing to
commit or push: the page already asks for `audio/09.mp3`, and the
moment the object exists it is served. Only a `content.js` edit — a
version bump, a renamed track, a changed download name — needs a `?v=`
bump and a push.

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
itself, from the folders under `assets/`, and says everyone is signed
in — there is nothing between Eric and his own disk. Two switches exist
for testing the gate, which a preview would otherwise never show:
`TGM_PREVIEW=locked` (the gate appears, **any** address is accepted,
nothing is posted, and the code is always `123456`) and
`TGM_PREVIEW=offline` (the relay never answers, so the page shows
`gate_offline`). Both are testing aids in a tool that is never
published. Run a switched copy on **another port** —
`TGM_PREVIEW=locked python3 tools/preview-server.py 8421` — rather than
restarting the one Eric has open on 8420.

### The locked door

Under the password form, between it and the back link, the gate offers
**"No invitation?" and a Purchase Full Digital Access button** — added
29 September 2026, so someone who arrives without a password has somewhere
to go other than away. It shows on the wrong-password screen too, which is
when it is most use.

**There is no terms line on either page, as of 3 October 2026.** It
read "All sales are final." under both buy buttons; Eric asked for it
gone from both, and `music.early_access.terms` is now `""`, which
removes the element in both places rather than leaving an empty
paragraph. Checked in the preview: no `.cta__terms` on the main page,
no `#gateTerms` at the gate, and the buy button and its note are
untouched. **This is the site no longer saying it — whatever refund
policy is set in Gumroad is unchanged**, and the vault still takes
access away on a refund or dispute. The machinery below is all still
there; typing a line back between the quotation marks restores it in
both places.

**Neither the shop address nor the terms are written twice.** `#gateBuy`
takes its `href` from `music.early_access.url` and `#gateTerms` its
words from `music.early_access.terms` — the same two the main page's
button uses — so there is one place to change each and no way for them
to drift apart. Somebody buying from the gate is buying the same thing,
and two different answers to "can I have my money back" is the last
thing a shop should have. Both follow the empty-string rule: `""`
removes the line rather than leaving a paragraph holding space open.
**Tested both ways, in both places.**
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

The album is 20 tracks in one recording — `assets/audio/album.m4a` —
with the `tracks:` list in `content.js` naming them and `track_starts`
saying where each one begins. If the recording is missing every row
reads "Soon" together, which is the honest answer: there are no longer
twenty files that can go missing one at a time. Bonus tracks are
separated by `bonus_starts_at`.

### The storm — the gate becoming the vault

`assets/js/storm-intro.js`, added 30 September 2026. A hurricane turns
over the gate, the vault is built underneath while it cannot be seen,
and then the eye opens onto the album. **600ms to swallow the gate,
1160ms turning, 1440ms for the eye — 3.2 seconds.**

**Those three are scaled together, never padded one at a time.** Eric
asked for it slower on 30 September 2026 and the whole clock was
stretched from 420/820/1020. The storm turns through a fixed angle
whatever the clock says, so stretching the clock is what actually makes
it turn more slowly; adding the time to one phase would only have held
a still picture for longer. `MOTE_TAIL_MS` was stretched with it for
the same reason — see the motes below.

**It plays in exactly one place: the moment the relay accepts a code.**
A returning visitor whose cookie is still good is let in by the startup
block with no weather at all — they have just done nothing, and a storm
would be an announcement with nothing to announce.

**The contract is one function**, and the module knows nothing about
sessions, codes or the vault:

```js
window.TGMStorm.play(onCovered) -> Promise
```

`onCovered()` fires once, when the cover is opaque and the page beneath
is safe to rearrange. The promise resolves when the cover is gone.

**Nothing about the weather may cost anyone their album.** `unlock()`
is behind a latch in `enterVault()` and **three** separate things call
it: the storm when it has covered the gate, a timer at `coverMs + 500`
whatever the storm is doing, and the promise settling either way. First
one wins. Tested by deleting `window.TGMStorm` outright and by making
`play()` throw — vault in both cases, no cover left behind.

**Three numbers in two other files are tied to this clock.** All three
moved when it was slowed, and a future change must move them again:

| | Must be | Now |
|---|---|---|
| `.storm` opacity transition in `style.css` | **equal to** `COVER_MS` | 600ms |
| `unlockBy()` in `access.js` | after `COVER_MS`, well before the CSS failsafe | `coverMs + 500` |
| `storm-failsafe` delay in `style.css` | **comfortably after** `TOTAL_MS + 1200` | 6000ms |

That last one is the trap. The storm's own last-resort timer fires at
`TOTAL_MS + 1200` — 4400ms at the current length — and the CSS failsafe
was sitting at 4500, a tenth of a second of margin over the very thing
it exists to back up. It went to 6000. **A backstop that fires almost
at the same moment as the thing it is backing up is not a backstop.**

#### Three things that look like tuning and are load-bearing

- **The cloud is assembled on its own canvas, then laid over the sea.**
  The eye is taken OUT of the cloud with `destination-out` so the
  eyewall's torn inner edge is what rings it. Done straight onto the
  visible canvas, that cut goes through the sea as well and the eye
  becomes a window onto the page — the gate's own words were legible
  through the middle of the hurricane. That is what the second surface
  is for.
- **`radius()` is 0.50 of the long side, not 0.78.** At 0.78 the
  viewport is inside the cloud: gorgeous texture, no legible storm,
  because at that magnification a hurricane is just weather out of an
  aeroplane window.
- **Band sweeps stay under about 3.6 radians.** Past a turn and a half
  a band closes on itself and the eye reads concentric rings rather
  than arms. An arm has to travel *out* more than it travels *round*.
  This was the number that took longest to find; 7 and 8 radians gave
  a bullseye.

#### Why it is stamped rather than drawn

The first version drew each band as one filled path with a gradient
through it, and Eric's word for it was "comic-book". He was right, and
the obvious fix — retune the gradients — is the wrong one. **A
hurricane has no smooth edges anywhere.** It is thousands of separate
cells at every size, clumped into bands that break, thin and fray.
Smooth is what makes a drawing of a spiral.

So nothing is a filled path. One soft cell sprite is stamped ~9,000
times with value noise opening real gaps, into **three shells turned
at slightly different rates** (1.12 / 1.00 / 0.88) — a real storm does
not rotate rigidly, and that shear is much of what reads as alive.
Rates are kept close on purpose, or the four arms shear into soup.

Built once at **34ms** and thereafter only turned, so a frame is three
`drawImage` calls plus the motes below: **measured at 74fps against a
pane idling at 76**. The layers are built at a fixed size and blown up
— cloud upscales better than anything, having no edges to go soft —
and the grain laid over the top afterwards is at the screen's own
resolution, which is where the fine detail actually comes from.

#### The motes, and why the layers alone were not enough

**A rigid picture turning reads as a picture turning.** The baked
layers give the storm its structure but rotate as one, and what the eye
takes for *speed* is a streak. So ~2,500 motes on a desktop (900 on a
phone) ride the same four arms, each drawn as a short two-segment arc
from where it was a moment ago to where it is now.

This idea, the outward fling as the eye opens, and the continuous
differential rotation came from **Eric's own earlier `storm-intro.js`**,
which he sent on 30 September 2026 and which lives in `~/Downloads` —
`~/Downloads` is blocked by macOS privacy protection, which is why it
could not be found when the storm was first written. That file was a
page-load arrival animation with no `onCovered` and no promise, so it
could not drive this transition, and it needed a `.storm-intro` CSS
block that has never been in this repo. Only its ideas were taken.

**The tail is computed from the clock, never remembered between
frames.** `spinAt(ms)` and `openAt(ms)` answer where a mote was at any
moment, so a dropped frame stretches no streak and a backgrounded tab
flings nothing across the screen on return.

**Two things about streaks that had to be learned by looking:**

- **They must be shorter than the eye can follow.** At the 95ms tail
  the original used, every mote at a given radius drew the same long
  arc and the storm filled with concentric scratches like a worn
  record. Now 68ms — and **each mote carries its own multiplier on
  it**, which is the other half of what kills the rings.
- **A streak over bare water is a scratch on the picture.** They are
  kept inside the cloud's own reach; there is nothing out there for
  them to be part of.

**They are not all ink, and that is a deliberate departure from the
file they came from.** That storm was ink on paper; this one is lit the
other way round — light cloud on dark water — so ink motes would be
invisible over the sea. Tone is taken from radius: **ink near the
bright core**, where it reads as the dark lanes between a real storm's
bands, paper and gray further out.

They are drawn onto the cloud surface **before** the eye is cut, so the
eye and the reveal take them out too. On the visible canvas instead,
streaks would go on blowing across an open eye with the album showing
through it.

**Nothing calls `Math.random` for shape.** A seeded generator, reset
per build, so it is the same storm on every sign-in and any shape
worth keeping can be found again. (The grain tile is the exception and
does not matter.)

**The eyewall gets finer cells than any other band.** At the ordinary
size a single cell is nearly as wide as the eye, and one surviving the
cut hangs off the rim — which turned the eye into a comma on every
screen.

#### The rest of the wiring

- **Reduced motion is locked twice.** `enterVault()` never calls the
  storm, doing a 300ms opacity crossfade instead (`.vault--arriving`);
  and `.storm { display: none }` under the media query catches any
  route not thought of. Emulating the OS setting is not possible in
  the built-in pane — it was tested by making the page's own
  `matchMedia` report `reduce`, which is the exact condition
  `calmPreferred()` asks, plus reading the rule out of the stylesheet.
- **A press of anything ends it**, over 160ms rather than as a cut, and
  `onCovered` fires early rather than being skipped — so someone who
  presses at 110ms still gets a built vault.
- **The gate is sealed the moment the relay says yes.** The code has
  been spent; a second submit would only be told it was wrong.
- **Focus moves to `.vault__heading`**, which carries `tabindex="-1"`
  in the markup for that purpose, so a keyboard is not left on a button
  inside a hidden gate. `.vault__heading:focus` drops the outline,
  since this focus is only ever programmatic.
- `z-index: 90` — the stage's 40 is the next highest thing.
- **`tools/preview-server.py` takes `--locked` and `--offline`** as
  well as the environment variable, added because the app's preview
  tooling can pass arguments but not environment, and the gate could
  not otherwise be walked end to end from here. Run it on another port:
  `python3 tools/preview-server.py --locked 8421`.

### The album player

**The album is ONE continuous recording, and the track list is twenty
positions inside it.** `assets/audio/album.m4a` in the bucket's
`audio/` folder; `access.js` builds one `<audio>` element and twenty
rows that are windows onto it.

This took three attempts to arrive at, and the two that failed are
worth knowing about, because both look like the obvious answer:

| | gapless | plays behind a locked iPhone |
|---|---|---|
| twenty `<audio>` elements (until 2 Oct 2026) | **no** | yes |
| one Gapless-5 player, Web Audio (2 Oct, a few hours) | yes | **no** |
| **one continuous recording** (now) | **yes** | **yes** |

**Twenty files cannot be gapless**, and it is not a matter of tuning.
At the end of a song the old player called `play()` on a file that had
not fetched a note: the connection, the first chunk and the decoder
start **are** the gap.

**Web Audio can be gapless, and an iPhone suspends it.** Scheduling
the next song on the exact sample the last one ends works — it was
built, and measured at 43,275 ms of track 04 to 0 ms of track 05 in a
single animation frame. But iOS suspends an audio context the moment
the screen locks, so the album stopped when Eric locked his phone.
**Gaplessness and background playback were the same machinery** and
there was no reconciling them. A silent companion element put the
lock-screen *controls* back and could not keep the *music* going;
feeding the context a media element did not either. Both were tried.

**One recording has no joins to be gapless across.** There is nothing
between one song and the next except the next sample — the gap is not
solved so much as abolished. And it plays through an ordinary `<audio>`
element, which iOS is perfectly happy to keep playing with the screen
off and to show on the lock screen.

**Measured on the finished thing, across the 07 → 08 join: the element
never paused, and the playhead never fell more than 1 ms behind the
wall clock.** Tracks 08, 13 and 18 have no words, so their 404s in the
console are correct and not a fault.

#### The stand-ins, and why lyrics.js was never touched

`lyrics.js` is 1,834 lines and reaches into `track.audio` as though it
were an `<audio>` element in about thirty places. **It has not been
changed by one character through any of this**, because each track
still gets an object that behaves like its own `<audio>` —
`currentTime`, `duration`, `paused`, `ended`, `play()`, `pause()`,
`addEventListener` — **counting from its own beginning as though the
other nineteen songs were not in the same file**. `startOf()`,
`endOf()` and `within()` are the whole of that translation.

State lives in arrays in the bridge rather than inside each stand-in,
because this has to reach *across* tracks — ending the one that
finished, pausing the one being left — and twenty closures would be
the harder way round.

#### Things here that look like detail and are not

- **`settle()` is about labels, not sound.** Nothing happens to the
  audio at a boundary; the playhead carries on. What changes is which
  row lights up, which words arrive, which title reaches the lock
  screen. A frame loop watches for it while playing, because
  `timeupdate` alone fires about four times a second and would leave
  the words a quarter-second behind. `timeupdate` is kept as the
  backstop for when frames are throttled — a hidden tab, a locked
  screen — which costs nothing, since nobody is looking at a late
  label, and `visibilitychange` puts it right on return.
- **`carriedOn` tells a roll-on from a jump.** The album running on by
  itself ends the song it leaves (`ended`, bar back to 0, clock back
  to full length). Somebody jumping merely stops it (`pause`), and its
  position is kept so pressing it again carries on from there.
- **The song being left gets `pause` EITHER way, and that line had to
  be put back by hand.** When the album was twenty elements, starting
  one called `pause()` on the other nineteen — and *that* is what
  turned the last song's button from a pause mark back into a play
  mark. With one element there is nothing left to pause and nothing
  fires, so a row that had just finished sat showing a pause mark for
  a song that had stopped. **Eric caught it between This Way and St.
  Elmo's Fire**; the bar and clock had reset correctly, which is why
  it read as cosmetic rather than as the missing event it was. The
  general shape is worth remembering: **behaviour that used to fall
  out of twenty players pausing each other has to be stated outright
  now.**
- **`startAt()` emits `play` itself when the element was already
  playing.** Seeking inside a file that is already going fires no
  `play` event, so the song jumped to would never be announced.
- **The one `<audio>` is ON the page on purpose.** `main.js` stops a
  film talking over a song by pausing any sounding `<audio>` it can
  find — so that behaviour is simply restored, with nothing in
  access.js arranging it. (The Gapless-5 version needed
  `hushForFilms()` for exactly this; it is gone.) Anything that pauses
  the element is noticed, because the rows are painted from its own
  events.
- **`preload="metadata"`, never `auto`.** The file is 109 MB. The
  browser fetches as it plays, in slices, and the vault answers Range
  requests — so starting at track 15 fetches from track 15 rather than
  everything before it. Confirmed: a range from the middle of the file
  is served as a 206.
- **Every row knows its length at once**, because that is now
  arithmetic on the track list rather than something to fetch. The
  twenty metadata probes are gone with the twenty players.
- **The element's `error` tells "no file" from "the network let go
  mid-song", and the two are handled differently.** Added 3 October
  2026 in the pre-launch review (it had been written in v81 during the
  lock-screen rounds and reverted with the rest). A failure before any
  duration was ever known means there is no album: every row reads
  "Soon", as before. A failure after that is a wobble: `recover()`
  reloads the same address — no cache-buster, so what the browser
  already holds is still good — puts the playhead back and carries on
  if it was playing, capped at three goes, the count cleared by
  `playing`. Before this, one dropped connection on a phone turned all
  twenty rows to "Soon" with every play button disabled until a reload.
  Tested: a synthetic error at 1166.5s resumed at 1169.0s with 0 rows
  marked and 0 buttons disabled.
- **A `play` the album started by itself carries `carried: true`.**
  `emit()` takes an optional third argument of extra fields for the
  event, and `settle()` uses it on the roll-on's `play`. lyrics.js reads
  it to keep the phone sheet down — see The phone sheet.

#### Rebuilding the recording

`tools/join-album.py` joins `01.wav … 20.wav` end to end, altering
nothing, and prints the positions ready to paste into content.js:

```
python3 tools/join-album.py "/Users/ericsorrels/Desktop/Gray Man Continuous"
afconvert -f m4af -d aac -b 256000 -q 127 -s 1 album.wav album.m4a
cp album.m4a assets/audio/album.m4a
```

Built 2 October 2026 from twenty 16-bit 44.1 kHz stereo WAVs Eric
bounced: 159,887,867 frames, **60 min 25.58 s**, 640 MB joined, out at
**108.9 MB** with `ftyp → moov → mdat` so playback does not wait for
the whole file.

- **It refuses to join files that disagree** about rate, depth or
  channels, and says what each one is. One song at a different sample
  rate plays at the wrong speed and drags everything after it out of
  place. **Track 20 was 48 kHz while the rest were 44.1**; Eric
  re-bounced it.
- **It reads the finished file back** and checks the frame count
  rather than trusting its own arithmetic. A short write would put
  every song after it in the wrong place, silently.
- **It alters nothing** — no trimming, no fading, no normalising.
  **Settled 2 October 2026: the silences in Eric's bounces are
  deliberate and are not to be "fixed".** An earlier measurement of
  silence at five joins (09→10 at 773 ms and so on) was about the
  previous files and is spent; do not go hunting it again.
- **Never type a position in by hand.** They are measured from the
  recording. A number typed by eye puts a title, its words and its
  clock slightly out of step with the sound, and nothing looks wrong.

**`audio_version` now shifts 109 MB rather than one track**, so bump it
only when the recording genuinely changes. Changing it is the whole
album re-downloaded for every listener.

#### The rest of the row, unchanged through all of it

- **The timeline is a real `<input type="range">`**, not a drawn line: it can
  be dragged, nudged with the arrow keys, and read aloud. A `scrubbing` flag
  stops playback yanking the handle out from under a finger mid-drag, and the
  `input` handler moves the song as it goes — which is what the lyrics panel
  rides on.
- **Volume is one slider governing the album**, floating at the right edge,
  remembered in `localStorage`. It flips light over the paper section, and is
  hidden entirely at ≤620px, where a saved level is ignored in favour of full
  volume — a quiet level chosen on a laptop must not follow a listener to a
  phone with nothing on screen to undo it. (All twenty stand-ins now pass it
  through to the one element, so it is one slider over one thing at last.)
  **And it is never shown where a page cannot set the volume at all** —
  an iPad, which is wide enough to pass the 620px rule and whose Safari
  calls itself a Macintosh, so it cannot be told apart by name. Since
  3 October 2026 `volumeIsSettable()` asks the element itself: write
  0.5, read it back, and iOS hands back 1. If so the panel stays
  `hidden` and `setUpVolume()` does nothing else. Lifting a hidden
  panel onto the stage is harmless; `[hidden]` holds there too.
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
recording and the volume. Everything else that moves the album — the
stage's transport, the panel's, and the lock screen's — is in
`lyrics.js`, because that is where `current` and the album array live.
Don't add a second copy here; see The transport in the head.

**Numbers come from position in that list, not from anything written
down**, and that now cuts deeper than it used to. Adding or deleting a
track renumbers every track below it — and `track_starts` is a list in
the same order, so it has to be rebuilt, not edited. `assets/lyrics/NN.lrc`
and `assets/notes/NN.txt` do not follow by themselves either. After any
change to the list: rebuild the recording with `tools/join-album.py`,
paste the new positions, rename the numbered lyrics and notes below the
change, and move `bonus_starts_at` by the same amount or the bonus
heading lands on the wrong song.

**Renaming a track is the other half of that.** Titles are the key
`access.track_artists` is looked up by, so a rename has to happen in both
places or that song silently loses its singer. Numbers don't move on a
rename, so nothing else needs touching. (Eric renamed track 19 to
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

**One exception, on a phone, since 3 October 2026: a roll-on does not
raise a sheet the listener shut.** Down there the sheet covers half the
screen and the track list with it, so a listener who closed it and was
halfway through the album had it rise over them again at every song.
`openForPlay(carried)` stands down when the `play` is one the album
started itself (`carried`, set by access.js), the sheet was shut by
hand (`shutByHand`, set in `setOpen()` whenever `remember` is true —
the handle, a tap behind, a swipe, Escape), **and** `onPhone` matches.
A press of play on a song still opens it, on every screen; a desktop
roll-on still opens it; and the flag is for this visit only. Tested
at 375px and at 1191px: press opens, close, roll-on stays shut on the
phone and reopens on the desktop, press opens again on both.

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
tab inside names one view of it.

**The handle carries a cross at its left end while the panel is open**,
added 3 October 2026 at Eric's asking. It is **part of the handle, not
a button beside it**, and that is the point: the handle already opens
and closes, so a second button would be a second way to do one job —
and would have to find room to the left of something already sitting at
the left edge of the screen, where there is none. What people were
missing was not a control but the knowledge that the handle *was* one,
and a mark says that better than a word does. It is `aria-hidden`,
because the button around it is already named and already carries
`aria-expanded`.

Its one requirement on the markup: **the tab's words live in their own
`<span>` now**, because `data-content` writes `innerHTML` and would
otherwise wipe the cross out of the button every time the page loaded. At ≥1280px it sits in the margin beside the 720px
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
and the stage is meant to survive it.

**On every width since 3 October 2026.** It was a computer's affair
until then — the button was `display: none` below 768px, and pulling
the window narrower closed the stage because the way out would have
gone with it. **Eric asked for it on phones too**, so the button is
everywhere, the width gate is gone from `expand()`, and nothing
collapses on a resize any more: there is no longer a width at which the
way out disappears. On a phone the button leaves the head's corner and
becomes the last item in the tab row, which is the only place it fits —
the corner is where the transport already is.

**iOS will refuse true full screen**, since it grants it to video
elements only. That is the already-handled path: the stage is a
full-viewport overlay regardless, and `askForFullscreen()` swallows the
refusal. So the phone gets the view without the browser's chrome going
away, which is what it was always going to get.

**The stage's head is laid out the phone's way below 620px**, and
getting there cost two bugs that looked unrelated and were one.

The stage centres its tabs and drops the track number out of the flow
to the left, which is right where there is room beside them. At 375px
there is none and the number landed on top of LYRICS — so down here the
head is simply the panel's own: tabs, number, then the way out at the
far right. Opening the words out should not rearrange the one row that
was already familiar.

Then: **`.stage .lyrics__tab` shortens `padding-bottom` to 0.6em, and
on a phone that shortening breaks the underline and the number at
once.** The phone has already made these a 1.1rem tap target and moved
the active underline to `bottom: 0.82rem`, so it sits just beneath the
words instead of at the foot of the target. Shorten the box under it
and that 0.82rem stops being below the text and starts being *through*
it — **a line struck across LYRICS**. The same shortening leaves the
padding lopsided, 1.1rem over 0.6em, so the words sit low in their own
box while the number centres on the box itself: **both were centred, on
different things**, which is why the number read as off its line.

Symmetric padding fixes both. **Measured after: 4.5px of clearance
below the words, and the number's centre and the words' centre at the
same 46.9.** Eric found both from his phone; neither shows at any width
a desktop browser is likely to be at.

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

**Notes are Markdown** in `assets/notes/NN.md` **or `NN.txt`** —
`findNotes()` tries `.md` and falls back to `.txt`, the same bargain
`findWords()` strikes with `.lrc` and `.txt`. **The fallback was added
2 October 2026 because Eric's eighteen notes all arrived as `.txt`
and, until then, every one of them would have 404'd in silence** with
each Notes tab reading "No notes for this track" and nothing anywhere
saying why. TextEdit writes `.txt`; insisting on `.md` would have meant
renaming every note by hand for ever. Either extension is read as
Markdown, which costs a plain file nothing — prose with no markup in it
is simply paragraphs. `safeKey()` in the worker filters on the folder
prefix only, never the extension, so `notes/NN.txt` needed nothing
doing to it. `notes_version` in `content.js` is the cache tag. The reader
in `lyrics.js` is deliberately small: paragraphs, `#`–`###` headings
(rendered h3–h5, since the track title is the h2 above), `*italic*`,
`**bold**`, `***both***`, and `---` for a rule. One Return is a line
break, two start a paragraph — what someone typing into TextEdit expects.
**Emphasis is asterisks only**: underscores are left alone on purpose so a
file name or an address survives intact instead of turning silently into
italics. Every line goes through `escapeHtml()` before any tag is added,
so nothing written in a note can become markup of its own.

**The notes pane's bottom padding is load-bearing, and its absence was
a real bug.** `.lyrics__scroll` sets no bottom padding at all, because
the lyrics get theirs from `sizeTail()` in `lyrics.js` — which writes
to the `<ol>` and so never touches the notes pane. So the last line of
a note sat flush against the pane's bottom edge, *inside* the fade
below, and the closing two or three lines of every note dissolved into
the background with nothing left to scroll into. Measured before the
fix: the final line ended **0.6px below** the pane's own bottom.
`.lyrics__scroll--notes` now carries `padding-bottom: 3.4em` against
its own 2.6em fade, and `.stage .lyrics__scroll--notes` 5.2rem against
its deeper 4rem one — the stage resets padding to 0, so it has to say
it again. **Both are in the same unit as the fade in the same rule, so
they can be compared at a glance; change one and check the other.**
Eric found it reading the notes. Fixed and measured in all three
shapes — panel, stage and phone sheet — on 3 October 2026.

Two more things that look like details and are not. The notes pane fades only
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

**`.stage .lyrics__head .lyrics__transport` is `display: none`, and
that is load-bearing.** The stage does not draw its own copy of the
panel; it *lifts the panel into itself*, so without that rule these
buttons would travel in and sit above the stage's own transport.

**Scoped to the head, and that scoping is the whole of how the phone's
full-screen view works.** Down there the same three buttons are lifted
a second time — out of the head and down to the foot of the stage,
above the scrub bar, which is where a thumb expects them and where a
bar belongs in relation to the buttons it answers to. `placeSteps()`
does it, through the same `lift()` the panel and the volume slider go
through, so there is still one set of buttons on the page driving one
`<audio>` and nothing to keep in step. The stage's own play button
hides while they are down there: one play button, not two.

**The stylesheet keys off `stage--steps`, a class, never off the
width.** The class says what the arrangement actually is; a width query
would be a guess at it, and the two can disagree — **turning a handset
on its side takes it past 620px with the buttons still at the foot**.
`placeSteps()` is therefore asked again on every width change, not only
on opening. Tested by expanding at 375px and widening to 812: the
buttons go home, the stage's own play button comes back, and the head's
copy is hidden by the rule above. One set of controls either way.

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

**But `nexttrack` must be nulled ONLY at the end of the album, and
getting that wrong brought the ten-second jumps back.** `drawTransport()`
runs once at startup with `current` still null, and the old test —
`(current && nextPlayable())` — read "nothing has played yet" as "there
is nothing after this" and nulled it. The lock screen was then holding
`previoustrack` and nothing else, and **with a lone skip handler iOS
gives up and offers its own jump buttons**, which is precisely what
declining `seekbackward`/`seekforward` is there to avoid. The test is
now `(!current || nextPlayable())`.

**It only began to show when the album became one long recording**, and
that is the part worth remembering. Twenty short elements meant iOS
built its Now Playing afresh at every play, by which time
`drawTransport()` had run again with a real `current`; one element
exists from page load, so iOS settles the buttons while the startup
reading is still the only one it has. **A startup value that used to be
harmless because something always overwrote it in time is exactly the
kind of thing the single element changed.** Eric found it on his phone
on 3 October 2026.

**KNOWN BUG, ACCEPTED 3 October 2026 — resuming from the lock screen
loses the lock screen. Do not troubleshoot it again unless Eric asks.**
Pause from the lock screen, press play there, and the music resumes
correctly — then a second or two later iOS takes the album's Now
Playing panel down and shows its own default one, offering music from
the listener's library. The music keeps playing; only the panel goes.
Six rounds of changes (v79–v84) were tried on one afternoon and every
one was reverted; the tree is back at v78 and `6f73b60` is the revert.
What those rounds established, so nobody repeats them: the worker
answers a resume correctly (a Range fix was made and proven not to be
the cause); our code is not seeking on resume, not pausing, not seeing
an `error` event, and the element reports `readyState 4` and `playing`
throughout — an event log driven by `timeupdate` showed iOS's own
buttons arriving and being obeyed, and the panel dying anyway; telling
iOS the song's clock (14 s of 225) or the album's (2721 of 3625) made
no difference, so the two-clock contradiction is not it; and leaving
`play`/`pause` for iOS to work on the element itself was worse, because
with no pause handler iOS picked the welcome film as its Now Playing
target and a lock-screen pause started a video behind a locked phone.
Whatever iOS is reacting to, it does not report it to the page. If it
is ever picked up again, the only honest next step is an iPhone cabled
to a Mac with Safari's Web Inspector attached, reading iOS's own
console — not another guess from here. The one thing not yet tried is
that `drawTransport()` re-registers `nexttrack` and re-sends the
playback state on every `play` event, including a resume.

**And it is NOT the continuous file — that was tested, the same
afternoon, before reverting the player to twenty files.** The v73
twenty-element player was run from a scratch copy over Wi-Fi
(`--phone`, per-track `.m4a`s) and Eric tried it on his phone: the
panel dropped on resume exactly as it does with one recording, and
seeking was worse besides. So the one-file design was never the
cause, the two-clock theory is doubly dead, and **going back to twenty
files would give up gapless playback for nothing.** Eric decided on
3 October 2026 to keep continuous playback and carry the lock-screen
drop as a known issue for early access. Don't offer the revert again.

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
- **Always `LANG=en_US.UTF-8 pbcopy`, never bare `pbcopy`.** This shell has
  no locale set, so macOS labels the clipboard Mac Roman while the bytes
  on it are UTF-8. Every em dash then arrives somewhere else as `‚Äî` —
  which is how one reached a real email's subject line, sent to a real
  address, on 29 September 2026. **A round trip through `pbpaste` will
  not show this**, because it misreads the label the same way and the two
  errors cancel; check with `osascript -e 'the clipboard as text'`, which
  reads it as any other app would.
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

## Where things stand (3 October 2026)

**`?v=79` is the pre-launch review's fixes, committed 3 October 2026
for the Monday launch.** Eric asked for a read-only review of the whole
access page, then for these: a song starting now stops a film (the
rule had only ever run the other way — see Video); a mid-song network
error recovers instead of marking every row "Soon" (see The album
player); the phone sheet stays down on a roll-on when the listener shut
it (see The phone sheet); the album page's tab reads "Early Digital
Access — The Gray Man" from `access.browser_tab_title` rather than the
main page's title, which `main.js` used to apply to both; the volume
slider is withheld on an iPad; and `content.js`'s comments no longer
describe twenty files or a password. **Left alone on purpose:** the
"pre-save on Spotify or Apple Music" line has no link to tap, and the
About the World button still 404s until the file is in the bucket —
both Eric's, both known.

**`?v=77` is live, everything is pushed, and the album is one
continuous recording.** Confirmed against graymanmusical.com: both
pages at v77, branch in sync, the live `content.js` carrying
`album_file: album.m4a`, twenty `track_starts`, `album_length`
3625.575215, and `downloads_version: 2` — and the live `lyrics.js`
carrying the lock-screen fix.

**It plays gapless, it plays behind a locked iPhone, and the lock
screen shows skip-track buttons.** All three confirmed by Eric on his
own phone, which is the only place the last two can be confirmed. The
twenty `<audio>` elements are gone, and so is the Gapless-5 player
that briefly replaced them. See The album player for the two designs
that failed and why.

**The private check was re-run after the push and everything holds.**
`assets/audio/album.m4a`, the old per-track files, the notes, the
lyrics and both PDFs all 404 at graymanmusical.com; the vault answers
401 for `session` and 404 for `admin`, `admin/list` and every file to
anyone without a cookie. The sleeve's new pictures and `sleeve.js`
answer 200, which is intended — `assets/img/` is public and always
has been.

**`audio_version` was deliberately NOT bumped** for the move to one
recording. The address changed from `audio/NN.m4a` to
`audio/album.m4a`, so there was no old copy anywhere to displace, and
a bump would have made every listener re-fetch 109 MB for nothing.

**The old per-track files can come out of the bucket whenever Eric
likes** — twenty `.mp3`s and twenty `.m4a`s that nothing asks for any
more. Nothing depends on them; they are only clutter.

**`?v=73` is live and everything is pushed**, confirmed against
graymanmusical.com on 2 October 2026: both pages at v73, the branch in
sync, and the live `content.js` carrying `audio_version: 4`,
`lyrics_version: 5`, `notes_version: 2`, `downloads_version: 1`, the
booklet's new filename and track 15's three-performer credit.

**The notes were checked publicly, specifically because of the ignore
hole that morning.** `assets/notes/01.txt` and `07.txt` both 404 at
graymanmusical.com, as do `assets/lyrics/01.lrc`, `assets/audio/01.mp3`
and the booklet. The vault answers 401 for `session` and 404 for
`admin`, both downloads, `notes/07.txt`, `audio/16.mp3` and
`lyrics/16.lrc` to anyone without a cookie. **Re-run that public check
after any `.gitignore` change** — it is the one that would have caught
the near miss from the far side.

**A vault 404 is not cached anywhere, which is worth knowing when a
file seems not to have arrived.** Worker responses bypass Cloudflare's
edge cache — three requests to a made-up track came back 404 with no
`cf-cache-status` header at all — and `notFound()` sends no
`Cache-Control`, so nothing holds a miss. **A file put in the bucket is
therefore served immediately.** If a track still reads "Soon" after an
upload, the upload itself is wrong — wrong name, or dropped at the root
instead of inside its folder — and waiting will not fix it. Checked
2 October 2026.

**The worker was redeployed on 1 October 2026** for the guest-list
picking, and checked afterwards: `session` 401, and `admin`,
`admin/list`, every vault file and a wrong Gumroad doorbell secret all
404.

**Check the worker after every dashboard deploy, with that same
handful of requests.** It is pasted in by hand, and a paste that lost
its tail would leave the album unreachable for everyone with nothing on
the site to show it. The public endpoints answer without a session, so
the check costs nothing and spends none of the per-IP code allowance.
`audio_version: 4`, `lyrics_version: 5`, `notes_version: 2`,
`downloads_version: 1`, `bonus_starts_at: 19`, twenty tracks.

**Settled. Don't raise these again unless Eric does.**

- **The refund path is untested, by choice.** Adding through Gumroad is
  proven; a refund withdrawing access is not, because it needs a real
  paid purchase — Gumroad cannot refund the $0 test sale, and revoking
  is a different act (see Gumroad). It was raised on 30 September 2026,
  the cost was named — one real purchase, refunded — and Eric judged
  the situation unlikely for this product and chose to find out if it
  ever happens. The mechanism is the same `reconcile()` that adding
  uses and is tested against stand-in responses in both directions; the
  untested part is only whether Gumroad's refund webhook arrives as
  expected. **Don't re-raise it. Don't describe it as verified either.**
- **A warning when `GUMROAD_PRODUCT` matches none of the recent sales**
  was offered twice and not taken up. It would turn the silent
  misconfiguration that cost a Stage 6 test into a visible one, and
  would matter again if a second product is ever added. The setting is
  correct now. Offer it if a new product appears; otherwise leave it.

- **`05.lrc`'s untimed line is fixed, and this note was stale.** It used
  to be that "Waste a time, my ass." sat between the 2:58 and 3:04
  stamps with no time of its own, so it never appeared. It now reads
  `[02:58.41]I got to spend a whole Sunday with you. Waste a time, my
  ass.` — merged onto the line before it rather than stranded. Found on
  2 October 2026 when a checker reported the file clean and the
  discrepancy with this note was chased rather than assumed to be the
  checker's fault. **Worth the general lesson: when a note and a
  measurement disagree, check which is out of date before trusting
  either.**
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
  **REORDERING COUNTS AS REPLACING, and this is the case that hides.**
  Swapping two tracks changes what two existing addresses *mean*:
  somebody who played the old 16 has it in their browser under
  `audio/16.mp3`, and the new 16 asks for that same name. Without a bump
  they hear the song that used to be there, under the new title, and
  nothing looks wrong. Both numbers went to 4 for the 15/16 swap on
  1 October 2026. The cost is smaller than it sounds: the player
  preloads metadata only, so a listener re-fetches a track when they
  play it, not the album on load.
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

- **All three downloads have their files, as of 3 October 2026 — the
  item below is history.** `about-the-world.pdf` arrived as a 15.5 MB
  master (`about-the-world-master.pdf`, four US-letter pages: two of
  text, two of captioned photographs) and went in at **5.2 MB, 34%**,
  through `tools/shrink-pdf.swift` at 0.92 in under three seconds.
  Indistinguishable from the master at 3x on a photograph. The two
  text pages keep every character selectable (1,897 and 2,642); **the
  two photograph pages lose their captions' selectability** (158 and
  131 characters), the known flattening of text over artwork. No
  `downloads_version` bump: the address had never served a file, and a
  vault 404 is not cached. **Eric uploads it to the bucket himself** —
  check `downloads/about-the-world.pdf` is inside the folder, not at
  the root, if the button still 404s.
  **Replaced on 4 October 2026 for a typo**, same name, and this time
  `downloads_version` went to 3 — the address had served a file by
  then, which is exactly the case the number is for. Same result from
  the same settings: 15.5 MB to 5.2 MB, four pages, the same two pages
  keeping their text. **The way to confirm a corrected master actually
  carries the correction** is to pull the text out of the old web copy
  and the new one with PDFKit and `diff` them word by word; it showed
  the one reworded line on page 3 and nothing else, which is better
  evidence than a matching file size.
- **One of the three download buttons still leads nowhere.** Lyric
  Booklet and Listening Guide are both done — see The downloads above.
  **About the World** is named in `content.js` but has no file yet, so
  a supporter clicking it gets a 404. **Eric knows and is making it;
  don't raise it again.** If it is still missing much later,
  the alternative is to have a button hide itself when its file is absent —
  download buttons are always drawn, so unlike the video and buy-access
  links, emptying a label won't do it. (There were four: the full-album zip
  was dropped on 29 September 2026. "Listening Guide" was briefly renamed
  "Liner Notes" the same day and put straight back — that name already
  belongs to the lyrics panel's handle, and one page should not have two
  different things under it.) **The file names now match the labels** —
  `listening-guide.pdf`, `lyric-booklet.pdf`, `about-the-world.pdf`,
  lined up on 30 September 2026 before Eric made the files, which was
  the moment to do it: two of them still read `digital-lyric-book` and
  `about-pawleys-island` from before the buttons were renamed.
- **The album is complete**, as of 2 October 2026: every track has
  audio, and every track but the three interstitials has words. Eric
  added 09 and 16 — the last two — that day. Nothing reads "Soon" any more and the
  "Soon" path has no live example on the album; keep that in mind
  before assuming it still has one to test against. Both new files are
  128 kbps stereo 44.1 kHz, matching the other eighteen. (Earlier:
  04, 08 and 14 added and 02, 12 and 13 replaced on 24 September 2026,
  `audio_version` to 3; 18 added on 29 September with no bump.)
  **`audio_version` was deliberately NOT bumped for 09 and 16** —
  both addresses had never served a file, so there was no old copy
  anywhere to displace. The reasoning is written into `content.js`
  beside the setting.
- **15 and 16 were swapped on 1 October 2026** — 15 is now How to Be
  Young, 16 is The Gray Man and is the one still waiting for a file.
  Eric renamed `16.mp3`/`16.lrc` to `15.*` on his Mac **and in the
  bucket**, and both version numbers were bumped to 4. The singers
  needed no attention: `track_artists` is keyed by title, which is
  exactly what that design is for. Checked afterwards that Next and the
  end-of-song roll-on both skip the empty 16 and land on 17, and that
  `bonus_starts_at` at 19 was untouched because the swap sits above it.
- **Three tracks have audio but no words:** 08, 13 and 18 — the three
  *Eye of the Storm* interstitials, so this may well be final rather
  than a gap. Their panel says there are no lyrics, which is correct.
  (02, 04, 12 and 14 were written on 29 September 2026,
  `lyrics_version` to 3; 09 and 16 on 2 October, `lyrics_version` to 5.)
- **Every other track has both.** All seventeen `.lrc` files were
  re-read on 2 October 2026 after Eric redid a batch of uploads: all
  UTF-8, all ascending, none with an untimed line, and every last
  stamp inside its song. **That sweep is only worth believing because
  the checker was first proved against a deliberately broken file** —
  a clean result from an untested checker is not evidence of anything.
- **Every track has liner notes, as of 3 October 2026.** 19 and 20
  were added that evening and 16 was revised, `notes_version` to 3.
  The two bonus notes are prose only, with no credit block — 19 opens
  "Oh right, the bonus tracks!" and 20 is a single line with no line
  ending at all, which the reader handles. So "No notes for this
  track" has no live example on the album any more. What follows was
  written when only 01–18 existed.
- **Tracks 01–18 have liner notes**, added 2 October 2026 as `.txt`.
  The two bonus tracks, 19 and 20, had none at the time. Each note is a credit block — Words and Music,
  Arrangement, Featured Performers — then prose about the song. All
  eighteen are UTF-8, with no headings, rules or emphasis markup in
  any of them, so the reader renders paragraphs and line breaks and
  nothing else.
- **The notes were checked against the track list by their Featured
  Performer line, not by eye.** That is what proved the numbering
  survived the 15/16 swap of the day before: note 15 credits Colin
  Donnell and note 16 Ella Frederickson, matching `track_artists`.
  **It is a better check than reading the prose**, because most notes
  never name their own song.
- **Settled 2 October 2026: track 15 is "Colin Donnell, Eric Sorrels, &
  Ella Frederickson".** The note was right and `track_artists` was
  short; Eric confirmed and the track list was brought into line. **All
  eighteen now agree with their notes**, which is the check to re-run
  after any credit change — match each note's Featured Performer
  against `track_artists` rather than reading the prose. (08, 13 and 18
  have no Featured Performer line at all, which is correct: they are
  instrumental, and `track_artists` naming Eric Sorrels for them is not
  a mismatch.)
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
