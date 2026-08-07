// THE GRAY MAN — live conditions at Pawleys Island.
//
// Fetches the current reading from OpenWeatherMap and keeps it in the
// browser for a few minutes, so opening the page repeatedly doesn't
// call the weather service every time. All labels and settings come
// from content.js → weather.

(function () {
  'use strict';

  var C = window.SITE_CONTENT || {};
  var W = C.weather;

  var panel = document.getElementById('weatherPanel');
  if (!panel || !W || !(W.proxy_url || W.api_key)) return;

  var CACHE_KEY = 'tgm_weather';
  var maxAgeMs = (W.refresh_minutes || 12) * 60 * 1000;
  var L = W.labels || {};

  /* ---------------------------------------------------------------
     Formatting helpers
     --------------------------------------------------------------- */

  var COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  function bearing(deg) {
    if (typeof deg !== 'number') return '';
    return COMPASS[Math.round(deg / 22.5) % 16];
  }

  function titleCase(s) {
    return String(s || '').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function round(n) {
    return typeof n === 'number' ? Math.round(n) : null;
  }

  /* ---------------------------------------------------------------
     Turn the service's reply into the rows we display
     --------------------------------------------------------------- */

  function readingFrom(d) {
    var wind = d.wind || {};
    var rows = [];

    function add(label, value) {
      if (label && value) rows.push([label, value]);
    }

    add(L.feels_like, round(d.main && d.main.feels_like) + '°');

    // Wind: speed with the direction it blows from.
    if (typeof wind.speed === 'number') {
      var dir = bearing(wind.deg);
      add(L.wind, Math.round(wind.speed) + ' mph' + (dir ? ' ' + dir : ''));
    }

    // Gust is only reported when there is one.
    if (typeof wind.gust === 'number') {
      add(L.gust, Math.round(wind.gust) + ' mph');
    }

    add(L.clouds, (d.clouds && typeof d.clouds.all === 'number') ? d.clouds.all + '%' : null);
    add(L.humidity, (d.main && typeof d.main.humidity === 'number') ? d.main.humidity + '%' : null);
    add(L.pressure, (d.main && d.main.pressure) ? d.main.pressure + ' hPa' : null);

    // Visibility arrives in metres even in imperial units.
    if (typeof d.visibility === 'number') {
      var miles = d.visibility / 1609.34;
      add(L.visibility, (miles >= 10 ? '10+' : miles.toFixed(1)) + ' mi');
    }

    // Rain only appears in the reply while it is actually raining.
    var rain = d.rain && (d.rain['1h'] || d.rain['3h']);
    add(L.rain, rain ? (rain / 25.4).toFixed(2) + ' in' : (W.rain_none || 'None'));

    return {
      temp: round(d.main && d.main.temp),
      desc: titleCase(d.weather && d.weather[0] && d.weather[0].description),
      rows: rows,
      at: Date.now()
    };
  }

  /* ---------------------------------------------------------------
     Drawing
     --------------------------------------------------------------- */

  function draw(r) {
    document.getElementById('wxTemp').textContent =
      (r.temp === null || r.temp === undefined) ? '—' : r.temp;
    document.getElementById('wxDesc').textContent = r.desc || '—';

    var grid = document.getElementById('wxGrid');
    grid.innerHTML = '';
    r.rows.forEach(function (row) {
      // Each reading is its own cell — a div grouping dt/dd is valid
      // inside a description list and keeps label and value together.
      var cell = document.createElement('div');
      cell.className = 'weather__cell';

      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];

      cell.appendChild(dt);
      cell.appendChild(dd);
      grid.appendChild(cell);
    });

    var stamp = document.getElementById('wxStamp');
    if (stamp) {
      stamp.textContent = 'Observed ' + new Date(r.at).toLocaleTimeString([], {
        hour: 'numeric', minute: '2-digit'
      });
    }

    panel.setAttribute('data-state', 'ready');
  }

  function fail() {
    var status = panel.querySelector('.weather__status');
    if (status && W.error_text) status.textContent = W.error_text;
    panel.setAttribute('data-state', 'error');
  }

  /* ---------------------------------------------------------------
     Cache, then fetch
     --------------------------------------------------------------- */

  function cached() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var r = JSON.parse(raw);
      if (!r || typeof r.at !== 'number') return null;
      return (Date.now() - r.at < maxAgeMs) ? r : null;
    } catch (e) {
      return null;   // private browsing, or a stale format
    }
  }

  function store(r) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(r));
    } catch (e) { /* nothing to do */ }
  }

  var fresh = cached();
  if (fresh) {
    draw(fresh);
    return;
  }

  // Prefer the relay at Cloudflare, which holds one reading for everyone.
  // Only if none is configured does the browser ask the weather service
  // itself, which exposes the key and costs a call per visitor.
  var url = W.proxy_url
    ? W.proxy_url
    : 'https://api.openweathermap.org/data/2.5/weather'
      + '?lat=' + encodeURIComponent(W.latitude)
      + '&lon=' + encodeURIComponent(W.longitude)
      + '&units=imperial'
      + '&appid=' + encodeURIComponent(W.api_key);

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('weather service returned ' + res.status);
      return res.json();
    })
    .then(function (d) {
      if (!d || !d.main) throw new Error('unexpected reply');
      var reading = readingFrom(d);
      store(reading);
      draw(reading);
    })
    .catch(fail);
})();
