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
their address and press **Ask Gumroad and Stripe**. It shows every sale
each shop has for that address, what product each was for, and — in
plain words — whether the vault counts it and why not. Gumroad's answer
comes first, Stripe's beneath it.

Three answers you might see:

- **"a different product"** — the vault is looking for the wrong
  product identifier. See the warning below.
- **"refunded" / "charged back" / "disputed"** — working as intended.
- **"Gumroad has no sale at all to that address"** — they bought it
  under a different email, or the purchase never completed. It then
  lists your most recent sales so you can spot which address they
  really used.

When a sale *does* count but they still aren't on the list, press
**Make the list match**, which appears beside the first button. They're
added.

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
   somebody get in?**, press **Ask Gumroad and Stripe**, then press
   **Make the list match**.

Or simply press **Remove** on their row, which does the same thing
without involving Gumroad at all. Removing by hand is the quicker route
and always works.

Either way, if they're signed in with the page already open, they can
keep listening until they reload. To end every session instantly,
change `SESSION_SECRET` — but that signs out everybody.

### "Nonrefundable" is a policy, not a mechanism

You can state that sales are final — it's set in Gumroad under your
store's **refund policy**. The site itself has not said so since
3 October 2026, when the line under both buy buttons was taken off;
typing one back into `music.early_access.terms` in `content.js`
restores it in both places.

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

## How Stripe connects

Stripe is a second way to buy, beside Gumroad. **It was built and
tested against stand-ins on 6 October 2026 and has not yet met the real
Stripe** — until it has, both buy buttons on the site still go to
Gumroad, and nothing about Gumroad has changed.

When someone pays through your Stripe payment link, Stripe tells the
vault, and their address joins the list tagged **STRIPE**. A full
refund, or a dispute you lose, takes it off again.

### What Stripe does, and what the site never touches

Stripe hosts the whole payment on its own page. There are no card
fields on your site, nothing of Stripe's loaded into it, and nothing a
visitor could tamper with to change the price. No card number ever
comes near the vault.

### What the vault trusts

Stripe's messages are **signed**, which Gumroad's are not — the vault
can prove a message really came from Stripe, and throws away anything
that can't prove it. Even so, it doesn't take the message's word for
anything. It reads the receipt number out of it, fetches that receipt
from Stripe itself, and decides from what Stripe's own records say.

### What takes access away, and what doesn't

| What happened | Access |
|---|---|
| a full refund | taken away |
| a part refund | stays |
| a dispute opened, or lost | taken away |
| a dispute you win | given back |
| a bank *inquiry* (a question, no money moved) | stays |

**You refund in Stripe's own dashboard**, not here. The vault notices
within seconds.

### Three things that protect you

**If Stripe can't be reached, nothing changes** — and Stripe keeps
re-sending the message for up to three days until the vault has dealt
with it.

**Stripe never overrules you.** Anyone you added by hand stays, whatever
Stripe says.

**Somebody who bought in both shops keeps their access until both are
refunded.** The Source column shows one shop at a time — whichever is
currently vouching for them — and may change from GUMROAD to STRIPE or
back. That is the vault keeping track, not a fault.

### If a sale is ever missed

The same safety net as Gumroad. A buyer is sent from Stripe straight
back to your access page; if they ask for a code before Stripe's
message has arrived, the vault asks Stripe about them on the spot and
lets them in.

### "They bought it but can't get in"

The same box on the admin page: **Why didn't somebody get in?** Under
**STRIPE** it lists every receipt for that address and says, in plain
words, whether each one counts.

- **"a different product"** — `STRIPE_PRODUCT` is not the id of what
  they bought. The ids are shown beside the receipt; use the one
  beginning `prod_`.
- **"fully refunded" / "disputed" / "dispute lost"** — working as
  intended.
- **"Stripe has no receipt at all for that address"** — they paid
  under a different email, or never finished paying. It then lists your
  most recent receipts, with no addresses on them, so the ids can be
  compared.

What it shows about a receipt is cut down on purpose: no name, no
postal address, no amount and no card.

**Capital letters.** Stripe keeps an address exactly as the buyer
typed it, and its own search is exact about capitals — somebody who
paid as `Pat@Example.com` is not found by asking it for
`pat@example.com`. The vault allows for this. It looks under the
address as you type it, again in small letters, and then through your
latest hundred receipts for the same address in any capitals, and it
shows each receipt with the spelling Stripe holds.

**Nobody is taken off the list because nothing was found.** A person
who arrived through Stripe is only removed when the vault has looked at
their receipt and seen it refunded or lost to a dispute. If **Make the
list match** says Stripe has no receipt for someone tagged STRIPE, it
leaves them alone and tells you so; if they really should come off,
press **Remove** on their row.

> ⚠️ **Test mode and live mode are two separate worlds.** Stripe gives
> the product, the payment link, the key and the webhook secret a
> different value in each. Moving from testing to real sales means
> changing all three secrets together, and making the payment link and
> the webhook again on the live side. The admin page says in capitals
> which mode the key is in.

### Where the settings live

All in Stripe's dashboard, and the admin page's **Stripe** panel checks
them and says by name if anything is missing.

- **The payment link.** After payment, send the buyer to
  `https://graymanmusical.com/access.html?paid` — the last word is what
  makes the page greet them as a buyer. Quantity fixed at one.
- **The key.** A *restricted* key that can only read: Checkout
  Sessions, PaymentIntents, Charges and Disputes set to **Read**,
  everything else **None**. It cannot charge, refund or pay out.
- **The webhook.** Pointed at the address the admin page shows, with
  six events ticked and no others. The admin page lists them.

### What Stripe leaves to you that Gumroad did for you

Gumroad is the seller of record and deals with sales tax itself. On
Stripe **you** are the seller. On 6 October 2026 you chose to collect
no tax through the link for now. That is a setting on the payment link
and can be changed there at any time; nothing in the vault depends on
it.

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
| `STRIPE_SECRET_KEY` | a restricted, read-only key: reads your own receipts, to confirm a purchase |
| `STRIPE_WEBHOOK_SECRET` | proves a message really came from Stripe |
| `STRIPE_PRODUCT` | which Stripe product grants access — its id, beginning `prod_` |

**`SESSION_SECRET` is the emergency lever.** Changing it signs out
every single person at once and cancels any code in flight. Use it if
you ever think somebody's access has been shared or stolen. Everyone
simply signs in again with a new code — nobody loses their place on the
guest list.

---

## Making sure codes reach the inbox

Email providers decide whether to trust a message by checking three
things published against your domain name. All three are now in place,
and a full test of a real code email scored **10 out of 10**.

You don't need to understand them, but you do need to leave them alone:

| | Where it lives | |
|---|---|---|
| **SPF** | the `send.` part of your domain | says Resend is allowed to send for you |
| **DKIM** | your domain | a signature proving the email wasn't tampered with |
| **DMARC** | your domain | ties the other two together — added 30 September 2026 |

**The DMARC one was missing, and that's why a code went to spam on an
iCloud address.** Apple is the strictest of the big providers about it.
It's set up now through Cloudflare → Email → DMARC Management.

### Two warnings on that page you should ignore

- **"SPF policy: Soft fail"** — this is about a *different* SPF record,
  the one for mail coming *to* you. It isn't what your codes are checked
  against. Changing it would help nothing and could break something.
- **"BIMI: Fail"** — BIMI is the little logo beside a sender's name in
  Gmail. It costs over $1,000 a year in certificates and makes no
  difference to whether mail lands in the inbox.

### One thing still to do

In a week or two, go back to that page and change the policy from
**None** to **Quarantine**. It's a stronger signal to Apple and Google
and stops anyone sending email pretending to be you.

### To test it yourself at any time

1. Go to **mail-tester.com** and copy the address it shows you.
2. On the admin page, paste that address in and press **Add these**.
3. Go to `access.html`, enter it, and press Send My Code.
4. Back on mail-tester, press **Check your score**.
5. Remove the address from the admin page afterward.

That tests the actual email your site sends, not a guess about it.

### If someone says it went to their spam folder

No setting fixes a mailbox that has already decided. Ask them to open
their spam folder, mark the message **Not Junk**, and add
**hello@graymanmusical.com** to their contacts. That fixes it for them
permanently.

And bear in mind your domain is new. It has barely sent any email, and
a run of short, near-identical messages each containing a number looks
— to a filter that doesn't know you — much like spam. It improves as
real people receive and open the mail. **Before a big announcement,
it's better if sign-ins spread over a few days than all arrive in one
afternoon.**

---

## When something goes wrong

| What you're told | What's most likely | What to do |
|---|---|---|
| "I never got the code" | it's in their spam folder | ask them to look there first — it's nearly always this |
| "The code doesn't work" | they asked twice and are using the older email | tell them to use the code from the **newest** email, or press Send another code and wait |
| "It says the code expired" | more than ten minutes passed | ask for a new one |
| "Too many tries" | five wrong guesses | ask for a new code; the old one is gone |
| "It says my email isn't an address" | a typo, or a space on the end | check for a trailing space |
| Someone bought but can't get in | wrong product identifier, or a missed notification | use **Why didn't somebody get in?** on the admin page — it asks both shops and says which |
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
private storage at Cloudflare, where the vault reads them. **Adding
anything means putting it in both.** A track that's only on your Mac
reads "Soon" on the live site; one that's only in the bucket works
live but not in your preview. Neither half tells you the other is
missing.

| What | On your Mac | In the bucket (R2 → `grayman-vault`) |
|---|---|---|
| A track | `assets/audio/NN.mp3` | `audio/NN.mp3` |
| Lyrics | `assets/lyrics/NN.lrc` | `lyrics/NN.lrc` |
| Liner notes | `assets/notes/NN.md` | `notes/NN.md` |
| A download | `assets/downloads/name.pdf` | `downloads/name.pdf` |

`NN` is two digits — `01`, not `1` — and it's the track's position in
the list on the access page.

**Click into the folder before uploading.** Files dropped at the top
level of the bucket are invisible to the vault, and nothing warns you.
That's the first thing to check if a file you've uploaded still won't
appear.

**Replacing** a track means telling me, so I can change the version
number that makes browsers fetch it again — otherwise people keep
hearing the old one. **Replacing a download** means giving the PDF a
new file name, because those have no version number at all. Adding
something new has neither problem.

The three download buttons expect exactly these names:
`listening-guide.pdf`, `lyric-booklet.pdf`, `about-the-world.pdf`.

The `.gitignore` file is set up to stop these being committed by
accident. Don't remove those lines.
