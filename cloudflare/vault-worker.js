// THE GRAY MAN — the vault relay.
//
// Runs at Cloudflare on the route  graymanmusical.com/vault-api/*  and is
// the ONLY way to reach the album's files. They live in a private R2
// bucket (grayman-vault) which has no public address of its own, so
// nothing here is reachable except through this file.
//
// What it does:
//   POST /vault-api/login     a password in, a signed session cookie back
//   POST /vault-api/logout    throws the cookie away
//   GET  /vault-api/session   "am I still signed in?" — yes or no, nothing more
//   GET  /vault-api/audio/01.mp3      a file, but only with a good cookie
//        /vault-api/lyrics/01.lrc
//        /vault-api/notes/01.md
//        /vault-api/downloads/<name>
//
// Anything else, and anything at all without a valid session, is a 404.
// Not a 403: a refusal would confirm the file is there, and there is no
// reason to tell a stranger that.
//
// NOTHING SECRET IS WRITTEN IN THIS FILE. It is committed to a public
// repository on purpose. The two secrets live in Cloudflare:
//
//   VAULT_PASSWORD   the password Eric gives out with an invitation
//   SESSION_SECRET   a long random string, used to sign session cookies
//
// and the bucket arrives as the binding  VAULT.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Everything this worker answers for sits under /vault-api/.
    if (!url.pathname.startsWith(PREFIX)) return notFound();
    const route = url.pathname.slice(PREFIX.length);

    if (route === 'login') return handleLogin(request, env);
    if (route === 'logout') return handleLogout(request, env);
    if (route === 'session') return handleSession(request, env);

    return handleFile(request, env, route);
  },
};

const PREFIX = '/vault-api/';

// The folders inside the bucket that may be asked for. A request for
// anything outside this list is a 404 before the bucket is ever touched,
// which is also what stops "../" walking out of the vault.
const FOLDERS = ['audio/', 'lyrics/', 'notes/', 'downloads/'];

const COOKIE = 'tgm_vault';
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/* ---------------------------------------------------------------------
   Signing in

   verifyCredential() is deliberately the only place that decides whether
   someone is who they say they are, and it hands back a "subject" — a
   short name for whoever just signed in. Everything after it only cares
   about that subject, never about how it was arrived at.

   That is the seam for email-plus-a-code later: add a
   POST /vault-api/request-code route that mails a one-time code, keep
   the codes in a KV namespace against the address they were sent to,
   and rewrite verifyCredential() to check the code and return the email
   address as the subject. Nothing below this function has to change,
   and sessions already issued go on working.
   --------------------------------------------------------------------- */

async function verifyCredential(body, env) {
  const given = typeof body.password === 'string' ? body.password : '';
  if (!given || !env.VAULT_PASSWORD) return null;

  // Compared as digests of equal length, byte by byte, so the time this
  // takes cannot leak how much of the password was right.
  const ok = timingSafeEqual(
    await sha256(given),
    await sha256(env.VAULT_PASSWORD)
  );

  // One subject for everyone while a single shared password is the way
  // in. With emailed codes this becomes the address that was verified.
  return ok ? 'invite' : null;
}

async function handleLogin(request, env) {
  if (request.method !== 'POST') return notFound();

  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  const subject = await verifyCredential(body, env);

  if (!subject) {
    // A wrong password answers 401, not 404 — the page has to be able to
    // tell "that isn't the password" from "the vault is broken", and a
    // visitor typing at a password box already knows the box is there.
    // The pause is a small brake on anyone trying passwords in bulk; the
    // real brake is a Rate Limiting rule on this path in the dashboard.
    await sleep(400);
    return json({ ok: false }, 401);
  }

  const token = await issueSession(subject, env);
  return json({ ok: true }, 200, {
    'set-cookie': cookie(token, SESSION_MS / 1000),
  });
}

function handleLogout(request, env) {
  if (request.method !== 'POST') return notFound();
  return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
}

async function handleSession(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return notFound();
  const who = await readSession(request, env);
  return json({ ok: !!who }, who ? 200 : 401);
}

/* ---------------------------------------------------------------------
   The session cookie

   The cookie is its own proof. It carries who it is for and when it
   stops being valid, followed by a signature made with SESSION_SECRET.
   Nothing is stored at Cloudflare's end, so there is no session list to
   keep, and a cookie that has been edited in any way stops verifying.

   Changing SESSION_SECRET signs everyone out at once, which is the
   lever to pull if a session is ever thought to have leaked.
   --------------------------------------------------------------------- */

async function issueSession(subject, env) {
  const expires = Date.now() + SESSION_MS;
  const nonce = crypto.randomUUID();
  const payload = b64url(`v1|${subject}|${expires}|${nonce}`);
  const signature = await sign(payload, env.SESSION_SECRET);
  return `${payload}.${signature}`;
}

async function readSession(request, env) {
  if (!env.SESSION_SECRET) return null;

  const token = cookieValue(request.headers.get('cookie'), COOKIE);
  if (!token) return null;

  const cut = token.lastIndexOf('.');
  if (cut < 1) return null;

  const payload = token.slice(0, cut);
  const signature = token.slice(cut + 1);

  const expected = await sign(payload, env.SESSION_SECRET);
  if (!timingSafeEqual(bytes(signature), bytes(expected))) return null;

  let parts;
  try {
    parts = unb64url(payload).split('|');
  } catch (e) {
    return null;
  }

  const [version, subject, expires] = parts;
  if (version !== 'v1' || !subject) return null;
  if (!expires || Date.now() > Number(expires)) return null;

  return subject;
}

function cookie(value, maxAgeSeconds) {
  // Path is the whole site rather than /vault-api, so that a <audio> or
  // fetch() from any page carries it, and so signing out from anywhere
  // clears the same cookie.
  //   HttpOnly — no script can read it, so nothing on the page can leak it
  //   Secure   — never sent over plain http
  //   SameSite=Lax — not sent when another site makes the request
  return (
    `${COOKIE}=${value}; Path=/; Max-Age=${Math.floor(maxAgeSeconds)}; ` +
    'HttpOnly; Secure; SameSite=Lax'
  );
}

function cookieValue(header, name) {
  if (!header) return null;
  for (const piece of header.split(';')) {
    const at = piece.indexOf('=');
    if (at < 0) continue;
    if (piece.slice(0, at).trim() === name) return piece.slice(at + 1).trim();
  }
  return null;
}

/* ---------------------------------------------------------------------
   Handing over a file
   --------------------------------------------------------------------- */

async function handleFile(request, env, route) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return notFound();

  const key = safeKey(route);
  if (!key) return notFound();

  // Checked before the bucket is asked anything, so an unsigned request
  // cannot even be used to find out which tracks exist.
  const who = await readSession(request, env);
  if (!who) return notFound();

  // Passing the request's own headers lets R2 answer a Range request
  // itself — which is what makes dragging a track's seek bar work
  // instead of throwing the song back to the beginning.
  const object = await env.VAULT.get(key, {
    range: request.headers,
    onlyIf: request.headers,
  });

  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('x-content-type-options', 'nosniff');

  // "private" is the load-bearing word. Without it Cloudflare's own edge
  // cache may keep an .mp3 — extensions like that are cached by default
  // — and then hand it to somebody with no cookie at all, which would
  // undo the entire point of this worker. "private" says: the listener's
  // own browser may keep this, nothing in between may.
  headers.set('cache-control', 'private, max-age=3600');
  headers.set('vary', 'Cookie');

  // R2 hands back no body when the browser already holds the file
  // (onlyIf matched), which is a 304.
  if (!object.body) return new Response(null, { status: 304, headers });

  const asked = request.headers.get('range');
  if (asked && object.range) {
    const size = object.size;
    const offset = object.range.offset ?? (size - object.range.suffix);
    const length = object.range.length ?? (size - offset);
    const last = offset + length - 1;

    if (offset < 0 || offset >= size) {
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${size}` },
      });
    }

    headers.set('content-range', `bytes ${offset}-${last}/${size}`);
    headers.set('content-length', String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('content-length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}

// Turns the part of the address after /vault-api/ into a key in the
// bucket, or null if it is not somewhere this worker will look. The
// folder list is an allow-list, so "../" and anything else unexpected
// simply never matches.
function safeKey(route) {
  let key;
  try {
    key = decodeURIComponent(route);
  } catch (e) {
    return null;
  }

  if (!key || key.includes('..') || key.includes('\\') || key.includes('\0')) {
    return null;
  }
  if (key.startsWith('/')) return null;
  if (!FOLDERS.some((folder) => key.startsWith(folder))) return null;
  if (key.endsWith('/')) return null;

  return key;
}

/* ---------------------------------------------------------------------
   Small helpers
   --------------------------------------------------------------------- */

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function json(data, status, extra) {
  const headers = new Headers(extra || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers });
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

const encoder = new TextEncoder();

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return new Uint8Array(digest);
}

async function sign(text, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  return b64url(String.fromCharCode(...new Uint8Array(mac)));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

function bytes(text) {
  return encoder.encode(text);
}

function b64url(binaryString) {
  return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '==='.slice((padded.length + 3) % 4));
}
