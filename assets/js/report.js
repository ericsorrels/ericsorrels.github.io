// THE GRAY MAN — Report a Sighting.
//
// The listeners' feedback form at the foot of the album page, and the
// notice near the top that points down to it. Every word comes from
// content.js → access.report; the song list comes from access.tracks.
//
// It posts to the vault at /vault-api/report, which takes the listener's
// address from their signed-in session. The page never asks for it and
// never sends it.
//
// One report per person: filing again replaces the earlier one. When
// the vault opens, somebody who has already filed sees that it is on
// file, with a way to revise it.
//
// It touches nothing of the album's. It waits for the vault to be shown
// (access.js takes the `hidden` off it) before asking about anything.

(function () {
  'use strict';

  var C = window.SITE_CONTENT || {};
  var A = C.access || {};
  var R = A.report;
  var box = document.getElementById('report');
  var notice = document.getElementById('reportNotice');
  var vault = document.getElementById('vault');
  if (!R || !box || !vault) return;

  var ENDPOINT = '/vault-api/report';

  // The longest each box of words may be. KEEP IN STEP with REPORT_TEXT
  // in cloudflare/vault-worker.js, which refuses anything longer.
  var CAPS = {
    song: 120,
    heard_other: 80,
    sentence: 280,
    moment: 500,
    line: 280,
    send_to: 280,
    love: 120,
    where: 200,
    change: 1000,
    work_title: 120,
    full_name: 80,
    first_name: 40,
    last_initial: 2,
    city: 60,
    state: 40
  };

  // The order the choices appear in. The words are in content.js; these
  // codes are what the vault checks against.
  var CHARACTERS = ['charli', 'theo', 'gray_man', 'someone_else'];
  var STORMS = ['1822', '1979', '1989', '2004', '2022'];
  var HEARD = ['kickstarter', 'instagram', 'tiktok', 'friend', 'colleague', 'pawleys', 'other'];
  var CREDITS = ['full', 'initial', 'anonymous'];
  var TICKS = ['tickets', 'kickstarter', 'may_quote', 'video'];

  // Escapes the words, then turns *Some Words* into the show-title
  // treatment — the same rule main.js applies to every slot.
  function format(text) {
    var probe = document.createElement('span');
    probe.textContent = String(text == null ? '' : text);
    return probe.innerHTML.replace(/\*([^*]+)\*/g, '<em class="show-title">$1</em>');
  }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  var serial = 0;
  function uid(name) {
    serial += 1;
    return 'sighting-' + name + '-' + serial;
  }

  /* ------------------------------------------------------------------
     Building the form.
     ------------------------------------------------------------------ */

  var fields = {};   // name → the element (or radio group) holding it

  function tag(words) {
    return words ? ' <span class="sighting__tag">' + format(words) + '</span>' : '';
  }

  // A box of words, one line or several.
  function words(name, question, opts) {
    opts = opts || {};
    var wrap = el('div', 'sighting__q' + (opts.extraClass ? ' ' + opts.extraClass : ''));
    var id = uid(name);
    var label = el('label', 'sighting__ask', format(question) + tag(opts.required ? R.required : ''));
    label.setAttribute('for', id);
    var input = el(opts.long ? 'textarea' : 'input', 'sighting__input' + (opts.long ? ' sighting__input--long' : ''));
    input.id = id;
    input.name = name;
    if (!opts.long) input.type = 'text';
    input.maxLength = CAPS[name];
    if (opts.long) input.rows = opts.rows || 3;
    if (opts.required) input.setAttribute('aria-required', 'true');
    if (opts.autocomplete) input.setAttribute('autocomplete', opts.autocomplete);
    else input.setAttribute('autocomplete', 'off');
    wrap.appendChild(label);
    wrap.appendChild(input);
    fields[name] = input;
    return wrap;
  }

  // A row of choices to tap. Pressing the chosen one again un-chooses
  // it, since every one of these is optional.
  function chips(name, question, codes, labels, opts) {
    opts = opts || {};
    var set = el('fieldset', 'sighting__q sighting__chips' + (opts.stack ? ' sighting__chips--stack' : ''));
    set.appendChild(el('legend', 'sighting__ask', format(question)));
    var row = el('div', 'sighting__chip-row');
    var radios = [];
    codes.forEach(function (code) {
      var label = el('label', 'sighting__chip');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = name;
      radio.value = code;
      label.appendChild(radio);
      label.appendChild(el('span', '', format((labels || {})[code] || code)));
      row.appendChild(label);
      radios.push(radio);
    });
    set.appendChild(row);

    var was = '';
    row.addEventListener('click', function (event) {
      var radio = event.target;
      if (!radio || radio.name !== name) return;
      if (opts.required) {
        was = radio.value;
        return;
      }
      if (radio.value === was) {
        radio.checked = false;
        was = '';
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        was = radio.value;
      }
    });

    fields[name] = {
      radios: radios,
      get: function () {
        for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value;
        return '';
      },
      set: function (value) {
        radios.forEach(function (r) { r.checked = r.value === value; });
        was = value || '';
      },
      focus: function () { (radios.filter(function (r) { return r.checked; })[0] || radios[0]).focus(); }
    };
    return set;
  }

  function tick(name, words, note, publishTag) {
    var wrap = el('div', 'sighting__q sighting__tick-wrap');
    var label = el('label', 'sighting__tick');
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.name = name;
    label.appendChild(box);
    label.appendChild(el('span', 'sighting__tick-words', format(words) + tag(publishTag)));
    wrap.appendChild(label);
    if (note) wrap.appendChild(el('p', 'sighting__note', format(note)));
    fields[name] = box;
    return wrap;
  }

  function group(title, note, extraClass) {
    var set = el('fieldset', 'sighting__group' + (extraClass ? ' ' + extraClass : ''));
    set.appendChild(el('legend', 'sighting__group-title', format(title)));
    if (note) set.appendChild(el('p', 'sighting__note sighting__note--lead', format(note)));
    return set;
  }

  function songPicker() {
    var wrap = el('div', 'sighting__q');
    var id = uid('song');
    var label = el('label', 'sighting__ask', format(R.song));
    label.setAttribute('for', id);
    var select = el('select', 'sighting__select');
    select.id = id;
    select.name = 'song';
    var first = document.createElement('option');
    first.value = '';
    first.textContent = R.song_choose || '';
    select.appendChild(first);
    (A.tracks || []).forEach(function (title) {
      var option = document.createElement('option');
      option.value = String(title).slice(0, CAPS.song);
      option.textContent = title;
      select.appendChild(option);
    });
    wrap.appendChild(label);
    wrap.appendChild(select);
    fields.song = select;
    return wrap;
  }

  // Shows a part of the form only while the choice it belongs to is made.
  function showWhen(part, name, value) {
    var sync = function () {
      var chosen = fields[name].get();
      part.hidden = Array.isArray(value) ? value.indexOf(chosen) < 0 : chosen !== value;
    };
    fields[name].radios.forEach(function (r) { r.addEventListener('change', sync); });
    sync();
    return sync;
  }

  var form = el('form', 'sighting__form');
  form.noValidate = true;

  var taps = group(R.group_taps);
  taps.appendChild(songPicker());
  taps.appendChild(chips('character', R.character, CHARACTERS, R.characters));
  taps.appendChild(chips('storm', R.storm, STORMS, R.storms));
  taps.appendChild(chips('heard', R.heard, HEARD, R.heard_from));
  var heardOther = words('heard_other', R.heard_other, { extraClass: 'sighting__q--follow' });
  taps.appendChild(heardOther);
  form.appendChild(taps);

  var said = group(R.group_words);
  said.appendChild(words('sentence', R.sentence, { long: true, rows: 2, required: true }));
  said.appendChild(words('moment', R.moment, { long: true }));
  said.appendChild(words('line', R.line, { long: true, rows: 2 }));
  said.appendChild(words('send_to', R.send_to, { long: true, rows: 2 }));
  said.appendChild(words('love', R.love));
  said.appendChild(words('where', R.where));
  form.appendChild(said);

  var hidden = group(R.group_private, R.private_note, 'sighting__group--private');
  hidden.appendChild(words('change', R.change, { long: true, rows: 4 }));
  form.appendChild(hidden);

  var yesNo = { yes: R.yes, no: R.no };
  var bearings = group(R.group_context);
  bearings.appendChild(chips('work', R.work, ['yes', 'no'], yesNo));
  var workTitle = words('work_title', R.work_title, { extraClass: 'sighting__q--follow' });
  bearings.appendChild(workTitle);
  bearings.appendChild(chips('pawleys', R.pawleys, ['yes', 'no'], yesNo));
  bearings.appendChild(chips('hurricane', R.hurricane, ['yes', 'no'], yesNo));
  bearings.appendChild(tick('tickets', R.tickets));
  form.appendChild(bearings);

  var credit = group(R.group_credit);
  credit.appendChild(chips('credit', R.credit, CREDITS, R.credits, { stack: true, required: true }));
  var fullPart = el('div', 'sighting__credit-part');
  fullPart.appendChild(words('full_name', R.full_name, { autocomplete: 'name' }));
  var initialPart = el('div', 'sighting__credit-part sighting__credit-part--three');
  initialPart.appendChild(words('first_name', R.first_name, { autocomplete: 'given-name' }));
  initialPart.appendChild(words('last_initial', R.last_initial, { extraClass: 'sighting__q--initial' }));
  initialPart.appendChild(words('city', R.city, { autocomplete: 'address-level2' }));
  var anonPart = el('div', 'sighting__credit-part');
  anonPart.appendChild(words('state', R.state, { autocomplete: 'address-level1' }));
  credit.appendChild(fullPart);
  credit.appendChild(initialPart);
  credit.appendChild(anonPart);
  credit.appendChild(tick('kickstarter', R.kickstarter));
  credit.appendChild(tick('may_quote', R.may_quote, R.may_quote_note, R.required_publish));
  credit.appendChild(tick('video', R.video));
  form.appendChild(credit);

  var error = el('p', 'sighting__error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  form.appendChild(error);

  var submit = el('button', 'sighting__submit', format(R.submit));
  submit.type = 'submit';
  form.appendChild(submit);

  // The head of the section, the filed note, then the form.
  box.appendChild(el('p', 'section-label sighting__label', format(R.label)));
  if (R.intro) box.appendChild(el('p', 'sighting__intro', format(R.intro)));
  if (R.intro_more) box.appendChild(el('p', 'sighting__more', format(R.intro_more)));

  var filed = el('div', 'sighting__filed');
  filed.hidden = true;
  filed.setAttribute('tabindex', '-1');
  filed.appendChild(el('p', 'sighting__filed-words', format(R.filed)));
  var revise = el('button', 'sighting__revise', format(R.revise));
  revise.type = 'button';
  filed.appendChild(revise);
  box.appendChild(filed);
  box.appendChild(form);

  var syncHeard = showWhen(heardOther, 'heard', 'other');
  var syncWork = showWhen(workTitle, 'work', 'yes');
  var syncFull = showWhen(fullPart, 'credit', 'full');
  var syncInitial = showWhen(initialPart, 'credit', 'initial');
  var syncAnon = showWhen(anonPart, 'credit', ['anonymous', '']);
  fields.credit.set('anonymous');
  syncFull(); syncInitial(); syncAnon();

  function resync() {
    syncHeard(); syncWork(); syncFull(); syncInitial(); syncAnon();
  }

  /* ------------------------------------------------------------------
     Reading and filling the answers.
     ------------------------------------------------------------------ */

  function read() {
    var out = {};
    Object.keys(CAPS).forEach(function (name) { out[name] = fields[name].value.trim(); });
    ['character', 'storm', 'heard', 'work', 'pawleys', 'hurricane', 'credit'].forEach(function (name) {
      out[name] = fields[name].get();
    });
    TICKS.forEach(function (name) { out[name] = !!fields[name].checked; });
    return out;
  }

  function fill(report) {
    if (!report) return;
    Object.keys(CAPS).forEach(function (name) {
      if (typeof report[name] === 'string') fields[name].value = report[name];
    });
    ['character', 'storm', 'heard', 'work', 'pawleys', 'hurricane', 'credit'].forEach(function (name) {
      fields[name].set(report[name] || (name === 'credit' ? 'anonymous' : ''));
    });
    TICKS.forEach(function (name) { fields[name].checked = report[name] === true; });
    resync();
  }

  /* ------------------------------------------------------------------
     Filed, or not.
     ------------------------------------------------------------------ */

  function drawNotice(hasFiled) {
    if (!notice) return;
    var link = hasFiled ? R.notice_filed_link : R.notice_link;
    if (!R.notice_link || !link) {
      notice.hidden = true;
      return;
    }
    notice.querySelector('.report-notice__before').innerHTML =
      format(hasFiled ? R.notice_filed_before : R.notice_before);
    notice.querySelector('.report-notice__link').innerHTML = format(link);
    notice.querySelector('.report-notice__after').innerHTML =
      format(hasFiled ? R.notice_filed_after : R.notice_after);
    notice.hidden = false;
  }

  function showFiled(on) {
    filed.hidden = !on;
    form.hidden = on;
    box.classList.toggle('sighting--filed', on);
  }

  revise.addEventListener('click', function () {
    showFiled(false);
    var first = fields.sentence;
    if (first && first.focus) first.focus();
  });

  // The notice's link opens the form for revising, as well as going to it.
  if (notice) {
    notice.querySelector('.report-notice__link').addEventListener('click', function () {
      if (!filed.hidden) showFiled(false);
    });
  }

  /* ------------------------------------------------------------------
     Filing it.
     ------------------------------------------------------------------ */

  var REASONS = {
    missing: 'error_missing',
    credit: 'error_credit',
    'too-long': 'error_long',
    'signed-out': 'error_signed_out',
    'slow-down': 'error_slow'
  };

  function say(key, field) {
    error.innerHTML = format(R[key] || R.error_offline || '');
    error.hidden = false;
    var target = field && fields[field];
    if (target && target.focus) target.focus();
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    error.hidden = true;

    var answers = read();

    // The two things worth catching before troubling the vault. It
    // checks everything again regardless.
    if (!answers.sentence) return say('error_missing', 'sentence');
    if (answers.credit === 'full' && !answers.full_name) return say('error_credit', 'full_name');
    if (answers.credit === 'initial') {
      var gap = ['first_name', 'last_initial', 'city'].filter(function (k) { return !answers[k]; })[0];
      if (gap) return say('error_credit', gap);
    }

    var label = submit.innerHTML;
    submit.disabled = true;
    submit.innerHTML = format(R.sending || '');

    fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers)
    }).then(function (reply) {
      return reply.json().catch(function () { return {}; }).then(function (body) {
        return { status: reply.status, body: body || {} };
      });
    }).then(function (answer) {
      submit.disabled = false;
      submit.innerHTML = label;
      if (answer.status === 200 && answer.body.ok) {
        showFiled(true);
        drawNotice(true);
        filed.focus();
        return;
      }
      say(REASONS[answer.body.reason] || 'error_offline', answer.body.field);
    }).catch(function () {
      submit.disabled = false;
      submit.innerHTML = label;
      say('error_offline');
    });
  });

  /* ------------------------------------------------------------------
     When the vault opens: has this listener filed already?
     ------------------------------------------------------------------ */

  var asked = false;

  function opened() {
    if (asked || vault.hidden) return;
    asked = true;
    box.hidden = false;
    drawNotice(false);

    fetch(ENDPOINT, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (reply) { return reply.ok ? reply.json() : null; })
      .then(function (body) {
        if (body && body.ok && body.report) {
          fill(body.report);
          showFiled(true);
          drawNotice(true);
        }
      })
      .catch(function () { /* the empty form is the right thing to show */ });
  }

  if (window.MutationObserver) {
    new MutationObserver(opened).observe(vault, { attributes: true, attributeFilter: ['hidden'] });
  }
  opened();
})();
