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

  // The expanded view, and the parts of the page it borrows.
  var expandButton = document.getElementById('lyricsExpand');
  var stage = document.getElementById('lyricsStage');
  var well = document.getElementById('lyricsStageWell');
  var stageVolume = document.getElementById('lyricsStageVolume');
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

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wideEnough = window.matchMedia('(min-width: 1280px)');
  // Expanding is a desktop affair; on a phone the panel is already
  // most of the screen, and there is no room to spare for a second one.
  var roomToExpand = window.matchMedia('(min-width: 768px)');

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

  function matchBackdrop() {
    if (!paperSection) return;
    var tabBox = tab.getBoundingClientRect();
    tab.classList.toggle(
      'lyrics-tab--on-paper',
      tabBox.top + tabBox.height / 2 < paperSection.getBoundingClientRect().bottom
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

  function notesUrl(number) {
    return 'assets/notes/' + number + '.md'
      + (A.notes_version ? '?v=' + encodeURIComponent(A.notes_version) : '');
  }

  // Resolves to the file's text, or null when there is none worth showing.
  function findNotes(number) {
    if (notesCache[number] !== undefined) return Promise.resolve(notesCache[number]);

    return fetchText(notesUrl(number)).then(function (text) {
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

  // The line shown before anything has played reads differently on the
  // stage, where the track list it would otherwise send you to is behind
  // the words. Once a track has played this line is gone for good, so
  // opening and closing the stage after that leaves the status alone.
  function refreshWaiting() {
    if (!waiting) return;
    setStatus(isExpanded
      ? (A.lyrics_waiting_expanded || 'Press play to begin.')
      : (A.lyrics_waiting || 'Press play on any track and its words appear here.'));
    if (hasNotes) {
      setNotesStatus(isExpanded
        ? (A.lyrics_waiting_expanded || 'Press play to begin.')
        : (A.notes_waiting || 'Press play on any track and its notes appear here.'));
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

  function watch(track) {
    var audio = track.audio;

    audio.addEventListener('play', function () {
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

  // The album's own marks, so the stage's button is that button, larger.
  var PLAY_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  var PAUSE_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';

  var borrowed = [];       // the way back for everything carried onto the stage
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

  // With nothing playing yet, the stage's button starts the album at its
  // first track that has audio. In full screen the track list is out of
  // sight entirely, so this is the only way in.
  function firstPlayable() {
    for (var i = 0; i < album.length; i++) {
      if (!album[i].audio.dataset.missing) return album[i];
    }
    return null;
  }

  // Everything that only changes when the track does.
  function drawTransport() {
    if (!canExpand) return;

    var audio = current && current.audio;
    var playing = !!audio && !audio.paused && !audio.ended;
    var length = audio ? audio.duration : NaN;
    var opener = current ? null : firstPlayable();

    stagePlay.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    stagePlay.disabled = audio ? !!audio.dataset.missing : !opener;
    stagePlay.setAttribute('aria-label', current
      ? (playing ? 'Pause ' : 'Play ') + current.title
      : (opener ? 'Play ' + opener.title : 'Play'));

    stageSeek.disabled = !length || !isFinite(length);
    stageSeek.setAttribute('aria-label', current
      ? 'Scrub through ' + current.title
      : 'Scrub through the track');

    stageLength.textContent = clock(length);
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

  function playPause() {
    if (!current) {
      var opener = firstPlayable();
      if (opener) opener.audio.play();    // its own play event does the rest
      return;
    }
    if (current.audio.paused) current.audio.play();
    else current.audio.pause();
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

  function expand() {
    if (isExpanded || !canExpand || !roomToExpand.matches) return;
    isExpanded = true;

    borrowed = [lift(panel, well)];
    if (volumePanel) borrowed.push(lift(volumePanel, stageVolume));

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

    // If the window is pulled narrower than the stage is meant for, come
    // back down: the way out would go with the room for it.
    var onWidthChange = function () {
      if (isExpanded && !roomToExpand.matches) collapse(false);
    };
    if (roomToExpand.addEventListener) roomToExpand.addEventListener('change', onWidthChange);
    else if (roomToExpand.addListener) roomToExpand.addListener(onWidthChange);

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
     Start up
     ------------------------------------------------------------------ */

  function start(albumTracks) {
    if (started || !albumTracks || !albumTracks.length) return;
    started = true;

    album = albumTracks;
    albumTracks.forEach(watch);

    tab.hidden = false;
    panel.hidden = false;

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
      drawTransport();
    }

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
