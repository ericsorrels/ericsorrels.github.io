/* =====================================================================
   THE STORM — the gate becoming the vault

   One transition, played once, in one place: the moment the relay
   accepts a code. The gate is not cut away and replaced; it is
   swallowed. The storm turns over it, the vault is built underneath
   while nobody can see it, and then the eye opens onto the album.

   This file knows nothing about sessions, codes, relays or the vault.
   It draws weather and it says when the page underneath is hidden.
   Everything else is access.js's business — which is what lets the
   storm fail without taking a listener's album down with it.

   The contract is one function:

       window.TGMStorm.play(onCovered) -> Promise

   onCovered() is called exactly once, the moment the cover is opaque
   and it is safe to rearrange the page beneath. The promise resolves
   when the cover is gone. Neither ever fires twice, and a skip fires
   both early rather than skipping them.

   Duotone like everything else: the palette is read from the
   stylesheet's own custom properties at run time, so it cannot drift
   from the site if a colour is ever retuned.

   ---------------------------------------------------------------------
   HOW IT IS DRAWN, AND WHY IT IS DRAWN THAT WAY

   The first version of this drew each band as one filled path with a
   gradient through it. It read as a pinwheel — a comic-book storm —
   and the reason is worth writing down, because the obvious fix is the
   wrong one. A hurricane on a satellite image has no smooth edges
   anywhere. It is thousands of separate cloud cells at every size,
   clumped into bands that break, thin out, and fray into the ocean.
   Smooth is what makes a drawing of a spiral; lumpy is what makes
   weather. No amount of retuning a gradient gets you there.

   So nothing here is a filled path. The cloud is STAMPED: one soft
   round sprite, drawn some nine thousand times at varying size,
   brightness and offset along each band, with a noise function opening
   gaps and thinning the edges. That is expensive to build and cheap to
   show, which suits this exactly — it is built once and then only
   turned.

   Three layers, built separately and turned at slightly different
   rates. A real storm does not rotate as one rigid object: the
   eyewall runs faster than the outer bands, and the shear between
   them is a good part of what the eye reads as "alive". Rates are
   kept close (1.12 / 1.00 / 0.88) so the four principal arms stay
   legible as four arms rather than shearing into soup.
   ===================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     The shape of the weather.
     ------------------------------------------------------------------ */

  // A hurricane on a chart is never a circle and never square to the
  // page. That slight lean is most of what makes this read as weather.
  var TILT = -0.34;          // radians, about 19 degrees off level
  var OVAL = 0.72;           // how far the circle is squashed

  // How far out the baked layers go, in storm radii. Everything must
  // have faded to nothing well inside this: the layer is a square
  // canvas, and cloud still showing at its corner would draw a visible
  // straight edge across the sky.
  var LAYER_REACH = 1.35;

  // Three shells, turning at their own rates.
  var LAYERS = [
    { rate: 1.12 },   // the eyewall and the tight inner cloud
    { rate: 1.00 },   // the four principal arms
    { rate: 0.88 }    // the outer bands, and the cirrus blown off the top
  ];

  var TURN_TOTAL = Math.PI * 2 * 0.82;   // how far it turns, start to end

  /* ------------------------------------------------------------------
     The motes — fine grains of weather riding the arms.

     The baked layers give the storm its structure, but they turn as
     rigid pictures, and a rigid picture turning reads as a picture
     turning. What the eye takes for SPEED is a streak. So a few
     thousand motes ride the same arms and are drawn not as points but
     as a short arc from where each one was a moment ago to where it is
     now — the faster it travels, the longer its streak, at any frame
     rate.

     The tail is computed from the clock rather than remembered between
     frames. A dropped frame therefore lengthens no streak and a tab
     coming back from the background flings nothing across the screen.

     Their colour is taken from where they are, not fixed. Over the
     bright core they are INK, where they read as the dark lanes that
     run between a real storm's bands; out over the water they are
     paper and gray, where anything dark would simply vanish. That is
     the one change from the version these came from, which was ink on
     paper throughout — this storm is lit the other way round.
     ------------------------------------------------------------------ */

  // How far back in time a streak reaches. Short, and it matters: at
  // 95ms every mote at a given radius drew the same long arc, and the
  // storm filled with concentric scratches like a worn record. A streak
  // has to be shorter than the eye can follow, or it stops reading as
  // speed and starts reading as a drawn line. Each mote also carries
  // its own multiplier on this, so no two at the same radius are the
  // same length — which is the other half of what kills the rings.
  // Scaled with the clock. A streak's length is its angular speed times
  // this, so slowing the storm without lengthening the tail would have
  // quietly thinned the streaks away to nothing.
  var MOTE_TAIL_MS = 68;
  var MOTE_FLING = 1.45;     // how far out they are thrown as the eye opens

  // Four batches, each stroked in one pass. Per-mote alpha would mean a
  // stroke per mote; the variation that matters comes from where they
  // are and how they clump, not from each one being its own shade.
  // Kept faint. These are meant to say the storm is moving, not to be
  // the thing you look at — the cloud is the picture. At double these
  // values they took it over.
  var MOTE_TONES = [
    { tone: 'paper',  alpha: 0.15, line: 0.9 },
    { tone: 'shadow', alpha: 0.13, line: 1.1 },
    { tone: 'gray',   alpha: 0.09, line: 1.4 },
    { tone: 'ink',    alpha: 0.19, line: 1.0 }
  ];

  // Differential rotation, continuous this time rather than the three
  // discrete shells the baked layers use: the eyewall runs fastest and
  // the outer bands drag. Kept inside the layers' own spread so the
  // motes never visibly outrun the cloud they are riding on.
  function moteRate(r) {
    return 1.16 - 0.30 * clamp01(r / 1.2);
  }

  // The eye, in storm radii. There is a narrow band to hit: too large
  // and it is a dinner plate with weather round the rim, too small and
  // it reads as a pinhole punched in a cloud rather than as the thing
  // the whole system is turning about. 0.062 was the pinhole.
  var EYE_R = 0.088;

  /* ------------------------------------------------------------------
     The clock. Three phases, and the first one's length is the only
     number access.js depends on — it is when the page beneath is safe
     to rearrange.
     ------------------------------------------------------------------ */

  var COVER_MS = 600;    // the gate is swallowed; the storm begins to turn
  var HOLD_MS = 1160;    // it turns, while the vault is built underneath
  var OPEN_MS = 1440;    // the eye opens onto the album
  var TOTAL_MS = COVER_MS + HOLD_MS + OPEN_MS;   // 3200

  // All three were scaled together from 420/820/1020 rather than the
  // extra time being added to one end. The storm turns through the same
  // angle whatever the clock says, so stretching the clock is what
  // actually makes it turn more slowly; padding a single phase would
  // just have held a still picture for longer.
  //
  // TWO THINGS ELSEWHERE ARE TIED TO THESE NUMBERS and were moved with
  // them. The `.storm` opacity transition in style.css must equal
  // COVER_MS, or the gate is cut away rather than swallowed. And the
  // CSS failsafe that fades the sheet must stay later than this file's
  // own last-resort timer at TOTAL_MS + 1200 — now 4400ms, so the
  // failsafe went to 6000.

  var SKIP_MS = 160;     // a press ends it — quickly, but not as a cut

  /* ------------------------------------------------------------------
     The palette, read from the stylesheet rather than written here.
     ------------------------------------------------------------------ */

  function readColour(name, fallback) {
    var raw = '';
    try {
      raw = getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim();
    } catch (e) {
      raw = '';
    }
    var hex = /^#?([0-9a-f]{6})$/i.exec(raw.replace(/^#/, '#'));
    if (!hex) return fallback;
    var n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* ------------------------------------------------------------------
     Randomness that comes out the same every time.

     The storm has to be the same storm on every sign-in — this is a
     piece of the site, not a toy that surprises you. So nothing here
     calls Math.random: it runs off a seeded generator that is reset
     before each build, which means the weather is reproducible and any
     shape worth keeping can be found again.
     ------------------------------------------------------------------ */

  var seed = 1;

  function reseed(n) { seed = n >>> 0; }

  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  // Smooth value noise, for the way a band thickens and thins and
  // breaks along its length. Three octaves is enough to stop the
  // clumping looking regular.
  function hash1(n) {
    var s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  function noise1(x) {
    var i = Math.floor(x), f = x - i;
    var a = hash1(i), b = hash1(i + 1);
    var u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }

  function fbm(x) {
    return noise1(x) * 0.54 + noise1(x * 2.17) * 0.29 + noise1(x * 4.63) * 0.17;
  }

  /* ------------------------------------------------------------------
     Easing.
     ------------------------------------------------------------------ */

  function easeIn(u) { return Math.pow(u, 1.45); }

  function easeOpen(u) {
    // Slow at first — the eye widening — then away.
    return u < 0.45 ? 2.1 * u * u : 1 - Math.pow(1 - u, 2.6);
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* ------------------------------------------------------------------
     Can this browser draw at all?
     ------------------------------------------------------------------ */

  function supported() {
    try {
      var probe = document.createElement('canvas');
      return !!(probe.getContext && probe.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------
     The paper grain and the printer's screen, baked into one tile.

     The site wears both as CSS pseudo-elements. Neither reaches a
     canvas, so they are drawn here — the same fine newsprint grain and
     the same 3px dot grid. This is also what keeps the picture from
     going soft: the cloud layers are built at a fixed size and blown
     up to fill the screen, and grain laid over the top at the screen's
     own resolution is what puts the fine detail back.
     ------------------------------------------------------------------ */

  function makeTexture(ctx, ink, paper) {
    var size = 120;                 // a multiple of 3, so the grid meets
    var tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;

    var tctx = tile.getContext('2d');
    var img = tctx.createImageData(size, size);
    var d = img.data;

    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var i = (y * size + x) * 4;
        var n = Math.random();
        var lift = (x % 3 === 0 && y % 3 === 0) ? 13 : 0;
        var light = n > 0.5;
        d[i] = light ? paper[0] : ink[0];
        d[i + 1] = light ? paper[1] : ink[1];
        d[i + 2] = light ? paper[2] : ink[2];
        d[i + 3] = Math.round(n * 24) + lift;
      }
    }

    tctx.putImageData(img, 0, 0);

    try {
      return ctx.createPattern(tile, 'repeat');
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------
     One cloud cell.

     A soft round sprite, made once per tone and then stamped thousands
     of times. Drawing a prepared image is many times cheaper than
     building a gradient per cell, and at these counts that is the
     difference between a storm that builds in a twentieth of a second
     and one that visibly hangs the page.

     The falloff is deliberately not linear. A cell with a bright
     middle and a long thin tail piles up into something that has both
     dense cores and vague edges, which is what a cloud field does.
     ------------------------------------------------------------------ */

  function makeCell(colour, px) {
    var c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    g.addColorStop(0.00, rgba(colour, 1));
    g.addColorStop(0.22, rgba(colour, 0.72));
    g.addColorStop(0.50, rgba(colour, 0.28));
    g.addColorStop(0.78, rgba(colour, 0.07));
    g.addColorStop(1.00, rgba(colour, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, px, px);
    return c;
  }

  /* ------------------------------------------------------------------
     The bands.

     Each is a logarithmic spiral given as the radius it starts at, the
     radius it ends at and how far round it travels getting there. The
     radius is built as rFrom * (rTo/rFrom)^t rather than from a pitch
     constant, so a band is guaranteed to arrive where it was asked to
     at any screen size.

     The four principal arms are hand-written and deliberately uneven —
     one running far out, one stub, two between, none of them a quarter
     turn apart. Everything else is generated around them: fragments,
     broken outer bands, and the cirrus streaming off the top.
     ------------------------------------------------------------------ */

  function bandsFor(which) {
    var out = [];
    var i;

    if (which === 0) {
      // The central dense overcast, wound tight. Narrow bands with
      // low gap thresholds: this near the middle a real storm is
      // almost solid cloud, and the structure is in its brightness
      // rather than in holes.
      out.push({ at: 0.0, sweep: 3.6, from: 0.105, to: 0.34, width: 0.048, weight: 1.15, gap: 0.10, tone: 0 });
      out.push({ at: 2.1, sweep: 3.2, from: 0.115, to: 0.38, width: 0.042, weight: 1.02, gap: 0.14, tone: 0 });
      out.push({ at: 4.4, sweep: 2.8, from: 0.110, to: 0.32, width: 0.036, weight: 0.88, gap: 0.18, tone: 0 });
      // The eyewall — a ring of cloud, not a drawn circle, so it has
      // the lumpy inner edge every real one has. The brightest thing
      // in the picture, because on an infrared chart the coldest,
      // highest tops stand right here.
      out.push({ at: 0.0, sweep: Math.PI * 2, from: EYE_R * 1.02, to: EYE_R * 1.95, width: 0.040, weight: 1.30, gap: 0.0, tone: 0, dense: true });
      return out;
    }

    if (which === 1) {
      // THE FOUR. Uneven on every axis: where they start, how far they
      // wrap, how wide they run and how solid they are. Narrower and
      // brighter than the first attempt — wide soft bands overlapped
      // into a single disc and the spiral stopped reading at all.
      // The sweeps are what decide whether this is a spiral or a set of
      // rings, and it is the number that took the longest to find. Much
      // past a turn and a half, a band has wrapped far enough to close
      // on itself and the eye reads concentric circles — which is what
      // 7 and 8 radians gave. An arm has to travel OUT more than it
      // travels ROUND to be seen as an arm.
      out.push({ at: 0.00, sweep: 3.10, from: 0.16, to: 0.86, width: 0.078, weight: 1.35, gap: 0.20, tone: 0 });
      out.push({ at: 1.72, sweep: 2.40, from: 0.18, to: 0.62, width: 0.056, weight: 1.05, gap: 0.28, tone: 0 });
      out.push({ at: 3.10, sweep: 3.60, from: 0.15, to: 0.99, width: 0.090, weight: 1.22, gap: 0.24, tone: 0 });
      out.push({ at: 4.88, sweep: 1.90, from: 0.20, to: 0.48, width: 0.042, weight: 0.82, gap: 0.34, tone: 1 });

      // Fragments between them. Real bands are not four clean things
      // with empty sky between; the gaps hold torn-off pieces. Kept
      // few and faint, or they fill the gaps that make the arms arms.
      reseed(20260930);
      for (i = 0; i < 5; i++) {
        out.push({
          at: rnd() * Math.PI * 2,
          sweep: 1.4 + rnd() * 2.2,
          from: 0.24 + rnd() * 0.30,
          to: 0.48 + rnd() * 0.40,
          width: 0.022 + rnd() * 0.026,
          weight: 0.20 + rnd() * 0.20,
          gap: 0.42 + rnd() * 0.18,
          tone: 1
        });
      }
      return out;
    }

    // The outer shield: thin, broken, and falling apart at the edge.
    out.push({ at: 0.55, sweep: 2.90, from: 0.50, to: 1.14, width: 0.092, weight: 0.56, gap: 0.36, tone: 1 });
    out.push({ at: 3.55, sweep: 3.30, from: 0.46, to: 1.20, width: 0.104, weight: 0.50, gap: 0.40, tone: 1 });

    reseed(77712);
    for (i = 0; i < 6; i++) {
      out.push({
        at: rnd() * Math.PI * 2,
        sweep: 1.4 + rnd() * 1.8,
        from: 0.54 + rnd() * 0.30,
        to: 0.86 + rnd() * 0.32,
        width: 0.028 + rnd() * 0.038,
        weight: 0.18 + rnd() * 0.20,
        gap: 0.48 + rnd() * 0.16,
        tone: 2
      });
    }

    // Cirrus blown off the top and away — long, thin, nearly not there.
    // It is what stops the storm ending at a rim.
    for (i = 0; i < 5; i++) {
      out.push({
        at: rnd() * Math.PI * 2,
        sweep: 3.0 + rnd() * 2.0,
        from: 0.70 + rnd() * 0.20,
        to: 1.16 + rnd() * 0.14,
        width: 0.020 + rnd() * 0.016,
        weight: 0.13 + rnd() * 0.11,
        gap: 0.30,
        tone: 2
      });
    }

    return out;
  }

  /* ------------------------------------------------------------------
     Scattering the motes.

     They are placed on the FOUR PRINCIPAL ARMS, read from the same
     table the cloud is built from, so the streaks run along the bands
     a viewer can see rather than swirling independently of them. A
     little under a third are loose haze at a random bearing, which is
     what keeps the gaps between the arms from looking swept clean.

     Seeded, like everything else here, so it is the same storm every
     time.
     ------------------------------------------------------------------ */

  function buildMotes(n) {
    reseed(90210);
    var arms = bandsFor(1).slice(0, 4);
    var out = [];

    for (var i = 0; i < n; i++) {
      var r, a;

      if (rnd() < 0.28) {
        // Haze. Squaring the roll crowds it toward the middle, which is
        // where a storm actually keeps its weather. Kept inside the
        // cloud's own reach: a streak out over bare water has nothing
        // to be part of and reads as a scratch on the picture.
        var t = rnd();
        r = 0.10 + 0.92 * t * t;
        a = rnd() * Math.PI * 2;
      } else {
        var band = arms[(rnd() * arms.length) | 0];
        var s = rnd();
        r = band.from * Math.pow(band.to / band.from, s) * (1 + (rnd() - 0.5) * 0.24);
        a = band.at + s * band.sweep + (rnd() - 0.5) * 0.55;
      }

      // Tone by radius, for the reason set out beside MOTE_TONES: ink
      // only where there is bright cloud behind it to show against.
      var tone;
      if (r < 0.34) tone = rnd() < 0.40 ? 3 : 0;          // ink lanes in the core
      else if (r < 0.75) tone = rnd() < 0.55 ? 1 : 0;     // paper and shadow
      else tone = rnd() < 0.5 ? 2 : 1;                    // thinning to gray

      // Its own share of the tail length, so a ring of motes at one
      // radius does not draw a ring of identical arcs.
      out.push({ r: r, a: a, tone: tone, tail: 0.5 + rnd() * 0.95 });
    }

    return out;
  }

  /* ------------------------------------------------------------------
     Building one layer.

     Coordinates are in storm radii throughout — 1.0 is the storm's
     nominal edge — and turned into layer pixels only at the moment of
     stamping. That is what lets the band table above be written in
     numbers that mean something and never need re-tuning per screen.
     ------------------------------------------------------------------ */

  function buildLayer(which, px, cells) {
    var c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var x = c.getContext('2d');

    var mid = px / 2;
    var U = mid / LAYER_REACH;        // pixels per storm radius
    var bands = bandsFor(which);

    reseed(9001 + which * 7717);

    for (var b = 0; b < bands.length; b++) {
      var band = bands[b];
      var steps = band.dense ? 460 : 230;
      var growth = band.to / band.from;
      var phase = rnd() * 100;

      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var th = band.at + t * band.sweep;
        var r = band.from * Math.pow(growth, t);

        // Where the band is thick, where it thins, and where it simply
        // is not there. Without this every band is a continuous stroke,
        // which is the single biggest tell of a drawn storm.
        var d = fbm(phase + t * 9.0);
        if (d < band.gap) continue;
        var body = (d - band.gap) / (1 - band.gap);

        // Fade out into the ocean. Nothing may still be visible when
        // the layer's square edge arrives, or the sky gets a corner.
        var edge = 1;
        if (r > 1.02) edge = clamp01((1.24 - r) / 0.22);
        if (edge <= 0) continue;

        var many = band.dense ? 3 : (1 + (d * 3) | 0);

        for (var k = 0; k < many; k++) {
          // Scatter across the band rather than along its middle. The
          // tangential jitter is divided by the radius so a cell near
          // the eye is not flung half way round the storm.
          var jr = (rnd() - 0.5) * band.width * 2.2;
          var jt = (rnd() - 0.5) * band.width * 1.5 / Math.max(r, 0.07);
          var rr = r + jr;
          var tt = th + jt;

          var sx = mid + rr * Math.cos(tt) * U;
          var sy = mid + rr * Math.sin(tt) * U;

          // The eyewall gets finer cells than anything else. At the
          // ordinary size a single one can be nearly as wide as the eye,
          // and one surviving the cut hangs off the rim like a tail —
          // which turned the eye into a comma on every screen.
          var size = band.dense
            ? band.width * U * (0.30 + rnd() * 0.80)
            : band.width * U * (0.55 + rnd() * 1.75);
          var a = band.weight * body * edge * (0.20 + rnd() * 0.40);
          if (a <= 0.004) continue;

          // Brightest nearest the eye, as on an infrared chart where
          // the coldest, highest tops sit over the core. The step down
          // is by radius rather than at random, so the storm is lit
          // from its middle instead of being evenly speckled.
          var tone = band.tone;
          if (tone === 0 && rr > 0.42) tone = 1;
          if (tone === 0 && rr > 0.70) tone = 2;
          if (rnd() > 0.86) tone = Math.min(2, tone + 1);

          x.globalAlpha = a > 1 ? 1 : a;
          x.drawImage(cells[tone], sx - size / 2, sy - size / 2, size, size);
        }
      }
    }

    x.globalAlpha = 1;
    return c;
  }

  /* ------------------------------------------------------------------
     The performance itself.
     ------------------------------------------------------------------ */

  function play(onCovered) {
    var ink = readColour('--ink', [27, 26, 23]);
    var paper = readColour('--paper', [237, 232, 221]);
    var gray = readColour('--gray-mid', [139, 133, 121]);
    var shadow = readColour('--paper-shadow', [211, 204, 184]);

    // Named, so the mote table above can be written in the palette's own
    // words rather than in indexes nobody can read back.
    var tones = { paper: paper, shadow: shadow, gray: gray, ink: ink };

    var cover = document.createElement('div');
    cover.className = 'storm';
    cover.setAttribute('aria-hidden', 'true');

    var canvas = document.createElement('canvas');
    canvas.className = 'storm__canvas';
    cover.appendChild(canvas);
    document.body.appendChild(cover);

    var ctx = canvas.getContext('2d');
    if (!ctx) {
      // Nothing can be drawn. Say the page is covered — it is not, but
      // a listener waiting on that word must not be left waiting — and
      // take the cover straight back off again.
      cover.parentNode.removeChild(cover);
      try { onCovered(); } catch (e) {}
      return Promise.resolve();
    }

    var w = 0, h = 0, dpr = 1;
    var texture = makeTexture(ctx, ink, paper);
    var vignette = null;
    var layers = null;
    var layerPx = 0;
    var motes = null;

    // The cloud is assembled here first, then laid over the sea as one
    // picture. It has to be a separate surface, and the reason is the
    // eye: the eye is taken OUT of the cloud with destination-out, so
    // that what shows through it is the eyewall's own torn inner edge
    // rather than a drawn circle. Done straight onto the visible
    // canvas, that same cut goes through the sea as well and turns the
    // eye into a window onto the gate — which is exactly what it did
    // on the first attempt, with the page's own words legible through
    // the middle of the hurricane.
    var cloud = document.createElement('canvas');
    var cctx = cloud.getContext('2d');

    // Three tones. Duotone still: paper for the high cold tops, the
    // paper shadow for the body of the cloud, the middle gray for
    // whatever is thinning out into the sea.
    var cells = [
      makeCell(paper, 64),
      makeCell(shadow, 64),
      makeCell(gray, 64)
    ];

    function radius() {
      // Set so the whole system is legible AS a system — eye, eyewall,
      // the four arms winding off it — with the outer bands running off
      // the sides rather than stopping inside the frame.
      //
      // Tuned down from 0.78 of the long side, which put the viewport
      // inside the cloud: beautifully textured and completely
      // unreadable, because at that magnification a hurricane is just
      // weather out of an aeroplane window. It has to be seen from far
      // enough away to have a shape.
      return Math.max(w, h) * 0.50;
    }

    // Where the eye sits. Off centre, and slowly adrift — the bands are
    // built around the eye, so moving this moves the whole system and
    // the storm never comes apart from its own middle.
    function eyeAt(secs) {
      return {
        x: w * 0.5 + w * 0.085 + Math.sin(secs * 0.62 + 0.4) * w * 0.012,
        y: h * 0.5 - h * 0.055 + Math.cos(secs * 0.47) * h * 0.011
      };
    }

    function measure() {
      // Capped at 2: past that the extra pixels cost real frames on a
      // phone and buy nothing the grain does not already hide.
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      cloud.width = canvas.width;
      cloud.height = canvas.height;

      var cx = w * 0.5, cy = h * 0.5;
      var far = Math.sqrt(cx * cx + cy * cy);

      vignette = ctx.createRadialGradient(cx, cy, far * 0.25, cx, cy, far);
      vignette.addColorStop(0, rgba(ink, 0));
      vignette.addColorStop(0.62, rgba(ink, 0.22));
      vignette.addColorStop(1, rgba(ink, 0.80));

      // The layers are built at a fixed size and blown up to fit. Cloud
      // upscales better than anything else there is — it has no edges
      // to go soft — and the grain laid over the top afterwards is at
      // the screen's own resolution, which is where the fine detail
      // actually comes from. Rebuilt only if the size moved enough to
      // matter, because building is the one expensive thing here.
      var wanted = Math.min(1024, Math.max(640, Math.round(Math.max(w, h) * 0.9)));
      if (!layers || Math.abs(wanted - layerPx) > 160) {
        layerPx = wanted;
        layers = [
          buildLayer(0, layerPx, cells),
          buildLayer(1, layerPx, cells),
          buildLayer(2, layerPx, cells)
        ];
      }

      // Same density of motes on any screen, so a phone does a fraction
      // of the work for the same look rather than the same work for a
      // quarter of the pixels.
      if (!motes) {
        motes = buildMotes(
          Math.round(Math.min(2600, Math.max(900, w * h / 420)))
        );
      }
    }

    measure();
    window.addEventListener('resize', measure);

    /* ---------------------------------------------------------------
       State. Three latches, each of which must fire exactly once.
       --------------------------------------------------------------- */

    var started = 0;
    var covered = false;
    var finished = false;
    var skipped = false;
    var skippedAt = 0;
    var raf = 0;
    var settle = null;

    function sayCovered() {
      if (covered) return;
      covered = true;
      // Wrapped, because whatever access.js does with this word is not
      // this file's to get wrong. If building the vault throws, the
      // storm still has to come off the screen.
      try { onCovered(); } catch (e) {}
    }

    /* ---------------------------------------------------------------
       The clock, asked as a function of time rather than read off the
       current frame. A streak needs to know where its mote was 95ms
       ago, and the honest way to answer that is to work it out, not to
       remember the last frame — which would stretch every streak after
       a dropped frame and fling the lot across the screen when a
       backgrounded tab came back.
       --------------------------------------------------------------- */

    function spinAt(ms) {
      return TURN_TOTAL * easeIn(clamp01(ms / TOTAL_MS));
    }

    function openAt(ms) {
      var from = skipped ? skippedAt : COVER_MS + HOLD_MS;
      var over = skipped ? SKIP_MS : OPEN_MS;
      return ms <= from ? 0 : easeOpen(clamp01((ms - from) / over));
    }

    // Where one mote is at a given moment, in screen pixels. The order
    // of the transforms matches the layer draw exactly — turn, squash,
    // tilt, then move to the eye — or the streaks would ride a
    // different storm from the cloud beneath them.
    function moteAt(m, ms, R, eye, cosT, sinT, out) {
      var o = openAt(ms);
      var rr = m.r * (1 + MOTE_FLING * o * o) * R;
      var ang = m.a + spinAt(ms) * moteRate(m.r);
      var lx = Math.cos(ang) * rr;
      var ly = Math.sin(ang) * rr * OVAL;
      out.x = eye.x + lx * cosT - ly * sinT;
      out.y = eye.y + lx * sinT + ly * cosT;
    }

    var pA = { x: 0, y: 0 }, pB = { x: 0, y: 0 }, pC = { x: 0, y: 0 };

    function drawMotes(c, elapsed, R, eye) {
      if (!motes) return;

      var cosT = Math.cos(TILT), sinT = Math.sin(TILT);
      var o = openAt(elapsed);

      // In over the first third of a second, and away as the eye opens
      // — by the time the album is legible through the hole there
      // should be no weather left blowing across it.
      var fade = Math.min(1, elapsed / 480) * (1 - o * 0.85);
      if (fade <= 0.01) return;

      var paths = [[], [], [], []];

      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        var t1 = elapsed;
        var t0 = Math.max(0, elapsed - MOTE_TAIL_MS * m.tail);
        var tm = (t0 + t1) / 2;
        moteAt(m, t0, R, eye, cosT, sinT, pA);
        moteAt(m, tm, R, eye, cosT, sinT, pB);
        moteAt(m, t1, R, eye, cosT, sinT, pC);
        // Three points, two segments: a straight streak would cut the
        // corner on an arc this tight near the eye.
        paths[m.tone].push(pA.x, pA.y, pB.x, pB.y, pC.x, pC.y);
      }

      c.save();
      c.lineCap = 'round';
      c.lineJoin = 'round';

      for (var k = 0; k < MOTE_TONES.length; k++) {
        var p = paths[k];
        if (!p.length) continue;
        var spec = MOTE_TONES[k];
        c.globalAlpha = spec.alpha * fade;
        c.lineWidth = spec.line;
        c.strokeStyle = rgba(tones[spec.tone], 1);
        c.beginPath();
        for (var n = 0; n < p.length; n += 6) {
          c.moveTo(p[n], p[n + 1]);
          c.lineTo(p[n + 2], p[n + 3]);
          c.lineTo(p[n + 4], p[n + 5]);
        }
        c.stroke();
      }

      c.restore();
    }

    function drawFrame(elapsed) {
      var u = clamp01(elapsed / TOTAL_MS);
      var spin = TURN_TOTAL * easeIn(u);
      var secs = elapsed / 1000;
      var R = radius();
      var eye = eyeAt(secs);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // The sea. Not flat — a slow lift under the storm, so the cloud
      // sits in weather rather than on a rectangle of paint.
      ctx.fillStyle = rgba(ink, 1);
      ctx.fillRect(0, 0, w, h);

      // A faint warmth under the system, so the sea is not flat black
      // where the storm sits on it. Kept low: raised, it becomes a glow
      // behind everything and flattens the cloud's own modelling.
      var lift = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, R * 1.15);
      lift.addColorStop(0, rgba(gray, 0.13));
      lift.addColorStop(0.55, rgba(gray, 0.05));
      lift.addColorStop(1, rgba(gray, 0));
      ctx.fillStyle = lift;
      ctx.fillRect(0, 0, w, h);

      // --- the cloud, built on its own surface ------------------------
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cctx.clearRect(0, 0, w, h);

      // Each shell turned at its own rate inside the tilt and the
      // squash, so the whole system leans one way and shears gently
      // against itself as it goes.
      var span = R * LAYER_REACH * 2;
      for (var i = 0; i < layers.length; i++) {
        cctx.save();
        cctx.translate(eye.x, eye.y);
        cctx.rotate(TILT);
        cctx.scale(1, OVAL);
        cctx.rotate(spin * LAYERS[i].rate);
        cctx.drawImage(layers[i], -span / 2, -span / 2, span, span);
        cctx.restore();
      }

      // The motes go on the cloud surface and BEFORE the eye is cut, so
      // the eye takes them out along with everything else. Drawn onto
      // the visible canvas instead, streaks would go on blowing across
      // an open eye with the album showing through it.
      drawMotes(cctx, elapsed, R, eye);

      // The eye, taken out of the cloud. What is left showing is the
      // eyewall's own torn inner edge — a drawn dark circle would give
      // the one clean line this whole picture is trying not to have.
      var eyeR = R * EYE_R;
      cctx.save();
      cctx.translate(eye.x, eye.y);
      cctx.rotate(TILT);
      cctx.scale(1, OVAL);
      // Cut tight, and softly. A wide or hard cut eats the eyewall's
      // scattered inner cells and leaves a clean black ellipse — the
      // one drawn-looking thing in an otherwise torn picture. Cutting
      // just inside the wall lets those cells survive and ring the eye
      // raggedly, which is what a real one looks like.
      var clear = cctx.createRadialGradient(0, 0, 0, 0, 0, eyeR * 1.18);
      clear.addColorStop(0.00, 'rgba(0,0,0,1)');
      clear.addColorStop(0.44, 'rgba(0,0,0,0.96)');
      clear.addColorStop(0.74, 'rgba(0,0,0,0.62)');
      clear.addColorStop(1.00, 'rgba(0,0,0,0)');
      cctx.globalCompositeOperation = 'destination-out';
      cctx.fillStyle = clear;
      cctx.beginPath();
      cctx.arc(0, 0, eyeR * 1.18, 0, Math.PI * 2);
      cctx.fill();
      cctx.restore();

      // Laid over the sea as one picture, so the hole in it shows
      // water rather than the page.
      ctx.drawImage(cloud, 0, 0, w, h);

      // Grain and the printer's screen, over the whole thing at once.
      if (texture) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = texture;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // The eye opening. Everything above is painted, then a hole is
      // taken back out of it — growing from the eye, so the album is
      // read through the eye rather than from behind a curtain going up.
      var openFrom = skipped ? skippedAt : COVER_MS + HOLD_MS;
      var openOver = skipped ? SKIP_MS : OPEN_MS;

      if (elapsed >= openFrom) {
        var o = easeOpen(clamp01((elapsed - openFrom) / openOver));

        // Far enough to clear the furthest corner from wherever the
        // eye happens to be — not the centre, which would leave one
        // corner still painted when the rest had gone.
        var far = Math.max(
          Math.sqrt(eye.x * eye.x + eye.y * eye.y),
          Math.sqrt((w - eye.x) * (w - eye.x) + eye.y * eye.y),
          Math.sqrt(eye.x * eye.x + (h - eye.y) * (h - eye.y)),
          Math.sqrt((w - eye.x) * (w - eye.x) + (h - eye.y) * (h - eye.y))
        ) * 1.08;

        var rNow = R * EYE_R + (far - R * EYE_R) * o;

        var cut = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, rNow);
        cut.addColorStop(0.00, 'rgba(0,0,0,1)');
        cut.addColorStop(0.74, 'rgba(0,0,0,1)');
        cut.addColorStop(1.00, 'rgba(0,0,0,0)');

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = cut;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }

    /* ---------------------------------------------------------------
       Finishing, and the ways in to it.
       --------------------------------------------------------------- */

    var resolveWhenGone;
    var gone = new Promise(function (resolve) { resolveWhenGone = resolve; });

    function finish() {
      if (finished) return;
      finished = true;

      if (raf) cancelAnimationFrame(raf);
      if (settle) clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointerdown', skip, true);
      window.removeEventListener('keydown', skip, true);

      // Said again rather than assumed. If the frame loop never ran —
      // a tab put to sleep at exactly the wrong moment — this is the
      // last chance for the vault to get built.
      sayCovered();

      if (cover.parentNode) cover.parentNode.removeChild(cover);
      resolveWhenGone();
    }

    // Any press ends it. The eye opens from wherever it has got to,
    // over SKIP_MS rather than instantly — a cut to the vault on a
    // dark screen reads as a fault, and a sixth of a second does not
    // read as being made to wait.
    function skip() {
      if (skipped || finished) return;
      skipped = true;
      skippedAt = Math.max(0, now() - started);

      // Whoever pressed is not waiting for the fade to finish, so the
      // vault is built at once whether or not the cover was opaque.
      sayCovered();

      cover.classList.add('storm--skipping');
      if (settle) clearTimeout(settle);
      settle = setTimeout(finish, SKIP_MS);
    }

    function now() {
      return (window.performance && performance.now)
        ? performance.now()
        : Date.now();
    }

    function frame() {
      if (finished) return;
      var elapsed = now() - started;

      try {
        drawFrame(elapsed);
      } catch (e) {
        // A drawing fault is not worth a locked-out listener.
        finish();
        return;
      }

      if (!covered && elapsed >= COVER_MS) sayCovered();

      if (!skipped && elapsed >= TOTAL_MS) {
        finish();
        return;
      }

      raf = requestAnimationFrame(frame);
    }

    /* ---------------------------------------------------------------
       Go. The cover is added transparent and lit on the next frame, so
       the browser has a value to transition away from — set in the
       same frame it is inserted, the fade never happens and the gate
       is cut away rather than swallowed.
       --------------------------------------------------------------- */

    started = now();
    drawFrame(0);

    requestAnimationFrame(function () {
      cover.classList.add('storm--in');
      started = now();
      raf = requestAnimationFrame(frame);
    });

    window.addEventListener('pointerdown', skip, true);
    window.addEventListener('keydown', skip, true);

    // The belt to the CSS failsafe's braces. If requestAnimationFrame
    // never fires again — a backgrounded tab is the ordinary way this
    // happens — the storm still comes off.
    settle = setTimeout(function () {
      if (!finished) finish();
    }, TOTAL_MS + 1200);

    return gone;
  }

  window.TGMStorm = {
    supported: supported,
    play: play,
    // Read by nothing here; exported so access.js's own failsafe can be
    // set from this file's clock rather than from a number copied into
    // another file and left to go stale.
    coverMs: COVER_MS,
    totalMs: TOTAL_MS
  };
})();
