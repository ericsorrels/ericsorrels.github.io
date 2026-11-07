// THE GRAY MAN — page behavior.
//
// 1. Pours the words from content.js into the page. (To edit any text
//    on the site, open content.js — never this file.)
// 2. Atmospheric motion: fog parallax on the hero, the nav drifting in
//    after the hero, and sections fading up as they enter the viewport.
//    All motion is disabled when the visitor prefers reduced motion.

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. Content injection
     ------------------------------------------------------------------ */

  var C = window.SITE_CONTENT;

  // Escapes the text, then turns *Some Words* into the styled
  // show-title treatment (uppercase, letterspaced).
  function format(text) {
    var probe = document.createElement('span');
    probe.textContent = String(text);
    return probe.innerHTML.replace(/\*([^*]+)\*/g, '<em class="show-title">$1</em>');
  }

  function lookup(path) {
    return path.split('.').reduce(function (obj, key) {
      return obj == null ? undefined : obj[key];
    }, C);
  }

  if (C) {
    // Browser tab title + search-engine description.
    if (C.meta) {
      // The album page has a tab title of its own (content.js →
      // access.browser_tab_title); the main page's is the fallback. Told
      // apart by the gate, which only the album page has. Until
      // 3 October 2026 this gave both pages the main page's title, over
      // the one written in access.html.
      var onAlbumPage = !!document.getElementById('gate');
      var tabTitle = (onAlbumPage && C.access && C.access.browser_tab_title)
        || C.meta.browser_tab_title;
      if (tabTitle) document.title = tabTitle;
      var desc = document.querySelector('meta[name="description"]');
      if (desc && C.meta.search_description) {
        desc.setAttribute('content', C.meta.search_description);
      }
    }

    // Simple one-line text slots.
    document.querySelectorAll('[data-content]').forEach(function (el) {
      var value = lookup(el.getAttribute('data-content'));
      if (value == null) return;
      el.innerHTML = format(value);

      // Opt in to the | line-break convention, the same bar that starts
      // a new line in a download button's label.
      //
      // Deliberately NOT done inside format(), which runs on every slot
      // on both pages: a video's credit uses | for a break that happens
      // only on phones, and doing it here for everyone would break that
      // line on every screen. An element has to ask.
      if (el.hasAttribute('data-content-breaks')) {
        el.innerHTML = el.innerHTML.replace(/\|/g, '<br>');
      }

      // Opt in to links:  [the words](https://the.address)  becomes
      // those words, linked. Opt-in for the same reason the breaks are
      // — format() runs on every slot on both pages, and square
      // brackets are ordinary punctuation everywhere else.
      //
      // The text has already been escaped by format(), so nothing in
      // content.js can become markup of its own; this adds the one tag.
      // Only a full http(s) address is accepted, and one with a
      // quotation mark, a space or an angle bracket in it is not an
      // address — which is also what keeps it from breaking out of the
      // attribute it is written into. Anything that doesn't match is
      // simply left on the page as it was typed.
      if (el.hasAttribute('data-content-links')) {
        el.innerHTML = el.innerHTML.replace(
          /\[([^\]\[]+)\]\((https?:\/\/[^\s)"'<>]+)\)/g,
          '<a class="prose-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );
      }

      if (el.hasAttribute('data-email')) {
        el.setAttribute('href', 'mailto:' + value);
      }
    });

    // Hero title — the artwork's alt text (what screen readers announce
    // and what search engines read) comes from the title words.
    document.querySelectorAll('[data-content-alt]').forEach(function (el) {
      var value = lookup(el.getAttribute('data-content-alt'));
      if (Array.isArray(value)) value = value.join(' ');
      if (value) el.setAttribute('alt', value);
    });

    // About — one <p> per paragraph, thin rule between them.
    var about = document.querySelector('[data-content-list="about.paragraphs"]');
    var paragraphs = C.about && C.about.paragraphs;
    if (about && Array.isArray(paragraphs)) {
      about.innerHTML = '';
      paragraphs.forEach(function (text, i) {
        if (i > 0) {
          var rule = document.createElement('div');
          rule.className = 'rule';
          rule.setAttribute('aria-hidden', 'true');
          about.appendChild(rule);
        }
        var p = document.createElement('p');
        p.innerHTML = format(text);
        about.appendChild(p);
      });
    }

    // News — one article per announcement in content.js.
    var newsBox = document.querySelector('[data-content-list="news.items"]');
    var items = C.news && C.news.items;
    if (newsBox && Array.isArray(items)) {
      newsBox.innerHTML = '';
      items.forEach(function (item) {
        var article = document.createElement('article');
        article.className = 'news-item';

        var date = document.createElement('p');
        date.className = 'news-item__date';
        date.innerHTML = format(item.date || '');

        var heading = document.createElement('h2');
        heading.className = 'news-item__title';
        heading.innerHTML = format(item.title || '');

        var prose = document.createElement('div');
        prose.className = 'section__prose';
        var body = document.createElement('p');
        body.innerHTML = format(item.text || '');
        prose.appendChild(body);

        article.appendChild(date);
        article.appendChild(heading);
        article.appendChild(prose);
        newsBox.appendChild(article);
      });
    }

    // Videos — one player per entry in content.js → music.videos, in the
    // order written there. An entry with no file is skipped.
    var videoBox = document.getElementById('musicVideos');
    var videoTemplate = document.getElementById('videoTemplate');
    var videoList = (C.music && C.music.videos) || [];
    var players = [];

    if (videoBox && videoTemplate) {
      videoList.forEach(function (video) {
        if (video && video.file) videoBox.appendChild(buildVideo(video));
      });
    }

    // The album page's two films: the welcome under the heading, and the
    // behind-the-scenes one at the foot after the bonus tracks. Each is a
    // single film rather than a list, but both go through the same
    // buildVideo() as the main page's — so the play button, the poster,
    // the caption rules and the hide-itself-on-error behaviour are one
    // piece of code rather than three that drift apart. This runs on the
    // main page too, where neither box exists and nothing happens.
    var pageFilms = [
      ['welcomeVideo', 'welcome_video'],
      ['thanksVideo', 'thanks_video']
    ];

    pageFilms.forEach(function (pair) {
      var box = document.getElementById(pair[0]);
      var film = C.access && C.access[pair[1]];
      if (!box || !videoTemplate || !film || !film.file) return;

      // buildVideo() adds the player to `players` itself — don't push it
      // again here, or it gets two copies of the listener below.
      box.appendChild(buildVideo(film));
    });

    // The Spotify player on the main page, when there is one (see
    // "Where to listen" below). Kept up here because the rules that
    // follow have to be able to quiet it. `playing` is Spotify's own
    // word for it, from the iFrame API; there is no other way to know,
    // since the player lives in a frame of Spotify's that this page
    // cannot look inside.
    var spotify = { controller: null, playing: false };

    function hushSpotify() {
      if (spotify.controller && spotify.playing) {
        try { spotify.controller.pause(); } catch (e) { /* nothing to do */ }
      }
    }

    // Nothing on a page may talk over anything else on it, and this is
    // the one place that is arranged — for the main page's list and the
    // album page's two films alike, once every player exists.
    //
    // Pausing sounding <audio> is the album half of it. access.js owns
    // those track players and is deliberately not reached into: every
    // one of them is an <audio> element on the page, so this needs to
    // know nothing about how the album works. On the main page there is
    // no <audio> now, only the films and the Spotify player.
    players.forEach(function (player) {
      player.addEventListener('play', function () {
        var sounding = document.getElementsByTagName('audio');
        for (var i = 0; i < sounding.length; i++) {
          if (!sounding[i].paused) sounding[i].pause();
        }
        players.forEach(function (other) {
          if (other !== player && !other.paused) other.pause();
        });
        hushSpotify();
      });
    });

    // And the other direction: a song starting stops any film. Until
    // 3 October 2026 this rule ran one way only, and a track pressed
    // while the welcome film was talking played straight over it.
    //
    // Caught at the document rather than on the album's element,
    // because that element does not exist yet when this runs — access.js
    // builds it when the vault opens. A media element's `play` does not
    // bubble, but a capturing listener up here still sees it, which is
    // what lets this know nothing about how or when the album is built.
    document.addEventListener('play', function (event) {
      var what = event.target;
      if (!what || what.tagName !== 'AUDIO') return;
      players.forEach(function (film) {
        if (!film.paused) film.pause();
      });
      hushSpotify();
    }, true);

    // ---- Where to listen: three buttons and a Spotify player ----------
    // Everything from content.js → music.streaming. A button appears only
    // with a link; the row only with at least one button; the player only
    // with an album link. So until the links are pasted in, nothing here
    // shows at all.
    var streaming = (C.music && C.music.streaming) || {};
    var webAddress = function (text) {
      return typeof text === 'string' && /^https?:\/\/[^\s"'<>]+$/.test(text.trim());
    };

    var streamRow = document.getElementById('streaming');
    if (streamRow) {
      var anyLink = false;
      [['spotify', 'streamSpotify'], ['apple_music', 'streamApple'], ['youtube_music', 'streamYouTube']]
        .forEach(function (pair) {
          var link = document.getElementById(pair[1]);
          var item = streaming[pair[0]];
          if (!link || !item || !item.label || !webAddress(item.url)) return;
          link.href = item.url.trim();
          link.hidden = false;
          anyLink = true;
        });
      streamRow.hidden = !anyLink;
    }

    // The album link as pasted from Spotify's Share menu — with or
    // without a country in it, with or without ?si=… on the end — or a
    // spotify:album:… address. Answers the kind and the id, or null.
    var spotifyItem = function (text) {
      var found = String(text || '').trim()
        .match(/^(?:https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?|spotify:)(album|playlist|track)[/:]([A-Za-z0-9]{10,40})/);
      return found ? { kind: found[1], id: found[2] } : null;
    };

    var embedBox = document.getElementById('spotifyEmbed');
    var slot = document.getElementById('spotifySlot');
    var album = spotifyItem(streaming.spotify_album);

    if (embedBox && slot && album) {
      embedBox.hidden = false;
      var label = streaming.spotify_player_label || '';
      var started = false;

      var named = function () {
        var frame = embedBox.querySelector('iframe');
        if (frame && label) frame.setAttribute('title', label);
        return frame;
      };

      // If Spotify's controls never arrive — a blocker, a network that
      // will not have them — the album is still shown, as Spotify's
      // plain player. It plays perfectly well; it simply cannot be told
      // to stop when something else on the page starts.
      var plain = function () {
        if (named()) return;
        var frame = document.createElement('iframe');
        frame.src = 'https://open.spotify.com/embed/' + album.kind + '/' + album.id +
          '?utm_source=generator&theme=0';
        frame.setAttribute('loading', 'lazy');
        frame.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        frame.setAttribute('title', label);
        slot.parentNode.replaceChild(frame, slot);
      };

      // Spotify's iFrame API: its own script builds the player and hands
      // back a controller that can pause it and says when it plays. That
      // is what lets the page keep it from talking over a film, in both
      // directions.
      var build = function () {
        if (started) return;
        started = true;

        var fallback = setTimeout(plain, 10000);

        window.onSpotifyIframeApiReady = function (IFrameAPI) {
          IFrameAPI.createController(slot, {
            url: 'https://open.spotify.com/' + album.kind + '/' + album.id + '?theme=0',
            width: '100%',
            height: 352
          }, function (controller) {
            clearTimeout(fallback);
            spotify.controller = controller;
            named();

            controller.addListener('playback_update', function (event) {
              var data = (event && event.data) || {};
              var playing = data.isPaused === false;
              var began = playing && !spotify.playing;
              spotify.playing = playing;
              if (!began) return;

              // Spotify has started: any film, and any <audio>, goes quiet.
              var sounding = document.getElementsByTagName('audio');
              for (var i = 0; i < sounding.length; i++) {
                if (!sounding[i].paused) sounding[i].pause();
              }
              players.forEach(function (film) {
                if (!film.paused) film.pause();
              });
            });
          });
        };

        var script = document.createElement('script');
        script.src = 'https://open.spotify.com/embed/iframe-api/v1';
        script.async = true;
        script.onerror = function () {
          clearTimeout(fallback);
          plain();
        };
        document.head.appendChild(script);
      };

      // Spotify is not asked for anything until the visitor is nearly
      // there — the same saving loading="lazy" makes on a plain frame,
      // which Spotify's own script does not offer.
      if ('IntersectionObserver' in window) {
        var nearby = new IntersectionObserver(function (entries) {
          if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
          nearby.disconnect();
          build();
        }, { rootMargin: '600px 0px' });
        nearby.observe(embedBox);
      } else {
        build();
      }
    }

    function buildVideo(video) {
      var figure = videoTemplate.content.firstElementChild.cloneNode(true);
      var player = figure.querySelector('.video__player');
      players.push(player);
      var caption = figure.querySelector('.video__caption');

      player.src = video.file;
      if (video.poster) player.setAttribute('poster', video.poster);
      figure.setAttribute('data-shape', video.shape || 'wide');

      // The caption and the credit beneath it are independent: either can
      // be left empty in content.js, and only what's written shows up.
      var captionText = figure.querySelector('.video__caption-text');
      var creditBox = figure.querySelector('.video__credit');
      var credit = video.credit || {};

      if (video.caption) {
        captionText.innerHTML = format(video.caption);
      } else {
        captionText.remove();
      }

      if (credit.text) {
        // With an address the credit becomes a link; without one it's
        // just words, so the page never shows a link leading nowhere.
        var creditEl;
        if (credit.url) {
          creditEl = document.createElement('a');
          creditEl.className = 'video__credit-link';
          creditEl.href = credit.url;
          creditEl.target = '_blank';
          creditEl.rel = 'noopener noreferrer';
        } else {
          creditEl = document.createElement('span');
        }
        // A bar in the credit marks where it splits on a phone. The space
        // goes before the break so the line still reads as one sentence
        // on wider screens, where the break is switched off in CSS.
        creditEl.innerHTML = format(credit.text)
          .replace(/\|/g, ' <br class="video__credit-break">');
        creditBox.appendChild(creditEl);
      } else {
        creditBox.remove();
      }

      // Nothing to say at all — drop the empty line and its spacing.
      if (!video.caption && !credit.text) caption.remove();

      // A missing or unplayable file leaves the section as it was
      // rather than showing an empty black box.
      player.addEventListener('error', function () {
        figure.hidden = true;
      });

      // Take the browser's control bar away until someone presses play,
      // so it doesn't sit across the bottom of the cover image — where a
      // logo or a caption tends to fall. The moment playback starts, the
      // ordinary controls come back and behave as usual.
      var playButton = figure.querySelector('.video__play');
      if (playButton) {
        if (video.play_label) playButton.setAttribute('aria-label', video.play_label);

        player.removeAttribute('controls');
        playButton.hidden = false;

        var reveal = function () {
          player.setAttribute('controls', '');
          playButton.hidden = true;
          var started = player.play();
          // Older browsers return nothing here; newer ones a promise that
          // rejects if playback is refused, in which case put the button back.
          if (started && typeof started.catch === 'function') {
            started.catch(function () {
              player.removeAttribute('controls');
              playButton.hidden = false;
            });
          }
        };

        playButton.addEventListener('click', reveal);
      }

      return figure;
    }

    // Subscribe form — the placeholder, button and destination come from
    // content.js. The form works without any of this (the address is in
    // the HTML too), so a reader is never left with a dead field.
    var sub = C.subscribe;
    var subForm = document.getElementById('subscribeForm');
    if (subForm && sub) {
      if (sub.substack_url) subForm.setAttribute('action', sub.substack_url);
      var subInput = subForm.querySelector('.subscribe__input');
      var subButton = subForm.querySelector('.subscribe__button');
      if (subInput && sub.placeholder) subInput.setAttribute('placeholder', sub.placeholder);
      if (subButton && sub.button) subButton.textContent = sub.button;
    }

    // Buy-early-access button — appears only once a shop address exists,
    // so the page never shows a link that leads nowhere.
    var cta = document.getElementById('earlyAccess');
    var early = C.music && C.music.early_access;
    if (cta && early && early.url) {
      var button = cta.querySelector('.cta__button');
      var note = cta.querySelector('.cta__note');

      button.href = early.url;
      button.textContent = early.label || 'Purchase Early Digital Access';

      if (early.note) {
        note.innerHTML = format(early.note);
      } else {
        note.remove();
      }

      // The terms line. Same rule as the note: an empty line removes it
      // rather than leaving an empty paragraph holding space open.
      var terms = cta.querySelector('.cta__terms');
      if (terms) {
        if (early.terms) terms.innerHTML = format(early.terms);
        else terms.remove();
      }

      cta.hidden = false;
    }

    // The way in, under that button, for someone who already has
    // access. Its words are ordinary slots and were poured in above;
    // all this does is the empty-string rule — no words for the link,
    // no line, rather than a question left standing with no answer.
    var haveAccess = document.getElementById('haveAccess');
    if (haveAccess) {
      var enter = haveAccess.querySelector('.cta__enter');
      if (!enter || !enter.textContent.trim()) haveAccess.hidden = true;
    }

    // The same offer on the access page's gate, for someone who arrived
    // without a password. It borrows the shop address from the button
    // above rather than holding its own, so there is only one to keep
    // current — but its words are separate, because "Purchase Early
    // Digital Access" beside a password box is answering a different
    // question from the one it answers on the main page. Hidden until
    // that address exists, by the same rule.
    var gateInvite = document.getElementById('gateInvite');
    var gateBuy = document.getElementById('gateBuy');
    if (gateInvite && gateBuy && early && early.url) {
      gateBuy.href = early.url;

      // The same terms as the main page's button, from the same line in
      // content.js — a visitor buying from the gate is buying exactly
      // the same thing, and two different answers to "can I have my
      // money back" is the last thing a shop should have.
      var gateTerms = document.getElementById('gateTerms');
      if (gateTerms) {
        if (early.terms) {
          gateTerms.innerHTML = format(early.terms);
          gateTerms.hidden = false;
        } else {
          gateTerms.remove();
        }
      }

      gateInvite.hidden = false;
    }

    // Contact — one column per block. Blank lines are left off entirely,
    // so a block with only an address doesn't leave gaps behind.
    var contactBox = document.querySelector('[data-content-list="contact.blocks"]');
    var blocks = C.contact && C.contact.blocks;
    if (contactBox && Array.isArray(blocks)) {
      contactBox.innerHTML = '';
      blocks.forEach(function (block) {
        var col = document.createElement('div');
        col.className = 'contact-block';

        if (block.heading) {
          var h = document.createElement('p');
          h.className = 'contact-block__heading';
          h.textContent = block.heading;
          col.appendChild(h);
        }

        if (block.name) {
          var n = document.createElement('p');
          n.className = 'contact-block__name';
          n.textContent = block.name;
          col.appendChild(n);
        }

        if (block.company) {
          var co = document.createElement('p');
          co.className = 'contact-block__line';
          co.textContent = block.company;
          col.appendChild(co);
        }

        if (block.email) {
          var e = document.createElement('p');
          e.className = 'contact-block__line';
          var mail = document.createElement('a');
          mail.className = 'contact-link';
          mail.href = 'mailto:' + block.email;
          mail.textContent = block.email;
          e.appendChild(mail);
          col.appendChild(e);
        }

        if (block.phone) {
          var p = document.createElement('p');
          p.className = 'contact-block__line';
          var tel = document.createElement('a');
          tel.className = 'contact-link';
          // Strip spaces and brackets so a phone can dial it directly.
          tel.href = 'tel:' + block.phone.replace(/[^\d+]/g, '');
          tel.textContent = block.phone;
          p.appendChild(tel);
          col.appendChild(p);
        }

        contactBox.appendChild(col);
      });
    }

    // Footer — one small line per entry.
    var footer = document.querySelector('[data-content-list="footer.lines"]');
    var lines = C.footer && C.footer.lines;
    if (footer && Array.isArray(lines)) {
      footer.innerHTML = '';
      lines.forEach(function (line) {
        var p = document.createElement('p');
        p.innerHTML = format(line);
        footer.appendChild(p);
      });
    }
  }

  /* ------------------------------------------------------------------
     2. Atmospheric motion
     ------------------------------------------------------------------ */

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var hero = document.querySelector('.hero');
  var fog = document.querySelector('.hero__fog');
  var nav = document.querySelector('.site-nav');

  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var offset = window.scrollY;

      // Fog parallax, only while the hero is on screen.
      if (fog && hero && !reduceMotion && offset < hero.offsetHeight) {
        fog.style.transform = 'translateY(' + offset * 0.15 + 'px)';
      }

      // Nav appears once the hero is mostly scrolled past.
      if (nav) {
        nav.classList.toggle('is-visible', offset > window.innerHeight * 0.7);
      }

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Scroll reveals.
  var reveals = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  reveals.forEach(function (el) { observer.observe(el); });
})();
