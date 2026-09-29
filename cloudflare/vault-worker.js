// THE GRAY MAN — the vault relay.
//
// Runs at Cloudflare on the route  graymanmusical.com/vault-api/*  and is
// the ONLY way to reach the album's files. They live in a private R2
// bucket (grayman-vault) which has no public address of its own, so
// nothing here is reachable except through this file.
//
// What it does:
//   POST /vault-api/request-code  an email in, a six-digit code posted out
//   POST /vault-api/verify-code   the code back, a signed session cookie out
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
//   SESSION_SECRET   a long random string. It signs session cookies AND
//                    the stored hashes of codes in flight, so changing it
//                    signs everybody out and voids any code not yet used.
//   RESEND_API_KEY   lets this worker hand an email to Resend to deliver
//
// There is no VAULT_PASSWORD any more. The shared password was removed
// on 29 September 2026 in favour of a code emailed to an address on the
// guest list, so that access can be given and taken away one person at
// a time instead of everyone holding the same secret.
//
// and two stores arrive as bindings:
//
//   VAULT     the private R2 bucket holding the album's files
//   MEMBERS   the D1 database listing who is allowed in — see The guest list

export default {
  // ctx is here for ctx.waitUntil, which lets this worker answer the
  // browser and go on working afterwards. Sending the email that way is
  // what makes "was that address approved?" take the same length of
  // time either way — see handleRequestCode.
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Everything this worker answers for sits under /vault-api/.
    if (!url.pathname.startsWith(PREFIX)) return notFound();
    const route = url.pathname.slice(PREFIX.length);

    if (route === 'request-code') return handleRequestCode(request, env, ctx);
    if (route === 'verify-code') return handleVerifyCode(request, env);
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
   Signing in — an address, then a code

   Two steps. Ask for a code, then send it back.

   THE FIRST STEP TELLS A STRANGER NOTHING. Whether or not the address
   is on the guest list, the answer is identical: the same words, the
   same status, and — because the email is posted after the answer has
   already gone back, through ctx.waitUntil — the same length of time.
   So this cannot be used to find out who Eric's supporters are, which
   it could if an approved address answered any differently from an
   unapproved one.

   The brake is applied BEFORE the guest list is consulted, for the same
   reason: being turned away for asking too often has to look the same
   whoever is asking.
   --------------------------------------------------------------------- */

const CODE_LIFE_MS = 10 * 60 * 1000;   // a code is good for ten minutes
const CODE_TRIES = 5;                  // wrong guesses before it is torn up
const RESEND_GAP_MS = 60 * 1000;       // the quiet minute after one is sent

const HOUR_MS = 60 * 60 * 1000;
const CODES_PER_EMAIL = 5;             // per address, per hour
const CODES_PER_IP = 12;               // per internet address, per hour
const TRIES_PER_IP = 30;               // guesses per internet address, per hour

async function handleRequestCode(request, env, ctx) {
  if (request.method !== 'POST') return notFound();
  if (!env.MEMBERS) return json({ ok: false, reason: 'offline' }, 503);

  const body = await readJson(request);
  const email = normalizeEmail(body.email);

  // The one thing that IS said plainly, because it is about what was
  // typed rather than about who is on the list. Somebody who has
  // mistyped their address deserves to be told so rather than left
  // waiting for an email that was never going to come.
  if (!email) return json({ ok: false, reason: 'bad-email' }, 400);

  const from = clientAddress(request);

  if (
    (await overLimit(env, 'email:' + email, CODES_PER_EMAIL, HOUR_MS)) ||
    (await overLimit(env, 'ip:' + from, CODES_PER_IP, HOUR_MS))
  ) {
    return json({ ok: false, reason: 'slow-down' }, 429);
  }

  // Everything from here is done after the answer has been sent, so the
  // reply's timing carries no news about whether the address is known.
  ctx.waitUntil(postCode(env, email));

  return json({ ok: true }, 200);
}

// Decides whether there is anybody to write to, and writes to them. Its
// answer goes nowhere: the browser was told "on its way" some
// milliseconds ago, whatever happens in here.
async function postCode(env, email) {
  await sweep(env);

  const member = await findMember(env, email);
  if (!member) return;

  // A code already sent and still warm is left alone. Otherwise a second
  // press of the button would quietly replace the code in the email that
  // is already on its way, and the listener would type the code they were
  // sent and be told it is wrong.
  const waiting = await env.MEMBERS.prepare(
    'SELECT sent_at FROM codes WHERE email = ? AND expires_at > ?'
  )
    .bind(email, Date.now())
    .first();

  if (waiting && Date.now() - waiting.sent_at < RESEND_GAP_MS) return;

  const code = newCode();
  const now = Date.now();

  await env.MEMBERS.prepare(
    'INSERT INTO codes (email, code_hash, expires_at, tries, sent_at) ' +
      'VALUES (?, ?, ?, 0, ?) ' +
      'ON CONFLICT(email) DO UPDATE SET ' +
      'code_hash = excluded.code_hash, expires_at = excluded.expires_at, ' +
      'tries = 0, sent_at = excluded.sent_at'
  )
    .bind(email, await hashCode(email, code, env), now + CODE_LIFE_MS, now)
    .run();

  await sendEmail(env, {
    to: email,
    subject: `Your code is ${code} — The Gray Man`,
    text:
      `${code}\n\n` +
      'That is your code for Early Digital Access. Type it into the page\n' +
      'you came from. It is good for ten minutes, and it works once.\n\n' +
      'If you did not ask for it, somebody typed your address by mistake.\n' +
      'Nothing has happened and you can ignore this.\n\n' +
      '— The Gray Man\n' +
      'https://graymanmusical.com/access.html\n',
  });
}

async function handleVerifyCode(request, env) {
  if (request.method !== 'POST') return notFound();
  if (!env.MEMBERS) return json({ ok: false, reason: 'offline' }, 503);

  const body = await readJson(request);
  const email = normalizeEmail(body.email);

  // Spaces and stray characters are thrown away rather than refused, so
  // a code pasted out of an email as "123 456" is simply read as 123456.
  const code = String(body.code == null ? '' : body.code).replace(/\D/g, '');

  if (!email || code.length !== 6) {
    await sleep(400);
    return json({ ok: false, reason: 'wrong' }, 401);
  }

  const from = clientAddress(request);
  if (await overLimit(env, 'try:' + from, TRIES_PER_IP, HOUR_MS)) {
    return json({ ok: false, reason: 'slow-down' }, 429);
  }

  const held = await env.MEMBERS.prepare(
    'SELECT code_hash, expires_at, tries FROM codes WHERE email = ?'
  )
    .bind(email)
    .first();

  // No code, or one past its ten minutes. Both are answered the same
  // way, which is also the answer an address that was never on the list
  // receives — there is no row for it either, and no reason to say so.
  if (!held || Date.now() > held.expires_at) {
    if (held) await forget(env, email);
    await sleep(400);
    return json({ ok: false, reason: 'expired' }, 401);
  }

  const offered = await hashCode(email, code, env);
  if (!timingSafeEqual(bytes(offered), bytes(held.code_hash))) {
    const spent = held.tries + 1;

    if (spent >= CODE_TRIES) {
      // Torn up rather than merely counted, so a code that has been
      // guessed at five times cannot be guessed at a sixth.
      await forget(env, email);
      await sleep(400);
      return json({ ok: false, reason: 'locked' }, 401);
    }

    await env.MEMBERS.prepare('UPDATE codes SET tries = ? WHERE email = ?')
      .bind(spent, email)
      .run();

    await sleep(400);
    return json({ ok: false, reason: 'wrong', left: CODE_TRIES - spent }, 401);
  }

  // Right. The code is spent the moment it works, so the same one can
  // never be used twice — by this listener or by anybody who saw it.
  await forget(env, email);

  await env.MEMBERS.prepare('UPDATE members SET last_login = ? WHERE email = ?')
    .bind(new Date().toISOString().replace(/\.\d+Z$/, 'Z'), email)
    .run();

  // The session's subject is the address itself now, rather than the one
  // shared name every password holder used to get. So a cookie says WHO,
  // which is what makes it possible to take one person's access away.
  const token = await issueSession(email, env);
  return json({ ok: true }, 200, {
    'set-cookie': cookie(token, SESSION_MS / 1000),
  });
}

function forget(env, email) {
  return env.MEMBERS.prepare('DELETE FROM codes WHERE email = ?')
    .bind(email)
    .run();
}

// Six digits, from the same source of randomness that makes session
// nonces. Bytes of 250 and over are thrown away rather than folded in:
// 256 does not divide by 10, so keeping them would make 0 to 5 very
// slightly likelier than 6 to 9.
function newCode() {
  let out = '';
  while (out.length < 6) {
    const batch = crypto.getRandomValues(new Uint8Array(8));
    for (const byte of batch) {
      if (byte < 250 && out.length < 6) out += String(byte % 10);
    }
  }
  return out;
}

// The code is never stored, only this. Signed with SESSION_SECRET, so
// the guest list being read would still not tell anyone what to type;
// and bound to the address, so a hash lifted from one row cannot be
// offered for another.
function hashCode(email, code, env) {
  return sign(`code|${email}|${code}`, env.SESSION_SECRET);
}

/* ---------------------------------------------------------------------
   The brake

   Counting per address and per internet address, in windows. Each thing
   being counted gets a row holding how many times it has asked and when
   its allowance starts again.

   It errs toward letting people in: if the database cannot be reached,
   overLimit() says "not over", because a supporter locked out by a
   database wobble is a worse failure than an attacker getting a few
   extra guesses at a code that expires in ten minutes anyway.
   --------------------------------------------------------------------- */

async function overLimit(env, bucket, limit, windowMs) {
  const now = Date.now();

  try {
    const row = await env.MEMBERS.prepare(
      'SELECT count, window_until FROM throttle WHERE bucket = ?'
    )
      .bind(bucket)
      .first();

    // Nothing yet, or the window has run out: start a fresh one.
    if (!row || now > row.window_until) {
      await env.MEMBERS.prepare(
        'INSERT INTO throttle (bucket, count, window_until) VALUES (?, 1, ?) ' +
          'ON CONFLICT(bucket) DO UPDATE SET count = 1, ' +
          'window_until = excluded.window_until'
      )
        .bind(bucket, now + windowMs)
        .run();
      return false;
    }

    if (row.count >= limit) return true;

    await env.MEMBERS.prepare(
      'UPDATE throttle SET count = count + 1 WHERE bucket = ?'
    )
      .bind(bucket)
      .run();

    return false;
  } catch (e) {
    return false;
  }
}

// Expired codes and spent windows, cleared as we go, so neither table
// ever needs tending. Failure here is not worth refusing anybody over.
async function sweep(env) {
  const now = Date.now();
  try {
    await env.MEMBERS.batch([
      env.MEMBERS.prepare('DELETE FROM codes WHERE expires_at < ?').bind(now),
      env.MEMBERS.prepare('DELETE FROM throttle WHERE window_until < ?').bind(now),
    ]);
  } catch (e) {
    /* nothing worth doing about it */
  }
}

// Cloudflare puts the visitor's real address here. It is not something
// the browser can set, so it cannot be fiddled with from outside.
function clientAddress(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch (e) {
    return {};
  }
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
