// THE GRAY MAN — the lyrics panel on the Early Digital Access page.
//
// When a track starts playing, its words are fetched from
// assets/lyrics/NN.lrc — NN being the track number — falling back to
// NN.txt, and saying so plainly when there is neither. Timed words
// (.lrc) light the line being sung, scroll themselves along with it, and
// jump the song when a line is clicked. Plain words are simply shown.
//
// The panel opens and closes with the Liner Notes tab, and that choice
// is remembered between visits, like the volume. Pressing play opens it
// too, whatever the track — that one isn't remembered, so the tab still
// has the last word on how the panel arrives next time.
//
// On a wide screen it also opens out to fill the screen. That view holds
// no words of its own: this same panel is lifted bodily into it and put
// back afterwards, so there is only ever one set of lines, one loader,
// one highlighter. The volume slider is carried in with it — in true
// full screen the browser paints nothing outside the expanded element,
// so anything the listener still needs has to travel inside it.
//
// Every word the listener reads here comes from content.js → access.
// The album itself arrives from access.js once the vault is built.

(function () {
  'use strict';

  var C = window.SITE_CONTENT || {};
  var A = C.access || {};

  var tab = document.getElementById('lyricsTab');
  // The cross at the handle's left end, drawn once below and shown by
  // the stylesheet only while the panel is open.
  var tabClose = document.getElementById('lyricsTabClose');
  var panel = document.getElementById('lyricsPanel');
  if (!tab || !panel) return;

  var numEl = document.getElementById('lyricsNum');
  var titleEl = document.getElementById('lyricsTitle');
  var scroller = document.getElementById('lyricsScroll');
  var statusEl = document.getElementById('lyricsStatus');
  var list = document.getElementById('lyricsLines');
  var announcer = document.getElementById('lyricsAnnounce');

  // The panel's other view: the same track's liner notes.
  var tabWords = document.getElementById('lyricsTabWords');
  var tabNotes = document.getElementById('lyricsTabNotes');
  var notesScroll = document.getElementById('notesScroll');
  var notesStatus = document.getElementById('notesStatus');
  var notesBody = document.getElementById('notesBody');
  var hasNotes = !!(tabWords && tabNotes && notesScroll && notesStatus && notesBody);

  // The three buttons at the top of the panel on a phone, where the
  // track list is behind the sheet and the album needs steering from
  // inside it.
  var head = document.getElementById('lyricsHead');
  var transport = document.getElementById('lyricsTransport');
  var prevButton = document.getElementById('lyricsPrev');
  var playButton = document.getElementById('lyricsPlay');
  var nextButton = document.getElementById('lyricsNext');
  var hasTransport = !!(transport && prevButton && playButton && nextButton);

  // The expanded view, and the parts of the page it borrows.
  var expandButton = document.getElementById('lyricsExpand');
  var stage = document.getElementById('lyricsStage');
  var well = document.getElementById('lyricsStageWell');
  var stageVolume = document.getElementById('lyricsStageVolume');
  // Where the phone's three buttons go while the stage is up — empty
  // on a computer, which uses the stage's own play button instead.
  var stageSteps = document.getElementById('lyricsStageSteps');
  var stagePlay = document.getElementById('lyricsStagePlay');
  var stageSeek = document.getElementById('lyricsStageSeek');
  var stageElapsed = document.getElementById('lyricsStageElapsed');
  var stageLength = document.getElementById('lyricsStageLength');
  var volumePanel = document.getElementById('volumePanel');
  var vault = document.getElementById('vault');

  // Everything the expanded view needs. Without it the panel carries on
  // exactly as it did before the stage existed.
  var canExpand = !!(stage && well && expandButton && stagePlay && stageSeek);

  var OPEN_KEY = 'tgm_lyrics';
  var VIEW_KEY = 'tgm_lyrics_view';

  // How long the panel leaves the listener alone after they scroll it
  // themselves, so it doesn't drag the words back mid-read.
  var HANDS_OFF = 4000;

  // How far down its own window the line being sung is held. Expanded,
  // it sits dead centre; in the small panel a little above, so more of
  // what is coming is in view than what has gone.
  var READING_LINE = 0.35;
  var READING_LINE_EXPANDED = 0.5;

  // What the arrow keys move the song by while expanded.
  var NUDGE = 5;

  // How far into a track Previous still means "back one" rather than
  // "start this again" — the bargain every other player makes.
  var RESTART_AFTER = 3;

  // What separates a tap from a scroll, and a drag from a tap.
  var TAP_SLOP = 10;        // px the finger may wander and still be a tap
  var TAP_TIME = 300;       // ms it may rest before it is a press instead
  var DRAG_GRIP = 8;        // px of travel before the panel takes the finger
  var DRAG_SHARE = 0.3;     // how much of the panel must go down to close it
  // Px per millisecond downward that closes it however short the travel.
  // High enough to mean a throw and nothing else: a considered drag runs
  // at around 0.2–0.8, so a lower bar here closes the panel on gestures
  // that were being aimed rather than thrown.
  var FLICK = 1.1;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wideEnough = window.matchMedia('(min-width: 1280px)');
  // Expanding is a desktop affair; on a phone the panel is already
  // most of the screen, and there is no room to spare for a second one.
  // Opening the words out used to be a computer's affair only, on the
  // reasoning that a phone's panel is already most of the screen.
  // **Eric asked for it on phones too on 3 October 2026**, and the
  // width gate is gone with it: the button is on every screen now, so
  // there is no longer a width at which the way out would disappear.
  // What the phone gets instead is its own arrangement of the
  // controls — see placeSteps().
  // The phone sheet: full width, no volume slider, no way to the track
  // list without shutting the panel. All three touch affordances below
  // — the transport, tap-to-hide and swipe-to-hide — live only here.
  var onPhone = window.matchMedia('(max-width: 620px)');

  var started = false;
  var isOpen = false;
  var isExpanded = false;
  var view = 'lyrics';     // or 'notes' — which tab is on show
  var album = [];          // every track, so the stage can start one
  var waiting = true;      // true until the first track plays
  var current = null;      // the track on show: { number, title, audio }
  var entries = [];        // its timed lines, in time order
  var buttons = [];        // entry index → the button showing it (gaps have none)
  var activeIndex = -1;
  var frameRequest = 0;
  var scrolledAt = 0;
  var loadToken = 0;
  var cache = {};          // track number → what was found for it
  var notesCache = {};     // and the same for its notes
  var wordsFor = null;     // the track each pane is currently showing,
  var notesFor = null;     // so neither is fetched or redrawn twice

  // Is the panel on screen at all, in either of its shapes?
  function isVisible() {
    return isOpen || isExpanded;
  }

  // The page runs pale at the top and dark below, so the handle flips
  // between light and dark depending on what it is over — the same way
  // the volume panel does. Set once the album is built.
  var paperSection = null;

  // The paper section ends in a fade to ink behind the welcome film
  // (style.css, --welcome-fade), so the handle changes its dress at the
  // middle of that fade, not at the section's foot. The same reading
  // access.js takes for the volume panel; 0 when there is no fade.
  function fadeMiddle() {
    var fade = parseFloat(
      window.getComputedStyle(paperSection).getPropertyValue('--welcome-fade'));
    return (isFinite(fade) && fade > 0) ? fade / 2 : 0;
  }

  function matchBackdrop() {
    if (!paperSection) return;
    var tabBox = tab.getBoundingClientRect();
    tab.classList.toggle(
      'lyrics-tab--on-paper',
      tabBox.top + tabBox.height / 2
        < paperSection.getBoundingClientRect().bottom - fadeMiddle()
    );
  }

  // Asks again once the handle should have finished travelling. The end
  // of the slide asks too, and gets there first — this is for when there
  // is no slide to end: motion turned down, a browser that skipped it,
  // an interrupted one. Asking twice costs nothing and gives the same
  // answer, so this stays honest even if the 0.8s in style.css changes.
  var backdropTimer = 0;

  function matchBackdropSoon() {
    window.clearTimeout(backdropTimer);
    backdropTimer = window.setTimeout(matchBackdrop, 850);
  }

  // And are the words the view on show? The song is only followed then —
  // with the notes up, the lines are hidden and have no height to
  // measure against.
  function isShowing() {
    return isVisible() && view === 'lyrics';
  }

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

  // The words and the notes come from the relay at Cloudflare, not from
  // this site — see the note at the top of access.js. The cookie that
  // opens them travels on its own; fetch() sends it for a same-origin
  // address, which /vault-api/ is.
  var VAULT = '/vault-api/';

  function lyricsUrl(number, extension) {
    return VAULT + 'lyrics/' + number + '.' + extension
      + (A.lyrics_version ? '?v=' + encodeURIComponent(A.lyrics_version) : '');
  }

  // Resolves to the file's text, or null when there is no such file.
  function fetchText(url) {
    // credentials and cache are spelled out rather than left to the
    // defaults: the session cookie has to ride along, and a cached copy
    // of a "you are not signed in" answer would outlive the signing in.
    return fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function (response) {
      return response.ok ? response.text() : null;
    }).catch(function () {
      return null;
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
     Reading a notes file

     A deliberately small piece of Markdown: paragraphs, headings, bold
     and italic, and a dividing line. Everything else comes out as the
     words Eric typed, which is the point — he writes these in TextEdit
     and should never have to think about what is markup and what isn't.

     Emphasis is asterisks only. Underscores are left alone on purpose,
     so a file name or an address with _underscores_ in it survives
     intact rather than turning silently into italics.
     ------------------------------------------------------------------ */

  // Every scrap of the file goes through here before any tag is added,
  // so nothing written in a note can become markup of its own.
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inlineMarkup(text) {
    return escapeHtml(text)
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  function renderMarkdown(text) {
    var out = [];
    var paragraph = [];

    // One Return moves to a new line, two start a new paragraph — which
    // is what someone typing into TextEdit expects to happen.
    function flush() {
      if (!paragraph.length) return;
      out.push('<p>' + paragraph.join('<br />') + '</p>');
      paragraph = [];
    }

    String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach(function (raw) {
      var line = raw.trim();

      if (!line) {
        flush();
        return;
      }

      if (/^-{3,}$/.test(line)) {
        flush();
        out.push('<hr />');
        return;
      }

      var heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) {
        flush();
        // The track's title is the h2 above the panel, so the notes'
        // own headings start below it at h3.
        var level = Math.min(heading[1].length + 2, 5);
        out.push('<h' + level + '>' + inlineMarkup(heading[2].trim()) + '</h' + level + '>');
        return;
      }

      paragraph.push(inlineMarkup(line));
    });

    flush();
    return out.join('');
  }

  function notesUrl(number, extension) {
    return VAULT + 'notes/' + number + '.' + extension
      + (A.notes_version ? '?v=' + encodeURIComponent(A.notes_version) : '');
  }

  // Resolves to the file's text, or null when there is none worth showing.
  //
  // .md first, then .txt — the same bargain the words above strike with
  // .lrc and .txt, and for the same reason: TextEdit saves a plain file
  // as .txt, so insisting on .md would mean renaming every note by hand
  // for ever. Either is read as Markdown, which costs a .txt nothing —
  // a note with no markup in it is simply paragraphs.
  function findNotes(number) {
    if (notesCache[number] !== undefined) return Promise.resolve(notesCache[number]);

    return fetchText(notesUrl(number, 'md')).then(function (text) {
      if (text != null && text.trim()) return text;
      return fetchText(notesUrl(number, 'txt'));
    }).then(function (text) {
      var kept = (text != null && text.trim()) ? text : null;
      notesCache[number] = kept;        // an empty file counts as none
      return kept;
    });
  }

  /* ------------------------------------------------------------------
     Putting them on screen
     ------------------------------------------------------------------ */

  function setStatus(text) {
    statusEl.textContent = text || '';
    statusEl.hidden = !text;
  }

  // The line shown before anything has played comes in three versions,
  // because it has to point at a different way in each time. In the
  // panel on a computer it sends you to the track list beside it. On the
  // stage, and on a phone, that list is behind the words — but both of
  // those carry a play button of their own, so the line names that
  // instead. Returns null when the two views should each use their own
  // wording, which is the computer case.
  function waitingLine() {
    if (isExpanded) return A.lyrics_waiting_expanded || 'Press play to begin.';
    if (onPhone.matches && hasTransport) {
      return A.lyrics_waiting_phone || 'Press play to begin the album.';
    }
    return null;
  }

  // Once a track has played this line is gone for good, so opening and
  // closing the stage after that leaves the status alone.
  function refreshWaiting() {
    if (!waiting) return;
    var shared = waitingLine();
    setStatus(shared
      || A.lyrics_waiting || 'Press play on any track and its words appear here.');
    if (hasNotes) {
      setNotesStatus(shared
        || A.notes_waiting || 'Press play on any track and its notes appear here.');
    }
  }

  function setNotesStatus(text) {
    if (!hasNotes) return;
    notesStatus.textContent = text || '';
    notesStatus.hidden = !text;
  }

  function clearNotes() {
    if (!hasNotes) return;
    notesBody.textContent = '';
    notesBody.hidden = true;
    notesScroll.scrollTop = 0;
    notesFor = null;
  }

  function announce(text) {
    if (!isVisible() || !text) return;
    announcer.textContent = '';
    window.setTimeout(function () { announcer.textContent = text; }, 60);
  }

  function clearLines() {
    list.textContent = '';
    list.hidden = true;
    list.style.paddingTop = '';
    list.style.paddingBottom = '';
    entries = [];
    buttons = [];
    activeIndex = -1;
    wordsFor = null;
    scroller.scrollTop = 0;
    scroller.removeAttribute('tabindex');
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
    // from the keyboard. (Its name comes from its own tab, in the markup.)
    scroller.tabIndex = 0;
  }

  // Room under the last line, so it can still rise to the reading line —
  // and, expanded, room over the first so it can fall back to it. The
  // small panel needs no room above: there the reading line sits high
  // enough that the opening line reaches it unaided.
  function sizeTail() {
    if (list.hidden) return;
    list.style.paddingBottom = Math.round(scroller.clientHeight * 0.55) + 'px';
    list.style.paddingTop = isExpanded
      ? Math.round(scroller.clientHeight * READING_LINE_EXPANDED) + 'px'
      : '';
  }

  function show(track) {
    current = track;
    waiting = false;        // something has played; the invitation is spent
    stopFollowing();
    clearLines();
    clearNotes();
    drawTransport();        // the album has rolled on; the stage follows

    numEl.textContent = track.number;
    titleEl.textContent = track.title;
    titleEl.hidden = false;
    nameNowPlaying(track);  // and the same title on the phone's own screen

    loadToken++;              // anything still in the air belongs to the last track
    loadView();
  }

  // Only the view on show is fetched. The other waits until it's asked
  // for, and once a pane holds the right track it is left alone — so
  // switching back and forth doesn't refetch or lose your place.
  function loadView() {
    if (!current) return;
    if (view === 'notes') {
      if (notesFor !== current.number) loadNotes(current, loadToken);
    } else if (wordsFor !== current.number) {
      loadWords(current, loadToken);
    }
  }

  function loadWords(track, token) {
    setStatus(A.lyrics_loading || 'Finding the words…');

    findWords(track.number).then(function (result) {
      if (token !== loadToken) return;        // another track took over
      wordsFor = track.number;

      // The listener may have moved to the notes while this was in the
      // air; the words still go in, but quietly.
      var onShow = view === 'lyrics';

      if (result.kind === 'timed') {
        setStatus('');
        renderTimed(result.entries);
        if (onShow) announce((A.lyrics_button || 'Lyrics') + ': ' + track.title);
        sync(true);
        startFollowing();
      } else if (result.kind === 'plain') {
        setStatus('');
        renderPlain(result.text);
        if (onShow) announce((A.lyrics_button || 'Lyrics') + ': ' + track.title);
      } else {
        setStatus(A.lyrics_none || 'No lyrics for this track');
        if (onShow) announce(A.lyrics_none || 'No lyrics for this track');
      }
    }, function () {
      if (token !== loadToken) return;
      setStatus(A.lyrics_none || 'No lyrics for this track');
    });
  }

  function loadNotes(track, token) {
    setNotesStatus(A.notes_loading || 'Finding the notes…');

    findNotes(track.number).then(function (text) {
      if (token !== loadToken) return;
      notesFor = track.number;

      var onShow = view === 'notes';
      var html = text == null ? '' : renderMarkdown(text);

      if (html) {
        setNotesStatus('');
        notesBody.innerHTML = html;       // every word of it escaped first
        notesBody.hidden = false;
        notesScroll.scrollTop = 0;
        if (onShow) announce((A.notes_button || 'Notes') + ': ' + track.title);
      } else {
        clearNotes();
        notesFor = track.number;
        setNotesStatus(A.notes_none || 'No notes for this track');
        if (onShow) announce(A.notes_none || 'No notes for this track');
      }
    }, function () {
      if (token !== loadToken) return;
      setNotesStatus(A.notes_none || 'No notes for this track');
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
    var where = isExpanded ? READING_LINE_EXPANDED : READING_LINE;
    var top = button.offsetTop - scroller.clientHeight * where + button.offsetHeight / 2;
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

    if (isShowing()) follow(arriving, jump);
  }

  function onFrame() {
    frameRequest = 0;
    if (!isShowing() || !current || current.audio.paused) return;
    sync(false);
    if (isExpanded) tickTransport();
    frameRequest = window.requestAnimationFrame(onFrame);
  }

  // Every frame while a song plays: timeupdate arrives far too rarely to
  // land a line on the beat.
  function startFollowing() {
    if (frameRequest || !isShowing() || !current || !entries.length) return;
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

  // Playing anything brings the panel up with it, on any screen and for
  // every track — including the roll-on to the next one, so the words
  // follow the album through. Deliberately not remembered: the tab is
  // still what decides how the panel arrives on the next visit, and a
  // press of play shouldn't quietly overrule a listener who shut it.
  // Skipped while the stage is up, where the panel is already on screen
  // in its largest form and `isOpen` only says what to return to.
  //
  // ONE EXCEPTION, on a phone. Down there the sheet covers half the
  // screen and the track list with it, so a listener who has shut it
  // and is halfway through the album would otherwise have it rise over
  // them again at every song. A roll-on — `carried`, which access.js
  // puts on a `play` the album started by itself — leaves a sheet shut
  // by hand where it is. A press of play on a song is still a request
  // for the words and still opens it. Eric asked for this on 3 October
  // 2026; it is for this visit only, and the next visit starts afresh.
  var shutByHand = false;

  function openForPlay(carried) {
    if (isVisible()) return;
    if (carried && shutByHand && onPhone.matches) return;
    setOpen(true, false);
  }

  function watch(track) {
    var audio = track.audio;

    audio.addEventListener('play', function (event) {
      openForPlay(!!(event && event.carried));   // before the words are
                                 // asked for, so the panel is already
                                 // travelling by then
      if (isOnShow(audio)) startFollowing();
      else show(track);          // sets current, so the redraw below lands
      drawTransport();
    });

    audio.addEventListener('pause', function () {
      if (!isOnShow(audio)) return;
      stopFollowing();
      sync(false);
      drawTransport();
    });

    // Dragging the seek bar moves the song as it goes, so the words keep
    // up with the drag — and with a jump made while paused.
    ['seeking', 'seeked'].forEach(function (type) {
      audio.addEventListener(type, function () {
        if (!isOnShow(audio)) return;
        sync(true);
        tickTransport();
        // The one moment the phone's own clock is wrong: it has been
        // counting on from where the song used to be.
        reportPosition();
      });
    });

    audio.addEventListener('timeupdate', function () {
      if (!isOnShow(audio)) return;
      if (!frameRequest) sync(false);
      tickTransport();
    });

    // How long the song runs isn't known until the file's head arrives,
    // and the stage's clock and seek bar wait on it.
    ['loadedmetadata', 'durationchange', 'ended'].forEach(function (type) {
      audio.addEventListener(type, function () { if (isOnShow(audio)) drawTransport(); });
    });

    // A track with no file yet is flagged by access.js, whose own
    // listener was attached first and so has already run. Redrawn even
    // when nothing is playing, because which track the stage would
    // start has just changed.
    audio.addEventListener('error', function () { drawTransport(); });
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

    // `remember` is true for exactly the closings a listener made
    // themselves — the handle, a tap on the page behind, a swipe down,
    // Escape — and false for the ones the page made. That is the same
    // question openForPlay() asks, so it is answered here once.
    if (remember) shutByHand = !open;

    if (remember) {
      try {
        window.localStorage.setItem(OPEN_KEY, open ? 'open' : 'closed');
      } catch (e) { /* nothing to do */ }
    }

    if (open) {
      sizeTail();
      sync(true);
      startFollowing();
    } else if (!isExpanded) {
      stopFollowing();
    }

    // The handle is about to travel the whole height of the panel, from
    // over the pale top of the page to over the dark album below or
    // back, and neither a scroll nor a resize will happen to notice.
    matchBackdropSoon();
  }

  tab.addEventListener('click', function () { setOpen(!isOpen, true); });

  /* ------------------------------------------------------------------
     The two views — the words, and the notes about them
     ------------------------------------------------------------------ */

  function setView(next, remember) {
    if (!hasNotes) return;
    view = (next === 'notes') ? 'notes' : 'lyrics';
    var onNotes = view === 'notes';

    tabWords.setAttribute('aria-selected', onNotes ? 'false' : 'true');
    tabNotes.setAttribute('aria-selected', onNotes ? 'true' : 'false');
    // One stop on the way through the panel; the arrows move inside it.
    tabWords.tabIndex = onNotes ? -1 : 0;
    tabNotes.tabIndex = onNotes ? 0 : -1;

    scroller.hidden = onNotes;
    notesScroll.hidden = !onNotes;

    // The panel — and the stage, when it's up — takes its name from
    // whichever view is being read.
    var named = (onNotes ? 'lyricsTabNotes' : 'lyricsTabWords') + ' lyricsTitle';
    panel.setAttribute('aria-labelledby', named);
    if (stage) stage.setAttribute('aria-labelledby', named);

    if (remember) {
      try {
        window.localStorage.setItem(VIEW_KEY, view);
      } catch (e) { /* private browsing */ }
    }

    loadView();

    if (onNotes) {
      stopFollowing();
    } else {
      // The lines have been sitting hidden, so they had no height to be
      // measured against until this moment.
      remeasure();
      startFollowing();
    }
  }

  if (hasNotes) {
    tabWords.addEventListener('click', function () { setView('lyrics', true); });
    tabNotes.addEventListener('click', function () { setView('notes', true); });

    [tabWords, tabNotes].forEach(function (button) {
      button.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight' || event.key === 'End') next = 'notes';
        else if (event.key === 'ArrowLeft' || event.key === 'Home') next = 'lyrics';
        else return;

        event.preventDefault();
        setView(next, true);
        (next === 'notes' ? tabNotes : tabWords).focus();
      });
    });
  }

  // Expanded, Escape belongs to the stage — it leaves full screen rather
  // than closing the panel out from under it.
  panel.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || isExpanded || !isOpen) return;
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
     The expanded view

     A screen-filling stage the panel is carried into, rather than a
     second copy of it. Loading the words, lighting the line being sung,
     jumping the song when a line is clicked — all of it is the same
     machinery in a different place, so there is nothing here to keep in
     step with anything.

     The browser's full-screen mode is asked for on top, and refused
     gracefully: strict setups and older Safaris say no, and the stage is
     meant to be worth having either way.
     ------------------------------------------------------------------ */

  // Four brackets opening outward, and the same four turned inward.
  var EXPAND_ICON =
    '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="square">' +
    '<path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>';
  var COLLAPSE_ICON =
    '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="square">' +
    '<path d="M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6"/></svg>';

  // The cross on the handle. Thinner-stroked than the expand marks and
  // smaller than the words beside it: it is telling you what pressing
  // the handle does, not competing with it.
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="square">' +
    '<path d="M5 5l14 14M19 5L5 19"/></svg>';

  // The album's own marks. Written as paths drawn at whatever size is
  // asked for, so the stage's button and the phone's are the one button
  // at two sizes rather than two sets of the same drawing.
  function mark(path, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" ' +
      'aria-hidden="true"><path d="' + path + '" fill="currentColor"/></svg>';
  }

  var PLAY_PATH = 'M8 5v14l11-7z';
  var PAUSE_PATH = 'M7 5h4v14H7zM13 5h4v14h-4z';
  // A bar with a triangle facing it: the mark every player uses, so
  // nobody has to learn what it means.
  var PREV_PATH = 'M6 5h2.2v14H6zM19 5v14L9.6 12z';
  var NEXT_PATH = 'M15.8 5H18v14h-2.2zM5 5v14l9.4-7z';

  var borrowed = [];       // the way back for everything carried onto the stage
  var stepsLifted = null;  // and the way back for the phone's three buttons
  var wasFullscreen = false;
  var scrubbing = false;   // true while the stage's handle is under a finger

  /* ---- The transport -------------------------------------------------
     It moves current.audio and nothing else, which is why the album's own
     row for that track stays in step without being told: both are working
     the one <audio> element. */

  function clock(seconds) {
    if (!isFinite(seconds)) return '–:––';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function paintSeek(fraction) {
    stageSeek.style.setProperty('--played', (fraction * 100).toFixed(2) + '%');
  }

  /* ---- Which track is next, and which was last ----------------------
     All of it reads the album's own <audio> elements and the `missing`
     flag access.js puts on the ones with no file yet, so a gap in the
     album is stepped over here exactly as it is by the roll-on at the
     end of a song. */

  function playableFrom(start, step) {
    for (var i = start; i >= 0 && i < album.length; i += step) {
      if (!album[i].audio.dataset.missing) return album[i];
    }
    return null;
  }

  // With nothing playing yet, the play button starts the album at its
  // first track that has audio. On the stage and on a phone the track
  // list is out of sight, so this is the only way in.
  function firstPlayable() {
    return playableFrom(0, 1);
  }

  function positionOf(track) {
    for (var i = 0; i < album.length; i++) {
      if (album[i] === track) return i;
    }
    return -1;
  }

  function nextPlayable() {
    var at = positionOf(current);
    return at < 0 ? null : playableFrom(at + 1, 1);
  }

  function previousPlayable() {
    var at = positionOf(current);
    return at < 0 ? null : playableFrom(at - 1, -1);
  }

  // Starting a track is the album's own business: set it to the top and
  // play it, the way access.js does when a song ends. Its play event
  // carries the panel and the words along with it.
  function startTrack(track) {
    if (!track) return;
    track.audio.currentTime = 0;
    track.audio.play();
  }

  // A few seconds in, Previous means this one again; before that it
  // steps back. At the first track there is nothing behind it, so it
  // means this one again there too.
  function goPrevious() {
    if (!current) return;
    if (current.audio.currentTime > RESTART_AFTER) {
      startTrack(current);
      return;
    }
    startTrack(previousPlayable() || current);
  }

  function goNext() {
    startTrack(nextPlayable());
  }

  // Everything that only changes when the track does.
  function drawTransport() {
    var audio = current && current.audio;
    var playing = !!audio && !audio.paused && !audio.ended;
    var length = audio ? audio.duration : NaN;
    var opener = current ? null : firstPlayable();
    var stopped = audio ? !!audio.dataset.missing : !opener;

    if (canExpand) {
      stagePlay.innerHTML = mark(playing ? PAUSE_PATH : PLAY_PATH, 16);
      stagePlay.disabled = stopped;
      stagePlay.setAttribute('aria-label', current
        ? (playing ? 'Pause ' : 'Play ') + current.title
        : (opener ? 'Play ' + opener.title : 'Play'));

      stageSeek.disabled = !length || !isFinite(length);
      stageSeek.setAttribute('aria-label', current
        ? 'Scrub through ' + current.title
        : 'Scrub through the track');

      stageLength.textContent = clock(length);
    }

    // The phone's three buttons. Painted from the same reading of the
    // same <audio> element as the stage's, which is what keeps every
    // play mark on the page saying the same thing — wherever the song
    // was actually started or stopped.
    if (hasTransport) {
      playButton.innerHTML = mark(playing ? PAUSE_PATH : PLAY_PATH, 15);
      playButton.disabled = stopped;
      playButton.setAttribute('aria-label', playing
        ? (A.panel_pause || 'Pause')
        : (A.panel_play || 'Play'));

      prevButton.innerHTML = mark(PREV_PATH, 15);
      prevButton.setAttribute('aria-label', A.panel_previous || 'Previous track');
      prevButton.disabled = !current;

      nextButton.innerHTML = mark(NEXT_PATH, 15);
      nextButton.setAttribute('aria-label', A.panel_next || 'Next track');
      // Nothing left with a file in it: the end of the album.
      nextButton.disabled = !current || !nextPlayable();
    }

    // And the transport nobody can see. Handing back null at the end of
    // the album greys the button out on the lock screen, the same way
    // the panel's own Next greys out above.
    //
    // ONLY at the end of the album. "Nothing has played yet" is a
    // different thing and must not null it — this runs once at startup
    // with `current` still null, and until 3 October 2026 that left the
    // lock screen holding `previoustrack` and nothing else. With a lone
    // skip handler iOS gives up and offers its ten-second jumps
    // instead, which is the opposite of what an album wants.
    //
    // It only began to show when the album became one long recording.
    // Twenty short elements meant iOS built its Now Playing afresh at
    // every play, by which time this had run again with a real
    // `current`; one element exists from page load, so iOS settles the
    // buttons while the startup reading is still the only one it has.
    if (hasMedia) {
      handle('nexttrack', (!current || nextPlayable()) ? goNext : null);
      reportPlayback();
    }

    tickTransport();
  }

  // And everything that changes as it plays.
  function tickTransport() {
    if (!canExpand || scrubbing) return;

    var audio = current && current.audio;
    var length = audio ? audio.duration : 0;
    var fraction = (audio && length && isFinite(length)) ? audio.currentTime / length : 0;

    stageSeek.value = Math.round(fraction * 1000);
    paintSeek(fraction);
    stageElapsed.textContent = clock(audio ? audio.currentTime : 0);
  }

  // Split in two because the page's buttons and the phone's mean
  // different things by a press. A button on the page toggles — it is
  // showing you which of the two it will do. The lock screen, a car
  // stereo and an AirPod send `play` and `pause` as separate orders,
  // and a toggle there would stop a song that a stray `play` arrived
  // for. Same work, told apart.
  function startPlaying() {
    if (!current) {
      var opener = firstPlayable();
      if (opener) opener.audio.play();    // its own play event does the rest
      return;
    }
    if (current.audio.paused) current.audio.play();
  }

  function stopPlaying() {
    if (current && !current.audio.paused) current.audio.pause();
  }

  function playPause() {
    if (current && !current.audio.paused) stopPlaying();
    else startPlaying();
  }

  function skip(seconds) {
    if (!current) return;
    var audio = current.audio;
    var next = audio.currentTime + seconds;
    if (isFinite(audio.duration)) next = Math.min(audio.duration, next);
    audio.currentTime = Math.max(0, next);
    scrolledAt = 0;                        // a deliberate move: follow it at once
    sync(true);
    tickTransport();
  }

  /* ---- The transport the listener cannot see -------------------------
     The lock screen, the Control Center, a car stereo over Bluetooth,
     the squeeze of an AirPod stem. To the browser these are one thing:
     the Media Session. To this file they are a fourth transport — the
     stage has one, the phone sheet has one, the album's own rows are
     one — and like the others they move `current.audio` and nothing
     else, and are painted from the same reading of it. Which is why
     none of the logic below is new: `goPrevious` and `goNext` are the
     panel's own buttons, three-second rule and all.

     Everything here is optional. Where there is no mediaSession, or a
     browser refuses a particular action, the page is exactly what it
     was. */

  var hasMedia = !!(window.navigator && navigator.mediaSession);

  // The sleeve at the sizes a phone asks for. One stem and a list of
  // widths: replacing the cover means new filenames for all of them —
  // the cache rule for pictures — so this changes in one place, and
  // the <img> in access.html in the other.
  var COVER_STEM = 'assets/img/album-cover';
  var COVER_SIZES = [192, 384, 512];

  function sleeveArtwork() {
    return COVER_SIZES.map(function (side) {
      return {
        src: COVER_STEM + '-' + side + '.jpg',
        sizes: side + 'x' + side,
        type: 'image/jpeg'
      };
    });
  }

  // Who to credit for this one. A song with a singer named against it
  // in content.js gets that name; everything else falls back to the
  // album's own artist.
  //
  // Keyed by title, deliberately, and not by track number. Numbers here
  // come from position in the list, so adding one song renumbers every
  // song below it — and a list of singers keyed by number would go on
  // looking right while crediting all of them to the wrong songs. A
  // title moves with its song.
  function creditFor(track) {
    var named = A.track_artists && A.track_artists[track.title];
    return (named && String(named).trim()) || A.media_artist || '';
  }

  // What the handset shows: this song, on this album, by whoever sang
  // it. The title has come from content.js all along — it is the same
  // string the album's own row is labelled with.
  function nameNowPlaying(track) {
    if (!hasMedia || !window.MediaMetadata || !track) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title,
        artist: creditFor(track),
        album: A.media_album || '',
        artwork: sleeveArtwork()
      });
    } catch (e) { /* an older take on the same idea; the rest still works */ }
  }

  // Where the song has got to. The phone runs its own clock from this
  // and a playback rate, so it wants telling when the truth changes —
  // a seek, a pause, a new track — rather than sixty times a second.
  function reportPosition() {
    if (!hasMedia || !navigator.mediaSession.setPositionState) return;
    var audio = current && current.audio;
    var length = audio ? audio.duration : 0;
    try {
      if (!audio || !isFinite(length) || length <= 0) {
        navigator.mediaSession.setPositionState();     // nothing to show yet
        return;
      }
      navigator.mediaSession.setPositionState({
        duration: length,
        playbackRate: audio.playbackRate || 1,
        // Clamped: a position past the end is the one thing this throws on.
        position: Math.min(Math.max(0, audio.currentTime), length)
      });
    } catch (e) { /* a browser that disagrees about the numbers */ }
  }

  function reportPlayback() {
    if (!hasMedia) return;
    var audio = current && current.audio;
    navigator.mediaSession.playbackState =
      !audio ? 'none' : (audio.paused ? 'paused' : 'playing');
    reportPosition();
  }

  function handle(action, handler) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) { /* this browser has never heard of that one */ }
  }

  function wireMediaSession() {
    if (!hasMedia) return;

    handle('play', startPlaying);
    handle('pause', stopPlaying);

    // The panel's own two buttons, unchanged — so the three-second
    // rule on Previous is the same rule on the lock screen as it is
    // under a thumb, because it is the same function.
    handle('previoustrack', goPrevious);
    handle('nexttrack', goNext);

    handle('seekto', function (details) {
      var audio = current && current.audio;
      if (!audio || !details || typeof details.seekTime !== 'number') return;
      var length = audio.duration;
      var to = Math.max(0, isFinite(length) ? Math.min(details.seekTime, length) : details.seekTime);
      if (details.fastSeek && audio.fastSeek) audio.fastSeek(to);
      else audio.currentTime = to;
      scrolledAt = 0;                      // a deliberate move: follow it at once
      sync(true);
      tickTransport();
      reportPosition();
    });

    // Turned down on purpose. Offer to jump ten seconds and iOS gives
    // the listener two jump buttons; decline, and it gives them the
    // skip-track buttons instead, which is what an album wants.
    handle('seekbackward', null);
    handle('seekforward', null);
  }

  /* ---- Carrying the panel on and off --------------------------------- */

  // Moves an element and hands back the way to put it exactly where it
  // was, so nothing has to remember the shape of the page.
  function lift(element, into) {
    var mark = document.createComment(' lifted onto the lyrics stage ');
    element.parentNode.insertBefore(mark, element);
    into.appendChild(element);
    return function () {
      if (mark.parentNode) mark.parentNode.replaceChild(element, mark);
    };
  }

  // Takes the page behind out of reach of the keyboard and screen
  // readers while the stage is up. Where `inert` is unknown the stage
  // simply stays tabbable-through, which is untidy rather than broken.
  function setAside(element, away) {
    if (!element || !('inert' in HTMLElement.prototype)) return;
    element.inert = away;
  }

  function setExpandButton() {
    expandButton.innerHTML = isExpanded ? COLLAPSE_ICON : EXPAND_ICON;
    var label = isExpanded
      ? (A.lyrics_collapse || 'Leave full screen')
      : (A.lyrics_expand || 'Full screen');
    expandButton.setAttribute('aria-label', label);
    expandButton.setAttribute('title', label);
    expandButton.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  }

  function fullscreenNow() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function askForFullscreen() {
    var ask = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (!ask) return;
    try {
      var answer = ask.call(stage);
      // A refusal is not a fault: the stage is already up without it.
      if (answer && answer.catch) answer.catch(function () {});
    } catch (e) { /* the same */ }
  }

  // The reading line is measured against the stage's height, which isn't
  // known until the panel has taken it — and changes again when full
  // screen arrives.
  function remeasure() {
    sizeTail();
    sync(true);
  }

  /* ---- The phone's three buttons, on the stage ----------------------
     On a phone the previous, play and next buttons are LIFTED out of
     the panel's head and set above the scrub bar at the foot of the
     stage, which is where a thumb expects them and where the bar can
     sit directly beneath them. The same borrowing the panel and the
     volume slider go through, so there is still one set of buttons on
     the page driving one <audio>, and nothing to keep in step.

     Asked again whenever the width changes, not only on opening,
     because turning a phone on its side takes it over 620px — the
     buttons would otherwise be left at the foot with the phone's
     arrangement no longer applying to them.

     The stage is marked `stage--steps` while they are down there, and
     the stylesheet keys off THAT rather than the width: the class says
     what the arrangement actually is, and cannot disagree with it. */
  function placeSteps() {
    var wanted = isExpanded && onPhone.matches && hasTransport && !!stageSteps;

    if (wanted && !stepsLifted) {
      stepsLifted = lift(transport, stageSteps);
      stage.classList.add('stage--steps');
    } else if (!wanted && stepsLifted) {
      stepsLifted();
      stepsLifted = null;
      stage.classList.remove('stage--steps');
    }
  }

  function expand() {
    if (isExpanded || !canExpand) return;
    isExpanded = true;

    borrowed = [lift(panel, well)];
    if (volumePanel) borrowed.push(lift(volumePanel, stageVolume));
    placeSteps();           // after the panel, so the buttons travel from it

    document.documentElement.classList.add('stage-open');
    setAside(vault, true);
    setAside(tab, true);
    setExpandButton();
    drawTransport();
    refreshWaiting();
    startFollowing();

    // Asked for from inside the click, where the browser will grant it.
    askForFullscreen();

    window.requestAnimationFrame(function () {
      if (!isExpanded) return;
      stage.focus();          // so Escape and the shortcuts have somewhere to land
      remeasure();
    });
  }

  function collapse(returnFocus) {
    if (!isExpanded) return;
    isExpanded = false;

    if (fullscreenNow() === stage) {
      var leave = document.exitFullscreen || document.webkitExitFullscreen;
      if (leave) {
        try {
          var answer = leave.call(document);
          if (answer && answer.catch) answer.catch(function () {});
        } catch (e) { /* nothing left to do */ }
      }
    }
    wasFullscreen = false;

    document.documentElement.classList.remove('stage-open');
    // The three buttons go home first, while the panel they belong to
    // is still on the stage — then the panel itself is carried back and
    // takes them with it.
    placeSteps();
    while (borrowed.length) borrowed.pop()();
    setAside(vault, false);
    setAside(tab, false);
    setExpandButton();
    refreshWaiting();

    remeasure();
    if (isOpen) startFollowing();
    else stopFollowing();

    // Back to the button that opened it — or to the tab, when the panel
    // it lives in is shut and nothing in it can take focus.
    if (returnFocus !== false) (isOpen ? expandButton : tab).focus();
  }

  function onFullscreenChange() {
    if (fullscreenNow() === stage) {
      wasFullscreen = true;
    } else if (isExpanded && wasFullscreen) {
      // Left full screen by Escape, by F11, or by the browser's own
      // control. Only follow it out if we were ever in — a refused
      // request fires nothing at all, and the stage survives that.
      collapse();
      return;
    } else {
      wasFullscreen = false;
    }
    if (isExpanded) window.requestAnimationFrame(remeasure);
  }

  if (canExpand) {
    expandButton.addEventListener('click', function () {
      if (isExpanded) collapse();
      else expand();
    });

    stagePlay.addEventListener('click', playPause);

    stageSeek.addEventListener('input', function () {
      var audio = current && current.audio;
      if (!audio || !audio.duration || !isFinite(audio.duration)) return;
      var fraction = stageSeek.value / 1000;
      paintSeek(fraction);
      stageElapsed.textContent = clock(fraction * audio.duration);
      audio.currentTime = fraction * audio.duration;
    });

    // The same guard the album's own rows use: the playing position must
    // not yank the handle out from under a finger mid-drag.
    stageSeek.addEventListener('pointerdown', function () { scrubbing = true; });
    stageSeek.addEventListener('keydown', function () { scrubbing = true; });
    window.addEventListener('pointerup', function () { scrubbing = false; });
    stageSeek.addEventListener('keyup', function () { scrubbing = false; });
    stageSeek.addEventListener('blur', function () { scrubbing = false; });

    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (type) {
      document.addEventListener(type, onFullscreenChange);
    });

    // Nothing to do on a change of width any more. This used to come
    // back down below 768px, because the expand button was hidden there
    // and the way out would have gone with it. The button is on every
    // screen now, so the stage can simply stay up and rearrange —
    // which is placeSteps()'s job, called from onWidth() below.

    // Escape leaves; Space stops and starts; the arrows step through the
    // song. A control already under the caret answers for itself.
    document.addEventListener('keydown', function (event) {
      if (!isExpanded) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        collapse();
        return;
      }

      var onControl = event.target && event.target.closest
        && event.target.closest('button, input, select, textarea');

      if (event.key === ' ' || event.key === 'Spacebar') {
        if (onControl) return;
        event.preventDefault();
        playPause();          // with nothing playing, this starts the album
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (!current) return;
        // A slider, or the view tabs, answer for themselves.
        if (onControl && (onControl.tagName === 'INPUT'
            || onControl.getAttribute('role') === 'tab')) return;
        event.preventDefault();
        skip(event.key === 'ArrowRight' ? NUDGE : -NUDGE);
      }
    });
  }

  /* ------------------------------------------------------------------
     The phone sheet

     Down here the panel covers the track list, so it has to carry its
     own way of steering the album and its own ways of getting out of
     the way: a tap on the page behind it, or a swipe down its top edge.

     None of this is fenced off from the rest of the page. There is no
     backdrop over the album — the list stays scrollable underneath, and
     every listener on the page is passive so it keeps scrolling at full
     speed. What decides whether a touch belongs to the panel is where
     it started and how it moved, nothing more.
     ------------------------------------------------------------------ */

  // Is the phone sheet the shape the panel is in just now?
  function onSheet() {
    return onPhone.matches && isOpen && !isExpanded;
  }

  if (hasTransport) {
    prevButton.addEventListener('click', goPrevious);
    nextButton.addEventListener('click', goNext);
    // The same function the stage's button uses: with nothing playing
    // yet it starts the album at its first track that has audio.
    playButton.addEventListener('click', playPause);
  }

  /* ---- A tap on the page behind puts the panel away ------------------
     Not a click listener: on a phone a click arrives after a scroll's
     momentum has settled, and a flick down the album would have shut
     the panel. A touch is watched from the start so a scroll can be
     told from a tap by how far the finger went and how long it took. */

  var tapFrom = null;

  // Anything that does its own job when touched. A tap that lands on
  // one of these belongs to it, and the panel stays where it is.
  var INTERACTIVE = 'a, button, input, select, textarea, label, summary,' +
    ' [role="button"], [role="tab"], [tabindex]';

  function forgetTap() {
    tapFrom = null;
  }

  document.addEventListener('touchstart', function (event) {
    tapFrom = null;
    if (!onSheet() || event.touches.length !== 1) return;

    var target = event.target;
    // The panel and its handle answer for themselves — the swipe below
    // is the panel's own gesture, and the handle is the toggle.
    if (!target || !target.closest) return;
    if (panel.contains(target) || tab.contains(target)) return;
    if (target.closest(INTERACTIVE)) return;

    var touch = event.touches[0];
    tapFrom = { x: touch.clientX, y: touch.clientY, at: Date.now() };
  }, { passive: true });

  // A finger that travels is scrolling the album, whatever it does next.
  document.addEventListener('touchmove', function (event) {
    if (!tapFrom) return;
    var touch = event.touches[0];
    if (!touch) return;
    if (Math.abs(touch.clientX - tapFrom.x) > TAP_SLOP
        || Math.abs(touch.clientY - tapFrom.y) > TAP_SLOP) {
      forgetTap();
    }
  }, { passive: true });

  document.addEventListener('touchcancel', forgetTap, { passive: true });

  document.addEventListener('touchend', function (event) {
    var from = tapFrom;
    tapFrom = null;
    if (!from || !onSheet()) return;

    var touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    if (Date.now() - from.at > TAP_TIME) return;          // a rest, not a tap
    if (Math.abs(touch.clientX - from.x) > TAP_SLOP) return;
    if (Math.abs(touch.clientY - from.y) > TAP_SLOP) return;

    // The same door the handle uses, remembered the same way.
    setOpen(false, true);
  }, { passive: true });

  /* ---- A swipe down the top edge puts it away too --------------------
     The panel follows the finger by way of one custom property that the
     open rules for both the sheet and its handle add to their own
     transforms — so the handle rides the edge down without this code
     having to know anything about where either of them sits. */

  var drag = null;
  var swallowClick = false;

  function setDrag(pixels) {
    document.documentElement.style.setProperty('--lyrics-drag', pixels + 'px');
  }

  function endDrag(settle) {
    document.documentElement.classList.remove('lyrics-dragging');
    if (settle) document.documentElement.classList.add('lyrics-settling');
    setDrag(0);
    drag = null;
  }

  // Downward pixels per millisecond between two samples of the finger.
  // Zero when there is nothing to compare against, so the caller can
  // fall back to an earlier pair.
  function rateBetween(fromY, fromAt, toY, toAt) {
    if (fromY == null || fromAt == null) return 0;
    var ms = toAt - fromAt;
    if (ms <= 0) return 0;
    return (toY - fromY) / ms;
  }

  // A finger that dragged must not also count as a press on whatever it
  // set off from. Cleared on its own in case no click follows at all.
  function armClickSwallow() {
    swallowClick = true;
    window.setTimeout(function () { swallowClick = false; }, 400);
  }

  // Everything that can be taken hold of to pull the sheet down. Open,
  // the handle sits on the panel's top edge and the head is the rest of
  // that same edge, so the two are one bar to a thumb and answer a
  // finger the same way. Shut, the handle is the only one of them on
  // screen and `onSheet()` keeps it inert — a tap is still what opens.
  function grip(handle) {
    if (!handle) return;

    handle.addEventListener('touchstart', function (event) {
      drag = null;
      if (!onSheet() || event.touches.length !== 1) return;
      var touch = event.touches[0];
      drag = {
        x: touch.clientX,
        y: touch.clientY,
        lastY: touch.clientY,
        lastAt: Date.now(),
        prevY: null,        // the sample before that, for reading a flick
        prevAt: null,
        moved: false
      };
    }, { passive: true });

    // Not passive: once this is a downward drag the page must be stopped
    // from scrolling underneath it.
    handle.addEventListener('touchmove', function (event) {
      if (!drag) return;
      var touch = event.touches[0];
      if (!touch) return;

      var down = touch.clientY - drag.y;
      var across = touch.clientX - drag.x;

      if (!drag.moved) {
        // Sideways or upward is not this gesture. Letting go of it here
        // rather than fighting for it is what leaves a tap on a tab, and
        // a scroll of the page, working exactly as they did.
        if (Math.abs(across) > Math.abs(down)) { drag = null; return; }
        if (down < DRAG_GRIP) return;
        drag.moved = true;
        document.documentElement.classList.remove('lyrics-settling');
        document.documentElement.classList.add('lyrics-dragging');
      }

      event.preventDefault();
      setDrag(Math.max(0, down));
      drag.prevY = drag.lastY;
      drag.prevAt = drag.lastAt;
      drag.lastY = touch.clientY;
      drag.lastAt = Date.now();
    }, { passive: false });

    handle.addEventListener('touchend', function (event) {
      var held = drag;
      drag = null;
      if (!held || !held.moved) return;

      armClickSwallow();

      var touch = event.changedTouches && event.changedTouches[0];
      var endY = touch ? touch.clientY : held.lastY;
      var down = Math.max(0, endY - held.y);

      // How fast it was still travelling when it let go. Read from the
      // lift itself where the finger moved between its last touchmove
      // and leaving the glass — and from the two moves before that
      // where it did not, which is the usual way a flick ends. Without
      // the second reading a fast, short flick measures as standing
      // still and the panel would stay up.
      var speed = rateBetween(held.lastY, held.lastAt, endY, Date.now())
        || rateBetween(held.prevY, held.prevAt, held.lastY, held.lastAt);

      var far = down > panel.offsetHeight * DRAG_SHARE;
      if (far || speed > FLICK) {
        endDrag(false);         // the closing slide is the panel's own
        setOpen(false, true);
      } else {
        endDrag(true);          // and this one eases it back up
      }
    }, { passive: true });

    handle.addEventListener('touchcancel', function () {
      if (drag && drag.moved) endDrag(true);
      drag = null;
    }, { passive: true });
  }

  grip(head);
  grip(tab);

  // Caught at the document, on the way down, rather than on the two
  // handles themselves. At the element a touch landed on, a capturing
  // listener holds no priority — every listener there runs in the order
  // it was added, and the handle's own open-and-close was added long
  // before this. From up here the press is stopped before it reaches
  // either of them.
  document.addEventListener('click', function (event) {
    if (!swallowClick) return;
    var where = event.target;
    if (!where || !where.closest) return;
    if (!(head && head.contains(where)) && !tab.contains(where)) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  // The settle is a one-off: taken off again so it never shortens the
  // ordinary open and close.
  panel.addEventListener('transitionend', function (event) {
    if (event.propertyName === 'transform') {
      document.documentElement.classList.remove('lyrics-settling');
    }
  });

  // Crossing into or out of the phone's width changes which way in the
  // waiting line should point, and whether the three buttons are there
  // to be drawn at all. A drag caught mid-air by a turn of the handset
  // is simply dropped.
  function onWidth() {
    if (drag) { endDrag(false); }
    // Turning a handset on its side takes it over 620px, so where the
    // three buttons belong can change while the stage is still up.
    if (canExpand) placeSteps();
    refreshWaiting();
    drawTransport();
  }

  if (onPhone.addEventListener) onPhone.addEventListener('change', onWidth);
  else if (onPhone.addListener) onPhone.addListener(onWidth);

  /* ------------------------------------------------------------------
     Start up
     ------------------------------------------------------------------ */

  function start(albumTracks) {
    if (started || !albumTracks || !albumTracks.length) return;
    started = true;

    album = albumTracks;
    albumTracks.forEach(watch);

    tab.hidden = false;
    panel.hidden = false;

    // The cross on the handle. Drawn once; the stylesheet decides when
    // it is seen, which is only while the panel is open.
    if (tabClose) tabClose.innerHTML = CLOSE_ICON;

    // Whichever view was last read. The words are the default, and what
    // a first-time visitor gets.
    if (hasNotes) {
      var savedView = null;
      try {
        savedView = window.localStorage.getItem(VIEW_KEY);
      } catch (e) { /* private browsing */ }
      setView(savedView === 'notes' ? 'notes' : 'lyrics', false);
    }

    if (canExpand) {
      stage.hidden = false;
      setExpandButton();
    }

    // A singer listed against a title that is not on the album is a
    // typo, and would otherwise do nothing at all — the song would just
    // go on being credited to the album's artist, with no sign anything
    // was wrong. Said once, to the console, where no visitor will meet
    // it but anyone looking for the fault will.
    if (A.track_artists && window.console && console.warn) {
      var sung = albumTracks.map(function (t) { return t.title; });
      Object.keys(A.track_artists).forEach(function (title) {
        if (sung.indexOf(title) < 0) {
          console.warn('content.js: track_artists lists "' + title
            + '", which is not a song on this album. Check the spelling '
            + 'against the tracks list.');
        }
      });
    }

    // The handset's own controls answer for the album from here on,
    // whether or not anything on the page is on screen.
    wireMediaSession();

    // Both transports at once: the stage's, and the phone's three
    // buttons, which have to be drawn before the panel is ever opened.
    drawTransport();

    // And which way in the waiting line points, now the width is known.
    refreshWaiting();

    // First visit: open where it costs nothing — beside the album on a
    // wide screen — and closed where it would sit over the page.
    var saved = remembered();
    setOpen(saved === null ? wideEnough.matches : saved, false);

    paperSection = document.querySelector('#vault .section--paper');
    var ticking = false;

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
      remeasure();          // the reading line is a share of the height
      // Asked here as well as on the media query's own change event.
      // The two agree, and the query is the more precise of them — but
      // it is one event at one moment, and a reload landing in the
      // middle of a resize can leave the page on the wrong side of it.
      // A resize always follows, and asking twice costs a redraw.
      onWidth();
    });

    // Asked at the end of the slide rather than the start of it: until
    // then the handle is still in transit and would answer for where it
    // set off from. See setOpen for the other half of this.
    tab.addEventListener('transitionend', function (event) {
      if (event.propertyName === 'transform') matchBackdrop();
    });

    matchBackdrop();
  }

  if (window.TGM_ALBUM) {
    start(window.TGM_ALBUM);
  } else {
    document.addEventListener('tgm:album-ready', function (event) { start(event.detail); });
  }
})();
