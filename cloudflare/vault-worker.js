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
//   GET  /vault-api/send-test?to=…   mails a test message — see Sending mail
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
// repository on purpose. The secrets live in Cloudflare:
//
//   VAULT_PASSWORD   the password Eric gives out with an invitation
//   SESSION_SECRET   a long random string, used to sign session cookies
//   RESEND_API_KEY   lets this worker hand an email to Resend to deliver
//
// and two stores arrive as bindings:
//
//   VAULT     the private R2 bucket holding the album's files
//   MEMBERS   the D1 database listing who is allowed in — see The guest list

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Everything this worker answers for sits under /vault-api/.
    if (!url.pathname.startsWith(PREFIX)) return notFound();
    const route = url.pathname.slice(PREFIX.length);

    if (route === 'login') return handleLogin(request, env);
    if (route === 'logout') return handleLogout(request, env);
    if (route === 'session') return handleSession(request, env);
    if (route === 'send-test') return handleSendTest(request, env, url);

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
   The guest list

   A D1 database — an ordinary table of rows and columns — arriving as
   the binding MEMBERS. One row per person allowed in: their address,
   where they came from ('manual' or 'gumroad'), when they were added,
   and when they last signed in. Its shape is in cloudflare/vault-schema.sql.

   Every address is put through normalizeEmail() before it is looked up
   or stored, so the list can never end up holding two rows for one
   person because of a capital letter or a stray space.
   --------------------------------------------------------------------- */

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;

  const email = raw.trim().toLowerCase();

  // Long enough to be an address, short enough to be a real one.
  if (email.length < 6 || email.length > 254) return null;

  // Deliberately loose. This is not trying to judge whether an address
  // exists — only to refuse something that plainly is not one, so that
  // nonsense never reaches the database or the mail relay. Whether an
  // address is real is answered by whether the code arrives.
  //
  // What it does refuse is telling: spaces and line breaks, commas and
  // semicolons, angle brackets and quotation marks. Those are the
  // characters that turn one address into a list of them, or smuggle a
  // second instruction into a mail header. An APOSTROPHE is deliberately
  // allowed — o'brien@… is a real address and a common name, and the
  // database is spoken to with bound values, so there is nothing for a
  // quotation mark to break into.
  if (!/^[^\s@,;:<>"]+@[^\s@.,;:<>"]+(\.[^\s@.,;:<>"]+)+$/.test(email)) {
    return null;
  }

  return email;
}

async function findMember(env, email) {
  if (!env.MEMBERS) return null;

  return await env.MEMBERS.prepare(
    'SELECT email, source, added_at, last_login FROM members WHERE email = ?'
  )
    .bind(email)
    .first();
}

/* ---------------------------------------------------------------------
   Sending mail

   Handed to Resend, which does the delivering. The key is a Worker
   secret and is never written down here, never logged, and never sent
   anywhere except to Resend itself.

   The FROM address is at graymanmusical.com, which is the domain Resend
   has been given permission to send as. Replies are pointed at Eric's
   own inbox instead, because hello@graymanmusical.com only forwards —
   there is nobody sitting in it.

   The wording of these emails is HERE rather than in content.js, which
   is the one deliberate exception to the everything-lives-in-content.js
   rule. This file runs at Cloudflare, not in a visitor's browser; it
   has no way to read content.js and never will. Anything a visitor
   reads on the PAGE still belongs in content.js.
   --------------------------------------------------------------------- */

const MAIL_FROM = 'The Gray Man <hello@graymanmusical.com>';
const MAIL_REPLY_TO = 'hello@ericsorrels.com';

async function sendEmail(env, { to, subject, text }) {
  if (!env.RESEND_API_KEY) {
    return { ok: false, why: 'No RESEND_API_KEY is set on this worker.' };
  }

  let reply;
  try {
    reply = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [to],
        reply_to: MAIL_REPLY_TO,
        subject,
        text,
      }),
    });
  } catch (e) {
    return { ok: false, why: 'Could not reach the mail relay at all.' };
  }

  if (!reply.ok) {
    // Resend's own complaint, kept short and passed along, because it
    // says useful things like "domain is not verified". It never
    // contains the key.
    let said = '';
    try {
      said = (await reply.text()).slice(0, 300);
    } catch (e) {
      said = '(no detail given)';
    }
    return { ok: false, why: `Resend answered ${reply.status}: ${said}` };
  }

  const data = await reply.json().catch(() => ({}));
  return { ok: true, id: data.id || null };
}

/* ---------------------------------------------------------------------
   The test message

   Proves three things in one visit: that the guest list can be read,
   that the mail key works, and that a message actually arrives.

   TWO THINGS GUARD IT, and neither is a new secret:
     - the visitor must already hold a valid vault session, so a
       stranger gets the same 404 as they would for a track;
     - the address must already be ON the guest list, so this can never
       be used to send mail to someone who did not ask for it.

   It answers in plain words rather than JSON, because it is read by a
   person in a browser window. It goes away in Stage 4, when the admin
   page takes the job over behind Cloudflare Access.
   --------------------------------------------------------------------- */

async function handleSendTest(request, env, url) {
  if (request.method !== 'GET') return notFound();

  const who = await readSession(request, env);
  if (!who) return notFound();

  const email = normalizeEmail(url.searchParams.get('to') || '');
  if (!email) {
    return plain(
      'Add an address to the end, like  ?to=you@example.com  — and it has\n' +
        'to be one already on the guest list.',
      400
    );
  }

  if (!env.MEMBERS) {
    return plain(
      'The guest list is not connected to this worker.\n\n' +
        'Cloudflare dashboard → Workers & Pages → grayman-vault → Bindings,\n' +
        'and add the D1 database grayman-members as  MEMBERS .',
      500
    );
  }

  const member = await findMember(env, email);
  if (!member) {
    return plain(
      `${email} is not on the guest list, so nothing was sent.\n\n` +
        'That is the guard working as intended: this can only ever mail\n' +
        'somebody already approved. Add them in the D1 console first.',
      404
    );
  }

  const sent = await sendEmail(env, {
    to: member.email,
    subject: 'A test signal from The Gray Man',
    text:
      'This is a test, and nothing is asked of you.\n\n' +
      'If it reached you, the vault can reach you — which is all it\n' +
      'needed to know before it starts sending sign-in codes.\n\n' +
      'You can close this and forget it.\n\n' +
      '— The Gray Man\n' +
      'https://graymanmusical.com\n',
  });

  if (!sent.ok) {
    return plain(`The message was NOT sent.\n\n${sent.why}\n`, 502);
  }

  return plain(
    `Sent to ${member.email}.\n\n` +
      `Resend's reference for it: ${sent.id || '(none given)'}\n\n` +
      'It should arrive within a few seconds. If it does not, look in\n' +
      "spam, then at the Emails page in Resend — it records every\n" +
      'message and what became of it.\n'
  );
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

// A plain-words answer, for the routes a person reads in a browser
// window rather than a script reads as JSON.
function plain(message, status) {
  return new Response(message, {
    status: status || 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
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
