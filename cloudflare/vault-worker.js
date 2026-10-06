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
//   GET  /vault-api/admin     the guest list, for Eric only — see The admin page
//        /vault-api/admin/list · /add · /remove · /test-code
//   POST /vault-api/gumroad/<secret>   what Gumroad posts to — see Gumroad
//   POST /vault-api/stripe/webhook     what Stripe posts to, signed — see Stripe
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
//   ADMIN_EMAIL      the one address allowed to open the admin page
//   GUMROAD_TOKEN    reads Eric's own sales, to confirm a purchase
//   GUMROAD_PRODUCT  which product grants access — its permalink or id
//   GUMROAD_PING_SECRET  the long random word in the address Gumroad posts to
//   STRIPE_SECRET_KEY    a RESTRICTED, read-only key: it reads Eric's own
//                        receipts, payments, charges and disputes, and can
//                        do nothing else — it cannot charge, refund or pay out
//   STRIPE_WEBHOOK_SECRET  the signing secret of the webhook endpoint, which
//                        is how a message is known to have come from Stripe
//   STRIPE_PRODUCT       which product grants access — its product id
//                        (prod_…), a price id or the payment link's id
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

    if (route === 'admin') return handleAdminPage(request, env);
    if (route.startsWith('admin/')) {
      return handleAdminApi(request, env, route.slice('admin/'.length));
    }

    if (route.startsWith('gumroad/')) {
      return handleGumroad(request, env, ctx, route.slice('gumroad/'.length));
    }

    if (route === 'stripe/webhook') return handleStripe(request, env, ctx);

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

  let member = await findMember(env, email);

  // Not on the list — but they may have bought it and the ping never
  // arrived, or arrived before any of this existed, or Eric changed the
  // address in Gumroad's settings and forgot to change it back. So ask
  // Gumroad directly before giving up. This is the safety net that
  // makes a missed webhook a delay rather than a locked door.
  //
  // It is safe to do here and nowhere else: this whole function runs
  // after the browser has already been answered, so however long
  // Gumroad takes, it cannot show through as a difference between an
  // address that is known and one that is not.
  if (!member && env.GUMROAD_TOKEN) {
    if ((await reconcile(env, email)) === true) {
      member = await findMember(env, email);
    }
  }

  // The same safety net for the other shop, asked second and for the
  // same reason. Somebody who has just paid through Stripe is sent
  // straight back to this page, and may well ask for a code before
  // Stripe's own message about the sale has arrived. A throw in here
  // is swallowed: it must never be the reason no code went out to
  // somebody the list already knows.
  if (!member && env.STRIPE_SECRET_KEY) {
    try {
      if ((await reconcileStripe(env, email)) === true) {
        member = await findMember(env, email);
      }
    } catch (e) {
      /* could not tell; they can ask again in a moment */
    }
  }

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
  if (!who) return json({ ok: false }, 401);

  // Still on the list? A session is good for thirty days, so without
  // this, taking somebody off the guest list would only stop them being
  // sent NEW codes — they would go on walking in until their cookie ran
  // out. The page asks this on every load, so a removal takes hold the
  // next time they open it.
  //
  // Asked here and not on every file: this runs once per page load,
  // where a check on each track would sit in the middle of seeking.
  // The gap that leaves is small and worth naming — somebody removed
  // while the page is already open keeps playing until they reload. To
  // end every session everywhere at once, change SESSION_SECRET.
  //
  // It fails OPEN, like the brake does. If D1 cannot be reached, a
  // listener is left alone rather than thrown out of an album they paid
  // for because a database had a bad minute.
  try {
    if (env.MEMBERS && !(await findMember(env, who))) {
      return json({ ok: false }, 401);
    }
  } catch (e) {
    /* leave them be */
  }

  return json({ ok: true }, 200);
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
   where they came from ('manual', 'gumroad' or 'stripe'), when they
   were added, and when they last signed in. Its shape is in cloudflare/vault-schema.sql.

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
   Gumroad

   Somebody buys early access; their address joins the guest list on its
   own. They refund it, or charge it back; it leaves again.

   A GUMROAD PING IS TREATED AS A RUMOUR, NOT AS NEWS. It arrives
   unsigned — there is no way to tell from the message itself that
   Gumroad sent it — so nothing in it is believed. The long random word
   in the address is only a doorbell: it stops strangers ringing, but
   anybody who ever learned it could ring too. All a ping does is name
   an address worth asking about. The answer comes from Gumroad's own
   API, over a connection this worker opened itself, with Eric's token.

   ONE HANDLER FOR EVERY EVENT, and it does not care which it was. Sale,
   refund, dispute, dispute won, cancellation — each means the same
   thing: "something changed for this address, go and look." reconcile()
   asks the API what is true now and makes the list agree. That is why
   it cannot get out of step, and why an event arriving twice, out of
   order, or not at all does no harm.

   IT FAILS SAFE, NOT OPEN. If Gumroad cannot be reached, reconcile()
   answers "don't know" and changes nothing. Taking away access somebody
   paid for, because an API had a bad minute, is the one outcome here
   worth going out of the way to prevent.

   AND IT ASKS TO BE TOLD AGAIN WHEN IT COULD NOT FINISH. The lookup is
   done before Gumroad is answered. If it could not be completed, or if
   Gumroad's records do not yet show what the ping is about, the answer
   is a 503, which Gumroad retries at one, three and ten minutes. So a
   bad moment costs a minute's delay rather than a buyer missing from
   the list. See handleGumroad.

   AND IT NEVER OVERRULES ERIC. Only rows whose source is 'gumroad' are
   ever removed. Somebody he added by hand stays added, whatever Gumroad
   says about them — a comped listener may well have no sale at all.
   --------------------------------------------------------------------- */

async function handleGumroad(request, env, ctx, tail) {
  if (request.method !== 'POST') return notFound();
  if (!env.GUMROAD_PING_SECRET || !env.MEMBERS) return notFound();

  // The doorbell. Compared whole, at constant time, so the address
  // cannot be felt out one character at a time.
  const given = tail.split('/')[0];
  if (!timingSafeEqual(bytes(given), bytes(env.GUMROAD_PING_SECRET))) {
    return notFound();
  }

  // Gumroad posts a form, not JSON.
  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return json({ ok: true }, 200);
  }

  const email = normalizeEmail(form.get('email') || '');

  // Nothing to look up, so nothing to ask again about. Gumroad retries
  // certain answers, and a queue of retries is not worth earning over a
  // ping with no usable address in it.
  if (!email) return json({ ok: true }, 200);

  // THE LOOKING-UP NOW HAPPENS BEFORE THE ANSWER, and the answer says
  // whether it worked. Until 5 October 2026 this replied 200 at once
  // and then tried a single time in the background: if that one try
  // failed — Gumroad's API having a bad moment, the guest list refusing
  // a write — the buyer was not added, nothing recorded it, and Gumroad
  // never sent the ping again, because it had been told "got it". A
  // real sale went missing from the list that way on 5 October.
  //
  // The attempt is kept alive with waitUntil whatever happens to the
  // reply, so running out of patience below does not abandon it. A
  // throw in it counts as "could not tell", the same as a null.
  const attempt = reconcile(env, email).then(
    (live) => live,
    () => null
  );
  ctx.waitUntil(attempt);

  const settled = await Promise.race([
    attempt.then((live) => ({ live })),
    sleep(PING_PATIENCE_MS).then(() => null),
  ]);

  // Still working when patience ran out, or could not find out at all.
  // Ask to be told again; by then the answer will be there to give.
  if (!settled || settled.live === null) return tryAgainLater();

  // It worked, and what the ping was about agrees with what Gumroad's
  // own records now say — or the ping made no claim worth checking.
  const claimed = pingClaims(env, form);
  if (claimed === null || claimed === settled.live) {
    return json({ ok: true }, 200);
  }

  // The ping says one thing and the records say another: a sale that
  // is not listed yet, or a refund that has not landed. The records
  // are what was acted on — the ping is still only a rumour, and
  // nothing in it was written anywhere. All its disagreement earns is
  // being asked again in a minute, when the two have had time to agree.
  return tryAgainLater();
}

// How long a ping's lookup may take before Gumroad is simply asked to
// send it again. Gumroad hangs up after five seconds; this leaves room
// to answer properly before it does.
const PING_PATIENCE_MS = 3500;

// 503 is one of the handful of answers Gumroad retries — at one, three
// and ten minutes. Most others (a 403, a 404) it drops on the spot.
function tryAgainLater() {
  return json({ ok: false, again: true }, 503);
}

/* What a ping says has happened, as a hint and nothing more: true for
   "this address should have a live sale", false for "it should not",
   and null for "this ping gives no reason to expect either".

   It is used for ONE thing — deciding whether to ask Gumroad to send
   the ping again when its own records disagree. It never decides who
   is on the guest list; reconcile() does that, from records fetched
   over a connection this worker opened itself.

   Null matters as much as the other two. Gumroad pings this address
   for EVERY sale on Eric's account, whatever the product, and a sale
   of something else leaves this vault's answer at "no live sale" for
   good. Asking again about those would earn three pointless retries
   per sale, for ever. The same goes for Gumroad's own test pings and
   for Eric buying his own product. */
function pingClaims(env, form) {
  const said = (name) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };

  if (said('test') === 'true') return null;

  const wanted = env.GUMROAD_PRODUCT;
  const ours =
    sameProduct(wanted, said('product_permalink'), said('product_id'), said('short_product_id')) ||
    sameProduct(wanted, said('permalink'), '', '');
  if (!ours) return null;

  const refunded = said('refunded') === 'true';
  // A dispute that Eric won leaves the sale standing.
  const disputed = said('disputed') === 'true' && said('dispute_won') !== 'true';

  return !(refunded || disputed);
}

/* Is this the product that grants access? Eric may have set either the
   permalink out of the shop address or the product's id, and both are
   matched, so neither is a wrong answer to give. One function, because
   the sales lookup, the admin page's check and the ping all ask it and
   must never disagree. */
function sameProduct(wanted, permalinkOrUrl, productId, shortId) {
  const want = String(wanted || '').trim().toLowerCase();
  if (!want) return false;

  const permalink = String(permalinkOrUrl || '').toLowerCase();
  const id = String(productId || '').toLowerCase();
  const short = String(shortId || '').toLowerCase();

  return (
    permalink === want ||
    id === want ||
    short === want ||
    permalink.endsWith('/' + want)
  );
}

/* Asks Gumroad what is true for one address and makes the guest list
   agree with it. Returns true if they should be in, false if they
   should not, and null if Gumroad could not be asked — in which case
   nothing is touched. */
async function reconcile(env, email) {
  const live = await hasLiveSale(env, email);
  if (live === null) return null;

  if (live) {
    await env.MEMBERS.prepare(
      'INSERT INTO members (email, source, added_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(email) DO NOTHING'
    )
      .bind(email, 'gumroad', new Date().toISOString().replace(/\.\d+Z$/, 'Z'))
      .run();
    return true;
  }

  // Note the source test. A refund takes away what Gumroad gave; it
  // does not take away what Eric gave.
  await env.MEMBERS.batch([
    env.MEMBERS.prepare(
      "DELETE FROM members WHERE email = ? AND source = 'gumroad'"
    ).bind(email),
    env.MEMBERS.prepare('DELETE FROM codes WHERE email = ?').bind(email),
  ]);

  return false;
}

/* true / false / null, where null means "could not tell". Looks for at
   least one sale of the right product, to this address, that has not
   been refunded, disputed or charged back. */
async function hasLiveSale(env, email) {
  if (!env.GUMROAD_TOKEN || !env.GUMROAD_PRODUCT) return null;

  // The token goes in the query string because that is what Gumroad's
  // own documentation specifies. It never leaves this worker except to
  // Gumroad, over https, and is never written to a log.
  const url = new URL('https://api.gumroad.com/v2/sales');
  url.searchParams.set('access_token', env.GUMROAD_TOKEN);
  url.searchParams.set('email', email);

  let sales;
  try {
    const reply = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });
    if (!reply.ok) return null;
    const data = await reply.json();
    if (!data || data.success === false || !Array.isArray(data.sales)) return null;
    sales = data.sales;
  } catch (e) {
    return null;
  }

  return sales.some((sale) => {
    if (normalizeEmail(sale.email || '') !== email) return false;

    const mine = sameProduct(
      env.GUMROAD_PRODUCT,
      sale.product_permalink,
      sale.product_id,
      sale.short_product_id
    );
    if (!mine) return false;

    // Gumroad's sales API spells it `chargedback`. This looked for
    // `chargebacked` until 5 October 2026, a name it uses elsewhere but
    // not here, so the test never fired. No harm came of it: a
    // chargeback also sets `disputed`, which the next line has always
    // caught. Both spellings are kept, since the old one costs nothing.
    if (sale.refunded === true) return false;
    if (sale.chargedback === true || sale.chargebacked === true) return false;
    // A dispute that Eric won leaves the sale standing.
    if (sale.disputed === true && sale.dispute_won !== true) return false;
    if (revoked(sale)) return false;

    return true;
  });
}

/* Revoking access is a SEPARATE act from refunding — Gumroad will not
   even let you revoke a fully refunded purchase — and it is what Eric
   reaches for when somebody is passing the album around. It plainly
   ought to shut the vault too.

   Three spellings are checked because Gumroad's API reference does not
   document this field, and a name guessed wrongly would fail in
   silence. Asking `=== true` for a field that does not exist is simply
   false, so the wrong guesses cost nothing — and the admin page's
   check prints the raw sale beside this, which is how the right name
   gets confirmed rather than assumed. */
function revoked(sale) {
  // true or the string "true", and nothing else. Not merely truthy:
  // the string "false" is truthy, and reading that as "revoked" would
  // throw out somebody who paid — the one mistake this whole file is
  // arranged to avoid.
  const yes = (v) => v === true || v === 'true';

  return yes(sale.is_access_revoked) || yes(sale.access_revoked) || yes(sale.revoked);
}

/* Asks Gumroad what it knows about one address and reports back
   without judging — every sale it returns, what product each was for,
   and whether this worker would count it. For finding out WHY somebody
   who bought the album did not land on the guest list, which is
   otherwise invisible: the lookup happens after the browser has been
   answered, so there is nothing to watch.

   The thing it most often catches: Gumroad's sales API reports a
   product's ORIGINAL perma id, not the custom permalink in the shop
   address. So GUMROAD_PRODUCT set to the pretty name out of the URL can
   silently match nothing. When no sale is found for the address, the
   most recent sales are listed instead, so the identifiers Eric's
   products actually use are there to read. */
async function gumroadLookup(env, email) {
  if (!env.GUMROAD_TOKEN) {
    return { ok: false, why: 'No GUMROAD_TOKEN is set.' };
  }

  const wanted = String(env.GUMROAD_PRODUCT || '').trim().toLowerCase();

  const ask = async (extra) => {
    const url = new URL('https://api.gumroad.com/v2/sales');
    url.searchParams.set('access_token', env.GUMROAD_TOKEN);
    for (const [k, v] of Object.entries(extra || {})) url.searchParams.set(k, v);
    const reply = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (!reply.ok) throw new Error('Gumroad answered ' + reply.status);
    const data = await reply.json();
    if (!data || data.success === false) throw new Error('Gumroad refused the token.');
    return Array.isArray(data.sales) ? data.sales : [];
  };

  const describe = (sale) => {
    const matches = sameProduct(
      wanted,
      sale.product_permalink,
      sale.product_id,
      sale.short_product_id
    );

    let verdict;
    if (!matches) verdict = 'a different product — this is why it was ignored';
    else if (sale.refunded === true) verdict = 'refunded';
    else if (sale.chargedback === true || sale.chargebacked === true) verdict = 'charged back';
    else if (sale.disputed === true && sale.dispute_won !== true) verdict = 'disputed';
    else if (revoked(sale)) verdict = 'access revoked';
    else verdict = 'counts — this one grants access';

    return {
      email: sale.email || null,
      product_permalink: sale.product_permalink || null,
      product_id: sale.product_id || null,
      short_product_id: sale.short_product_id || null,
      product_name: sale.product_name || null,
      price: sale.price,
      created: sale.created_at || sale.sale_timestamp || null,
      matches,
      verdict,
      // Everything Gumroad said about this sale, so a field this worker
      // does not know to look at can still be seen. The API reference
      // is incomplete — `is_access_revoked` is not in it — and reading
      // the real answer beats guessing at one. Only on sales looked up
      // by address, never on the recent-sales list, which is other
      // people's.
      raw: sale,
    };
  };

  try {
    const mine = (await ask({ email })).filter(
      (s) => normalizeEmail(s.email || '') === email
    );

    if (mine.length) {
      return { ok: true, wanted, found: mine.map(describe), recent: [] };
    }

    // Nothing for that address. Show what IS there, so the identifiers
    // can be compared by eye.
    const recent = (await ask({})).slice(0, 10).map((sale) => {
      const seen = describe(sale);
      const at = String(sale.email || '');
      seen.email = at ? at.slice(0, 2) + '…' + at.slice(at.indexOf('@')) : null;
      delete seen.raw;      // other people's sales; the identifiers suffice
      return seen;
    });

    return { ok: true, wanted, found: [], recent };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}

/* The four events Gumroad will only send if asked. The Ping setting in
   Eric's account covers sales; these cover a sale coming undone. They
   are registered from the admin page rather than a terminal, and
   registering the same one twice is harmless. */
const GUMROAD_EVENTS = ['refund', 'dispute', 'dispute_won', 'cancellation'];

function gumroadPingUrl(env) {
  return 'https://graymanmusical.com/vault-api/gumroad/' + env.GUMROAD_PING_SECRET;
}

async function gumroadSubscribe(env) {
  if (!env.GUMROAD_TOKEN || !env.GUMROAD_PING_SECRET) {
    return { ok: false, why: 'The Gumroad token or ping secret is not set.' };
  }

  const done = [];
  const failed = [];

  for (const name of GUMROAD_EVENTS) {
    const body = new URLSearchParams({
      access_token: env.GUMROAD_TOKEN,
      resource_name: name,
      post_url: gumroadPingUrl(env),
    });

    try {
      const reply = await fetch('https://api.gumroad.com/v2/resource_subscriptions', {
        method: 'PUT',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await reply.json().catch(() => ({}));
      if (reply.ok && data.success !== false) done.push(name);
      else failed.push(name + ' (' + reply.status + ')');
    } catch (e) {
      failed.push(name + ' (unreachable)');
    }
  }

  return { ok: !failed.length, done, failed };
}

async function gumroadStatus(env) {
  const set = {
    token: !!env.GUMROAD_TOKEN,
    product: env.GUMROAD_PRODUCT || null,
    secret: !!env.GUMROAD_PING_SECRET,
  };

  if (!set.token) return { ok: true, set, watching: [] };

  const watching = [];
  for (const name of GUMROAD_EVENTS) {
    try {
      const url = new URL('https://api.gumroad.com/v2/resource_subscriptions');
      url.searchParams.set('access_token', env.GUMROAD_TOKEN);
      url.searchParams.set('resource_name', name);
      const reply = await fetch(url.toString());
      const data = await reply.json().catch(() => ({}));
      const list = Array.isArray(data.resource_subscriptions)
        ? data.resource_subscriptions
        : [];
      if (list.some((s) => s.post_url === gumroadPingUrl(env))) watching.push(name);
    } catch (e) {
      /* leave it out of the list */
    }
  }

  return { ok: true, set, watching, ping: set.secret ? gumroadPingUrl(env) : null };
}

/* ---------------------------------------------------------------------
   Stripe

   A second shop beside Gumroad, held to the same rules. Somebody pays
   through a Stripe Payment Link; their address joins the guest list
   tagged 'stripe'. A full refund or a lost dispute takes it off again.
   Nothing about Gumroad above is changed by any of this.

   STRIPE HOSTS THE PAYMENT. There are no card fields on the site, no
   Stripe script on it, and no route here that makes a checkout — so no
   card detail ever comes near this file, and there is no price or
   product for a visitor to tamper with.

   A STRIPE MESSAGE IS SIGNED, WHICH A GUMROAD PING IS NOT — and it is
   still not believed. The signature proves Stripe sent it; nothing
   more is taken from it than the id of the receipt or payment it is
   about. That receipt is then fetched from Stripe over a connection
   this worker opened itself, and the address, the product and whether
   the money is still there are all read from THAT. reconcileStripe()
   asks what is true now and makes the list agree, so a message
   arriving twice, late, or out of order does no harm.

   IT FAILS SAFE. stripeLive() answers true, false, or null for "could
   not tell", and null changes nothing — nobody is added on a guess and
   nobody is removed because an API had a bad minute.

   IT ANSWERS HONESTLY, so Stripe re-sends when it should. 200 only
   once the list agrees with Stripe's records, or the message was
   rightly ignored (another product, an event this file does not act
   on). 503 when it could not find out or the list refused a write;
   Stripe then tries again, for up to three days.

   IT NEVER OVERRULES ERIC OR GUMROAD. Only rows whose source is
   'stripe' are ever removed, and not even those while Gumroad still
   shows a live sale for the same address — see reconcileStripe.

   NOTHING ABOUT A BUYER IS KEPT BUT THE ADDRESS. No name, no postal
   address, no amount and no card detail is written anywhere, and
   nothing is logged. The answer to Stripe is a status and no body.
   --------------------------------------------------------------------- */

const STRIPE_API = 'https://api.stripe.com/v1/';

// Pinned, so the fields read below keep their names whatever Eric's
// account default moves on to. Stripe's current version on 6 October
// 2026, when this was written.
const STRIPE_VERSION = '2026-09-30.endive';

// Not a secret — the secret is the signature on what arrives there.
const STRIPE_WEBHOOK_URL = 'https://graymanmusical.com/vault-api/stripe/webhook';

// The six events to tick on the webhook endpoint, and the only six this
// file acts on. Anything else that arrives signed is heard and ignored.
const STRIPE_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
];

// A message older than this is refused even with a good signature, so
// one that was overheard cannot be played back later.
const STRIPE_TOLERANCE_S = 5 * 60;

// Stripe's messages are a few kilobytes. Anything vastly larger is not
// one, and is turned away before any work is spent on it.
const STRIPE_BODY_LIMIT = 512 * 1024;

// How long a message's lookup may take before Stripe is simply asked to
// send it again. The attempt itself carries on regardless.
const STRIPE_PATIENCE_MS = 8000;

// What a dispute's status means for the sale it is about. An INQUIRY —
// the three "warning" statuses — is a bank asking a question; no money
// has moved, and most never become a dispute, so access stays. A status
// in neither list is one this file has not met, and is "could not tell".
const STRIPE_DISPUTE_AGAINST = ['needs_response', 'under_review', 'lost'];
const STRIPE_DISPUTE_STANDS = [
  'won',
  'prevented',
  'warning_closed',
  'warning_needs_response',
  'warning_under_review',
];

async function handleStripe(request, env, ctx) {
  if (request.method !== 'POST') return notFound();
  if (!env.STRIPE_WEBHOOK_SECRET || !env.MEMBERS) return notFound();

  const header = request.headers.get('stripe-signature') || '';
  if (!header) return notFound();
  if (Number(request.headers.get('content-length') || 0) > STRIPE_BODY_LIMIT) {
    return notFound();
  }

  // Read ONCE, as text, before anything parses it. The signature is
  // over these exact characters; a body that has been through a JSON
  // parser and back is a different string and would never verify.
  let raw;
  try {
    raw = await request.text();
  } catch (e) {
    return notFound();
  }
  if (raw.length > STRIPE_BODY_LIMIT) return notFound();

  // Unsigned, wrongly signed, tampered with or stale: the same blank
  // 404 the Gumroad doorbell gives, and the same one a stranger gets
  // for any address here. Nothing has been looked at but the signature.
  if (!(await stripeSigned(raw, header, env.STRIPE_WEBHOOK_SECRET))) {
    return notFound();
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch (e) {
    return stripeHeard();
  }

  const type = event && typeof event.type === 'string' ? event.type : '';
  const about = event && event.data ? event.data.object : null;

  // Signed, but not one of the six. Heard, and nothing else — saying
  // anything but 200 would only earn three days of the same message.
  if (!STRIPE_EVENTS.includes(type) || !about || typeof about !== 'object') {
    return stripeHeard();
  }

  // The same shape as the Gumroad doorbell: the work is done BEFORE the
  // answer, the answer says whether it worked, and the attempt is kept
  // alive with waitUntil so running out of patience does not abandon
  // it. A throw — the guest list refusing a write — counts as "could
  // not tell", the same as a null.
  const attempt = stripeEvent(env, type, about).then(
    (done) => done,
    () => null
  );
  ctx.waitUntil(attempt);

  const settled = await Promise.race([
    attempt.then((done) => ({ done })),
    sleep(STRIPE_PATIENCE_MS).then(() => null),
  ]);

  if (!settled || settled.done === null) return stripeAgain();
  return stripeHeard();
}

// A status and nothing else, either way.
function stripeHeard() {
  return new Response(null, { status: 200 });
}

function stripeAgain() {
  return new Response(null, { status: 503 });
}

/* Is this message Stripe's? The header reads  t=<seconds>,v1=<hex>,…
   and may carry more than one v1 while a signing secret is being
   rolled. The expected signature is HMAC-SHA256, keyed with the
   endpoint's signing secret, over the timestamp, a full stop, and the
   body exactly as it arrived.

   Every v1 offered is compared, each at constant time and with no
   early way out, so neither which one matched nor how nearly can be
   felt from outside. */
async function stripeSigned(raw, header, secret) {
  let stamp = '';
  const offered = [];

  for (const piece of String(header).split(',')) {
    const at = piece.indexOf('=');
    if (at < 0) continue;
    const name = piece.slice(0, at).trim();
    const value = piece.slice(at + 1).trim();
    if (name === 't') stamp = value;
    else if (name === 'v1') offered.push(value.toLowerCase());
  }

  if (!/^\d{1,12}$/.test(stamp) || !offered.length) return false;

  // Too old, or dated in a future that has not happened. Checked
  // against this worker's own clock, never against anything sent.
  const age = Math.floor(Date.now() / 1000) - Number(stamp);
  if (Math.abs(age) > STRIPE_TOLERANCE_S) return false;

  const expected = bytes(await hmacHex(stamp + '.' + raw, secret));

  let good = false;
  for (const one of offered) {
    if (timingSafeEqual(bytes(one), expected)) good = true;
  }
  return good;
}

/* Acts on one verified event. Answers true for "finished" — the list
   now agrees with Stripe's records, or this was rightly none of the
   vault's business — and null for "could not tell", which earns a 503
   and another delivery.

   All that is taken from the event is an id. A checkout event names
   its receipt; a refund or a dispute names a payment, and the receipt
   that payment belongs to is asked for. */
async function stripeEvent(env, type, about) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRODUCT) return null;

  let session;

  if (type.indexOf('checkout.session.') === 0) {
    const id = stripeId(about.id);
    if (!id) return true;
    session = await stripeSessionById(env, id);
  } else {
    let intent = stripeId(stripeRef(about.payment_intent));

    // A dispute always names its charge and does not always name the
    // payment, so the charge is asked which payment it was.
    if (!intent) {
      const charge = stripeId(stripeRef(about.charge));
      if (!charge) return true;
      const got = await stripeAsk(env, 'charges/' + charge, []);
      if (!got.ok) return null;
      intent = stripeId(stripeRef(got.data.payment_intent));
    }

    // Money that did not come through a checkout page at all — an
    // invoice, something keyed in by hand. Not this vault's.
    if (!intent) return true;

    session = await stripeSessionForPayment(env, intent);
    if (session === false) return true;
  }

  if (!session) return null;

  // Stripe sends this address every sale on Eric's account. One for
  // anything else is heard and left alone: a 200 and nothing more.
  const ours = await stripeOurs(env, session);
  if (ours === null) return null;
  if (!ours) return true;

  const email = normalizeEmail(stripeEmail(session));
  if (!email) return true;

  const live = await reconcileStripe(env, email, session);
  return live === null ? null : true;
}

/* Asks Stripe what is true for one address and makes the guest list
   agree. Returns true if Stripe shows a live sale, false if it does
   not, and null if that could not be found out — in which case
   nothing is touched.

   SOMEBODY MAY HAVE BOUGHT IN BOTH SHOPS, and a row has only one
   source. Two rules keep a refund in one from costing them the other,
   and both live here so that nothing of Gumroad's had to change:

   1. A live Stripe sale for a row tagged 'gumroad' re-tags it
      'stripe'. Gumroad's own refund only ever removes 'gumroad' rows,
      so from then on it cannot remove this one.

   2. Before a 'stripe' row is removed, Gumroad is asked. A live sale
      there keeps the row and tags it 'gumroad' again. If Gumroad
      cannot be asked, nothing changes and the answer is null — Stripe
      re-sends, and the question is put again.

   A 'manual' row is never touched by either rule. */
async function reconcileStripe(env, email, known) {
  const live = await stripeLive(env, email, known);
  if (live === null) return null;

  if (live) {
    await env.MEMBERS.prepare(
      'INSERT INTO members (email, source, added_at) VALUES (?, ?, ?) ' +
        "ON CONFLICT(email) DO UPDATE SET source = 'stripe' " +
        "WHERE members.source = 'gumroad'"
    )
      .bind(email, 'stripe', new Date().toISOString().replace(/\.\d+Z$/, 'Z'))
      .run();
    return true;
  }

  // No live sale at Stripe. That only matters to a row Stripe put there.
  const row = await findMember(env, email);
  if (!row || row.source !== 'stripe') return false;

  if (env.GUMROAD_TOKEN && env.GUMROAD_PRODUCT) {
    const elsewhere = await hasLiveSale(env, email);
    if (elsewhere === null) return null;

    if (elsewhere) {
      await env.MEMBERS.prepare(
        "UPDATE members SET source = 'gumroad' WHERE email = ? AND source = 'stripe'"
      )
        .bind(email)
        .run();
      return false;
    }
  }

  // Note the source test, the same one Gumroad's removal carries.
  await env.MEMBERS.batch([
    env.MEMBERS.prepare(
      "DELETE FROM members WHERE email = ? AND source = 'stripe'"
    ).bind(email),
    env.MEMBERS.prepare('DELETE FROM codes WHERE email = ?').bind(email),
  ]);

  return false;
}

/* true / false / null, as hasLiveSale answers for Gumroad. Looks for
   at least one receipt for the right product, to this address, that
   was paid and has not been fully refunded or lost to a dispute.

   `known` is a receipt already in hand — the one a message was about.
   It is judged alongside whatever the search by address returns, so
   the sale that rang the bell is always among those looked at, however
   Stripe's search treats the spelling of an address. */
async function stripeLive(env, email, known) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRODUCT) return null;

  const found = await stripeSessionsFor(env, email, false);
  if (!found) return null;

  const receipts = found.sessions.slice();
  if (known && !receipts.some((one) => one && one.id === known.id)) {
    receipts.push(known);
  }

  // More receipts than one page holds, for a single address, is not
  // something a real buyer does. If it ever happens and none of those
  // seen counts, the honest answer is "could not tell", not "no".
  let unsure = !found.all;

  for (const session of receipts) {
    if (!session || normalizeEmail(stripeEmail(session)) !== email) continue;

    const seen = await stripeJudge(env, session);
    if (seen.counts === true) return true;
    if (seen.counts === null) unsure = true;
  }

  return unsure ? null : false;
}

/* What one receipt is worth: { counts, why, refund, disputes }, where
   counts is true, false, or null for "could not tell". The sales
   lookup and the admin page's check both ask this, so they can never
   disagree about a receipt. */
async function stripeJudge(env, session) {
  const seen = { counts: false, why: '', refund: 'none', disputes: [] };
  const unsure = (why) => {
    seen.counts = null;
    seen.why = 'could not be judged — ' + why;
    return seen;
  };

  const ours = await stripeOurs(env, session);
  if (ours === null) return unsure('what was bought could not be read');
  if (!ours) {
    seen.why = 'a different product — this is why it was ignored';
    return seen;
  }

  if (session.status !== 'complete') {
    seen.why = session.status === 'expired'
      ? 'abandoned — the checkout page was left without paying'
      : 'still open — nobody has paid yet';
    return seen;
  }

  // The refund and dispute reading below is of a single payment. A
  // subscription has no single payment to read, so it is not counted
  // rather than counted for ever.
  if (session.mode !== 'payment') {
    seen.why = 'not a one-off payment';
    return seen;
  }

  // A code for 100% off: nothing was charged, so there is nothing that
  // can be refunded or disputed. It counts, as a free sale at Gumroad
  // does.
  if (session.payment_status === 'no_payment_required') {
    seen.counts = true;
    seen.why = 'counts — nothing was owed, so there is nothing to refund';
    return seen;
  }

  if (session.payment_status !== 'paid') {
    seen.why = 'not paid — a payment still on its way, or one that failed';
    return seen;
  }

  const charge = await stripeCharge(env, session);
  if (!charge) return unsure('Stripe did not hand over its payment');

  // `refunded` is true only when ALL of it has gone back. A part
  // refund leaves it false, and leaves the sale standing.
  if (charge.refunded === true) {
    seen.refund = 'full';
    seen.why = 'fully refunded';
    return seen;
  }
  if (Number(charge.amount_refunded) > 0) seen.refund = 'part';

  if (charge.disputed === true) {
    const id = stripeId(charge.id);
    const got = id
      ? await stripeAsk(env, 'disputes', [['charge', id], ['limit', '100']])
      : { ok: false };
    const list = got.ok && Array.isArray(got.data.data) ? got.data.data : null;

    if (!list || !list.length) {
      return unsure('it is marked disputed, but Stripe did not hand over the dispute');
    }

    seen.disputes = list.map((one) => String((one && one.status) || ''));

    const against = seen.disputes.filter((s) => STRIPE_DISPUTE_AGAINST.includes(s));
    if (against.length) {
      seen.why = against.includes('lost') ? 'dispute lost' : 'disputed, and not yet decided';
      return seen;
    }

    const strange = seen.disputes.filter((s) => !STRIPE_DISPUTE_STANDS.includes(s));
    if (strange.length) {
      return unsure('a dispute status this vault has not met: ' + strange.join(', '));
    }
  }

  seen.counts = true;
  seen.why = 'counts — this one grants access';
  if (seen.refund === 'part') seen.why += ' (partly refunded, which leaves it standing)';
  if (seen.disputes.includes('won')) seen.why += ' (a dispute, won)';
  else if (seen.disputes.length) seen.why += ' (a bank inquiry, not a dispute)';
  return seen;
}

/* Is this receipt for the thing that grants access? true, false, or
   null when what was bought could not be read at all — which must not
   be mistaken for "something else", or a real sale would be ignored in
   silence.

   STRIPE_PRODUCT may be the product's id (prod_…), a price's id
   (price_…) or the payment link's id (plink_…), and all three are
   matched, so none is a wrong answer to give. The product id is the
   one to prefer: it survives a change of price. One function, because
   the sales lookup, the webhook and the admin page's check all ask it
   and must never disagree. */
async function stripeOurs(env, session) {
  const want = String(env.STRIPE_PRODUCT || '').trim();
  if (!want || !session) return null;

  // Something that is not a Stripe id at all — the product's NAME,
  // say — can match nothing, and "nothing matched" would wave every
  // real sale past in silence, which is the trap GUMROAD_PRODUCT once
  // was. So it is "could not tell" instead: Stripe keeps re-sending,
  // its dashboard shows the deliveries failing, and a sale made in the
  // meantime arrives once the setting is put right.
  if (!/^(prod|price|plink)_/.test(want)) return null;

  if (stripeRef(session.payment_link) === want) return true;

  let items = session.line_items && Array.isArray(session.line_items.data)
    ? session.line_items.data
    : null;

  // Not sent along with the receipt, so it is asked for by itself.
  if (!items) {
    const id = stripeId(session.id);
    if (!id) return null;
    const got = await stripeAsk(env, 'checkout/sessions/' + id + '/line_items', [
      ['limit', '100'],
    ]);
    if (!got.ok || !Array.isArray(got.data.data)) return null;
    items = got.data.data;
  }

  return items.some((item) => {
    const price = item && item.price;
    if (!price || typeof price !== 'object') return false;
    return price.id === want || stripeRef(price.product) === want;
  });
}

/* The charge behind a paid receipt, or null if it could not be had.
   Normally it arrives folded into the receipt; if only its id did, it
   is fetched. */
async function stripeCharge(env, session) {
  let intent = session.payment_intent;

  if (typeof intent === 'string') {
    const id = stripeId(intent);
    if (!id) return null;
    const got = await stripeAsk(env, 'payment_intents/' + id, [
      ['expand[]', 'latest_charge'],
    ]);
    intent = got.ok ? got.data : null;
  }
  if (!intent || typeof intent !== 'object') return null;

  let charge = intent.latest_charge;

  if (typeof charge === 'string') {
    const id = stripeId(charge);
    if (!id) return null;
    const got = await stripeAsk(env, 'charges/' + id, []);
    charge = got.ok ? got.data : null;
  }

  return charge && typeof charge === 'object' && charge.object === 'charge'
    ? charge
    : null;
}

// What was bought and how it was paid, folded into the receipt so one
// question does the work of three.
function stripeExpand(prefix) {
  return [
    ['expand[]', prefix + 'line_items'],
    ['expand[]', prefix + 'payment_intent.latest_charge'],
  ];
}

// One receipt by its own id, or null if Stripe could not be asked.
async function stripeSessionById(env, id) {
  const got = await stripeAsk(env, 'checkout/sessions/' + id, stripeExpand(''));
  return got.ok && got.data.object === 'checkout.session' ? got.data : null;
}

// The receipt a payment belongs to: the receipt, false if it has none,
// or null if Stripe could not be asked.
async function stripeSessionForPayment(env, intent) {
  const got = await stripeAsk(
    env,
    'checkout/sessions',
    [['payment_intent', intent], ['limit', '1']].concat(stripeExpand('data.'))
  );
  if (!got.ok || !Array.isArray(got.data.data)) return null;
  return got.data.data[0] || false;
}

// Every receipt under one address — finished ones only, unless the
// admin page is asking and wants to see the abandoned ones too.
// Answers { sessions, all }, or null if Stripe could not be asked.
async function stripeSessionsFor(env, email, anyStatus) {
  const params = [['customer_details[email]', email], ['limit', '100']];
  if (!anyStatus) params.push(['status', 'complete']);

  const got = await stripeAsk(env, 'checkout/sessions', params.concat(stripeExpand('data.')));
  if (!got.ok || !Array.isArray(got.data.data)) return null;

  return { sessions: got.data.data, all: got.data.has_more !== true };
}

/* One question put to Stripe. Answers { ok, status, data } and never
   throws. `ok` means Stripe said yes AND sent something readable, so a
   caller that sees it can go straight to the data.

   The key travels in a header, never in the address, and goes nowhere
   but Stripe. It is not logged, and nothing Stripe says back about a
   refusal is passed on raw — see stripeWhy. */
async function stripeAsk(env, path, params) {
  if (!env.STRIPE_SECRET_KEY) return { ok: false, status: 0, data: null };

  const url = new URL(STRIPE_API + path);
  for (const [name, value] of params || []) url.searchParams.append(name, value);

  try {
    const reply = await fetch(url.toString(), {
      headers: {
        authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
        'stripe-version': STRIPE_VERSION,
        accept: 'application/json',
      },
    });

    let data = null;
    try {
      data = await reply.json();
    } catch (e) {
      data = null;
    }

    const readable = !!data && typeof data === 'object';
    return { ok: reply.ok && readable, status: reply.status, data: readable ? data : null };
  } catch (e) {
    return { ok: false, status: 0, data: null };
  }
}

// An id, whether Stripe handed over the bare id or the whole object.
function stripeRef(value) {
  if (typeof value === 'string') return value;
  return value && typeof value === 'object' && typeof value.id === 'string' ? value.id : '';
}

// An id fit to go into an address: letters, digits and underscores,
// which is all Stripe's ids are made of. Anything else is refused, so
// nothing in a message can steer a request somewhere it should not go.
function stripeId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_]{3,255}$/.test(value) ? value : '';
}

// The address a receipt was paid under, as Stripe spells it.
function stripeEmail(session) {
  const details = session && session.customer_details;
  const email = (details && details.email) || (session && session.customer_email) || '';
  return typeof email === 'string' ? email : '';
}

/* Why Stripe said no, in words that are safe to show. Its own message
   is NOT passed along: for a refused key it quotes part of the key
   back. Only the names of missing permissions are lifted out of it —
   they look like  rak_dispute_read  — along with Stripe's short code
   for the kind of refusal. */
function stripeWhy(got) {
  if (!got || got.status === 0) return 'Stripe could not be reached.';

  const error = got.data && got.data.error ? got.data.error : {};
  const said = typeof error.message === 'string' ? error.message : '';
  const missing = [];
  for (const name of said.match(/rak_[a-z0-9_]+/g) || []) {
    if (missing.indexOf(name) < 0) missing.push(name);
  }

  if (missing.length) {
    return 'The key is missing a permission: ' + missing.join(', ') + '.';
  }
  if (got.status === 401) return 'Stripe does not recognise the key.';
  if (got.status === 403) return 'The key is not allowed to read that.';

  const code = typeof error.code === 'string' && /^[a-z_]{1,60}$/.test(error.code)
    ? ' (' + error.code + ')'
    : '';
  return 'Stripe answered ' + got.status + code + '.';
}

/* What the admin page shows about Stripe: which of the three secrets
   are set — never what they are — whether the key is a test or a live
   one, and whether it can read what this file reads. */
async function stripeStatus(env) {
  const key = String(env.STRIPE_SECRET_KEY || '');
  const product = String(env.STRIPE_PRODUCT || '').trim();

  const out = {
    ok: true,
    set: { key: !!key, webhook: !!env.STRIPE_WEBHOOK_SECRET, product: !!product },
    // Read off the front of the key, which is all that is ever looked at.
    mode: !key ? null : /^(rk|sk)_test_/.test(key) ? 'test' : /^(rk|sk)_live_/.test(key) ? 'live' : 'unknown',
    kind: !key ? null : key.indexOf('rk_') === 0 ? 'restricted' : key.indexOf('sk_') === 0 ? 'full' : 'unknown',
    // What sort of id the product setting is, without showing it.
    names: !product ? null
      : product.indexOf('prod_') === 0 ? 'a product id'
      : product.indexOf('price_') === 0 ? 'a price id'
      : product.indexOf('plink_') === 0 ? 'a payment link id'
      : 'unrecognised',
    webhookUrl: STRIPE_WEBHOOK_URL,
    events: STRIPE_EVENTS,
    can: [],
  };

  if (!key) return out;

  // The same reads the webhook makes, so a missing permission shows up
  // here rather than as a sale that quietly never arrived.
  const reads = [
    ['receipts, with what was bought and how it was paid', 'checkout/sessions',
      [['limit', '1']].concat(stripeExpand('data.'))],
    ['disputes', 'disputes', [['limit', '1']]],
  ];

  for (const [what, path, params] of reads) {
    const got = await stripeAsk(env, path, params);
    out.can.push({ what, ok: got.ok, why: got.ok ? null : stripeWhy(got) });
  }

  return out;
}

/* Asks Stripe what it knows about one address and reports back without
   judging — every receipt it holds for it, what each was for, and
   whether this worker would count it. Stripe's twin of gumroadLookup.

   WHAT IS SHOWN IS CUT DOWN ON PURPOSE. A Stripe receipt carries a
   name, a postal address, an amount and the last digits of a card.
   None of that helps to find out why somebody did not get in, so none
   of it leaves this function: only the address that was asked about,
   the ids of what was bought, and the state of the payment.

   When nothing is found for the address, the most recent receipts are
   listed instead — with NO address on them at all — so the ids Eric's
   products actually use are there to compare with STRIPE_PRODUCT. */
async function stripeLookup(env, email) {
  if (!env.STRIPE_SECRET_KEY) {
    return { ok: false, why: 'No STRIPE_SECRET_KEY is set.' };
  }

  const bought = (session) => {
    const items = session.line_items && Array.isArray(session.line_items.data)
      ? session.line_items.data
      : [];
    return items.map((item) => ({
      product: stripeRef(item && item.price && item.price.product) || null,
      price: (item && item.price && item.price.id) || null,
    }));
  };

  const when = (session) => {
    const at = Number(session.created);
    return at > 0 ? new Date(at * 1000).toISOString().replace(/\.\d+Z$/, 'Z') : null;
  };

  const first = await stripeAsk(
    env,
    'checkout/sessions',
    [['customer_details[email]', email], ['limit', '100']].concat(stripeExpand('data.'))
  );
  if (!first.ok || !Array.isArray(first.data.data)) {
    return { ok: false, why: stripeWhy(first) };
  }

  const mine = first.data.data.filter(
    (session) => session && normalizeEmail(stripeEmail(session)) === email
  );

  if (mine.length) {
    const found = [];
    for (const session of mine) {
      const seen = await stripeJudge(env, session);
      found.push({
        receipt: session.id || null,
        email: stripeEmail(session) || null,
        created: when(session),
        checkout: session.status || null,
        payment: session.payment_status || null,
        bought: bought(session),
        payment_link: stripeRef(session.payment_link) || null,
        refund: seen.refund,
        disputes: seen.disputes,
        counts: seen.counts,
        verdict: seen.why,
      });
    }
    return { ok: true, set: !!String(env.STRIPE_PRODUCT || '').trim(), found, recent: [] };
  }

  // Nothing for that address. Show what IS there, so the ids can be
  // compared by eye. Other people's receipts: no address, no verdict
  // on their money — only what was bought.
  const lately = await stripeAsk(env, 'checkout/sessions', [
    ['status', 'complete'],
    ['limit', '10'],
    ['expand[]', 'data.line_items'],
  ]);
  if (!lately.ok || !Array.isArray(lately.data.data)) {
    return { ok: false, why: stripeWhy(lately) };
  }

  const recent = [];
  for (const session of lately.data.data) {
    if (!session) continue;
    recent.push({
      created: when(session),
      bought: bought(session),
      payment_link: stripeRef(session.payment_link) || null,
      matches: (await stripeOurs(env, session)) === true,
    });
  }

  return { ok: true, set: !!String(env.STRIPE_PRODUCT || '').trim(), found: [], recent };
}

/* ---------------------------------------------------------------------
   The admin page

   Eric's own view of the guest list: who is on it, where each came
   from, when they last signed in; a box to paste a batch of addresses
   into; a way to remove one; and a button that posts him a real code.

   TWO LOCKS, ON PURPOSE, AND THEY ARE INDEPENDENT.

   The first is Cloudflare Access, set up in the dashboard against
   graymanmusical.com/vault-api/admin* — it stops a request at the edge
   before this worker is even asked. The second is right here:
   requireAdmin() insists on a valid vault session whose subject is
   ADMIN_EMAIL, which means signing in with a code like anybody else.

   Why both. Access is configuration, and configuration can be edited,
   expire, or be set up against the wrong path — and if it ever lapsed,
   the first lock would silently be gone with nothing to say so. The
   second lock is in this file, cannot be switched off from a dashboard,
   and relies on nothing but a signature this worker made itself.

   NOTE WHAT IS NOT TRUSTED. Access announces who it let through in a
   Cf-Access-Authenticated-User-Email header, and it is tempting to read
   it. Nothing here does. A header is only as good as the thing in front
   of it: with Access off, or on a path it does not cover, anyone could
   send that header themselves and be believed. The session cookie
   cannot be forged, because verifying it needs SESSION_SECRET.

   The page's wording is hardcoded rather than in content.js. It is a
   tool of Eric's, like tools/lyric-timer.html — no visitor ever sees
   it, and it has to work with no site around it.
   --------------------------------------------------------------------- */

async function requireAdmin(request, env) {
  if (!env.ADMIN_EMAIL || !env.MEMBERS) return null;

  const who = await readSession(request, env);
  if (!who) return null;

  const allowed = normalizeEmail(env.ADMIN_EMAIL);
  return allowed && who === allowed ? who : null;
}

async function handleAdminPage(request, env) {
  if (request.method !== 'GET') return notFound();

  // Not a 403 and not a login prompt: the same blank 404 a stranger gets
  // for anything else here. There is no reason to tell anyone this page
  // exists.
  if (!(await requireAdmin(request, env))) return notFound();

  return new Response(ADMIN_PAGE, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      // It draws on nothing and talks to nowhere but itself.
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; " +
        "script-src 'unsafe-inline'; connect-src 'self'",
    },
  });
}

async function handleAdminApi(request, env, action) {
  const admin = await requireAdmin(request, env);
  if (!admin) return notFound();

  if (action === 'list' && request.method === 'GET') {
    const found = await env.MEMBERS.prepare(
      'SELECT email, source, added_at, last_login FROM members ' +
        'ORDER BY added_at DESC, email ASC'
    ).all();

    return json({ ok: true, you: admin, members: found.results || [] }, 200);
  }

  if (action === 'add' && request.method === 'POST') {
    const body = await readJson(request);
    return json(await addMembers(env, body.emails), 200);
  }

  if (action === 'remove' && request.method === 'POST') {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    if (!email) return json({ ok: false, why: 'Not an address.' }, 400);

    // Their own address would lock Eric out of this page.
    if (email === admin) {
      return json({ ok: false, why: 'That is you — removing it would lock you out.' }, 400);
    }

    await env.MEMBERS.batch([
      env.MEMBERS.prepare('DELETE FROM members WHERE email = ?').bind(email),
      env.MEMBERS.prepare('DELETE FROM codes WHERE email = ?').bind(email),
    ]);

    return json({ ok: true, removed: email }, 200);
  }

  if (action === 'gumroad' && request.method === 'GET') {
    return json(await gumroadStatus(env), 200);
  }

  if (action === 'gumroad-connect' && request.method === 'POST') {
    return json(await gumroadSubscribe(env), 200);
  }

  if (action === 'gumroad-check' && request.method === 'POST') {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    if (!email) return json({ ok: false, why: 'Not an address.' }, 400);
    return json(await gumroadLookup(env, email), 200);
  }

  // Having looked, put it right: ask Gumroad about the address again
  // and make the list agree. The same thing a ping would have caused,
  // by hand, for when one was missed or arrived before any of this
  // existed.
  if (action === 'gumroad-sync' && request.method === 'POST') {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    if (!email) return json({ ok: false, why: 'Not an address.' }, 400);
    const now = await reconcile(env, email);
    return json({ ok: true, email, live: now }, 200);
  }

  if (action === 'stripe' && request.method === 'GET') {
    return json(await stripeStatus(env), 200);
  }

  if (action === 'stripe-check' && request.method === 'POST') {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    if (!email) return json({ ok: false, why: 'Not an address.' }, 400);
    return json(await stripeLookup(env, email), 200);
  }

  // "Make the list match", for both shops at once — what the button on
  // the page presses now that there are two. The route above is left
  // exactly as it was.
  //
  // STRIPE IS ASKED FIRST, AND THE ORDER MATTERS. Gumroad's own
  // reconcile() removes a row tagged 'gumroad' the moment Gumroad shows
  // no live sale. If that person also bought through Stripe, asking
  // Stripe first re-tags the row 'stripe' before Gumroad's removal
  // looks at it, so they are never taken off and put back — which
  // would lose the date they were added and their last sign-in.
  //
  // For the same reason, if Stripe is set up and could not be asked,
  // nothing at all is done: Gumroad's half is not run on its own.
  if (action === 'match' && request.method === 'POST') {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    if (!email) return json({ ok: false, why: 'Not an address.' }, 400);

    const stripeOn = !!env.STRIPE_SECRET_KEY;

    try {
      let stripe = null;
      if (stripeOn) {
        stripe = await reconcileStripe(env, email);
        if (stripe === null) return json({ ok: true, email, stripeOn, held: true }, 200);
      }

      const gumroad = await reconcile(env, email);
      const row = await findMember(env, email);

      return json({
        ok: true,
        email,
        stripeOn,
        stripe,
        gumroad,
        listed: !!row,
        source: row ? row.source : null,
      }, 200);
    } catch (e) {
      return json({ ok: false }, 200);
    }
  }

  if (action === 'test-code' && request.method === 'POST') {
    // A real code by the real route, so this tests the thing itself
    // rather than a rehearsal of it.
    await postCode(env, admin);
    return json({ ok: true, sent: admin }, 200);
  }

  return notFound();
}

/* Pulls every address out of whatever was pasted in — one per line, a
   row of commas, a column out of a spreadsheet, or "Name <a@b.com>"
   straight from a mail client. Anything with an @ in it is a candidate;
   everything else in the text is passed over without comment, because
   a pasted list is full of names and headings and none of that is an
   error worth reporting.

   Already-known addresses are left exactly as they are — their source,
   the day they were added and their last sign-in all survive, which is
   what makes pasting the same list twice harmless. */
async function addMembers(env, text) {
  const raw = typeof text === 'string' ? text : '';
  // Nothing is required after the @, deliberately: "someone@" with the
  // domain missed off is picked up so it can be reported back as not an
  // address, rather than passed over in silence like the names and
  // headings around it. A token has to have something BEFORE the @
  // though, or every @handle in a pasted note becomes a complaint.
  const found = raw.match(/[^\s<>,;"]+@[^\s<>,;"]*/g) || [];

  const good = [];
  const rejected = [];
  const seen = new Set();

  for (const candidate of found) {
    const email = normalizeEmail(candidate.replace(/[.,;]+$/, ''));
    if (!email) {
      if (rejected.length < 20) rejected.push(candidate);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    good.push(email);
  }

  if (!good.length) return { ok: true, added: 0, already: 0, rejected };

  const before = await countMembers(env);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  await env.MEMBERS.batch(
    good.map((email) =>
      env.MEMBERS.prepare(
        'INSERT INTO members (email, source, added_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(email) DO NOTHING'
      ).bind(email, 'manual', now)
    )
  );

  const added = (await countMembers(env)) - before;

  return {
    ok: true,
    added,
    already: good.length - added,
    rejected,
  };
}

async function countMembers(env) {
  const row = await env.MEMBERS.prepare('SELECT count(*) AS n FROM members').first();
  return row ? row.n : 0;
}

// The page itself. Plain on purpose — it is a workbench, not a part of
// the show — but it borrows the site's paper and ink so it does not feel
// like somebody else's software. No fonts, no libraries, nothing loaded
// from anywhere: it has to work on its own.
const ADMIN_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>The guest list — The Gray Man</title>
<style>
  :root { --paper:#EDE8DD; --ink:#1B1A17; --soft:#35322C; --faint:#5C584E; --gray:#8B8579; --edge:#D3CCB8; }
  * { box-sizing: border-box; }
  body { margin:0; padding:2.5rem 1.25rem 6rem; background:var(--paper); color:var(--ink);
         font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
  main { max-width: 56rem; margin: 0 auto; }
  h1 { font-size:1.05rem; letter-spacing:.28em; text-transform:uppercase; font-weight:600; margin:0 0 .4rem; }
  .who { color:var(--faint); font-size:.85rem; margin:0 0 2.5rem; }
  h2 { font-size:.72rem; letter-spacing:.22em; text-transform:uppercase; color:var(--faint);
       font-weight:600; margin:2.75rem 0 .9rem; }
  textarea, input[type=email] { width:100%; padding:.8rem; background:#fff; color:var(--ink);
             border:1px solid var(--edge); border-radius:2px; font:inherit; font-size:.95rem; }
  textarea { min-height:7.5rem; resize:vertical; }
  input[type=email] { flex:1 1 16rem; width:auto; }
  button { font:inherit; font-size:.68rem; font-weight:600; letter-spacing:.2em; text-transform:uppercase;
           color:var(--ink); background:transparent; border:1px solid var(--ink);
           padding:.75rem 1.5rem; cursor:pointer; border-radius:2px; }
  button:hover:not(:disabled) { background:var(--ink); color:var(--paper); }
  button:disabled { color:var(--gray); border-color:var(--gray); cursor:default; }
  .row { display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin-top:1rem; }
  .said { font-size:.9rem; color:var(--soft); margin:1rem 0 0; min-height:1.4rem; }
  .said b { color: var(--ink); }
  table { width:100%; border-collapse:collapse; margin-top:.5rem; font-size:.9rem; }
  th { text-align:left; font-size:.62rem; letter-spacing:.18em; text-transform:uppercase;
       color:var(--faint); font-weight:600; padding:.6rem .7rem; border-bottom:1px solid var(--edge); }
  td { padding:.65rem .7rem; border-bottom:1px solid rgba(211,204,184,.6); vertical-align:middle; }
  /* Dates and their headings never break: "Sep 20," over "2026" reads as
     two facts rather than one. Only the address column is allowed to
     wrap, because some addresses genuinely are that long. */
  th, td.when { white-space:nowrap; }
  td.addr { font-weight:500; word-break:break-all; white-space:normal; }
  .tag { font-size:.6rem; letter-spacing:.14em; text-transform:uppercase; color:var(--faint);
         border:1px solid var(--edge); border-radius:2px; padding:.16rem .5rem; white-space:nowrap; }
  .never { color:var(--gray); }
  /* Big enough to hit without aiming. This page is used by one person
     who may well be reading it without his glasses on. */
  input[type=checkbox] { width:1.1rem; height:1.1rem; accent-color:var(--ink);
                         cursor:pointer; margin:0; vertical-align:middle; }
  th.pick, td.pick { width:1.1rem; padding-right:0; }
  .picked { display:flex; gap:1rem; align-items:center; flex-wrap:wrap;
            margin:.5rem 0 1rem; }
  .picked .said { margin:0; }
  #pickedOut { display:none; margin-top:.8rem; font-size:.85rem; }
  #pickedOut[data-open] { display:block; }
  .x { border:none; color:var(--gray); font-size:.62rem; padding:.35rem .5rem; letter-spacing:.14em; }
  .x:hover:not(:disabled) { background:transparent; color:var(--ink); text-decoration:underline; }
  /* Which order the list is in. Two quiet words rather than arrows on
     the column headings, because the Added column is hidden on a phone
     and its heading would go with it — leaving no way back. */
  .sort { display:flex; gap:.2rem; align-items:center; flex-wrap:wrap; margin:1.4rem 0 .1rem; }
  /* How many have signed in and how many never have, under the heading
     that says how many there are altogether. Its height is held open
     so the page does not jump when the list arrives. */
  .seen { font-size:.9rem; color:var(--soft); margin:-.35rem 0 1.1rem; min-height:1.4rem; }
  .seen b { color:var(--ink); }
  .sort__label { font-size:.62rem; letter-spacing:.18em; text-transform:uppercase;
                 color:var(--faint); font-weight:600; margin-right:.4rem; }
  .sort__by[aria-pressed=true] { color:var(--ink); text-decoration:underline;
                                 text-underline-offset:.3em; }
  .note { font-size:.82rem; color:var(--faint); margin:.6rem 0 0; }
  code { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:.82rem;
         background:#fff; border:1px solid var(--edge); border-radius:2px;
         padding:.1rem .35rem; word-break:break-all; }
  details { margin:.4rem 0 .6rem; }
  summary { cursor:pointer; font-size:.75rem; color:var(--faint); }
  pre { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:.72rem;
        background:#fff; border:1px solid var(--edge); border-radius:2px;
        padding:.7rem; overflow:auto; max-height:26rem; white-space:pre-wrap;
        word-break:break-word; margin:.4rem 0 0; }
  @media (max-width:620px) { .hide-narrow { display:none; } body { padding-top:1.5rem; } }
</style>
</head>
<body>
<main>
  <h1>The guest list</h1>
  <p class="who" id="who">&nbsp;</p>

  <h2>Add people</h2>
  <textarea id="paste" placeholder="Paste addresses here — one per line, separated by commas, or copied out of an email. Anything that isn't an address is ignored."></textarea>
  <div class="row">
    <button id="addBtn">Add these</button>
    <span class="said" id="addSaid"></span>
  </div>

  <h2>On the list — <span id="count">…</span></h2>
  <p class="seen" id="seenCount">&nbsp;</p>

  <div class="picked">
    <button id="copyBtn" disabled>Copy selected addresses</button>
    <span class="said" id="pickSaid"></span>
  </div>
  <p class="note"><b>Paste them into BCC, not To.</b> Addresses in the To line are
    shown to everybody who gets the message — your whole guest list, handed to all
    of it. BCC keeps each person's address to themselves. Tick the box at the top
    of the table to take the lot.</p>
  <textarea id="pickedOut" readonly rows="4"></textarea>

  <div class="sort" role="group" aria-label="Order of the list">
    <span class="sort__label">Sort by</span>
    <button class="x sort__by" id="sortAdded" aria-pressed="true">Date added</button>
    <button class="x sort__by" id="sortSeen" aria-pressed="false">Last signed in</button>
  </div>

  <table>
    <thead><tr>
      <th class="pick"><input type="checkbox" id="pickAll" aria-label="Select everybody"></th>
      <th>Email</th><th>Source</th><th class="hide-narrow">Added</th><th>Last signed in</th><th></th>
    </tr></thead>
    <tbody id="rows"><tr><td colspan="6" class="never">Reading the list…</td></tr></tbody>
  </table>
  <p class="note">Removing somebody stops any new code being sent to them. If they are
    signed in already, that session lasts until it runs out — to end every session at
    once, change SESSION_SECRET in the Cloudflare dashboard.</p>

  <h2>Gumroad</h2>
  <div id="gum" class="said">Asking Gumroad…</div>
  <div class="row">
    <button id="gumBtn">Watch refunds and disputes</button>
    <span class="said" id="gumSaid"></span>
  </div>
  <p class="note">Sales arrive through the Ping address in Gumroad under
    Settings &rarr; Advanced. The button above asks Gumroad to send the other
    four events to the same address, so a refund or a chargeback takes access
    away again. Pressing it twice does no harm. Anyone added by hand is never
    removed by Gumroad — only people who arrived through a purchase.</p>

  <h2>Stripe</h2>
  <div id="stripe" class="said">Asking Stripe…</div>
  <p class="note">Stripe tells this vault about a purchase, a refund or a dispute
    by posting a signed message to the webhook address above. The vault then asks
    Stripe itself what is true and makes the list agree. A full refund or a lost
    dispute takes access away; a part refund, or a dispute you win, leaves it.
    Stripe only ever removes people it added — never anyone added by hand, and
    never anyone who still has a live Gumroad purchase.</p>

  <h2>Why didn't somebody get in?</h2>
  <div class="row">
    <input id="checkWho" type="email" placeholder="their email address"
           autocapitalize="off" autocorrect="off" spellcheck="false">
    <button id="checkBtn">Ask Gumroad and Stripe</button>
    <button id="syncBtn" class="x" hidden>Make the list match</button>
  </div>
  <div class="said" id="checkSaid"></div>
  <p class="note">Asks Gumroad and Stripe what they know about that address and
    shows every sale each reports, whether or not this vault counts it. Use it
    when somebody says they bought the album but can't get in — or when you have
    revoked somebody and want to be sure it took. <b>The usual answer is the
    product:</b> Gumroad's API reports a product's original perma id, not the
    custom name in your shop address, so <code>GUMROAD_PRODUCT</code> may need to
    be the id shown below rather than the pretty name.</p>
  <p class="note"><b>Revoking access in Gumroad is not a refund</b>, and Gumroad
    does not send a message when you do it, so nothing here changes by itself.
    Revoke there, then come back and press <b>Make the list match</b>.
    If the sale still reads as counting afterwards, open <i>everything Gumroad
    said about it</i> and send me what is in there — the field that marks a
    revoked sale is not in Gumroad's own API reference.</p>
  <p class="note"><b>On Stripe the usual answer is the product too.</b>
    <code>STRIPE_PRODUCT</code> has to be one of the ids shown beside the receipt
    below. The one beginning <code>prod_</code> is the one to use, because it
    stays the same if you ever change the price. Test mode and live mode have
    different ids for everything, so it changes when the key does. What is shown
    about a Stripe receipt is cut down on purpose: no name, no postal address,
    no amount and no card.</p>

  <h2>Check the post</h2>
  <div class="row">
    <button id="testBtn">Send myself a code</button>
    <span class="said" id="testSaid"></span>
  </div>
</main>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };

  function ask(path, body) {
    return fetch('/vault-api/admin/' + path, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return null; });
  }

  function safe(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function day(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function busy(button, on, word) {
    button.disabled = on;
    if (on) { button.dataset.said = button.textContent; button.textContent = word; }
    else if (button.dataset.said) { button.textContent = button.dataset.said; }
  }

  var you = '';

  /* ------------------------------------------------------------------
     The order of the list.

     The worker sends it newest-added first, and that order is kept
     exactly as it arrived — sorting works on a copy, so "Date added"
     is always there to go back to.

     "Last signed in" puts the most recent sign-in at the top and
     everybody who has never signed in at the bottom. It sorts on the
     full moment, not the day shown in the table, so two people who
     signed in on the same day are still in the right order. Those who
     have never signed in keep the order they had, newest-added first.
     ------------------------------------------------------------------ */

  var members = [];
  var order = 'added';              // or 'seen'
  var ORDER_KEY = 'tgm_admin_order';

  try {
    if (window.localStorage.getItem(ORDER_KEY) === 'seen') order = 'seen';
  } catch (e) { /* private browsing; the default will do */ }

  function when(iso) {
    var t = iso ? Date.parse(iso) : NaN;
    return isNaN(t) ? null : t;
  }

  function inOrder() {
    if (order !== 'seen') return members;
    return members.slice().sort(function (a, b) {
      var x = when(a.last_login);
      var y = when(b.last_login);
      if (x !== null && y !== null) return y - x;
      if (x !== null) return -1;       // a has signed in, b never has
      if (y !== null) return 1;
      return 0;                        // neither has: leave them be
    });
  }

  // keepTicks is for a change of order only. Anything that changes who
  // is ON the list still clears the ticks, as it always has, so the box
  // at the top never speaks for a list it is no longer describing.
  function show(keepTicks) {
    var kept = keepTicks ? chosen() : [];

    draw(inOrder());

    if (kept.length) {
      picks().forEach(function (box) {
        if (kept.indexOf(box.getAttribute('data-email')) > -1) box.checked = true;
      });
      tally();
    }

    $('sortAdded').setAttribute('aria-pressed', order === 'added' ? 'true' : 'false');
    $('sortSeen').setAttribute('aria-pressed', order === 'seen' ? 'true' : 'false');
  }

  function setOrder(next) {
    if (order === next) return;
    order = next;
    try {
      window.localStorage.setItem(ORDER_KEY, order);
    } catch (e) { /* nothing to do */ }
    show(true);
  }

  $('sortAdded').addEventListener('click', function () { setOrder('added'); });
  $('sortSeen').addEventListener('click', function () { setOrder('seen'); });

  // How many have signed in, and how many never have. Counted by the
  // same test the table uses to print "never" — day() of the last
  // sign-in — so the two can never disagree about a row. The two
  // numbers always add up to the count in the heading above them.
  function countSeen(list) {
    var box = $('seenCount');
    if (!list.length) { box.innerHTML = '&nbsp;'; return; }

    var signedIn = list.filter(function (m) { return !!day(m.last_login); }).length;
    var never = list.length - signedIn;

    box.innerHTML =
      '<b>' + signedIn + '</b> ' + (signedIn === 1 ? 'has' : 'have') + ' signed in' +
      ' · <b>' + never + '</b> never ' + (never === 1 ? 'has' : 'have');
  }

  function draw(list) {
    $('count').textContent = list.length === 1 ? '1 person' : list.length + ' people';
    countSeen(list);
    if (!list.length) {
      $('rows').innerHTML = '<tr><td colspan="6" class="never">Nobody yet.</td></tr>';
      tally();
      return;
    }
    $('rows').innerHTML = list.map(function (m) {
      var seen = day(m.last_login);
      // Your own row gets no Remove button. The worker refuses to delete
      // it anyway — it would lock you out of this page — so offering the
      // button would only be a way of being told no.
      var last = (m.email === you)
        ? '<span class="never">you</span>'
        : '<button class="x" data-email="' + safe(m.email) + '">Remove</button>';
      // Your own row DOES get a tick box, unlike the Remove button —
      // there is nothing odd about sending yourself the announcement,
      // and it is the easiest way to see what everyone else got.
      return '<tr><td class="pick">' +
        '<input type="checkbox" class="pick" data-email="' + safe(m.email) +
        '" aria-label="Select ' + safe(m.email) + '"></td>' +
        '<td class="addr">' + safe(m.email) + '</td>' +
        '<td><span class="tag">' + safe(m.source) + '</span></td>' +
        '<td class="when hide-narrow">' + safe(day(m.added_at) || '') + '</td>' +
        '<td class="when">' + (seen ? safe(seen) : '<span class="never">never</span>') + '</td>' +
        '<td style="text-align:right">' + last + '</td></tr>';
    }).join('');
    // A redraw builds new boxes, so whatever was ticked is gone. Said
    // plainly by the count rather than left to be noticed.
    tally();
  }

  /* ------------------------------------------------------------------
     Picking addresses out of the list.

     This copies to the clipboard rather than opening a mail window. A
     mailto: link looked tempting and is a trap: addresses go into the
     URL, every browser and mail client caps how long that may be, and
     the ones that do not simply drop the overflow — so a long guest
     list would silently lose its tail, which is the worst way for this
     to fail. The clipboard has no such limit and the paste goes
     wherever he likes.
     ------------------------------------------------------------------ */

  function picks() {
    return [].slice.call(document.querySelectorAll('input.pick'));
  }

  function chosen() {
    return picks().filter(function (b) { return b.checked; })
      .map(function (b) { return b.getAttribute('data-email'); });
  }

  function tally() {
    var all = picks();
    var n = chosen().length;
    var head = $('pickAll');

    head.checked = n > 0 && n === all.length;
    // Half-ticked when only some are chosen, so the box at the top
    // never claims to speak for the whole list when it doesn't.
    head.indeterminate = n > 0 && n < all.length;
    head.disabled = all.length === 0;

    $('copyBtn').disabled = n === 0;
    $('pickSaid').textContent = n === 0 ? ''
      : (n === 1 ? '1 address selected' : n + ' addresses selected');

    if (n === 0) $('pickedOut').removeAttribute('data-open');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Older browsers, and any page the clipboard permission refuses.
    return new Promise(function (resolve, reject) {
      var box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.top = '-1000px';
      document.body.appendChild(box);
      box.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(box);
      if (ok) resolve(); else reject(new Error('no'));
    });
  }

  $('pickAll').addEventListener('change', function () {
    var on = this.checked;
    picks().forEach(function (b) { b.checked = on; });
    tally();
  });

  // Delegated, because the rows are rebuilt on every redraw.
  $('rows').addEventListener('change', function (e) {
    if (e.target && e.target.classList.contains('pick')) tally();
  });

  $('copyBtn').addEventListener('click', function () {
    var list = chosen();
    if (!list.length) return;

    // Commas, which is what every mail client expects in a BCC field.
    var text = list.join(', ');

    copyText(text).then(function () {
      $('pickSaid').innerHTML = '<b>' + list.length +
        '</b> copied — paste into BCC.';
    }).catch(function () {
      // The clipboard was refused. Hand them over on screen instead
      // rather than leaving him with a button that did nothing.
      var out = $('pickedOut');
      out.value = text;
      out.setAttribute('data-open', '1');
      out.focus();
      out.select();
      $('pickSaid').textContent = 'The clipboard was blocked — copy them from the box below.';
    });
  });

  function load() {
    return ask('list').then(function (r) {
      if (!r || !r.ok) {
        $('rows').innerHTML = '<tr><td colspan="6" class="never">The list could not be read.</td></tr>';
        return;
      }
      you = r.you;
      $('who').textContent = 'Signed in as ' + r.you;
      members = r.members || [];
      show(false);
    });
  }

  $('addBtn').addEventListener('click', function () {
    var text = $('paste').value;
    if (!text.trim()) { $('addSaid').textContent = 'Nothing pasted yet.'; return; }
    busy($('addBtn'), true, 'Adding…');
    $('addSaid').textContent = '';
    ask('add', { emails: text }).then(function (r) {
      busy($('addBtn'), false);
      if (!r || !r.ok) { $('addSaid').textContent = 'That did not work.'; return; }
      var said = [];
      said.push('<b>' + r.added + '</b> added');
      if (r.already) said.push(r.already + ' already there');
      if (r.rejected && r.rejected.length) {
        said.push(r.rejected.length + ' not an address: ' + safe(r.rejected.join(', ')));
      }
      if (!r.added && !r.already && !(r.rejected || []).length) {
        said = ['No addresses found in that.'];
      }
      $('addSaid').innerHTML = said.join(' · ');
      if (r.added) $('paste').value = '';
      load();
    });
  });

  $('rows').addEventListener('click', function (event) {
    var button = event.target.closest('button[data-email]');
    if (!button) return;
    var email = button.dataset.email;
    if (!window.confirm('Remove ' + email + ' from the guest list?')) return;
    busy(button, true, '…');
    ask('remove', { email: email }).then(function (r) {
      if (!r || !r.ok) {
        busy(button, false);
        window.alert(r && r.why ? r.why : 'That did not work.');
        return;
      }
      load();
    });
  });

  function gumroad() {
    return ask('gumroad').then(function (r) {
      if (!r || !r.ok) { $('gum').textContent = 'Gumroad could not be asked.'; return; }
      var lines = [];
      lines.push(r.set.token ? 'Token set.' : '<b>No token set</b> — add GUMROAD_TOKEN.');
      lines.push(r.set.product ? 'Product: ' + safe(r.set.product) : '<b>No product set</b> — add GUMROAD_PRODUCT.');
      if (!r.set.secret) lines.push('<b>No ping secret set</b> — add GUMROAD_PING_SECRET.');
      lines.push(r.watching && r.watching.length
        ? 'Watching: ' + r.watching.join(', ')
        : 'Not watching refunds yet.');
      $('gum').innerHTML = lines.join('<br>');
      if (r.ping) {
        $('gum').innerHTML += '<br>Ping address: <code>' + safe(r.ping) + '</code>';
      }
    });
  }

  $('gumBtn').addEventListener('click', function () {
    busy($('gumBtn'), true, 'Asking…');
    $('gumSaid').textContent = '';
    ask('gumroad-connect', {}).then(function (r) {
      busy($('gumBtn'), false);
      if (!r) { $('gumSaid').textContent = 'That did not work.'; return; }
      if (r.why) { $('gumSaid').textContent = r.why; return; }
      var said = [];
      if (r.done && r.done.length) said.push('Now watching ' + r.done.join(', ') + '.');
      if (r.failed && r.failed.length) said.push('Could not set up: ' + safe(r.failed.join(', ')));
      $('gumSaid').textContent = said.join(' ') || 'Nothing to do.';
      gumroad();
    });
  });

  function saleLine(s, i) {
    var bits = [];
    bits.push('<b>' + (i + 1) + '.</b> ' + safe(s.product_name || 'a product'));
    if (s.email) bits.push('to ' + safe(s.email));
    bits.push('<br>&nbsp;&nbsp;&nbsp;permalink: <code>' + safe(s.product_permalink || '—') + '</code>');
    bits.push('<br>&nbsp;&nbsp;&nbsp;product_id: <code>' + safe(s.product_id || '—') + '</code>');
    if (s.short_product_id) {
      bits.push('<br>&nbsp;&nbsp;&nbsp;short id: <code>' + safe(s.short_product_id) + '</code>');
    }
    bits.push('<br>&nbsp;&nbsp;&nbsp;<b>' + safe(s.verdict) + '</b>');
    if (s.raw) {
      bits.push('<br>&nbsp;&nbsp;&nbsp;<details><summary>everything Gumroad said about it</summary>' +
        '<pre>' + safe(JSON.stringify(s.raw, null, 2)) + '</pre></details>');
    }
    return bits.join(' ');
  }

  // What Gumroad said about an address, in the words it has always
  // been given in. Returns the lines and whether there is anything for
  // the "make the list match" button to act on.
  function gumroadSaid(r) {
    if (!r) return { html: 'That did not work.', found: false };
    if (!r.ok) return { html: safe(r.why || 'That did not work.'), found: false };

    var out = ['Looking for a product matching <code>' + safe(r.wanted || '(not set)') + '</code>.'];
    var found = false;

    if (r.found.length) {
      out.push('<br><br>Gumroad has ' + r.found.length + ' sale(s) to that address:');
      out.push(r.found.map(saleLine).join('<br>'));
      found = true;
    } else if (r.recent.length) {
      out.push('<br><br><b>Gumroad has no sale at all to that address.</b>' +
        ' Either the purchase was under a different email, or it never' +
        ' completed. Your most recent sales, for comparison:');
      out.push(r.recent.map(saleLine).join('<br>'));
    } else {
      out.push('<br><br><b>Gumroad reports no sales at all.</b>');
    }

    return { html: out.join(' '), found: found };
  }

  function stripeStatusLines(r) {
    var lines = [];

    if (!r.set.key && !r.set.webhook && !r.set.product) {
      lines.push('Not set up yet. It needs three secrets in Cloudflare: ' +
        'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_PRODUCT.');
    } else {
      if (!r.set.key) {
        lines.push('<b>No key set</b> — add STRIPE_SECRET_KEY.');
      } else if (r.mode === 'test') {
        lines.push('Key set — <b>TEST mode</b>. No real money moves, and real buyers are not seen.');
      } else if (r.mode === 'live') {
        lines.push('Key set — <b>LIVE mode</b>. Real sales.');
      } else {
        lines.push('<b>A key is set, but it does not look like a Stripe key.</b> ' +
          'It should begin rk_test_ or rk_live_.');
      }

      if (r.kind === 'full') {
        lines.push('<b>That is a full secret key</b>, which can do anything in your Stripe ' +
          'account. A restricted, read-only one is all this needs, and is safer.');
      }

      lines.push(r.set.webhook
        ? 'Webhook signing secret set.'
        : '<b>No webhook signing secret set</b> — add STRIPE_WEBHOOK_SECRET.');

      if (!r.set.product) {
        lines.push('<b>No product set</b> — add STRIPE_PRODUCT.');
      } else if (r.names === 'unrecognised') {
        lines.push('<b>A product is set, but it does not look like a Stripe id.</b> ' +
          'It should begin prod_, price_ or plink_.');
      } else {
        lines.push('Product set — ' + safe(r.names) + '.');
      }

      (r.can || []).forEach(function (c) {
        lines.push(c.ok
          ? 'The key can read ' + safe(c.what) + '.'
          : '<b>The key cannot read ' + safe(c.what) + '.</b> ' + safe(c.why || ''));
      });
    }

    lines.push('Webhook address: <code>' + safe(r.webhookUrl) + '</code>');
    lines.push('Events to tick there, and no others: ' + (r.events || []).map(function (e) {
      return '<code>' + safe(e) + '</code>';
    }).join(' '));

    return lines;
  }

  function stripe() {
    return ask('stripe').then(function (r) {
      if (!r || !r.ok) { $('stripe').textContent = 'Stripe could not be asked.'; return; }
      $('stripe').innerHTML = stripeStatusLines(r).join('<br>');
    });
  }

  function boughtLines(list) {
    if (!list || !list.length) return '<br>&nbsp;&nbsp;&nbsp;what was bought: <code>—</code>';
    return list.map(function (b) {
      return '<br>&nbsp;&nbsp;&nbsp;product: <code>' + safe(b.product || '—') + '</code>' +
        ' price: <code>' + safe(b.price || '—') + '</code>';
    }).join('');
  }

  function receiptLine(s, i) {
    var bits = [];
    bits.push('<b>' + (i + 1) + '.</b> ' + safe(day(s.created) || 'a receipt'));
    if (s.email) bits.push('to ' + safe(s.email));
    bits.push(boughtLines(s.bought));
    if (s.payment_link) {
      bits.push('<br>&nbsp;&nbsp;&nbsp;payment link: <code>' + safe(s.payment_link) + '</code>');
    }
    if (s.verdict) {
      bits.push('<br>&nbsp;&nbsp;&nbsp;<b>' + safe(s.verdict) + '</b>');
    } else {
      bits.push('<br>&nbsp;&nbsp;&nbsp;<b>' + (s.matches
        ? 'the product that grants access'
        : 'a different product') + '</b>');
    }
    if (s.receipt) {
      bits.push('<br>&nbsp;&nbsp;&nbsp;<details><summary>what Stripe said about it, cut down</summary>' +
        '<pre>' + safe(JSON.stringify(s, null, 2)) + '</pre></details>');
    }
    return bits.join(' ');
  }

  function stripeSaid(r) {
    if (!r) return { html: 'That did not work.', found: false };
    if (!r.ok) return { html: safe(r.why || 'That did not work.'), found: false };

    var out = [];
    var found = false;

    if (!r.set) out.push('<b>No STRIPE_PRODUCT is set</b>, so nothing can count yet.<br><br>');

    if (r.found.length) {
      out.push('Stripe has ' + r.found.length + ' receipt(s) for that address:');
      out.push(r.found.map(receiptLine).join('<br>'));
      found = true;
    } else if (r.recent.length) {
      out.push('<b>Stripe has no receipt at all for that address.</b>' +
        ' Either the purchase was under a different email, or it never' +
        ' completed. Your most recent receipts, for comparison — with no' +
        ' addresses shown:');
      out.push(r.recent.map(receiptLine).join('<br>'));
    } else {
      out.push('<b>Stripe reports no receipts at all.</b>');
    }

    return { html: out.join(' '), found: found };
  }

  $('checkBtn').addEventListener('click', function () {
    var who = $('checkWho').value.trim();
    if (!who) { $('checkSaid').textContent = 'Type an address first.'; return; }
    busy($('checkBtn'), true, 'Asking…');
    $('checkSaid').textContent = '';
    $('syncBtn').hidden = true;

    Promise.all([
      ask('gumroad-check', { email: who }),
      ask('stripe-check', { email: who })
    ]).then(function (both) {
      busy($('checkBtn'), false);

      var g = gumroadSaid(both[0]);
      var s = stripeSaid(both[1]);

      $('checkSaid').innerHTML =
        '<b>GUMROAD</b><br>' + g.html +
        '<br><br><b>STRIPE</b><br>' + s.html;

      // Offered whichever way the answer went: it adds somebody who
      // should be in and removes somebody who should not, so it is
      // the button for "make this agree with the shops" either way.
      $('syncBtn').hidden = !(g.found || s.found);
    });
  });

  // What "make the list match" did, said by where the address ended
  // up rather than by which shop was asked. With Stripe not set up at
  // all, the words are exactly the ones this button has always used.
  function matchSaid(r) {
    if (!r || !r.ok) return 'That did not work.';
    if (r.held) return 'Nothing changed — a shop could not be asked just now. Try again in a minute.';

    if (!r.stripeOn) {
      if (r.gumroad === true) return 'On the list. Their sale stands.';
      if (r.gumroad === false) return 'Taken off the list, if they were on it through a purchase. Anyone added by hand stays.';
      return 'Nothing changed — Gumroad could not be asked just now.';
    }

    if (r.listed) {
      if (r.source === 'manual') return 'On the list, added by hand. No purchase or refund changes that.';
      if (r.source === 'gumroad' && r.gumroad === null) {
        return 'On the list through Gumroad, which could not be asked just now — nothing was changed.';
      }
      return 'On the list, through ' + (r.source === 'stripe' ? 'Stripe' : 'Gumroad') + '. Their sale stands.';
    }

    if (r.gumroad === null) {
      return 'Not on the list. Stripe shows no live sale, and Gumroad could not be asked just now.';
    }
    return 'Not on the list. Neither shop shows a live sale for that address.';
  }

  $('syncBtn').addEventListener('click', function () {
    busy($('syncBtn'), true, '…');
    ask('match', { email: $('checkWho').value.trim() }).then(function (r) {
      busy($('syncBtn'), false);
      $('checkSaid').textContent = matchSaid(r);
      $('syncBtn').hidden = true;
      load();
    });
  });

  $('testBtn').addEventListener('click', function () {
    busy($('testBtn'), true, 'Sending…');
    $('testSaid').textContent = '';
    ask('test-code', {}).then(function (r) {
      busy($('testBtn'), false);
      $('testSaid').textContent = (r && r.ok)
        ? 'On its way to ' + r.sent + '. It is a real code, good for ten minutes.'
        : 'That did not work.';
    });
  });

  load();
  gumroad();
  stripe();
})();
</script>
</body>
</html>`;

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

// The same signing, written out as lowercase hex — which is how Stripe
// writes the signature it sends, where everything of this worker's own
// uses the shorter spelling above.
async function hmacHex(text, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  let hex = '';
  for (const byte of new Uint8Array(mac)) hex += byte.toString(16).padStart(2, '0');
  return hex;
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
