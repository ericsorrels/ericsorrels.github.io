// THE GRAY MAN — The Journey, plotted as a storm track.
//
// Builds the advisory chart from content.js → news.phases: a red line
// that draws itself down the page as the reader scrolls, gathering
// strength from pencil gray to landfall red, with each event plotted
// as a position along the track — the way a hurricane chart plots
// fixes. Everything the visitor reads comes from content.js.
//
// The path is built by MEASURING the rendered markers, not by assuming
// where they are — so it survives any screen size, font swap, or text
// edit without re-tuning. It rebuilds on resize and after fonts load.

(function () {
  'use strict';

  var C = window.SITE_CONTENT || {};
  var N = C.news;
  var host = document.getElementById('stormTrack');
  if (!host || !N || !Array.isArray(N.phases) || !N.phases.length) return;

  // The static text in the HTML is only for visitors without JavaScript;
  // from here on the plotted chart replaces it.
  var fallback = document.getElementById('stormTrackFallback');
  if (fallback) fallback.remove();

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';

  // Mirrors main.js — escapes the text, then *Some Words* become the
  // styled show-title treatment.
  function format(text) {
    var probe = document.createElement('span');
    probe.textContent = String(text == null ? '' : text);
    return probe.innerHTML.replace(/\*([^*]+)\*/g, '<em class="show-title">$1</em>');
  }

  /* ------------------------------------------------------------------
     Colors — taken from the site's own tokens so the palette stays
     canonical. The track warms from pencil gray toward storm red as
     the phases strengthen.
     ------------------------------------------------------------------ */

  var rootStyle = getComputedStyle(document.documentElement);
  function token(name, fallbackHex) {
    return rootStyle.getPropertyValue(name).trim() || fallbackHex;
  }
  var PENCIL = token('--gray-mid', '#8B8579');
  var RED = token('--storm-red', '#8A3D33');
  var INK = token('--ink', '#1B1A17');

  function channel(hex, i) {
    return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  }
  function mix(a, b, t) {
    var r = Math.round(channel(a, 0) + (channel(b, 0) - channel(a, 0)) * t);
    var g = Math.round(channel(a, 1) + (channel(b, 1) - channel(a, 1)) * t);
    var bl = Math.round(channel(a, 2) + (channel(b, 2) - channel(a, 2)) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  // How far along the gray-to-red climb each strength sits.
  var WARMTH = { 1: 0, 2: 0.25, 3: 0.55, 4: 0.8, 5: 1, 6: 0 };

  /* ------------------------------------------------------------------
     Markers — the hurricane-chart symbols. Open circle for a
     disturbance, filled for a storm, the cyclone glyph once it earns
     a category, growing and reddening to landfall. Drawn inline so
     they inherit nothing and load nothing.
     ------------------------------------------------------------------ */

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVGNS, name);
    for (var key in attrs) el.setAttribute(key, attrs[key]);
    return el;
  }

  function circleMarker(size, color, filled, dashed) {
    var svg = svgEl('svg', {
      width: size, height: size, viewBox: '-10 -10 20 20', 'aria-hidden': 'true'
    });
    var attrs = { r: 6.6, fill: filled ? color : 'none' };
    if (!filled) {
      attrs.stroke = color;
      attrs['stroke-width'] = 2.6;
      if (dashed) attrs['stroke-dasharray'] = '3.4 3.1';
    }
    svg.appendChild(svgEl('circle', attrs));
    return svg;
  }

  function cycloneMarker(size, color) {
    var svg = svgEl('svg', {
      width: size, height: size, viewBox: '-10 -10 20 20', 'aria-hidden': 'true'
    });
    svg.appendChild(svgEl('circle', { r: 3.1, fill: color }));
    // Two trailing arms, the spin of the storm.
    ['M 0 -6.6 A 6.6 6.6 0 0 1 6.6 0', 'M 0 6.6 A 6.6 6.6 0 0 1 -6.6 0']
      .forEach(function (d) {
        svg.appendChild(svgEl('path', {
          d: d, fill: 'none', stroke: color,
          'stroke-width': 2.4, 'stroke-linecap': 'round'
        }));
      });
    return svg;
  }

  function markerFor(strength) {
    switch (strength) {
      case 1: return circleMarker(13, PENCIL, false, false);
      case 2: return circleMarker(14, INK, true, false);
      case 3: return cycloneMarker(22, mix(PENCIL, RED, WARMTH[3]));
      case 4: return cycloneMarker(28, mix(PENCIL, RED, WARMTH[4]));
      case 5: return cycloneMarker(40, RED);
      default: return circleMarker(15, PENCIL, false, true);
    }
  }

  /* ------------------------------------------------------------------
     Build the chart
     ------------------------------------------------------------------ */

  // Where each fix sits across the rail, as a fraction of its width —
  // the gentle wander of a real track, recurving toward landfall.
  var DRIFT = [0.30, 0.60, 0.38, 0.68, 0.46, 0.30, 0.56, 0.40, 0.52, 0.64];

  host.classList.add('advisory');

  // The key — symbols explained, in chart-legend fashion. Any label
  // left empty ("") in content.js is left off, as everywhere else.
  var legend = N.legend || {};
  var keyRows = [
    ['disturbance', circleMarker(11, PENCIL, false, false)],
    ['storm', circleMarker(11, INK, true, false)],
    ['hurricane', cycloneMarker(15, mix(PENCIL, RED, 0.7))],
    ['landfall', cycloneMarker(18, RED)],
    ['projected', circleMarker(12, PENCIL, false, true)]
  ].filter(function (row) { return legend[row[0]]; });

  if (keyRows.length) {
    var key = document.createElement('aside');
    key.className = 'advisory__key';
    if (legend.title) {
      var keyTitle = document.createElement('p');
      keyTitle.className = 'advisory__key-title';
      keyTitle.textContent = legend.title;
      key.appendChild(keyTitle);
    }
    var keyList = document.createElement('ul');
    keyList.className = 'advisory__key-list';
    keyRows.forEach(function (row) {
      var li = document.createElement('li');
      li.appendChild(row[1]);
      var label = document.createElement('span');
      label.textContent = legend[row[0]];
      li.appendChild(label);
      keyList.appendChild(li);
    });
    key.appendChild(keyList);
    host.appendChild(key);
  }

  var chart = document.createElement('div');
  chart.className = 'advisory__chart';
  host.appendChild(chart);

  var phaseList = document.createElement('ol');
  phaseList.className = 'advisory__phases';
  chart.appendChild(phaseList);

  // Everything the scroll handler needs about each plotted fix.
  var fixes = [];
  var eventIndex = 0;

  N.phases.forEach(function (phase) {
    var li = document.createElement('li');
    li.className = 'advisory__phase';

    var masthead = document.createElement('header');
    masthead.className = 'advisory__masthead';
    [['advisory__no', phase.advisory],
     ['advisory__name', phase.name],
     ['advisory__cat', phase.category]].forEach(function (pair) {
      if (!pair[1]) return;
      var el = document.createElement(pair[0] === 'advisory__name' ? 'h2' : 'p');
      el.className = pair[0];
      el.innerHTML = format(pair[1]);
      masthead.appendChild(el);
    });
    li.appendChild(masthead);

    var events = document.createElement('ol');
    events.className = 'advisory__events';

    (phase.events || []).forEach(function (ev) {
      var strength = phase.strength || 1;
      var item = document.createElement('li');
      item.className = 'advisory__event';
      if (strength === 5) item.className += ' advisory__event--landfall';
      item.style.setProperty('--drift', DRIFT[eventIndex % DRIFT.length]);
      eventIndex += 1;

      var marker = document.createElement('span');
      marker.className = 'advisory__marker' +
        (strength === 5 ? ' advisory__marker--landfall' : '');
      marker.setAttribute('aria-hidden', 'true');
      marker.appendChild(markerFor(strength));
      item.appendChild(marker);

      var card = document.createElement('div');
      card.className = 'advisory__card';
      [['advisory__date', ev.date], ['advisory__place', ev.place]]
        .forEach(function (pair) {
          if (!pair[1]) return;
          var p = document.createElement('p');
          p.className = pair[0];
          p.innerHTML = format(pair[1]);
          card.appendChild(p);
        });
      if (ev.text) {
        var text = document.createElement('p');
        text.className = 'advisory__text';
        text.innerHTML = format(ev.text);
        card.appendChild(text);
      }
      if (strength === 5 && N.landfall_stamp) {
        var stamp = document.createElement('span');
        stamp.className = 'advisory__stamp';
        stamp.textContent = N.landfall_stamp;
        card.appendChild(stamp);
      }
      item.appendChild(card);

      events.appendChild(item);
      fixes.push({ marker: marker, card: card, strength: strength, y: 0 });
    });

    li.appendChild(events);
    phaseList.appendChild(li);
  });

  /* ------------------------------------------------------------------
     The track itself — one SVG behind the list. A solid line through
     landfall, colored by a top-to-bottom gradient keyed to the phases;
     a dashed forecast line and cone of uncertainty carrying on past it.
     ------------------------------------------------------------------ */

  var svg = svgEl('svg', { class: 'advisory__svg', 'aria-hidden': 'true' });
  chart.insertBefore(svg, phaseList);

  var defs = document.createElementNS(SVGNS, 'defs');
  var gradient = svgEl('linearGradient', {
    id: 'tgmTrackWarmth', gradientUnits: 'userSpaceOnUse',
    x1: 0, y1: 0, x2: 0, y2: 1
  });
  defs.appendChild(gradient);
  svg.appendChild(defs);

  var cone = svgEl('path', { class: 'advisory__cone', fill: PENCIL, 'fill-opacity': 0.1 });
  var forecast = svgEl('path', {
    class: 'advisory__forecast', fill: 'none', stroke: PENCIL,
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-dasharray': '2 7'
  });
  var track = svgEl('path', {
    class: 'advisory__track', fill: 'none',
    stroke: 'url(#tgmTrackWarmth)', 'stroke-width': 2.5, 'stroke-linecap': 'round'
  });
  svg.appendChild(cone);
  svg.appendChild(forecast);
  svg.appendChild(track);

  function smoothThrough(pts) {
    if (pts.length < 2) return '';
    var d = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(i - 1, 0)], p1 = pts[i];
      var p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      d += ' C ' + (p1.x + (p2.x - p0.x) / 6).toFixed(1)
        + ' ' + (p1.y + (p2.y - p0.y) / 6).toFixed(1)
        + ' ' + (p2.x - (p3.x - p1.x) / 6).toFixed(1)
        + ' ' + (p2.y - (p3.y - p1.y) / 6).toFixed(1)
        + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
  }

  var trackLength = 0;
  var samples = [];       // distance along the track at each height
  var landfallY = 0;

  function plot() {
    var chartRect = chart.getBoundingClientRect();
    if (!chartRect.height) return;

    svg.setAttribute('width', Math.round(chartRect.width));
    svg.setAttribute('height', Math.round(chartRect.height));

    fixes.forEach(function (fix) {
      var r = fix.marker.getBoundingClientRect();
      fix.x = r.left + r.width / 2 - chartRect.left;
      fix.y = r.top + r.height / 2 - chartRect.top;
    });

    var solid = fixes.filter(function (f) { return f.strength <= 5; });
    var beyond = fixes.filter(function (f) { return f.strength === 6; });
    var last = solid[solid.length - 1];
    landfallY = last.y;

    track.setAttribute('d', smoothThrough(solid));

    // The gradient's stops sit exactly at each fix, so the line reaches
    // each color just as it reaches the event that earned it.
    gradient.setAttribute('y1', solid[0].y);
    gradient.setAttribute('y2', last.y);
    gradient.innerHTML = '';
    var span = Math.max(last.y - solid[0].y, 1);
    solid.forEach(function (f) {
      gradient.appendChild(svgEl('stop', {
        offset: Math.min(Math.max((f.y - solid[0].y) / span, 0), 1),
        'stop-color': mix(PENCIL, RED, WARMTH[f.strength] || 0)
      }));
    });

    // The forecast: dashed on past landfall, ending a little beyond the
    // last plotted position, with the cone widening around it.
    var tip = beyond.length
      ? { x: beyond[beyond.length - 1].x + 12, y: beyond[beyond.length - 1].y + 70 }
      : { x: last.x + 12, y: last.y + 70 };
    var forecastPts = [last].concat(beyond).concat([tip]);
    forecast.setAttribute('d', smoothThrough(forecastPts));

    var flare = Math.min(38, chartRect.width * 0.05 + 14);
    cone.setAttribute('d',
      'M ' + (last.x - 7).toFixed(1) + ' ' + last.y.toFixed(1) +
      ' L ' + (tip.x - flare).toFixed(1) + ' ' + tip.y.toFixed(1) +
      ' L ' + (tip.x + flare).toFixed(1) + ' ' + tip.y.toFixed(1) +
      ' L ' + (last.x + 7).toFixed(1) + ' ' + last.y.toFixed(1) + ' Z');

    trackLength = track.getTotalLength();
    track.setAttribute('stroke-dasharray', trackLength + ' ' + trackLength);

    // A height-to-distance table, so the drawn tip can sit level with
    // however far down the page the reader has come.
    samples = [];
    var STEPS = 240;
    for (var i = 0; i <= STEPS; i++) {
      var len = trackLength * i / STEPS;
      samples.push({ len: len, y: track.getPointAtLength(len).y });
    }
  }

  function lengthAtHeight(y) {
    if (!samples.length || y <= samples[0].y) return 0;
    for (var i = 1; i < samples.length; i++) {
      if (samples[i].y >= y) {
        var a = samples[i - 1], b = samples[i];
        var t = (y - a.y) / Math.max(b.y - a.y, 0.001);
        return a.len + (b.len - a.len) * Math.min(t, 1);
      }
    }
    return trackLength;
  }

  /* ------------------------------------------------------------------
     Scroll — the line draws to a point level with the reader, fixes
     light as the line reaches them, cards surface once and stay.
     ------------------------------------------------------------------ */

  function update() {
    var chartTop = chart.getBoundingClientRect().top;
    var tipY = window.innerHeight * 0.55 - chartTop;

    track.setAttribute('stroke-dashoffset',
      Math.max(trackLength - lengthAtHeight(tipY), 0));

    fixes.forEach(function (fix) {
      var reached = fix.y <= tipY + 4;
      fix.marker.classList.toggle('is-lit', reached);
      if (reached) fix.card.classList.add('is-in');
    });

    var landed = landfallY <= tipY + 4;
    forecast.classList.toggle('is-on', landed);
    cone.classList.toggle('is-on', landed);
  }

  function showEverything() {
    plot();
    track.setAttribute('stroke-dashoffset', 0);
    fixes.forEach(function (fix) {
      fix.marker.classList.add('is-lit');
      fix.card.classList.add('is-in');
    });
    forecast.classList.add('is-on');
    cone.classList.add('is-on');
  }

  // Without motion, the chart is simply complete — the finished map,
  // not the storm replaying.
  if (reduceMotion) {
    showEverything();
    window.addEventListener('resize', debounce(showEverything));
    return;
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      update();
      ticking = false;
    });
  }

  function debounce(fn) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, 150);
    };
  }

  function replot() {
    plot();
    update();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', debounce(replot));
  window.addEventListener('load', replot);
  // Fonts arriving late change every measured height, so plot again.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(replot);
  }

  replot();
})();
