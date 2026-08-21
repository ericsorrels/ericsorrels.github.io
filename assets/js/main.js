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
      if (C.meta.browser_tab_title) document.title = C.meta.browser_tab_title;
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

    // Teaser video — only appears once a file is named in content.js.
    var figure = document.getElementById('musicVideo');
    var video = C.music && C.music.video;
    if (figure && video && video.file) {
      var player = figure.querySelector('.video__player');
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
        creditEl.innerHTML = format(credit.text);
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
      // so it doesn't sit across the bottom of the cover image — which is
      // where the logo falls. The moment playback starts, the ordinary
      // controls come back and behave as usual.
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

      figure.hidden = false;
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

      cta.hidden = false;
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
