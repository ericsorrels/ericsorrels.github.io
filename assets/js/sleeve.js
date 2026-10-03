// THE GRAY MAN — the album sleeve, which turns over.
//
// The cover on one side, the credits on the other. Press the left or
// right of the picture to turn it; press the middle to open it larger
// over the page, where it goes on turning. A finger swipes it either
// way, and the arrow keys do the same from a keyboard.
//
// Everything it needs is in the markup of access.html. With this file
// missing, or JavaScript off, both pictures are simply shown one above
// the other — which is why the carousel is switched on from in here
// (`sleeve--live`) rather than assumed by the stylesheet. Nothing is
// ever hidden behind a control that cannot work.
//
// Every word it reads out comes from content.js → access.

(function () {
  'use strict';

  var C = window.SITE_CONTENT || {};
  var A = C.access || {};

  var sleeve = document.getElementById('sleeve');
  if (!sleeve) return;

  var frame = sleeve.querySelector('.sleeve__frame');
  var faces = [].slice.call(sleeve.querySelectorAll('.sleeve__face'));
  if (!frame || faces.length < 2) return;      // one picture turns over nothing

  // How far a finger must travel across before it counts as turning the
  // sleeve rather than resting on it. The same bargain the lyrics sheet
  // strikes, and for the same reason: a gesture more up-and-down than
  // across belongs to the page, which must go on scrolling.
  var SWIPE = 40;
  var SWIPE_TIME = 800;

  var at = 0;                 // which side is showing
  var lightbox = null;        // built the first time it is opened
  var openedFrom = null;      // what to give focus back to on closing

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------
     Turning it over
     ------------------------------------------------------------------ */

  function show(index, quietly) {
    at = (index + faces.length) % faces.length;

    faces.forEach(function (face, i) {
      var here = i === at;
      face.classList.toggle('is-shown', here);
      // The one that isn't showing is taken out of the reading order
      // as well as out of sight, or a screen reader announces the
      // credits while the cover is on screen.
      face.setAttribute('aria-hidden', here ? 'false' : 'true');
    });

    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-here', i === at);
      dot.setAttribute('aria-selected', i === at ? 'true' : 'false');
      dot.tabIndex = i === at ? 0 : -1;
    });

    // The buttons say what they will do next, not where you are.
    if (prev) prev.setAttribute('aria-label', labelFor(at - 1));
    if (next) next.setAttribute('aria-label', labelFor(at + 1));

    if (lightbox) paintLightbox(quietly);
  }

  // What turning in a given direction would land on. With two sides
  // these are the same picture, which is exactly right — "show the
  // credits" when the cover is up, and the reverse.
  function labelFor(index) {
    var i = (index + faces.length) % faces.length;
    return i === 0
      ? (A.sleeve_previous || 'Show the album cover')
      : (A.sleeve_next || 'Show the album credits');
  }

  function turn(by) {
    show(at + by);
  }

  /* ------------------------------------------------------------------
     The three places to press, laid over the picture

     Real buttons rather than regions of a div, so a keyboard reaches
     them and a screen reader says what they are. They are invisible
     until the picture is hovered or one of them is focused — the
     sleeve should look like a sleeve, not like a control panel.
     ------------------------------------------------------------------ */

  function button(className, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.setAttribute('aria-label', label);
    b.setAttribute('title', label);
    return b;
  }

  var prev = button('sleeve__press sleeve__press--prev', labelFor(-1));
  var open = button('sleeve__press sleeve__press--open', A.sleeve_open || 'Open the album art larger');
  var next = button('sleeve__press sleeve__press--next', labelFor(1));

  // A mark for each, so the arrows are findable rather than guessed at.
  var CHEVRON_LEFT = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"' +
    ' stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M15 4L7 12l8 8"/></svg>';
  var CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"' +
    ' stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M9 4l8 8-8 8"/></svg>';
  var ENLARGE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"' +
    ' stroke="currentColor" stroke-width="1.5" stroke-linecap="square">' +
    '<path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>';

  prev.innerHTML = '<span class="sleeve__mark">' + CHEVRON_LEFT + '</span>';
  next.innerHTML = '<span class="sleeve__mark">' + CHEVRON_RIGHT + '</span>';
  open.innerHTML = '<span class="sleeve__mark sleeve__mark--open">' + ENLARGE + '</span>';

  frame.appendChild(prev);
  frame.appendChild(open);
  frame.appendChild(next);

  /* ---- Which side is up, said quietly underneath -------------------- */

  var dotRow = document.createElement('div');
  dotRow.className = 'sleeve__dots';
  dotRow.setAttribute('role', 'tablist');

  var dots = faces.map(function (face, i) {
    var dot = button('sleeve__dot', labelFor(i));
    dot.setAttribute('role', 'tab');
    dot.addEventListener('click', function () { show(i); });
    dotRow.appendChild(dot);
    return dot;
  });

  sleeve.appendChild(dotRow);

  /* ------------------------------------------------------------------
     Pressing, swiping, and the arrow keys
     ------------------------------------------------------------------ */

  // A swipe ends in a click on whatever it set off from, so a finger
  // drawn across the left of the picture would turn it twice. The flag
  // swallows that one click, on a short fuse so it can never outlive
  // the gesture that set it.
  var swallow = false;

  function swallowed() {
    if (!swallow) return false;
    swallow = false;
    return true;
  }

  function press(button, what) {
    button.addEventListener('click', function () {
      if (swallowed()) return;
      what();
    });
  }

  press(prev, function () { turn(-1); });
  press(next, function () { turn(1); });
  press(open, function () { openLightbox(); });

  // Swiping. Watched from the start of the touch so that a gesture
  // which turns out to be a scroll can be let go of rather than fought
  // for — `touch-action: pan-y` in the stylesheet is the other half.
  function swipable(element, onTurn) {
    var from = null;

    element.addEventListener('touchstart', function (event) {
      from = event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY, at: Date.now() }
        : null;
    }, { passive: true });

    element.addEventListener('touchmove', function (event) {
      if (!from) return;
      var touch = event.touches[0];
      // More up-and-down than across: the page is being scrolled.
      if (Math.abs(touch.clientY - from.y) > Math.abs(touch.clientX - from.x)) {
        from = null;
      }
    }, { passive: true });

    element.addEventListener('touchend', function (event) {
      if (!from) return;
      var travelled = event.changedTouches[0].clientX - from.x;
      var quick = Date.now() - from.at < SWIPE_TIME;
      if (quick && Math.abs(travelled) >= SWIPE) {
        // Swiping leftward brings the next side in from the right,
        // which is the way every photograph on a phone behaves.
        onTurn(travelled < 0 ? 1 : -1);
        swallow = true;
        window.setTimeout(function () { swallow = false; }, 400);
      }
      from = null;
    }, { passive: true });

    element.addEventListener('touchcancel', function () { from = null; }, { passive: true });
  }

  swipable(frame, turn);

  // The arrows, for anyone already inside the sleeve with a keyboard.
  sleeve.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    turn(event.key === 'ArrowRight' ? 1 : -1);
  });

  /* ------------------------------------------------------------------
     Opening it over the page

     Built the first time it is wanted, and kept afterwards. The larger
     copy of each picture — data-full in the markup — is fetched only
     now, so nobody pays 700 KB for a sleeve they never opened. Until
     it arrives the small one is shown stretched, which is softer than
     the real thing and very much better than an empty frame.
     ------------------------------------------------------------------ */

  var vault = document.getElementById('vault');
  var big = null;
  var bigFrame = null;
  var loaded = [];        // which full-size pictures have arrived

  function buildLightbox() {
    lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.id = 'sleeveLightbox';
    lightbox.hidden = true;
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');

    bigFrame = document.createElement('div');
    bigFrame.className = 'lightbox__frame';

    big = document.createElement('img');
    big.className = 'lightbox__img';
    big.decoding = 'async';
    bigFrame.appendChild(big);

    var shut = button('lightbox__close', A.sleeve_close || 'Close the album art');
    shut.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"' +
      ' stroke="currentColor" stroke-width="1.5" stroke-linecap="square">' +
      '<path d="M5 5l14 14M19 5L5 19"/></svg>';

    var back = button('lightbox__step lightbox__step--prev', labelFor(at - 1));
    var on = button('lightbox__step lightbox__step--next', labelFor(at + 1));
    back.innerHTML = CHEVRON_LEFT;
    on.innerHTML = CHEVRON_RIGHT;

    lightbox.appendChild(shut);
    lightbox.appendChild(back);
    lightbox.appendChild(bigFrame);
    lightbox.appendChild(on);
    document.body.appendChild(lightbox);

    // With two sides, a press anywhere on the picture turns it over —
    // which is what Eric asked for, and what the arrows either side
    // say in a way a bare picture cannot.
    press(big, function () { turn(1); });
    press(back, function () { turn(-1); });
    press(on, function () { turn(1); });
    press(shut, closeLightbox);

    // Outside the picture is the way out. Checked by what was pressed
    // rather than by coordinates, so the arrows and the close button
    // keep their own jobs.
    lightbox.addEventListener('click', function (event) {
      if (swallow) return;
      if (event.target === lightbox || event.target === bigFrame) closeLightbox();
    });

    swipable(lightbox, turn);

    // Keeping the two arrow buttons' labels honest as it turns.
    lightbox.steps = [back, on];
  }

  function paintLightbox(quietly) {
    if (!lightbox) return;

    var face = faces[at];
    var full = face.getAttribute('data-full');

    lightbox.setAttribute('aria-label', face.getAttribute('alt') || '');
    big.alt = face.getAttribute('alt') || '';

    if (lightbox.steps) {
      lightbox.steps[0].setAttribute('aria-label', labelFor(at - 1));
      lightbox.steps[1].setAttribute('aria-label', labelFor(at + 1));
      lightbox.steps[0].setAttribute('title', labelFor(at - 1));
      lightbox.steps[1].setAttribute('title', labelFor(at + 1));
    }

    if (!full) {
      big.src = face.currentSrc || face.src;
      return;
    }

    if (loaded[at]) {
      big.src = full;
      return;
    }

    // The small one first, which the page already holds, so something
    // is on screen immediately. Then the large one quietly over it.
    big.src = face.currentSrc || face.src;
    big.classList.add('is-waiting');

    var want = at;
    var full_ = new window.Image();
    full_.onload = function () {
      loaded[want] = true;
      if (at !== want || !lightbox || lightbox.hidden) return;
      big.src = full;
      big.classList.remove('is-waiting');
    };
    full_.onerror = function () {
      // The large copy is missing. The small one is already showing,
      // which is the whole of what this needs to survive.
      big.classList.remove('is-waiting');
    };
    full_.src = full;

    if (quietly) big.classList.remove('is-waiting');
  }

  function openLightbox() {
    if (!lightbox) buildLightbox();
    openedFrom = document.activeElement;

    lightbox.hidden = false;
    document.documentElement.classList.add('lightbox-open');
    paintLightbox();

    // The page behind goes out of reach of the keyboard and screen
    // readers, the same way the lyrics stage does it.
    if (vault && 'inert' in HTMLElement.prototype) vault.inert = true;

    window.requestAnimationFrame(function () {
      var shut = lightbox.querySelector('.lightbox__close');
      if (shut) shut.focus();
    });
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.documentElement.classList.remove('lightbox-open');
    if (vault && 'inert' in HTMLElement.prototype) vault.inert = false;

    // Back to whatever opened it, which is the button on the sleeve.
    if (openedFrom && openedFrom.focus) {
      try {
        openedFrom.focus({ preventScroll: true });
      } catch (e) {
        openedFrom.focus();
      }
    }
    openedFrom = null;
  }

  // Escape closes it; the arrows turn it. Caught at the document
  // because the press may be anywhere inside the overlay.
  document.addEventListener('keydown', function (event) {
    if (!lightbox || lightbox.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      turn(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  /* ------------------------------------------------------------------
     Start
     ------------------------------------------------------------------ */

  // Said last, so a browser that fell over on anything above leaves
  // both pictures stacked and readable rather than one of them hidden
  // behind a control that was never wired up.
  sleeve.classList.add('sleeve--live');
  if (calm.matches) sleeve.classList.add('sleeve--calm');

  show(0, true);
})();
