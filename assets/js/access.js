// THE GRAY MAN — Early Digital Access page.
//
// 1. The gate: checks the visitor's password against a scrambled
//    fingerprint (SHA-256). The real password never appears in this
//    file. To change the password, ask Claude for a new fingerprint.
// 2. The vault: builds the album track players and download buttons
//    from the lists in content.js.

(function () {
  'use strict';

  var C = window.SITE_CONTENT || {};
  var A = C.access || {};

  /* ------------------------------------------------------------------
     Password fingerprint (SHA-256 of the password).
     ------------------------------------------------------------------ */
  var PASSWORD_FINGERPRINT =
    'd16adb04d252cfeee428d034dcc4d7c963c62478df37df39812ca5f4a0c34c5a';

  var STORAGE_KEY = 'tgm_early_access';

  // Preferred path: the browser's built-in crypto tools.
  function sha256Subtle(text) {
    var data = new TextEncoder().encode(text);
    return window.crypto.subtle.digest('SHA-256', data).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
        return (b < 16 ? '0' : '') + b.toString(16);
      }).join('');
    });
  }

  // Fallback for browsers/hosts without crypto.subtle.
  // Public-domain SHA-256 implementation (ASCII input).
  function sha256Fallback(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }

    var maxWord = Math.pow(2, 32);
    var result = '';
    var words = [];
    var asciiBitLength = ascii.length * 8;

    var hash = [];
    var k = [];
    var primeCounter = 0;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (var i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      var j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;

    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15];
        var w2 = w[i - 2];

        var a = hash[0];
        var e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ (~e & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0
          );
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  function fingerprint(text) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return sha256Subtle(text);
    }
    return Promise.resolve(sha256Fallback(text));
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

  function buildTrack(title, index) {
    var row = document.createElement('div');
    row.className = 'track';

    var audio = document.createElement('audio');
    var number = (index + 1 < 10 ? '0' : '') + (index + 1);
    audio.preload = 'metadata';
    // The version tag makes a replaced track count as a new address, so
    // browsers fetch it instead of replaying the copy they already hold.
    audio.src = 'assets/audio/' + number + '.mp3'
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

    var timeline = document.createElement('div');
    timeline.className = 'track__timeline';
    var bar = document.createElement('div');
    bar.className = 'track__bar';
    var progress = document.createElement('div');
    progress.className = 'track__progress';
    bar.appendChild(progress);
    timeline.appendChild(bar);

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
    });

    audio.addEventListener('timeupdate', function () {
      if (audio.duration) {
        progress.style.width = (audio.currentTime / audio.duration) * 100 + '%';
        time.textContent = formatTime(audio.currentTime);
      }
    });

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
      progress.style.width = '0%';
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
      time.textContent = 'Soon';
    });

    play.addEventListener('click', function () {
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    });

    timeline.addEventListener('click', function (event) {
      if (!audio.duration) return;
      var rect = bar.getBoundingClientRect();
      var fraction = (event.clientX - rect.left) / rect.width;
      audio.currentTime = Math.max(0, Math.min(1, fraction)) * audio.duration;
    });

    players.push(audio);
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
        link.href = item.file;
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
  }

  /* ------------------------------------------------------------------
     Start up. (Runs last, so everything above is ready before a
     remembered visitor is let straight back in.)
     ------------------------------------------------------------------ */

  var remembered = false;
  try {
    remembered = window.sessionStorage.getItem(STORAGE_KEY) === 'open';
  } catch (e) { /* private-browsing modes can block storage; ignore */ }

  if (remembered) {
    unlock();
  } else if (input) {
    input.focus();
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var attempt = input.value;
      fingerprint(attempt).then(function (hex) {
        if (hex === PASSWORD_FINGERPRINT) {
          try {
            window.sessionStorage.setItem(STORAGE_KEY, 'open');
          } catch (e) { /* ignore */ }
          error.hidden = true;
          input.value = '';
          unlock();
        } else {
          error.hidden = false;
          input.value = '';
          input.focus();
        }
      });
    });
  }
})();
