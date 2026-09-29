// THE GRAY MAN — Early Digital Access page.
//
// 1. The gate: hands the password to the relay at Cloudflare and lets
//    it decide. Nothing here can tell a right password from a wrong
//    one, which is why there is nothing here worth picking apart.
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

  function sendPassword(password) {
    return fetch(vaultUrl('login'), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function (reply) {
      return reply.ok;
    }).catch(function () {
      return null;
    });
  }

  /* ------------------------------------------------------------------
     The gate.
     ------------------------------------------------------------------ */

  var gate = document.getElementById('gate');
  var vault = document.getElementById('vault');
  var form = document.getElementById('gateForm');
  var input = document.getElementById('gateInput');
  var error = document.getElementById('gateError');

  function unlock() {
    gate.hidden = true;
    vault.hidden = false;
    document.documentElement.scrollTop = 0;
    buildVault();
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

  function setUpVolume() {
    var panel = document.getElementById('volumePanel');
    var slider = document.getElementById('volumeSlider');
    if (!panel || !slider) return;

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

      var matchBackdrop = function () {
        var middle = window.scrollY + window.innerHeight / 2;
        var overPaper = middle < paper.offsetTop + paper.offsetHeight;
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

    var audio = document.createElement('audio');
    var number = (index + 1 < 10 ? '0' : '') + (index + 1);
    audio.preload = 'metadata';
    // The version tag makes a replaced track count as a new address, so
    // browsers fetch it instead of replaying the copy they already hold.
    audio.src = vaultUrl('audio/' + number + '.mp3')
      + (A.audio_version ? '?v=' + encodeURIComponent(A.audio_version) : '');

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
    time.textContent = '–:––';

    row.appendChild(play);
    row.appendChild(num);
    row.appendChild(name);
    row.appendChild(timeline);
    row.appendChild(time);
    row.appendChild(audio);

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
      players.forEach(function (other) {
        if (other !== audio && !other.paused) other.pause();
      });
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

      for (var i = index + 1; i < players.length; i++) {
        if (!players[i].dataset.missing) {
          players[i].currentTime = 0;
          players[i].play();
          return;
        }
      }
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
        link.href = vaultUrl(item.file);
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

  // The gate's own line, or the one for a relay that didn't answer.
  // Those are different troubles and a listener deserves to know which.
  function showError(key) {
    if (!error) return;
    var line = A[key];
    if (line) error.textContent = line;
    error.hidden = false;
  }

  // The cookie decides, not this browser's memory of anything, and it
  // lasts thirty days. seenBefore() governs only whether the password
  // screen is shown while the question is still in the air.
  if (seenBefore() && gate) gate.hidden = true;

  askSession().then(function (signedIn) {
    if (signedIn) {
      remember(true);
      unlock();
      return;
    }

    remember(false);
    if (gate) gate.hidden = false;
    if (signedIn === null) showError('gate_offline');
    if (input) input.focus();
  });

  if (form) {
    var busy = false;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (busy) return;

      var attempt = input ? input.value : '';
      if (!attempt) return;

      busy = true;
      sendPassword(attempt).then(function (ok) {
        busy = false;
        if (input) input.value = '';

        if (ok) {
          if (error) error.hidden = true;
          remember(true);
          unlock();
          return;
        }

        showError(ok === null ? 'gate_offline' : 'gate_error');
        if (input) input.focus();
      });
    });
  }
})();
