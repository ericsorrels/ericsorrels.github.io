# The vault — a plain guide

How the Early Digital Access page lets people in, how to add and remove
them, and what to do when something goes wrong.

Written for Eric. No technical background assumed. Nothing in this file
is secret — see **The secrets** near the end.

---

## The short version

The album is not on this website. It sits in private storage at
Cloudflare, and a small program — a "worker" — hands out one file at a
time to a browser that has proved who it is. Proving who you are means
receiving a six-digit code by email.

**Nobody shares a password any more.** Access is a list of email
addresses that you control, one person at a time.

---

## How somebody gets in

1. They open **graymanmusical.com/access.html** and type their email
   address.
2. The page always answers the same thing: *"If this email has access,
   a code is on its way."*
3. **If — and only if — their address is on your guest list**, a
   six-digit code is emailed to them.
4. They type the code. They are in, and stay in for **30 days** without
   signing in again.

### Why the message is worded so carefully

That "if" is doing real work. If an approved address got a different
answer from an unapproved one, anyone could stand at your gate typing
addresses to find out who has bought your album. So the page says the
same thing either way, and takes the same length of time to say it.

The one thing it *will* tell someone plainly is that they mistyped their
address — because that's about what they typed, not about who's on the
list.

### About the codes

| | |
|---|---|
| Length | six digits |
| Good for | ten minutes |
| Uses | one — it stops working the moment it's used |
| Wrong guesses allowed | five, then that code is destroyed |
| Codes per address | five an hour |

**If somebody asks for a second code, the first one stops working.**
That's why the error message says to use the code from the newest
email. It's the single most common confusion, and it's worth saying
out loud when you help someone.

A code sent less than a minute ago is *not* replaced if they press the
button again — that's deliberate, so an impatient double-press doesn't
invalidate the email already flying toward them.

---

## Adding and removing people

Everything happens on the admin page:

**graymanmusical.com/vault-api/admin**

You have to be signed in to the album first — sign in at
`access.html`, then open the admin page. Cloudflare will also email you
a PIN the first time each day. Two locks, on purpose.

### To add people

Paste addresses into the box and press **Add these**. It copes with
almost any shape:

- one per line
- separated by commas
- a column copied out of a spreadsheet
- `Jane Doe <jane@example.com>` copied straight out of an email

Names, headings and other text around the addresses are ignored.
Anything that looks like an address but isn't — `someone@` with the
domain missing — is reported back so you can fix it.

**Pasting the same list twice is harmless.** People already on the list
keep their original details.

### To remove someone

Press **Remove** on their row.

Two things to know:

- **It stops any new code being sent immediately**, and they lose access
  the next time they open the page.
- **If they're signed in with the page already open, they can keep
  listening until they reload.** To cut everyone off instantly, change
  `SESSION_SECRET` (see below) — but that signs out *everybody*,
  including you.

**Your own address has no Remove button.** Removing it would lock you
out of the admin page.

### The last-signed-in column

Handy for telling whether somebody is actually using their access, and
for spotting a person who says "it never worked" — if the column says
**never**, their code genuinely never arrived or was never typed.

---

## How Gumroad connects

When someone buys early access, Gumroad tells the vault, and their
address joins the list by itself. If they refund or charge back, it
comes off again.

### What to trust, and what the vault trusts

Gumroad's message is **unsigned** — there's nothing in it that proves
Gumroad sent it. So the vault doesn't believe it. It treats the message
as a tip-off, then asks Gumroad's own API directly whether that sale is
real and still standing. Only then does anything change.

### Two things that protect you

**If Gumroad can't be reached, nothing changes.** Somebody who paid you
will never lose access because an API had a bad minute.

**Gumroad never overrules you.** Anyone you added by hand — a comped
friend, a collaborator, an investor — stays on the list no matter what
Gumroad says. Only people who arrived *through a purchase* can be
removed by a refund.

### If a sale is ever missed

It doesn't matter much. If someone who bought the album asks for a code
and isn't on the list, the vault asks Gumroad about them on the spot
and lets them in if they find a real purchase. A missed notification
becomes a few seconds' delay rather than an email to you at midnight.

### "They bought it but can't get in"

The admin page has a box called **Why didn't somebody get in?** Type
their address and press **Ask Gumroad**. It shows every sale Gumroad
has for that address, what product each was for, and — in plain words —
whether the vault counts it and why not.

Three answers you might see:

- **"a different product"** — the vault is looking for the wrong
  product identifier. See the warning below.
- **"refunded" / "charged back" / "disputed"** — working as intended.
- **"Gumroad has no sale at all to that address"** — they bought it
  under a different email, or the purchase never completed. It then
  lists your most recent sales so you can spot which address they
  really used.

When a sale *does* count but they still aren't on the list, a **Put it
right** button appears. Press it and they're added.

> ⚠️ **The product identifier catches everyone once.** Gumroad's API
> reports a product's *original* perma id — a random string — not the
> friendly name you set for your shop address. So `GUMROAD_PRODUCT` set
> to `earlyaccess` may match nothing, even though that's what your shop
> URL says. The failure is silent: real sale, no error, nobody added.
>
> The fix: run the check above on any real purchase, read the
> `product_id` it reports, and set `GUMROAD_PRODUCT` to that instead.

### Revoking somebody's access

**Revoking access in Gumroad is not the same as refunding them**, and
Gumroad doesn't notify anything when you do it — so the guest list
won't change by itself.

To cut somebody off for good:

1. Revoke their access in Gumroad (Customers → find them → **Revoke
   access**), **or** just refund them if it was a paid sale.
2. Come back to the admin page, type their address into **Why didn't
   somebody get in?**, press **Ask Gumroad**, then press **Make the
   list match Gumroad**.

Or simply press **Remove** on their row, which does the same thing
without involving Gumroad at all. Removing by hand is the quicker route
and always works.

Either way, if they're signed in with the page already open, they can
keep listening until they reload. To end every session instantly,
change `SESSION_SECRET` — but that signs out everybody.

### "Nonrefundable" is a policy, not a mechanism

You can state that sales are final, and you should — it's set in
Gumroad under your store's **refund policy**, and the site says it
under both buy buttons (from `music.early_access.terms` in
`content.js`, one line feeding both).

But saying it doesn't stop a refund happening. **A buyer can raise a
chargeback with their card issuer whatever your page says**, and
Gumroad can refund in a dispute. So the vault still needs to take
access away when that happens — it's the case where you'd most want it
to.

One thing to check: Gumroad retired per-product refund policies in
March 2025, so it's now a single store-wide setting, and at one point
they switched every store to a 30-day money-back guarantee by default.
Worth confirming yours says what you think it says.

### Where the settings live

- **Sales** arrive via the Ping address, set in Gumroad under
  **Settings → Advanced → Ping**. The admin page shows you the address
  to paste there.
- **Refunds and disputes** are registered separately — press **Watch
  refunds and disputes** on the admin page. Pressing it twice is
  harmless.

The admin page's Gumroad panel tells you the state of all of this. If
anything is missing it says so by name.

---

## The secrets

These live **only** in the Cloudflare dashboard, under
Workers & Pages → `grayman-vault` → Settings → Variables and Secrets.
They are never written into this repository. Only their *names* appear
here, and the names are already public in the worker's own source.

| Name | What it does |
|---|---|
| `SESSION_SECRET` | signs the proof that somebody is signed in |
| `RESEND_API_KEY` | lets the vault send email |
| `ADMIN_EMAIL` | the one address allowed to open the admin page |
| `GUMROAD_TOKEN` | reads your own sales, to confirm a purchase |
| `GUMROAD_PRODUCT` | which product grants access |
| `GUMROAD_PING_SECRET` | the long random word in the address Gumroad posts to |

**`SESSION_SECRET` is the emergency lever.** Changing it signs out
every single person at once and cancels any code in flight. Use it if
you ever think somebody's access has been shared or stolen. Everyone
simply signs in again with a new code — nobody loses their place on the
guest list.

---

## When something goes wrong

| What you're told | What's most likely | What to do |
|---|---|---|
| "I never got the code" | it's in their spam folder | ask them to look there first — it's nearly always this |
| "The code doesn't work" | they asked twice and are using the older email | tell them to use the code from the **newest** email, or press Send another code and wait |
| "It says the code expired" | more than ten minutes passed | ask for a new one |
| "Too many tries" | five wrong guesses | ask for a new code; the old one is gone |
| "It says my email isn't an address" | a typo, or a space on the end | check for a trailing space |
| Someone bought but can't get in | wrong product identifier, or a missed notification | use **Why didn't somebody get in?** on the admin page — it says which |
| Nobody can get in at all | the vault is down or misconfigured | check the admin page. If *that* won't open either, see below |
| Tracks say "Soon" | the audio file isn't in the vault storage | the file has to be put in the bucket, not just the folder on your Mac |
| The whole album asks for a Cloudflare login | the Access rule is on the wrong path | it must be `vault-api/admin`, **not** `vault-api` |

That last row is the one genuinely alarming failure, and it has a
simple cause. If you ever see listeners being asked to log into
Cloudflare to hear a song, go to Zero Trust → Access controls →
Applications and check the path on the `Gray Man admin` application.

### If you need to undo a Worker change

Cloudflare keeps every version you've ever deployed. Workers & Pages →
`grayman-vault` → **Deployments** → find the previous one → roll back.
You cannot permanently break this by pasting the wrong thing.

---

## What it costs, and where the free plans run out

Nothing today. Here's where the ceilings are, in the order they'd
actually be reached:

| | Free allowance | What uses it |
|---|---|---|
| **Resend** (email) | **100 a day**, 3,000 a month | one email per sign-in |
| **Workers** | 100,000 requests a day | every track, seek and page load |
| **D1** (the list) | far more than this needs | |
| **R2** (the files) | far more than this needs | |
| **Cloudflare Access** | 50 people | **only you** — supporters never touch it |

**The one to plan around is Resend's 100 a day.** Ordinary use is
nowhere near it, because people sign in once and stay in for thirty
days. But if you announce the album to a few hundred supporters and
half of them sign in the same afternoon, codes after the hundredth
simply won't send.

Before a big announcement, either upgrade Resend to Pro for that month
(about $20, 50,000 emails, no daily cap) or expect sign-ins to spread
over a couple of days.

Going over the Workers limit returns an error rather than a bill.

---

## The one rule about files

**Never commit the album's files to this repository.** The audio,
lyrics, notes and downloads are deliberately kept out of it — they were
removed from it, and from its entire history, in September 2026,
because anything committed here is published at a public address whether
or not it's linked from anywhere.

They live in two places: on your own Mac, where you work, and in the
private storage at Cloudflare, where the vault reads them. **Adding a
track means putting it in both.** A track that's only on your Mac will
read "Soon" on the live site.

The `.gitignore` file is set up to stop these being committed by
accident. Don't remove those lines.
