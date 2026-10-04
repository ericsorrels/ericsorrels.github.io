// THE GRAY MAN — Early Digital Access page.
//
// 1. The gate: takes an email address, asks the relay at Cloudflare to
//    post a six-digit code to it, and hands the code back. Nothing here
//    knows who is allowed in or what any code is, which is why there is
//    nothing here worth picking apart.
// 2. The vault: builds the album track players and download buttons
//    from the lists in content.js, pointing every file at the relay.
//
// The album's audio, words and downloads are not served by this site.
// They sit in private storage that only the relay can read. See
// cloudflare/vault-worker.js.

(function () {
  'use strict';

  var C = window.SITE_CONTENT || {};
  var A = C.access || {};

  /* ------------------------------------------------------------------
     The vault relay

     The password is not checked here any more, and the album's files
     are no longer part of this website at all. Both live behind a small
     program running at Cloudflare — cloudflare/vault-worker.js — which
     keeps the files in private storage and hands one over only to a
     browser carrying a valid session.

     That session is a cookie the relay sets for itself. This file never
     sees it: it is marked HttpOnly, so no script on the page can read
     it, which is the whole point. All the page can do is ask "am I
     signed in?" and be told yes or no.
     ------------------------------------------------------------------ */

  var VAULT = '/vault-api/';

  // Where a vault file lives now — "audio/01.mp3" rather than
  // "assets/audio/01.mp3", those being the folder names inside the
  // private bucket.
  function vaultUrl(path) {
    return VAULT + String(path).replace(/^\/+/, '');
  }

  // A hint, not an answer: whether this browser has signed in before.
  // It spares a returning listener the sight of the password screen
  // flashing past while the relay is being asked. The relay is still
  // what decides, so this cannot let anybody in.
  var SEEN_KEY = 'tgm_vault_seen';

  function remember(seen) {
    try {
      if (seen) window.localStorage.setItem(SEEN_KEY, '1');
      else window.localStorage.removeItem(SEEN_KEY);
    } catch (e) { /* private browsing can block storage; no matter */ }
  }

  function seenBefore() {
    try {
      return window.localStorage.getItem(SEEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  // Resolves true, false, or null — null meaning the relay could not be
  // reached at all, which is a different thing from being turned away
  // and is said differently on screen.
  function askSession() {
    return fetch(vaultUrl('session'), {
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function (reply) {
      return reply.ok;
    }).catch(function () {
      return null;
    });
  }

  // Both steps of signing in go through here. It resolves to the
  // relay's own answer — { ok: true }, or { ok: false, reason: … } — or
  // to null, which means the relay could not be reached at all and is a
  // different thing from being turned away.
  function askRelay(route, payload) {
    return fetch(vaultUrl(route), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (reply) {
      return reply.json().catch(function () {
        return { ok: reply.ok };     // an answer we can't read, but a status
      });
    }).catch(function () {
      return null;
    });
  }

  /* ------------------------------------------------------------------
     The gate.
     ------------------------------------------------------------------ */

  var gate = document.getElementById('gate');
  var vault = document.getElementById('vault');
  var error = document.getElementById('gateError');

  var stepEmail = document.getElementById('gateStepEmail');
  var stepCode = document.getElementById('gateStepCode');
  var emailForm = document.getElementById('gateEmailForm');
  var codeForm = document.getElementById('gateCodeForm');
  var emailInput = document.getElementById('gateEmail');
  var codeInput = document.getElementById('gateCode');
  var again = document.getElementById('gateAgain');
  var another = document.getElementById('gateAnother');
  var elsewhere = document.getElementById('gateElsewhere');

  // The address a code was asked for, kept only so the second step can
  // say which one it is answering for. It is never stored anywhere.
  var asking = '';

  function unlock() {
    gate.hidden = true;
    vault.hidden = false;
    document.documentElement.scrollTop = 0;
    buildVault();
  }

  /* ------------------------------------------------------------------
     The storm — the one transition, played in one place.

     unlock() above is the whole of what has to happen. Everything here
     is weather drawn over the top of it, and it is arranged so that the
     weather can fail in any way it likes — missing file, no canvas, a
     throw halfway through — without a listener who has just typed a
     correct code being left outside their album.

     That is why unlock() is wrapped in a latch rather than called from
     inside the storm: three separate things call letIn(), the first one
     to arrive does it, and the other two find it already done.

     The storm plays ONLY here. A returning visitor whose cookie is
     still good is let in by the startup block below with no weather at
     all — they did not just do anything, and a storm would be an
     announcement with nothing to announce.
     ------------------------------------------------------------------ */

  // How long the vault may go unbuilt before it is built regardless of
  // what the storm is doing. Taken from the storm's own clock where it
  // is there to be asked, so the two cannot drift; the fallback is a
  // number that is simply longer than the fade.
  function unlockBy() {
    var s = window.TGMStorm;
    return (s && typeof s.coverMs === 'number') ? s.coverMs + 500 : 1200;
  }

  function calmPreferred() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  // Nothing on the gate can be pressed again from the moment the relay
  // says yes. The code has been spent; a second submit would only spend
  // it again and be told it was wrong.
  function sealGate() {
    if (!gate) return;
    var controls = gate.querySelectorAll('button, input');
    for (var i = 0; i < controls.length; i++) controls[i].disabled = true;
  }

  // Where a keyboard and a screen reader should be standing once the
  // weather clears. Without this, focus is left on a button inside a
  // gate that is now hidden, and the next Tab starts again from the top
  // of the document.
  function landInVault() {
    var heading = vault ? vault.querySelector('.vault__heading') : null;
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    try {
      heading.focus({ preventScroll: true });
    } catch (e) {
      heading.focus();
    }
  }

  // The way in for somebody who has asked not to be moved about, and
  // the way in when there is no storm to be had. A change of opacity
  // only — reduced motion is a request to be spared movement, not a
  // request for everything to happen without transition.
  function arriveQuietly() {
    if (vault) {
      vault.classList.add('vault--arriving');
      window.setTimeout(function () {
        vault.classList.remove('vault--arriving');
      }, 400);
    }
    landInVault();
  }

  function enterVault() {
    var done = false;
    function letIn() {
      if (done) return;
      done = true;
      unlock();
    }

    sealGate();

    var storm = window.TGMStorm;
    if (calmPreferred() || !storm || !storm.supported()) {
      letIn();
      arriveQuietly();
      return;
    }

    var playing = null;
    try {
      playing = storm.play(letIn);
    } catch (e) {
      playing = null;
    }

    // The storm refused to start. No weather, then, and no waiting for
    // it either.
    if (!playing || typeof playing.then !== 'function') {
      letIn();
      arriveQuietly();
      return;
    }

    // The storm says when it has covered the gate, and letIn() is
    // called from in there. This is the promise that it will happen
    // anyway — the vault is built by now whatever the weather is doing,
    // and well before the stylesheet's own failsafe uncovers it.
    window.setTimeout(letIn, unlockBy());

    playing.then(function () {
      letIn();
      landInVault();
    }, function () {
      letIn();
      landInVault();
    });
  }

  /* ------------------------------------------------------------------
     The vault — track players and download buttons.
     ------------------------------------------------------------------ */

  var built = false;

  /* ------------------------------------------------------------------
     Volume — one slider governing every track, remembered between visits.
     ------------------------------------------------------------------ */

  var VOLUME_KEY = 'tgm_volume';

  function storedVolume() {
    try {
      var v = parseFloat(window.localStorage.getItem(VOLUME_KEY));
      return (isFinite(v) && v >= 0 && v <= 1) ? v : 1;
    } catch (e) {
      return 1;   // private browsing, or nothing saved yet
    }
  }

  function applyVolume(level) {
    players.forEach(function (audio) { audio.volume = level; });
  }

  // Can this device's volume be set from a page at all? An iPhone or
  // iPad cannot: iOS keeps the level under the physical buttons, ignores
  // any value written to `volume`, and reads it back as 1 whatever was
  // set. Asked of the element itself rather than guessed from the
  // browser's name — an iPad in Safari calls itself a Macintosh — so a
  // slider is never shown that moves and changes nothing.
  function volumeIsSettable() {
    if (!stream) return true;
    try {
      stream.volume = 0.5;
      var settable = Math.abs(stream.volume - 0.5) < 0.01;
      stream.volume = 1;
      return settable;
    } catch (e) {
      return false;
    }
  }

  function setUpVolume() {
    var panel = document.getElementById('volumePanel');
    var slider = document.getElementById('volumeSlider');
    if (!panel || !slider) return;
    if (!volumeIsSettable()) return;    // left hidden; see above

    // The slider isn't shown on phones, so there a saved setting is
    // ignored in favour of full volume — otherwise a quiet level chosen
    // on a laptop would follow the listener to a handset with nothing on
    // screen to undo it. The phone's own buttons take over instead.
    var narrow = window.matchMedia('(max-width: 620px)');

    var sync = function () {
      var level = narrow.matches ? 1 : storedVolume();
      slider.value = Math.round(level * 100);
      applyVolume(level);
    };

    sync();

    if (narrow.addEventListener) {
      narrow.addEventListener('change', sync);
    } else if (narrow.addListener) {
      narrow.addListener(sync);          // older Safari
    }

    slider.addEventListener('input', function () {
      var next = slider.value / 100;
      applyVolume(next);
      try {
        window.localStorage.setItem(VOLUME_KEY, next);
      } catch (e) { /* nothing to do */ }
    });

    panel.hidden = false;

    // The page runs pale at the top and dark below, so the panel flips
    // between light and dark depending on what it happens to be over.
    var paper = document.querySelector('#vault .section--paper');
    if (paper) {
      var ticking = false;

      // The paper section ends in a fade to ink behind the welcome film
      // (style.css, --welcome-fade), so "over paper" stops being true
      // at the middle of that fade rather than at the section's foot —
      // otherwise this would sit there as a pale panel on near-black
      // for the last of the scroll. Read each time, because the fade
      // goes away if the film does; with no fade it is 0 and this is
      // the section's own foot, as it always was. lyrics.js asks the
      // same question of the same number for the handle.
      var fadeMiddle = function () {
        var fade = parseFloat(
          window.getComputedStyle(paper).getPropertyValue('--welcome-fade'));
        return (isFinite(fade) && fade > 0) ? fade / 2 : 0;
      };

      var matchBackdrop = function () {
        var middle = window.scrollY + window.innerHeight / 2;
        var overPaper = middle < paper.offsetTop + paper.offsetHeight - fadeMiddle();
        panel.classList.toggle('volume--on-paper', overPaper);
      };

      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          matchBackdrop();
          ticking = false;
        });
      }, { passive: true });

      window.addEventListener('resize', matchBackdrop);
      matchBackdrop();
    }
  }

  function formatTime(seconds) {
    if (!isFinite(seconds)) return '–:––';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  var PLAY_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
    '<path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  var PAUSE_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
    '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';

  var players = [];

  // The same tracks, with the number and title that go with each player,
  // for anything that follows the album — the lyrics panel does.
  var album = [];
  /* ------------------------------------------------------------------
     The player — ONE continuous recording, and twenty ways into it

     The album is a single audio file. The track list is twenty
     positions inside it, measured from the recording itself.

     WHY IT IS BUILT THIS WAY, which is not obvious and cost three
     attempts to arrive at:

     The songs run straight into each other, so there must be no
     silence at a join. Twenty separate files cannot do that — at the
     end of a song the old player asked for a file that had not begun
     to arrive, and the connection, the first chunk and the decoder
     start ARE the gap.

     Scheduling the next song on the exact sample the last one ends is
     possible, through the browser's Web Audio machinery, and it
     worked. But an iPhone SUSPENDS that machinery the moment the
     screen locks, so the album stopped when Eric locked his phone.
     Gaplessness and playing behind a locked screen were the same
     machinery, and there was no way to have both.

     One continuous recording has no joins to be gapless across. It
     plays through an ordinary <audio> element, which an iPhone is
     perfectly happy to keep playing with the screen off and to show
     on the lock screen. **The gap is not solved here so much as
     abolished: there is nothing between one song and the next except
     the next sample.**

     WHAT THE REST OF THE PAGE SEES

     Each track still gets an object that behaves exactly like its own
     <audio> element — currentTime, duration, paused, ended, play(),
     pause(), addEventListener — counting from its own beginning as
     though the other nineteen songs were not in the same file. So the
     rows, the clocks, the little progress bars, the lyrics panel, the
     stage and the lock screen all work unchanged, and
     assets/js/lyrics.js has never been touched through any of this.

     The state lives in arrays here rather than inside each stand-in,
     because this has to reach ACROSS tracks — ending the one that
     just finished, pausing the one being left — and twenty closures
     would be the harder way round.
     ------------------------------------------------------------------ */

  // The one file, and where each song begins inside it. Both come from
  // content.js, and the positions are MEASURED by tools/join-album.py
  // from the finished recording rather than typed in — which is what
  // makes the list, the clocks and the words agree with the sound.
  var ALBUM_FILE = String(A.album_file || 'album.m4a').replace(/^\/+/, '');
  var STARTS = Array.isArray(A.track_starts) ? A.track_starts : [];
  var ALBUM_LENGTH = Number(A.album_length) || 0;

  var stream = null;         // the one <audio> element, and all the sound
  var activeIndex = -1;      // which song the playhead is inside
  var watching = 0;          // the animation-frame handle, while playing

  var listeners = [];        // index → { type: [fn, …] }
  var positions = [];        // index → seconds into THAT song, where it was left
  var finished = [];         // index → has it played through to its end?

  function albumUrl() {
    return vaultUrl('audio/' + ALBUM_FILE)
      + (A.audio_version ? '?v=' + encodeURIComponent(A.audio_version) : '');
  }

  function startOf(index) {
    return STARTS[index] || 0;
  }

  // One song ends where the next begins; the last ends with the album.
  function endOf(index) {
    return (index + 1 < STARTS.length) ? STARTS[index + 1] : ALBUM_LENGTH;
  }

  function lengthOf(index) {
    return Math.max(0, endOf(index) - startOf(index));
  }

  // How far into its OWN song the playhead is.
  function within(index) {
    if (!stream) return 0;
    return Math.max(0, Math.min(stream.currentTime - startOf(index), lengthOf(index)));
  }

  // Which song the playhead is inside. The hair's breadth of lead stops
  // a boundary reading as the song before it by a rounding error.
  function indexAt(seconds) {
    var found = 0;
    for (var i = 0; i < STARTS.length; i++) {
      if (STARTS[i] <= seconds + 0.0001) found = i;
      else break;
    }
    return found;
  }

  // `extra` rides on the event for anything a listener needs to know
  // beyond the type — the one use so far is `carried`, which marks a
  // `play` the album started by itself at a boundary rather than one
  // somebody pressed for. lyrics.js reads it to decide whether the
  // phone's sheet may rise again.
  function emit(index, type, extra) {
    var who = listeners[index] && listeners[index][type];
    if (!who) return;
    var shim = players[index];
    var event = { type: type, target: shim };
    if (extra) for (var key in extra) event[key] = extra[key];
    for (var i = 0; i < who.length; i++) {
      // One listener throwing must not stop the others — the row's own
      // handlers and the lyrics panel's are on the same list.
      try {
        who[i].call(shim, event);
      } catch (e) {
        if (window.console && console.error) console.error(e);
      }
    }
  }

  function emitAll(type) {
    for (var i = 0; i < players.length; i++) emit(i, type);
  }

  /* ---- Watching for the moment one song becomes the next ------------
     Nothing happens to the SOUND at a boundary — it is one unbroken
     recording and the playhead simply carries on. What happens is a
     change of label: a different row lights up, a different set of
     words arrives, a different title reaches the lock screen.

     `timeupdate` alone fires about four times a second, which would
     leave the words up to a quarter of a second behind the song. So a
     frame loop runs while the album plays, and timeupdate is kept as
     the backstop for when it cannot — a browser throttles frames in a
     tab nobody is looking at, and stops them altogether behind a
     locked screen. Which costs nothing: there is no one there to see
     a late label, and coming back puts it right. */

  function watch() {
    if (watching) return;
    watching = window.requestAnimationFrame(function again() {
      if (!stream || stream.paused) {
        watching = 0;
        return;
      }
      settle();
      watching = window.requestAnimationFrame(again);
    });
  }

  function unwatch() {
    if (watching) window.cancelAnimationFrame(watching);
    watching = 0;
  }

  // Has the playhead moved into a different song? If it has, the one
  // being left is told it ended — or that it stopped, if this was a
  // jump rather than the album simply running on — and the one
  // arriving is told it started. Which is exactly what the two rows
  // were told when they were separate players.
  function settle() {
    if (!stream) return;

    var at = indexAt(stream.currentTime);
    if (at === activeIndex) return;

    var left = activeIndex;
    // The album running on by itself, rather than somebody jumping.
    var carriedOn = (left >= 0 && at === left + 1 && !stream.paused);

    activeIndex = at;

    if (left >= 0) {
      positions[left] = carriedOn ? 0 : within(left);
      finished[left] = carriedOn;
      // `ended` only when the album ran on by itself; `pause` EITHER
      // way, because the song being left has stopped either way and
      // its row has a play button that must say so.
      //
      // This is the half that had to be put back by hand. When the
      // album was twenty elements, starting one called pause() on the
      // other nineteen, and that is what turned the last song's button
      // from a pause mark back into a play mark. There is one element
      // now, so there is nothing left to pause and nothing fires —
      // and the row that had just finished sat there showing a pause
      // mark for a song that had stopped. Eric caught it between
      // This Way and St. Elmo's Fire.
      if (carriedOn) emit(left, 'ended');
      emit(left, 'pause');
    }

    finished[at] = false;
    if (carriedOn) emit(at, 'play', { carried: true });
  }

  /* ---- Picking the recording back up --------------------------------
     The network let go part way through a song. Load it again, put the
     playhead back where it was, and carry on if it was playing.

     The same address, deliberately: no cache-buster, so whatever the
     browser already holds of the album is still good and only what is
     missing is fetched. load() winds the playhead back to zero, hence
     the position being taken before it and put back after the file's
     head has arrived. */

  var recovering = 0;

  function recover() {
    if (!stream) return;

    var where = stream.currentTime
      || (activeIndex >= 0 ? startOf(activeIndex) + (positions[activeIndex] || 0) : 0);
    var wasPlaying = !stream.paused;

    var back = function () {
      stream.removeEventListener('loadedmetadata', back);
      try {
        stream.currentTime = where;
      } catch (e) { /* the browser will land where it can */ }
      if (!wasPlaying) return;
      var going = stream.play();
      if (going && going.catch) going.catch(function () {});
    };

    stream.addEventListener('loadedmetadata', back);
    stream.load();
  }

  /* ---- The one element ---------------------------------------------- */

  function buildStream(into) {
    stream = document.createElement('audio');
    // The file's head only, which is all that is wanted until somebody
    // presses play. The browser fetches the sound as it goes from
    // there, and the vault answers for a slice of a file — so starting
    // at track 15 fetches from track 15 rather than everything before it.
    stream.preload = 'metadata';
    stream.src = albumUrl();

    // On the page on purpose. main.js stops a film talking over a song
    // by pausing any sounding <audio> it can find, and this is one —
    // so that behaviour is simply restored, with nothing in this file
    // needed to arrange it. Anything that pauses this element is
    // noticed, because the rows are painted from its own events.
    if (into) into.appendChild(stream);

    stream.addEventListener('play', function () {
      settle();
      if (activeIndex < 0) activeIndex = indexAt(stream.currentTime);
      finished[activeIndex] = false;
      emit(activeIndex, 'play');
      watch();
    });

    stream.addEventListener('pause', function () {
      unwatch();
      if (activeIndex >= 0) {
        positions[activeIndex] = within(activeIndex);
        emit(activeIndex, 'pause');
      }
    });

    stream.addEventListener('timeupdate', function () {
      settle();                        // the backstop for the frame loop
      if (activeIndex >= 0) {
        positions[activeIndex] = within(activeIndex);
        emit(activeIndex, 'timeupdate');
      }
    });

    // Dragging a row's bar moves the one playhead, so the words keep up
    // with the drag exactly as they did.
    ['seeking', 'seeked'].forEach(function (type) {
      stream.addEventListener(type, function () {
        settle();
        if (activeIndex >= 0) emit(activeIndex, type);
      });
    });

    // The end of the album — the end of the last song, since there is
    // nothing after it in the file.
    stream.addEventListener('ended', function () {
      unwatch();
      var last = STARTS.length - 1;
      activeIndex = last;
      positions[last] = 0;
      finished[last] = true;
      emit(last, 'ended');
      emit(last, 'pause');
    });

    // Every row's bar waits on this: how long each song is comes from
    // content.js, but the file has to be there before it can be moved
    // about in.
    ['loadedmetadata', 'durationchange'].forEach(function (type) {
      stream.addEventListener(type, function () { emitAll(type); });
    });

    // A failure before anything ever loaded means there is no album
    // file, and every row should say so rather than twenty rows silently
    // doing nothing. A failure part way through a song is the network
    // letting go, and is a different thing entirely.
    //
    // Until 3 October 2026 this made no distinction: a dropped
    // connection mid-song marked all twenty rows "Soon", disabled every
    // play button, and left the element in an error state — a dead
    // album until the page was reloaded, over a wobble. Told apart now
    // by whether a duration was ever known.
    stream.addEventListener('error', function () {
      var loaded = isFinite(stream.duration) && stream.duration > 0;

      if (!loaded) {
        stream.dataset.missing = 'true';
        for (var i = 0; i < players.length; i++) {
          players[i].dataset.missing = 'true';
        }
        emitAll('error');
        return;
      }

      // It had been going, so put it back rather than giving up. Capped,
      // so a file that is genuinely broken cannot put this into a loop;
      // the count is cleared by sound actually arriving.
      if (recovering >= 3) return;
      recovering++;
      recover();
    });

    // Sound is arriving again, so whatever went wrong is behind us.
    stream.addEventListener('playing', function () { recovering = 0; });

    // Coming back to the page. A browser is free to have stopped
    // telling us anything while it was out of sight, so the labels are
    // brought up to date with wherever the sound actually got to.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden || !stream) return;
      settle();
      if (activeIndex >= 0) emit(activeIndex, 'timeupdate');
      if (!stream.paused) watch();
    });
  }

  // Start a song, from wherever it was left. Everything that plays
  // anything comes through here: a row's own button, the panel's, the
  // stage's and the lock screen's.
  function startAt(index) {
    var shim = players[index];
    if (!stream || !shim || shim.dataset.missing) return;

    var from = positions[index] || 0;
    if (from >= lengthOf(index) - 0.05) from = 0;   // it had played out
    var wasPlaying = !stream.paused;

    if (activeIndex !== index) {
      var left = activeIndex;
      activeIndex = index;
      if (left >= 0) {
        // Where that one got to, so pressing it again carries on from
        // there rather than starting it over.
        positions[left] = within(left);
        finished[left] = false;
        emit(left, 'pause');
      }
    }

    finished[index] = false;
    stream.currentTime = startOf(index) + from;

    var going = stream.play();
    if (going && going.catch) going.catch(function () {});

    // Already playing, so no `play` event is coming to announce the
    // song that has just been jumped to.
    if (wasPlaying) emit(index, 'play');
  }

  /* ---- What every other file thinks is an <audio> element ----------- */

  function trackShim(index) {
    listeners[index] = {};
    positions[index] = 0;
    finished[index] = false;

    function active() {
      return !!stream && activeIndex === index;
    }

    var shim = {
      // Where access.js's own "there is no file" flag lives, which is
      // what keeps a track out of the play-through order here and in
      // the lyrics panel.
      dataset: {},

      addEventListener: function (type, handler) {
        if (typeof handler !== 'function') return;
        (listeners[index][type] = listeners[index][type] || []).push(handler);
      },

      removeEventListener: function (type, handler) {
        var who = listeners[index][type];
        if (!who) return;
        var at = who.indexOf(handler);
        if (at >= 0) who.splice(at, 1);
      },

      play: function () {
        startAt(index);
      },

      pause: function () {
        if (active() && stream && !stream.paused) stream.pause();
      }
    };

    Object.defineProperty(shim, 'paused', {
      get: function () { return !(active() && stream && !stream.paused); }
    });

    Object.defineProperty(shim, 'ended', {
      get: function () { return !!finished[index]; }
    });

    // How long THIS song is — the distance to where the next one
    // begins. Known the moment the page opens, because it is
    // arithmetic on the track list rather than something to be fetched.
    Object.defineProperty(shim, 'duration', {
      get: function () { return lengthOf(index); }
    });

    // Counting from this song's own beginning, as though the other
    // nineteen were not in the same file.
    Object.defineProperty(shim, 'currentTime', {
      get: function () {
        return active() ? within(index) : (positions[index] || 0);
      },
      set: function (seconds) {
        var to = Math.max(0, Math.min(Number(seconds) || 0, lengthOf(index)));
        positions[index] = to;
        finished[index] = false;
        if (active() && stream) {
          // The element's own seeking/seeked come back to us and are
          // passed on from there.
          stream.currentTime = startOf(index) + to;
        } else {
          emit(index, 'seeking');
          emit(index, 'seeked');
        }
      }
    });

    // One slider governs the album, so all twenty pass it through to
    // the one element.
    Object.defineProperty(shim, 'volume', {
      get: function () { return stream ? stream.volume : 1; },
      set: function (level) {
        if (stream) stream.volume = Math.min(1, Math.max(0, Number(level) || 0));
      }
    });

    // Never changed here, but the lock screen asks for it when it works
    // out where the song has got to.
    Object.defineProperty(shim, 'playbackRate', {
      get: function () { return stream ? stream.playbackRate : 1; }
    });

    return shim;
  }

  // Who sang it, for the line under the title. Deliberately the same
  // rule lyrics.js uses for the lock screen — a named singer, or
  // media_artist where a name was left blank — so a song is never
  // credited one way in the list and another way on a phone. The two
  // are separate three-line copies on purpose: lyrics.js already leans
  // on access.js for the album, and having access.js reach back into
  // lyrics.js for this would tie the two together in both directions
  // for the sake of a lookup. If you change one, change the other.
  function creditFor(title) {
    var named = A.track_artists && A.track_artists[title];
    return (named && String(named).trim()) || A.media_artist || '';
  }

  function buildTrack(title, index) {
    var row = document.createElement('div');
    row.className = 'track';

    var number = (index + 1 < 10 ? '0' : '') + (index + 1);
    // What the rest of the page works: a stand-in that behaves like an
    // <audio> element of this song's own, counting from its own
    // beginning, with the one continuous recording behind it. Every
    // listener below is attached to this.
    //
    // There is no <audio> element per row any more. There used to be
    // twenty — and before that they were the player itself. The album
    // is one file now, so one element plays it; see the note above
    // buildStream().
    var audio = trackShim(index);

    var play = document.createElement('button');
    play.className = 'track__play';
    play.type = 'button';
    play.innerHTML = PLAY_ICON;
    play.setAttribute('aria-label', 'Play ' + title);

    var num = document.createElement('span');
    num.className = 'track__num';
    num.textContent = number;

    var name = document.createElement('span');
    name.className = 'track__title';
    name.textContent = title;

    // The singer sits inside the title's own column rather than beside
    // it, so the row's fixed flex columns are left exactly as they are.
    var credit = creditFor(title);
    if (credit) {
      var who = document.createElement('span');
      who.className = 'track__credit';
      who.textContent = credit;
      name.appendChild(who);
    }

    // A real range control rather than a bare line: it can be dragged,
    // nudged with the arrow keys, and read out by a screen reader, all
    // of which a plain div could not do.
    var timeline = document.createElement('div');
    timeline.className = 'track__timeline';
    var seek = document.createElement('input');
    seek.className = 'track__seek';
    seek.type = 'range';
    seek.min = 0;
    seek.max = 1000;
    seek.step = 1;
    seek.value = 0;
    seek.disabled = true;                 // until we know how long it is
    seek.setAttribute('aria-label', 'Scrub through ' + title);
    timeline.appendChild(seek);

    // How much of the line is filled in behind the handle.
    function paint(fraction) {
      seek.style.setProperty('--played', (fraction * 100).toFixed(2) + '%');
    }
    paint(0);

    var time = document.createElement('span');
    time.className = 'track__time';
    // Known at once now, because how long a song runs is the distance
    // to where the next one starts — arithmetic on the track list
    // rather than something to be fetched. Every row shows its length
    // the moment the page opens.
    time.textContent = formatTime(audio.duration);

    row.appendChild(play);
    row.appendChild(num);
    row.appendChild(name);
    row.appendChild(timeline);
    row.appendChild(time);

    // The bar still waits on the recording itself: the length is known
    // from the list, but there has to be something there to move about in.
    audio.addEventListener('loadedmetadata', function () {
      time.textContent = formatTime(audio.duration);
      seek.disabled = false;              // now it can be dragged
    });

    // True while the handle is being dragged, so the playing position
    // doesn't yank it back out from under the listener's finger.
    var scrubbing = false;

    audio.addEventListener('timeupdate', function () {
      if (!audio.duration || scrubbing) return;
      var fraction = audio.currentTime / audio.duration;
      seek.value = Math.round(fraction * 1000);
      paint(fraction);
      time.textContent = formatTime(audio.currentTime);
    });

    // Dragging, clicking anywhere along the line, and the arrow keys all
    // arrive here.
    seek.addEventListener('input', function () {
      if (!audio.duration) return;
      var fraction = seek.value / 1000;
      paint(fraction);
      time.textContent = formatTime(fraction * audio.duration);
      audio.currentTime = fraction * audio.duration;
    });

    seek.addEventListener('pointerdown', function () { scrubbing = true; });
    seek.addEventListener('keydown', function () { scrubbing = true; });
    window.addEventListener('pointerup', function () { scrubbing = false; });
    seek.addEventListener('keyup', function () { scrubbing = false; });
    seek.addEventListener('blur', function () { scrubbing = false; });

    audio.addEventListener('play', function () {
      play.innerHTML = PAUSE_ICON;
      play.setAttribute('aria-label', 'Pause ' + title);
      row.classList.add('track--playing');
      // Nothing to pause. There is one player now, so it can only be
      // on one song at a time — two tracks sounding at once is no
      // longer a thing that can happen. The row being left behind is
      // told it stopped by startAt() in the bridge above.
    });

    audio.addEventListener('pause', function () {
      play.innerHTML = PLAY_ICON;
      play.setAttribute('aria-label', 'Play ' + title);
      row.classList.remove('track--playing');
    });

    // At the end of a song, roll straight into the next one that has
    // audio, so the album plays through like a record.
    audio.addEventListener('ended', function () {
      seek.value = 0;
      paint(0);
      time.textContent = formatTime(audio.duration);
      row.classList.remove('track--playing');
      // No roll-on here any more, and that is the point of all this.
      // Starting the next song from here is what made the gap: it
      // asked for a file that had not begun to arrive. The one player
      // now moves to the next track itself, on the sample this one
      // ends, and tells us afterwards — which is what brought us here.
    });

    // No audio file uploaded yet for this track. Flagging it here keeps
    // it out of the play-through order above.
    audio.addEventListener('error', function () {
      audio.dataset.missing = 'true';
      row.classList.add('track--unavailable');
      play.disabled = true;
      seek.disabled = true;
      time.textContent = 'Soon';
    });

    play.addEventListener('click', function () {
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    });

    players.push(audio);
    album.push({ number: number, title: title, audio: audio });
    return row;
  }

  function buildVault() {
    if (built) return;
    built = true;

    var trackList = document.getElementById('trackList');

    // The recording itself, before the rows that are windows onto it.
    if (trackList) buildStream(trackList);

    if (trackList && Array.isArray(A.tracks)) {
      A.tracks.forEach(function (title, index) {
        // Drop the bonus-tracks heading in ahead of the track it starts at.
        if (A.bonus_starts_at && index + 1 === A.bonus_starts_at) {
          var heading = document.createElement('p');
          heading.className = 'track-group';
          heading.textContent = A.bonus_label || 'Bonus Tracks';
          trackList.appendChild(heading);
        }
        trackList.appendChild(buildTrack(title, index));
      });
    }

    var downloadList = document.getElementById('downloadList');
    if (downloadList && Array.isArray(A.downloads)) {
      A.downloads.forEach(function (item) {
        var link = document.createElement('a');
        link.className = 'download-btn';
        // The version tag, the same one audio, lyrics and notes have
        // carried all along. Without it a PDF replaced under the same
        // name went on being handed out for an hour, because the vault
        // tells a browser it may keep one that long — so replacing a
        // download used to mean renaming the file as well.
        link.href = vaultUrl(item.file)
          + (A.downloads_version ? '?v=' + encodeURIComponent(A.downloads_version) : '');
        link.setAttribute('download', '');

        // A | in the label means "start a new line here".
        String(item.label).split('|').forEach(function (part, i) {
          if (i > 0) link.appendChild(document.createElement('br'));
          link.appendChild(document.createTextNode(part.trim()));
        });

        downloadList.appendChild(link);
      });
    }

    // Last, so every track already exists to be turned down.
    setUpVolume();

    // Hand the finished album to whatever follows it — the lyrics panel
    // in lyrics.js. Left on the window as well as announced, so it is
    // found whichever of the two scripts is ready first.
    window.TGM_ALBUM = album;
    document.dispatchEvent(new CustomEvent('tgm:album-ready', { detail: album }));
  }

  /* ------------------------------------------------------------------
     Start up. (Runs last, so everything above is ready before a
     remembered visitor is let straight back in.)
     ------------------------------------------------------------------ */

  // Which line to show depends on which of several things went wrong,
  // and a listener deserves to know which. A mistyped address, a wrong
  // code, an expired one, too many tries, too many requests, and a relay
  // that never answered are six different troubles.
  function showError(key) {
    if (!error) return;
    error.textContent = A[key] || '';
    error.hidden = false;
  }

  function clearError() {
    if (error) error.hidden = true;
  }

  // Which of the gate's two steps is on screen. The two quiet choices
  // under the error belong to the code step as well, though they sit
  // outside it in the markup — see the note there.
  function showStep(which) {
    if (stepEmail) stepEmail.hidden = which !== 'email';
    if (stepCode) stepCode.hidden = which !== 'code';
    if (again) again.hidden = which !== 'code';
  }

  // The relay's answers, turned into the line that goes on screen.
  // 'offline' covers both a relay that refused to answer (null) and one
  // that answered to say its own storage is unreachable.
  function lineFor(answer, fallback) {
    if (!answer) return 'gate_offline';
    if (answer.reason === 'offline') return 'gate_offline';
    if (answer.reason === 'bad-email') return 'gate_bad_email';
    if (answer.reason === 'slow-down') return 'gate_slow_down';
    if (answer.reason === 'expired') return 'gate_code_expired';
    if (answer.reason === 'locked') return 'gate_code_locked';
    return fallback;
  }

  // Both buttons say what they are doing while they do it, rather than
  // going quiet and leaving a visitor wondering whether the press
  // landed. The label is put back either way.
  function whileWorking(button, work) {
    var said = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      if (A.gate_sending) button.textContent = A.gate_sending;
    }
    return work().then(function (answer) {
      if (button) {
        button.disabled = false;
        button.textContent = said;
      }
      return answer;
    });
  }

  function requestCode(address, button) {
    clearError();
    return whileWorking(button, function () {
      return askRelay('request-code', { email: address });
    }).then(function (answer) {
      if (answer && answer.ok) {
        asking = address;
        showStep('code');
        if (codeInput) {
          codeInput.value = '';
          codeInput.focus();
        }
        return;
      }

      showError(lineFor(answer, 'gate_bad_email'));
      return;
    });
  }

  /* ------------------------------------------------------------------
     Startup. The cookie decides, not this browser's memory of anything,
     and it lasts thirty days. seenBefore() governs only whether the
     gate is shown while the question is still in the air.
     ------------------------------------------------------------------ */

  // Screen-reader labels, from content.js like every other word here.
  if (emailInput && A.gate_placeholder) {
    emailInput.setAttribute('aria-label', A.gate_placeholder);
  }
  if (codeInput && A.gate_code_placeholder) {
    codeInput.setAttribute('aria-label', A.gate_code_placeholder);
  }

  if (seenBefore() && gate) gate.hidden = true;

  askSession().then(function (signedIn) {
    if (signedIn) {
      remember(true);
      unlock();
      return;
    }

    remember(false);
    if (gate) gate.hidden = false;
    showStep('email');
    if (signedIn === null) showError('gate_offline');
    if (emailInput) emailInput.focus();
  });

  if (emailForm) {
    emailForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var typed = emailInput ? emailInput.value.trim() : '';

      // A quick look before troubling the relay, so an obvious slip is
      // answered at once. The relay checks properly; this only saves a
      // round trip on something plainly not an address.
      if (!typed || typed.indexOf('@') < 1 || /\s/.test(typed)) {
        showError('gate_bad_email');
        if (emailInput) emailInput.focus();
        return;
      }

      requestCode(typed, emailForm.querySelector('.gate__button'));
    });
  }

  if (codeInput) {
    // Everything that is not a digit is dropped as it is typed, so a
    // code pasted out of an email as "123 456" — or with a stray space
    // at the end, which is how most of them arrive — simply reads as
    // 123456. Six is as many as it will hold.
    codeInput.addEventListener('input', function () {
      var digits = codeInput.value.replace(/\D/g, '').slice(0, 6);
      if (digits !== codeInput.value) codeInput.value = digits;
    });
  }

  if (codeForm) {
    codeForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var digits = codeInput ? codeInput.value.replace(/\D/g, '') : '';
      if (!digits) {
        if (codeInput) codeInput.focus();
        return;
      }

      clearError();

      whileWorking(codeForm.querySelector('.gate__button'), function () {
        return askRelay('verify-code', { email: asking, code: digits });
      }).then(function (answer) {
        if (answer && answer.ok) {
          clearError();
          remember(true);
          enterVault();
          return;
        }

        showError(lineFor(answer, 'gate_code_wrong'));
        if (codeInput) {
          codeInput.value = '';
          codeInput.focus();
        }
      });
    });
  }

  if (another) {
    another.addEventListener('click', function () {
      if (asking) requestCode(asking, another);
    });
  }

  if (elsewhere) {
    elsewhere.addEventListener('click', function () {
      clearError();
      showStep('email');
      if (codeInput) codeInput.value = '';
      if (emailInput) {
        // Left filled in rather than emptied: whoever pressed this is
        // usually fixing a typo, not starting over.
        emailInput.value = asking;
        emailInput.focus();
        emailInput.select();
      }
    });
  }
})();
