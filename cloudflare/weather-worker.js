/* =========================================================================
   THE GRAY MAN — weather relay
   =========================================================================

   This file does NOT run on the website. It runs at Cloudflare, sitting
   between the website and the weather service.

   What it does:
     • Asks OpenWeatherMap for the Pawleys Island reading
     • Holds that answer for 10 minutes
     • Gives every visitor in those 10 minutes the same held copy

   So a thousand visitors cost about six calls an hour instead of a
   thousand. It also keeps the weather key at Cloudflare rather than in
   the website's code, where anyone could read it.

   Deployment instructions are in HOW-TO-DEPLOY.txt next to this file.
   ========================================================================= */

const LATITUDE = 33.42;      // Pawleys Island, South Carolina
const LONGITUDE = -79.12;
const HOLD_SECONDS = 600;    // 10 minutes

// Only these sites may read from this relay.
const ALLOWED = [
  'https://graymanmusical.com',
  'https://www.graymanmusical.com',
  'https://ericsorrels.github.io',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowOrigin = ALLOWED.includes(origin) ? origin : ALLOWED[0];

    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin',
    };

    // Browsers ask permission before the real request.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'GET') {
      return json({ error: 'Only GET is supported.' }, 405, cors);
    }

    if (!env.OWM_KEY) {
      return json({ error: 'Weather key is not configured.' }, 500, cors);
    }

    const upstream =
      'https://api.openweathermap.org/data/2.5/weather'
      + `?lat=${LATITUDE}&lon=${LONGITUDE}&units=imperial`
      + `&appid=${env.OWM_KEY}`;

    try {
      // Cloudflare holds this answer for us, so the weather service is
      // only actually contacted once per interval, not once per visitor.
      const res = await fetch(upstream, {
        cf: { cacheTtl: HOLD_SECONDS, cacheEverything: true },
      });

      if (!res.ok) {
        return json({ error: `Weather service returned ${res.status}.` }, 502, cors);
      }

      const data = await res.json();

      // Pass on only what the page displays — the key is never echoed.
      return json(data, 200, {
        ...cors,
        // Tell browsers and Cloudflare how long this may be reused.
        'Cache-Control': `public, max-age=${HOLD_SECONDS}`,
      });
    } catch (err) {
      return json({ error: 'Could not reach the weather service.' }, 502, cors);
    }
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
