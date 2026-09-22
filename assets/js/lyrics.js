// THE GRAY MAN — the lyrics panel on the Early Digital Access page.
//
// When a track starts playing, its words are fetched from
// assets/lyrics/NN.lrc — NN being the track number — falling back to
// NN.txt, and saying so plainly when there is neither. Timed words
// (.lrc) light the line being sung, scroll themselves along with it, and
// jump the song when a line is clicked. Plain words are simply shown.
//
// The panel opens and closes with the Lyrics tab, and that choice is
// remembered between visits, like the volume.
//
// Every word the listener reads here comes from content.js → access.
// The album itself arrives from access.js once the vault is built.

(function () {
  'use strict';

  var C = window.SITE_CONTENT || {};
  var A = C.access || {};

  var tab = document.getElementById('lyricsTab');
  var panel = document.getElementById('lyricsPanel');
  if (!tab || !panel) return;

  var numEl = document.getElementById('lyricsNum');
  var titleEl = document.getElementById('lyricsTitle');
  var scroller = document.getElementById('lyricsScroll');
  var statusEl = document.getElementById('lyricsStatus');
  var list = document.getElementById('lyricsLines');
  var announcer = document.getElementById('lyricsAnnounce');

  var OPEN_KEY = 'tgm_lyrics';

  // How long the panel leaves the listener alone after they scroll it
  // themselves, so it doesn't drag the words back mid-read.
  var HANDS_OFF = 4000;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wideEnough = window.matchMedia('(min-width: 1280px)');

  var started = false;
  var isOpen = false;
  var current = null;      // the track on show: { number, title, audio }
  var entries = [];        // its timed lines, in time order
  var buttons = [];        // entry index → the button showing it (gaps have none)
  var activeIndex = -1;
  var frameRequest = 0;
  var scrolledAt = 0;
  var loadToken = 0;
  var cache = {};          // track number → what was found for it

  /* ------------------------------------------------------------------
     Reading an .lrc file
     ------------------------------------------------------------------ */

  function parseLrc(text) {
    var shiftSeconds = 0;
    var found = [];

    String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach(function (raw) {
      var line = raw.trim();

      var shift = /^\[offset:\s*([+-]?\d+)\s*\]$/i.exec(line);
      if (shift) {
        shiftSeconds = parseInt(shift[1], 10) / 1000;
        return;
      }

      // A line can carry several times — a chorus sung three times is
      // written once, stamped three times.
      var times = [];
      var stamp;
      while ((stamp = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/.exec(line))) {
        var fraction = stamp[3]
          ? parseInt(stamp[3], 10) / Math.pow(10, stamp[3].length)
          : 0;
        times.push(parseInt(stamp[1], 10) * 60 + parseInt(stamp[2], 10) + fraction);
        line = line.slice(stamp[0].length);
      }

      // No time at all: a tag like [ti:…], or a stray line. Skipped.
      if (!times.length) return;

      // Word-by-word timings are finer than this panel shows.
      var words = line.replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').trim();
      times.forEach(function (time) { found.push({ time: time, text: words }); });
    });

    // A positive offset brings every line in sooner.
    found.forEach(function (entry) {
      entry.time = Math.max(0, entry.time - shiftSeconds);
    });

    // Stable, so a blank line written just before a sung line at the
    // same moment stays above it.
    found.sort(function (a, b) { return a.time - b.time; });
    return found;
  }

  /* ------------------------------------------------------------------
     Finding the words
     ------------------------------------------------------------------ */

  function lyricsUrl(number, extension) {
    return 'assets/lyrics/' + number + '.' + extension
      + (A.lyrics_version ? '?v=' + encodeURIComponent(A.lyrics_version) : '');
  }

  // Resolves to the file's text, or null when there is no such file.
  function fetchText(url) {
    return fetch(url).then(function (response) {
      return response.ok ? response.text() : null;
    });
  }

  function findWords(number) {
    if (cache[number]) return Promise.resolve(cache[number]);

    return fetchText(lyricsUrl(number, 'lrc')).then(function (text) {
      var timed = text == null ? [] : parseLrc(text);
      if (timed.length) return { kind: 'timed', entries: timed };

      // An .lrc with no times in it is still words worth showing.
      if (text != null && text.trim()) return { kind: 'plain', text: text };

      return fetchText(lyricsUrl(number, 'txt')).then(function (plain) {
        return (plain != null && plain.trim())
          ? { kind: 'plain', text: plain }
          : { kind: 'none' };
      });
    }).then(function (result) {
      cache[number] = result;          // only settled answers are kept
      return result;
    });
  }

  /* ------------------------------------------------------------------
     Putting them on screen
     ------------------------------------------------------------------ */

  function setStatus(text) {
    statusEl.textContent = text || '';
    statusEl.hidden = !text;
  }

  function announce(text) {
    if (!isOpen || !text) return;
    announcer.textContent = '';
    window.setTimeout(function () { announcer.textContent = text; }, 60);
  }

  function clearLines() {
    list.textContent = '';
    list.hidden = true;
    list.style.paddingBottom = '';
    entries = [];
    buttons = [];
    activeIndex = -1;
    scroller.scrollTop = 0;
    scroller.removeAttribute('tabindex');
    scroller.removeAttribute('aria-labelledby');
  }

  // Breaks are held back until a line actually follows, so a blank line
  // at the top or bottom of a file leaves no stray space behind.
  function gapKeeper(into) {
    var waiting = false;
    var anything = false;
    return {
      hold: function () { if (anything) waiting = true; },
      settle: function () {
        if (waiting) {
          var gap = document.createElement('li');
          gap.className = 'lyrics__gap';
          gap.setAttribute('aria-hidden', 'true');
          into.appendChild(gap);
        }
        waiting = false;
        anything = true;
      }
    };
  }

  function renderTimed(timed) {
    entries = timed;
    buttons = [];

    var pieces = document.createDocumentFragment();
    var gaps = gapKeeper(pieces);

    timed.forEach(function (entry, index) {
      if (!entry.text) {
        gaps.hold();
        return;
      }
      gaps.settle();
      var item = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'lyrics__line';
      button.textContent = entry.text;
      button.tabIndex = -1;
      button.dataset.index = index;
      item.appendChild(button);
      pieces.appendChild(item);
      buttons[index] = button;
    });

    list.appendChild(pieces);
    list.hidden = false;
    sizeTail();

    // One way in from the keyboard; the arrows move from there.
    var first = list.querySelector('button.lyrics__line');
    if (first) first.tabIndex = 0;
  }

  function renderPlain(text) {
    var pieces = document.createDocumentFragment();
    var gaps = gapKeeper(pieces);

    String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach(function (raw) {
      var line = raw.trim();
      if (/^\[[a-z]+:.*\]$/i.test(line)) return;      // a stray .lrc tag
      if (!line) {
        gaps.hold();
        return;
      }
      gaps.settle();
      var item = document.createElement('li');
      item.className = 'lyrics__line lyrics__line--plain';
      item.textContent = line;
      pieces.appendChild(item);
    });

    list.appendChild(pieces);
    list.hidden = false;
    sizeTail();

    // Nothing here takes focus by itself, so let the words be scrolled
    // from the keyboard.
    scroller.tabIndex = 0;
    scroller.setAttribute('aria-labelledby', 'lyricsLabel lyricsTitle');
  }

  // Room under the last line, so it can still rise to the reading line.
  function sizeTail() {
    if (list.hidden) return;
    list.style.paddingBottom = Math.round(scroller.clientHeight * 0.55) + 'px';
  }

  function show(track) {
    current = track;
    stopFollowing();
    clearLines();

    numEl.textContent = track.number;
    titleEl.textContent = track.title;
    titleEl.hidden = false;
    setStatus(A.lyrics_loading || 'Finding the words…');

    var token = ++loadToken;
    findWords(track.number).then(function (result) {
      if (token !== loadToken) return;        // another track took over

      if (result.kind === 'timed') {
        setStatus('');
        renderTimed(result.entries);
        announce((A.lyrics_button || 'Lyrics') + ': ' + track.title);
        sync(true);
        startFollowing();
      } else if (result.kind === 'plain') {
        setStatus('');
        renderPlain(result.text);
        announce((A.lyrics_button || 'Lyrics') + ': ' + track.title);
      } else {
        setStatus(A.lyrics_none || 'No lyrics for this track');
        announce(A.lyrics_none || 'No lyrics for this track');
      }
    }, function () {
      if (token !== loadToken) return;
      setStatus(A.lyrics_none || 'No lyrics for this track');
    });
  }

  /* ------------------------------------------------------------------
     Keeping up with the song
     ------------------------------------------------------------------ */

  // The line being sung is the last one whose moment has come. The
  // hair's breadth of lead keeps it from lighting a frame late.
  function indexAt(seconds) {
    var low = 0;
    var high = entries.length - 1;
    var found = -1;
    while (low <= high) {
      var middle = (low + high) >> 1;
      if (entries[middle].time <= seconds + 0.03) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return found;
  }

  function setRoving(button) {
    buttons.forEach(function (other) { if (other) other.tabIndex = -1; });
    button.tabIndex = 0;
  }

  function follow(button, jump) {
    if (!button) {
      if (activeIndex < 0) scrollPanel(0, jump);
      return;
    }
    if (!jump && Date.now() - scrolledAt < HANDS_OFF) return;
    var top = button.offsetTop - scroller.clientHeight * 0.35 + button.offsetHeight / 2;
    scrollPanel(Math.max(0, top), jump);
  }

  function scrollPanel(top, jump) {
    var behavior = (jump || reduceMotion.matches) ? 'auto' : 'smooth';
    if (scroller.scrollTo) {
      scroller.scrollTo({ top: top, behavior: behavior });
    } else {
      scroller.scrollTop = top;
    }
  }

  function sync(jump) {
    if (!current || !entries.length) return;

    var index = indexAt(current.audio.currentTime);
    if (index === activeIndex && !jump) return;

    var leaving = buttons[activeIndex];
    if (leaving) {
      leaving.classList.remove('is-current');
      leaving.removeAttribute('aria-current');
    }

    activeIndex = index;

    var arriving = buttons[index];          // absent during a pause between lines
    if (arriving) {
      arriving.classList.add('is-current');
      arriving.setAttribute('aria-current', 'true');
      // Keep the way in pointed at the line being sung — unless the
      // listener is already moving through the lines themselves.
      if (!list.contains(document.activeElement)) setRoving(arriving);
    }

    if (isOpen) follow(arriving, jump);
  }

  function onFrame() {
    frameRequest = 0;
    if (!isOpen || !current || current.audio.paused) return;
    sync(false);
    frameRequest = window.requestAnimationFrame(onFrame);
  }

  // Every frame while a song plays: timeupdate arrives far too rarely to
  // land a line on the beat.
  function startFollowing() {
    if (frameRequest || !isOpen || !current || !entries.length) return;
    if (current.audio.paused) return;
    frameRequest = window.requestAnimationFrame(onFrame);
  }

  function stopFollowing() {
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
  }

  function isOnShow(audio) {
    return !!current && current.audio === audio;
  }

  function watch(track) {
    var audio = track.audio;

    audio.addEventListener('play', function () {
      if (isOnShow(audio)) startFollowing();
      else show(track);
    });

    audio.addEventListener('pause', function () {
      if (!isOnShow(audio)) return;
      stopFollowing();
      sync(false);
    });

    // Dragging the seek bar moves the song as it goes, so the words keep
    // up with the drag — and with a jump made while paused.
    ['seeking', 'seeked'].forEach(function (type) {
      audio.addEventListener(type, function () { if (isOnShow(audio)) sync(true); });
    });

    audio.addEventListener('timeupdate', function () {
      if (isOnShow(audio) && !frameRequest) sync(false);
    });
  }

  /* ------------------------------------------------------------------
     Opening, closing, and being read from a keyboard
     ------------------------------------------------------------------ */

  function remembered() {
    try {
      var saved = window.localStorage.getItem(OPEN_KEY);
      if (saved === 'open') return true;
      if (saved === 'closed') return false;
    } catch (e) { /* private browsing */ }
    return null;
  }

  function setOpen(open, remember) {
    isOpen = open;
    document.documentElement.classList.toggle('lyrics-open', open);
    tab.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (remember) {
      try {
        window.localStorage.setItem(OPEN_KEY, open ? 'open' : 'closed');
      } catch (e) { /* nothing to do */ }
    }

    if (open) {
      sizeTail();
      sync(true);
      startFollowing();
    } else {
      stopFollowing();
    }
  }

  tab.addEventListener('click', function () { setOpen(!isOpen, true); });

  panel.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    setOpen(false, true);
    tab.focus();
  });

  // Jump the song to a line.
  list.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('button.lyrics__line');
    if (!button || !current) return;
    var entry = entries[Number(button.dataset.index)];
    if (!entry) return;
    current.audio.currentTime = entry.time;
    scrolledAt = 0;                        // a deliberate jump: follow it at once
    setRoving(button);
    sync(true);
  });

  // The list is one stop on the way through the page; the arrows move
  // from line to line inside it.
  list.addEventListener('keydown', function (event) {
    var button = event.target.closest && event.target.closest('button.lyrics__line');
    if (!button) return;

    var all = Array.prototype.slice.call(list.querySelectorAll('button.lyrics__line'));
    var at = all.indexOf(button);
    var next;

    if (event.key === 'ArrowDown') next = all[at + 1];
    else if (event.key === 'ArrowUp') next = all[at - 1];
    else if (event.key === 'Home') next = all[0];
    else if (event.key === 'End') next = all[all.length - 1];
    else return;

    event.preventDefault();
    if (!next) return;
    setRoving(next);
    scrolledAt = Date.now();
    next.focus();
  });

  // Scrolling the words by hand holds the panel off for a moment.
  ['wheel', 'touchmove'].forEach(function (type) {
    scroller.addEventListener(type, function () { scrolledAt = Date.now(); }, { passive: true });
  });
  scroller.addEventListener('pointerdown', function (event) {
    if (event.target === scroller) scrolledAt = Date.now();   // the scrollbar
  });
  scroller.addEventListener('keydown', function (event) {
    if (event.target !== scroller) return;
    if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(event.key)) {
      scrolledAt = Date.now();
    }
  });

  /* ------------------------------------------------------------------
     Start up
     ------------------------------------------------------------------ */

  function start(albumTracks) {
    if (started || !albumTracks || !albumTracks.length) return;
    started = true;

    albumTracks.forEach(watch);

    tab.hidden = false;
    panel.hidden = false;

    // First visit: open where it costs nothing — beside the album on a
    // wide screen — and closed where it would sit over the page.
    var saved = remembered();
    setOpen(saved === null ? wideEnough.matches : saved, false);

    // The page runs pale at the top and dark below, so the tab flips
    // between light and dark depending on what it is over — the same
    // way the volume panel does.
    var paper = document.querySelector('#vault .section--paper');
    var ticking = false;

    function matchBackdrop() {
      if (!paper) return;
      var tabBox = tab.getBoundingClientRect();
      tab.classList.toggle(
        'lyrics-tab--on-paper',
        tabBox.top + tabBox.height / 2 < paper.getBoundingClientRect().bottom
      );
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        matchBackdrop();
        ticking = false;
      });
    }, { passive: true });

    window.addEventListener('resize', function () {
      matchBackdrop();
      sizeTail();
    });

    matchBackdrop();
  }

  if (window.TGM_ALBUM) {
    start(window.TGM_ALBUM);
  } else {
    document.addEventListener('tgm:album-ready', function (event) { start(event.detail); });
  }
})();
