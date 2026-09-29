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

  /* How they got here: 'manual' (Eric added them) or 'gumroad' (they
     bought early access and were added automatically). */
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
