/* THE GRAY MAN — the vault's guest list.

   This is the shape of the D1 database  grayman-members , which reaches
   the vault relay as the binding  MEMBERS . It is the list of people
   allowed to ask for a sign-in code.

   NOTHING SECRET IS IN THIS FILE, and no actual email addresses either.
   It describes the columns, not the people. It is committed to a public
   repository on purpose, the same as the worker beside it. The addresses
   themselves live only in the database at Cloudflare — never here, and
   never anywhere the site can serve.

   Run it once, by pasting the whole file into  Cloudflare dashboard →
   Storage & Databases → D1 SQL database → grayman-members → Console.
   Running it a second time changes nothing: every statement below says
   IF NOT EXISTS.

   EVERY COMMENT IN THIS FILE IS THE  /* … *\/  KIND, AND THAT MATTERS.
   The D1 console runs a paste as a single line. A  -- comment  reaches
   to the end of its line, so once the line breaks are gone the first one
   swallows the entire file and the console answers "Requests without any
   query are not supported". This kind has an end mark of its own, so it
   survives being flattened. Don't reintroduce  --  here. */

CREATE TABLE IF NOT EXISTS members (

  /* Always stored trimmed and lowercased. The worker does that before
     any address gets this far, so "  Eric@Example.COM " and
     "eric@example.com" can never become two different members.

     COLLATE NOCASE is a second guard on top of that, for rows typed in
     by hand in the console: it makes the database itself treat two
     spellings that differ only in capitals as the same address. */
  email      TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,

  /* How they got here: 'manual' (Eric added them), or 'gumroad' or
     'stripe' (they bought early access in that shop and were added
     automatically). Nothing restricts the words allowed here, so a new
     source needs no change to this table. Somebody who bought in both
     shops has ONE row, tagged with whichever shop is currently
     vouching for them — see reconcileStripe in the worker. */
  source     TEXT NOT NULL DEFAULT 'manual',

  /* When they were added, and when they last signed in successfully.
     Both are plain text in UTC, like  2026-09-29T14:02:11Z  — readable
     at a glance in the console, and they sort correctly as text.
     last_login stays empty until the first time they sign in. */
  added_at   TEXT NOT NULL,
  last_login TEXT
);

/* So the admin page can list newest-first without reading every row. */
CREATE INDEX IF NOT EXISTS members_added_at ON members (added_at);


/* ---------------------------------------------------------------------
   The codes in flight.

   One row per address waiting to be let in, and AT MOST ONE: the email
   is the primary key, so asking for a new code replaces the old one
   rather than adding to it. That is deliberate — two live codes for one
   person is how someone ends up typing the older of two emails and
   being told they are wrong.

   THE CODE ITSELF IS NOT STORED HERE. What is stored is a signed hash
   of it, made with SESSION_SECRET, so reading this table tells you
   nothing you could type at the gate. A six-digit code has only a
   million possibilities, which a plain hash would give up instantly;
   keyed with a secret, it cannot be worked backwards at all.

   Times here are plain numbers — milliseconds since 1970 — rather than
   the readable dates used in members above. These rows are read by the
   worker and never by a person, they live about ten minutes, and
   comparing numbers cannot go wrong the way comparing two differently
   written dates can.
   --------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS codes (
  email      TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  tries      INTEGER NOT NULL DEFAULT 0,
  sent_at    INTEGER NOT NULL
);


/* ---------------------------------------------------------------------
   The brake.

   One row per thing being counted — an address, or the internet address
   a request came from — holding how many times it has asked and when
   its allowance starts again. This is what stops somebody asking for
   ten thousand codes, or guessing at six digits until they hit one.

   The bucket is a plain label like  email:someone@example.com  or
   ip:203.0.113.4 , so both kinds of limit are counted by the same
   handful of lines rather than two sets of them.

   Rows are swept away once their window has passed, so this table stays
   small by itself and never needs tending.
   --------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS throttle (
  bucket       TEXT PRIMARY KEY NOT NULL,
  count        INTEGER NOT NULL,
  window_until INTEGER NOT NULL
);
