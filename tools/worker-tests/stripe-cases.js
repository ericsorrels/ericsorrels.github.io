// The Stripe cases for cloudflare/vault-worker.js, run against stand-ins
// (see harness.js). Each one prints a single line; index.html compares
// the lines with expected.json and says which, if any, have moved.
//
// Nothing printed may depend on the clock or on how fast the machine is,
// or a line would differ from one run to the next for no reason.
window.__STRIPE_CASES = async function () {
  var H = window.__H, W = H.World, out = [];
  var B = 'buyer@example.com';
  var w, s, s2, r, r2, a, first, raw, t;

  function line(n, what, r, w, extra) {
    out.push(n + '  ' + what + '  ->  ' + r.status + (r.body ? ' body:"' + r.body + '"' : '') +
      ' | list: ' + w.on() + (r.bg ? ' | UNHANDLED: ' + r.bg : '') +
      (w.unknownSql.length ? ' | UNKNOWN SQL: ' + w.unknownSql[0] : '') + (extra ? ' | ' + extra : ''));
  }
  function ping(extra) {
    var p = Object.assign({ seller_id: 'x', product_id: 'STANDINproductID0000==', product_name: 'Purchase Early Digital Access', permalink: 'earlyaccess', product_permalink: 'https://example.gumroad.com/l/earlyaccess', short_product_id: 'abcxyz', email: B, price: '1708', refunded: 'false', resource_name: 'sale', disputed: 'false', dispute_won: 'false' }, extra || {});
    return new URLSearchParams(p).toString();
  }
  // Gumroad's own doorbell, for the bought-in-both-shops cases.
  async function ring(w, body) {
    var pending = [];
    var req = new Request('https://graymanmusical.com/vault-api/gumroad/bell', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body });
    var reply = await w.api.worker.fetch(req, w.env, { waitUntil: function (p) { pending.push(p); } });
    await Promise.all(pending);
    return { status: reply.status, body: '' };
  }
  var OTHER = { product: 'prod_Tshirt', price: 'price_Tshirt', plink: 'plink_Tshirt' };

  /* A — the signature ------------------------------------------------ */
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s); line('A01', 'valid purchase, properly signed', r, w, 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { header: null }); line('A02', 'no signature header at all', r, w, 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { secret: 'whsec_somebody_elses' }); line('A03', 'signed with the wrong secret', r, w);
  w = new W(); s = w.buy(); raw = w.eventFor('checkout.session.completed', s); r = await w.hook(raw, { header: await H.sigHeader(raw, H.WHSEC), body: raw.replace(B, 'thief@example.com') }); line('A04', 'body tampered with after signing', r, w, 'thief on list: ' + w.on('thief@example.com'));
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { t: H.NOW() - 301 }); line('A05', 'good signature, 5 min 1 s old', r, w);
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { t: H.NOW() - 290 }); line('A06', 'good signature, 4 min 50 s old (inside the window)', r, w);
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { t: H.NOW() + 900 }); line('A07', 'good signature, dated 15 min in the future', r, w);
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { header: 'v1=' + 'a'.repeat(64) }); line('A08', 'header with no timestamp', r, w);
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { header: 't=' + H.NOW() }); line('A09', 'header with no v1', r, w);
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { header: 'garbage' }); line('A10', 'header that is nonsense', r, w);
  w = new W(); s = w.buy(); raw = w.eventFor('checkout.session.completed', s); t = H.NOW(); r = await w.hook(raw, { header: 't=' + t + ',v1=' + 'b'.repeat(64) + ',v1=' + (await H.hmac(t + '.' + raw, H.WHSEC)) }); line('A11', 'two v1s, the second one right (a rolled secret)', r, w);
  w = new W(); s = w.buy(); raw = w.eventFor('checkout.session.completed', s); t = H.NOW(); r = await w.hook(raw, { header: 't=' + t + ',v0=' + (await H.hmac(t + '.' + raw, H.WHSEC)) }); line('A12', 'right signature offered as v0, not v1', r, w);
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { method: 'GET' }); line('A13', 'a GET to the webhook', r, w);
  w = new W(); delete w.env.STRIPE_WEBHOOK_SECRET; s = w.buy(); r = await w.send('checkout.session.completed', s); line('A14', 'no STRIPE_WEBHOOK_SECRET set on the worker', r, w);
  w = new W(); s = w.buy(); r = await w.send('checkout.session.completed', s, { path: 'stripe/webhook/extra' }); line('A15', 'a slightly different address', r, w);
  w = new W(); r = await w.hook('{not json'); line('A16', 'signed, but not JSON', r, w);
  w = new W(); r = await w.hook(JSON.stringify({ type: 'customer.created', data: { object: { id: 'cus_1', email: B } } })); line('A17', 'signed, an event this vault does not act on', r, w, 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W(); s = w.buy(); r = await w.hook(w.eventFor('checkout.session.completed', s) + ' '.repeat(600 * 1024)); line('A18', 'a 600 KB body, properly signed', r, w);
  w = new W(); var bell = await w.hook('email=x', { path: 'gumroad/wrong' }); s = w.buy(); r = await w.send('checkout.session.completed', s, { header: null });
  out.push('A19  the refusal is the Gumroad doorbell\'s own: ' + (bell.status === r.status && bell.body === r.body) + ' (' + bell.status + ' "' + bell.body + '")');
  // An outside vector: the same value openssl gives for
  //   printf '%s' '1700000000.{"a":1}' | openssl dgst -sha256 -hmac 'whsec_vector'
  out.push('A20  hmacHex against openssl: ' + ((await new W().api.hmacHex('1700000000.{"a":1}', 'whsec_vector')) === '5d485af0d9ddc3522d7a396ce60598f0d5fbb3bacdb1924001168092bc407c18'));

  /* B — Stripe or the guest list failing ---------------------------- */
  w = new W(); s = w.buy(); w.stripe.mode = '500'; r = await w.send('checkout.session.completed', s); first = r.status + ' list ' + w.on(); w.stripe.mode = 'ok'; r2 = await w.send('checkout.session.completed', s); line('B01', 'Stripe API 500; then Stripe re-sends', r2, w, 'first answer was ' + first);
  w = new W(); s = w.buy(); w.stripe.mode = 'throws'; r = await w.send('checkout.session.completed', s); line('B02', 'Stripe API unreachable', r, w);
  w = new W(); s = w.buy(); w.stripe.mode = '401'; r = await w.send('checkout.session.completed', s); line('B03', 'Stripe refuses the key', r, w);
  w = new W(); s = w.buy(); w.stripe.mode = 'junk'; r = await w.send('checkout.session.completed', s); line('B04', 'Stripe answers nonsense', r, w);
  w = new W(); s = w.buy(); w.failWrites = true; r = await w.send('checkout.session.completed', s); first = r.status + ' list ' + w.on(); w.failWrites = false; r2 = await w.send('checkout.session.completed', s); line('B05', 'guest list refuses the write; then re-sent', r2, w, 'first answer was ' + first);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.refund(s, 'full'); w.failWrites = true; r = await w.send('charge.refunded', s); first = r.status + ' list ' + w.on(); w.failWrites = false; r2 = await w.send('charge.refunded', s); line('B06', 'refund, but the list refuses the removal; then re-sent', r2, w, 'first answer was ' + first);
  w = new W(); delete w.env.STRIPE_SECRET_KEY; s = w.buy(); r = await w.send('checkout.session.completed', s); line('B07', 'webhook secret set but no API key yet', r, w);
  w = new W(); delete w.env.STRIPE_PRODUCT; s = w.buy(); r = await w.send('checkout.session.completed', s); line('B08', 'no STRIPE_PRODUCT set', r, w);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.stripe.forceMore = true; w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('B09', 'refund, but Stripe says there are more receipts than it showed', r, w);

  /* C — refunds ------------------------------------------------------ */
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.refund(s, 'full'); w.codes.set(B, { x: 1 }); r = await w.send('charge.refunded', s); line('C01', 'full refund of a stripe row', r, w, 'code in flight voided: ' + !w.codes.has(B));
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.refund(s, 'part'); r = await w.send('charge.refunded', s); line('C02', 'part refund of a stripe row', r, w);
  w = new W({ members: [[B, 'manual']] }); s = w.buy(); w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('C03', 'full refund, but Eric added them by hand', r, w);
  w = new W({ members: [[B, 'gumroad']] }); s = w.buy(); w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('C04', 'full Stripe refund, row tagged gumroad', r, w, 'asked Gumroad ' + w.gum.calls + 'x');
  w = new W({ members: [[B, 'stripe']], sales: [H.gsale()] }); s = w.buy(); w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('C05', 'full Stripe refund, but a live Gumroad sale too', r, w);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.refund(s, 'full'); w.gum.mode = '500'; r = await w.send('charge.refunded', s); first = r.status + ' list ' + w.on(); w.gum.mode = 'ok'; r2 = await w.send('charge.refunded', s); line('C06', 'full Stripe refund while Gumroad cannot be asked; then re-sent', r2, w, 'first answer was ' + first);
  w = new W({ members: [[B, 'stripe']], gumroad: false }); s = w.buy(); w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('C07', 'full refund with Gumroad not set up at all', r, w, 'asked Gumroad ' + w.gum.calls + 'x');
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.buy(); w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('C08', 'bought twice at Stripe, one refunded in full', r, w);
  w = new W(); s = w.buy(); w.refund(s, 'full'); r = await w.send('charge.refunded', s); r2 = await w.send('checkout.session.completed', s); line('C09', 'out of order: the refund arrives BEFORE the purchase', r2, w, 'refund answered ' + r.status);
  w = new W(); s = w.buy(); await w.send('checkout.session.completed', s); await w.send('checkout.session.completed', s); r = await w.send('checkout.session.completed', s); line('C10', 'the same purchase delivered three times', r, w, 'rows: ' + w.members.size);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.refund(s, 'full'); await w.send('charge.refunded', s); r = await w.send('charge.refunded', s); line('C11', 'the same refund delivered twice', r, w);

  /* D — disputes ----------------------------------------------------- */
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.dispute(s, 'needs_response'); r = await w.send('charge.dispute.created', s); line('D01', 'dispute opened', r, w);
  first = w.on(); w.dispute(s, 'won'); r = await w.send('charge.dispute.closed', s); line('D02', '...and then won', r, w, 'before: ' + first);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.dispute(s, 'under_review'); r = await w.send('charge.dispute.created', s); w.dispute(s, 'lost'); r2 = await w.send('charge.dispute.closed', s); line('D03', 'dispute opened, then lost', r2, w, 'after opening: ' + r.status);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.dispute(s, 'warning_needs_response'); r = await w.send('charge.dispute.created', s); line('D04', 'a bank inquiry, not a dispute', r, w);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.dispute(s, 'prevented'); r = await w.send('charge.dispute.closed', s); line('D05', 'a dispute that was prevented', r, w);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.dispute(s, 'some_new_status'); r = await w.send('charge.dispute.created', s); line('D06', 'a dispute status this vault has never met', r, w);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.dispute(s, 'needs_response'); w.stripe.hideDisputes = true; r = await w.send('charge.dispute.created', s); line('D07', 'charge marked disputed, but Stripe lists no dispute yet', r, w);
  w = new W({ members: [[B, 'manual']] }); s = w.buy(); w.dispute(s, 'lost'); r = await w.send('charge.dispute.closed', s); line('D08', 'dispute lost, but Eric added them by hand', r, w);
  w = new W({ members: [[B, 'stripe']], sales: [H.gsale()] }); s = w.buy(); w.dispute(s, 'lost'); r = await w.send('charge.dispute.closed', s); line('D09', 'Stripe dispute lost, but a live Gumroad sale too', r, w);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.dispute(s, 'needs_response').payment_intent = null; r = await w.send('charge.dispute.created', s); line('D10', 'a dispute that names only its charge, not the payment', r, w);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy(); w.dispute(s, 'needs_response'); w.stripe.mode = 'no-disputes'; r = await w.send('charge.dispute.created', s); line('D11', 'dispute, but the key lacks permission to read disputes', r, w);

  /* E — other products, and things that are not this vault's -------- */
  w = new W(); s = w.buy(OTHER); r = await w.send('checkout.session.completed', s); line('E01', 'a purchase of a DIFFERENT product', r, w, 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W({ members: [[B, 'stripe']] }); w.buy(); s2 = w.buy(OTHER); w.refund(s2, 'full'); r = await w.send('charge.refunded', s2); line('E02', 'refund of a different product, buyer also holds the album', r, w);
  w = new W({ members: [[B, 'stripe']] }); w.buy(); r = await w.hook(JSON.stringify({ type: 'charge.refunded', data: { object: { id: 'ch_invoice', object: 'charge', payment_intent: 'pi_invoice', refunded: true, billing_details: { email: B } } } })); line('E03', 'refund of a payment that never went through a checkout page', r, w);
  w = new W(); r = await w.hook(JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: '../../v1/customers', customer_details: { email: B } } } })); line('E04', 'a signed event whose id is not an id', r, w, 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W(); r = await w.hook(JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_doesnotexist', customer_details: { email: B }, payment_status: 'paid', status: 'complete' } } })); line('E05', 'a signed event naming a receipt Stripe does not have', r, w);
  w = new W({ product: H.PRICE }); s = w.buy(); r = await w.send('checkout.session.completed', s); line('E06', 'STRIPE_PRODUCT given as the price id', r, w);
  w = new W({ product: H.PLINK }); s = w.buy(); r = await w.send('checkout.session.completed', s); line('E07', 'STRIPE_PRODUCT given as the payment link id', r, w);
  w = new W({ product: 'Early Digital Access' }); s = w.buy(); r = await w.send('checkout.session.completed', s); line('E08', 'STRIPE_PRODUCT given as the product NAME (not an id)', r, w);
  w = new W({ product: 'prod_SomethingElse' }); s = w.buy(); r = await w.send('checkout.session.completed', s); line('E09', 'STRIPE_PRODUCT a real-looking id for another product', r, w);

  /* F — kinds of payment -------------------------------------------- */
  w = new W(); s = w.buy({ payment_status: 'unpaid' }); r = await w.send('checkout.session.completed', s); first = r.status + ' list ' + w.on(); s.payment_status = 'paid'; r2 = await w.send('checkout.session.async_payment_succeeded', s); line('F01', 'a slow bank payment: checkout done, money arrives later', r2, w, 'at checkout: ' + first);
  w = new W(); s = w.buy({ payment_status: 'unpaid' }); await w.send('checkout.session.completed', s); r = await w.send('checkout.session.async_payment_failed', s); line('F02', 'a slow bank payment that then fails', r, w);
  w = new W(); s = w.buy({ payment_status: 'no_payment_required' }); r = await w.send('checkout.session.completed', s); line('F03', 'a 100%-off code: nothing charged', r, w);
  w = new W(); s = w.buy({ status: 'expired', payment_status: 'unpaid' }); r = await w.send('checkout.session.completed', s); line('F04', 'an abandoned checkout', r, w);
  w = new W(); s = w.buy({ mode: 'subscription' }); r = await w.send('checkout.session.completed', s); line('F05', 'a subscription to the same product (not offered)', r, w);
  w = new W(); s = w.buy({ email: 'Buyer@Example.COM' }); r = await w.send('checkout.session.completed', s); line('F06', 'paid as Buyer@Example.COM, Stripe search exact about capitals', r, w, 'stored as: ' + Array.from(w.members.keys()).join(','));
  w = new W(); w.stripe.caseSensitive = false; s = w.buy({ email: 'Buyer@Example.COM' }); r = await w.send('checkout.session.completed', s); line('F07', 'same, Stripe search NOT exact about capitals', r, w);
  w = new W({ members: [[B, 'stripe']] }); s = w.buy({ email: 'Buyer@Example.COM' }); w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('F08', 'full refund of the capitalised purchase', r, w);

  /* G — bought in both shops ---------------------------------------- */
  w = new W({ members: [[B, 'gumroad', '2026-09-15T12:00:00Z']], sales: [H.gsale()] }); s = w.buy(); r = await w.send('checkout.session.completed', s); line('G01', 'Gumroad buyer also buys at Stripe', r, w, 'last sign-in kept: ' + w.members.get(B).last_login);
  w.gum.sales = [H.gsale({ refunded: true })]; r = await ring(w, ping({ refunded: 'true', resource_name: 'refund' })); line('G02', '...then refunds at GUMROAD (through Gumroad\'s own doorbell)', r, w);
  w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('G03', '...then refunds at Stripe as well', r, w);
  w = new W({ members: [[B, 'gumroad']], sales: [H.gsale()] }); s = w.buy(); await w.send('checkout.session.completed', s); w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('G04', 'both shops, Stripe refunded first', r, w);
  w.gum.sales = [H.gsale({ refunded: true })]; r = await ring(w, ping({ refunded: 'true', resource_name: 'refund' })); line('G05', '...then Gumroad refunded', r, w);
  w = new W({ members: [[B, 'stripe']], sales: [H.gsale()] }); w.buy(); r = await ring(w, ping()); line('G06', 'Stripe buyer also buys at Gumroad', r, w);
  w.gum.sales = [H.gsale({ refunded: true })]; r = await ring(w, ping({ refunded: 'true', resource_name: 'refund' })); line('G07', '...then refunds at Gumroad', r, w);
  w = new W({ members: [[B, 'manual']], sales: [H.gsale()] }); s = w.buy(); r = await w.send('checkout.session.completed', s); line('G08', 'somebody Eric added by hand buys at Stripe', r, w);

  /* H — the gate ----------------------------------------------------- */
  function g(n, what, r, w, email, extra) {
    out.push(n + '  ' + what + '  ->  ' + r.status + ' ' + r.body + ' | code emailed: ' + w.mail +
      (w.mailed.length ? ' (to ' + w.mailed.join(',') + ')' : '') + ' | list: ' + w.on(email) +
      (r.bg ? ' | background stopped: ' + r.bg : '') + (w.unknownSql.length ? ' | UNKNOWN SQL' : '') + (extra ? ' | ' + extra : ''));
  }
  w = new W({ members: [['fan@example.com', 'manual']] }); r = await w.gate('fan@example.com'); g('H01', 'address on the list', r, w, 'fan@example.com', 'asked Stripe ' + w.stripe.calls.length + 'x, Gumroad ' + w.gum.calls + 'x');
  w = new W(); r = await w.gate('stranger@example.com'); g('H02', 'stranger', r, w, 'stranger@example.com', 'asked Stripe ' + w.stripe.calls.length + 'x, Gumroad ' + w.gum.calls + 'x');
  w = new W(); w.buy(); r = await w.gate(B); g('H03', 'Stripe buyer whose message has not arrived yet (the safety net)', r, w, B);
  w = new W({ sales: [H.gsale()] }); r = await w.gate(B); g('H04', 'Gumroad buyer whose ping was missed', r, w, B, 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W(); w.buy(); w.stripe.mode = '500'; r = await w.gate(B); g('H05', 'Stripe buyer, but Stripe is down', r, w, B);
  w = new W(); w.buy(); w.stripe.mode = 'throws'; w.gum.mode = 'throws'; r = await w.gate(B); g('H06', 'both shops unreachable', r, w, B);
  w = new W(); s = w.buy(); w.refund(s, 'full'); r = await w.gate(B); g('H07', 'somebody whose Stripe purchase was fully refunded', r, w, B);
  w = new W(); w.buy(OTHER); r = await w.gate(B); g('H08', 'bought something else at Stripe', r, w, B);
  w = new W(); w.buy(); w.stripe.delay = 700; w.gum.delay = 700; r = await w.gate(B); g('H09', 'both shops slow', r, w, B, 'answered before the lookups: ' + (r.ms < 200 && r.after > 1000));
  w = new W({ stripe: false, sales: [H.gsale()] }); r = await w.gate(B); g('H10', 'Stripe not set up at all: Gumroad buyer', r, w, B, 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W({ stripe: false }); r = await w.gate('stranger@example.com'); g('H11', 'Stripe not set up at all: stranger', r, w, 'stranger@example.com', 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W({ gumroad: false }); w.buy(); w.failWrites = true; r = await w.gate(B); g('H12', 'Stripe buyer, the guest list refuses the write (Gumroad off)', r, w, B);
  w = new W(); w.buy({ email: 'Buyer@Example.COM' }); r = await w.gate(B); g('H13', 'paid as Buyer@Example.COM, asks in small letters, search exact about capitals (KNOWN LIMIT)', r, w, B);
  w = new W(); w.stripe.caseSensitive = false; w.buy({ email: 'Buyer@Example.COM' }); r = await w.gate(B); g('H14', 'same, if Stripe search is not exact about capitals', r, w, B);
  r = await new W().gate('not an address'); out.push('H15  mistyped address  ->  ' + r.status + ' ' + r.body);

  /* I — what the worker sends Stripe -------------------------------- */
  w = new W(); s = w.buy(); await w.send('checkout.session.completed', s); w.dispute(s, 'lost'); await w.send('charge.dispute.closed', s); await w.gate(B); await w.admin('stripe'); await w.admin('stripe-check', { email: B });
  out.push('I01  key ever placed in an address: ' + w.stripe.sawKeyInUrl + ' | version header(s) sent: ' + Object.keys(w.stripe.versions).join(',') + ' | anything but a GET sent to Stripe: ' + !!w.stripe.wrote);
  w = new W(); w.stripe.noExpand = true; s = w.buy(); r = await w.send('checkout.session.completed', s); line('I02', 'Stripe folds nothing in: items and charge fetched one by one', r, w);
  w = new W({ members: [[B, 'stripe']] }); w.stripe.noExpand = true; s = w.buy(); w.refund(s, 'full'); r = await w.send('charge.refunded', s); line('I03', 'same, for a full refund', r, w);

  /* J — the admin page's Stripe status ------------------------------- */
  function leak(text) {
    var bad = ['Pat Buyer', 'Ocean Blvd', 'Pawleys', '29585', '4242', '1500', 'amount', H.KEY, H.WHSEC, 'visa', 'billing_details'];
    return bad.filter(function (b) { return text.indexOf(b) > -1; });
  }
  w = new W(); a = await w.admin('stripe'); out.push('J01  status, all three set  ->  ' + a.status + ' ' + JSON.stringify({ set: a.data.set, mode: a.data.mode, kind: a.data.kind, names: a.data.names, can: a.data.can.map(function (c) { return c.ok; }) }) + ' | leaks: [' + leak(a.text) + '] | shows the product value: ' + (a.text.indexOf(H.PROD) > -1));
  w = new W({ stripe: false }); a = await w.admin('stripe'); out.push('J02  status, nothing set  ->  ' + JSON.stringify({ set: a.data.set, mode: a.data.mode, can: a.data.can }) + ' | asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W({ key: 'sk_live_fullkey123' }); a = await w.admin('stripe'); out.push('J03  a full LIVE secret key  ->  mode ' + a.data.mode + ', kind ' + a.data.kind + ' | key echoed back: ' + (a.text.indexOf('sk_live_fullkey123') > -1));
  w = new W({ key: 'whsec_pasted_in_the_wrong_box' }); a = await w.admin('stripe'); out.push('J04  the webhook secret pasted where the key goes  ->  mode ' + a.data.mode + ', kind ' + a.data.kind + ' | echoed back: ' + (a.text.indexOf('whsec_pasted') > -1));
  w = new W(); w.stripe.mode = 'no-disputes'; a = await w.admin('stripe'); out.push('J05  key lacks the disputes permission  ->  ' + a.data.can[1].why + ' | leaks part of the key or account: ' + /rk_test_|acct_/.test(a.text));
  w = new W(); w.stripe.mode = '401'; a = await w.admin('stripe'); out.push('J06  Stripe refuses the key  ->  ' + a.data.can[0].why + ' | Stripe\'s own message passed on: ' + /Invalid API Key|rk_test_\*/.test(a.text));
  w = new W({ product: 'Early Digital Access' }); a = await w.admin('stripe'); out.push('J07  product set to its name  ->  names: ' + a.data.names);
  w = new W(); var none = { waitUntil: function () {} };
  var n1 = await w.api.worker.fetch(new Request('https://graymanmusical.com/vault-api/admin/stripe'), w.env, none);
  var n2 = await w.api.worker.fetch(new Request('https://graymanmusical.com/vault-api/admin/match', { method: 'POST', body: '{"email":"buyer@example.com"}' }), w.env, none);
  var n3 = await w.api.worker.fetch(new Request('https://graymanmusical.com/vault-api/admin/stripe-check', { method: 'POST', body: '{"email":"buyer@example.com"}' }), w.env, none);
  out.push('J08  the three new admin routes with no session  ->  ' + [n1.status, n2.status, n3.status].join(', ') + ' | asked Stripe ' + w.stripe.calls.length + 'x');

  /* K — "Why didn't somebody get in?" ------------------------------- */
  w = new W(); w.buy(); s = w.buy(); w.refund(s, 'full'); s = w.buy(); w.refund(s, 'part'); s = w.buy(); w.dispute(s, 'lost'); w.buy(OTHER); w.buy({ status: 'expired', payment_status: 'unpaid' }); w.buy({ payment_status: 'unpaid' }); s = w.buy(); w.dispute(s, 'won'); w.buy({ email: 'someone.else@example.com' });
  a = await w.admin('stripe-check', { email: B });
  out.push('K01  nine receipts, eight of them this buyer\'s  ->  found ' + a.data.found.length + ': ' + a.data.found.map(function (f) { return f.verdict; }).join(' / '));
  out.push('K02  what one receipt shows: ' + Object.keys(a.data.found[0]).join(', '));
  out.push('K03  name, postal address, amount or card anywhere in that answer: [' + leak(a.text) + '] | somebody else\'s address in it: ' + (a.text.indexOf('someone.else') > -1));
  w = new W(); w.buy({ email: 'other1@example.com' }); w.buy(Object.assign({ email: 'other2@example.com' }, OTHER));
  a = await w.admin('stripe-check', { email: B }); out.push('K04  nobody by that address  ->  found ' + a.data.found.length + ', recent matches ' + JSON.stringify(a.data.recent.map(function (x) { return x.matches; })) + ' | any address in it: ' + /@/.test(a.text) + ' | leaks: [' + leak(a.text) + ']');
  w = new W(); a = await w.admin('stripe-check', { email: B }); out.push('K05  no receipts at all  ->  ' + a.text);
  w = new W(); w.stripe.mode = '500'; a = await w.admin('stripe-check', { email: B }); out.push('K06  Stripe down  ->  ' + a.text);
  w = new W(); w.stripe.mode = '401'; a = await w.admin('stripe-check', { email: B }); out.push('K07  key refused  ->  ' + a.text);
  w = new W({ stripe: false }); a = await w.admin('stripe-check', { email: B }); out.push('K08  Stripe not set up  ->  ' + a.text);
  a = await new W().admin('stripe-check', { email: 'nope' }); out.push('K09  not an address  ->  ' + a.status + ' ' + a.text);
  w = new W({ sales: [H.gsale(), H.gsale({ refunded: true })] }); a = await w.admin('gumroad-check', { email: B }); out.push('K10  gumroad-check, as before  ->  ' + a.data.found.map(function (f) { return f.verdict; }).join(' / '));

  /* L — "Make the list match", both shops --------------------------- */
  var seen = '2026-09-20T10:00:00Z';
  function m(n, what, a, w, extra) {
    var d = a.data || {};
    out.push(n + '  ' + what + '  ->  ' + JSON.stringify({ held: d.held, stripe: d.stripe, gumroad: d.gumroad, listed: d.listed, source: d.source, ok: d.ok }) +
      ' | list: ' + w.on() + ' | sign-in kept: ' + ((w.members.get(B) || {}).last_login || '—') + (w.unknownSql.length ? ' | UNKNOWN SQL' : '') + (extra ? ' | ' + extra : ''));
  }
  w = new W({ members: [[B, 'gumroad', seen]], sales: [H.gsale()] }); a = await w.admin('match', { email: B }); m('L01', 'gumroad row, live at Gumroad only', a, w);
  w = new W({ members: [[B, 'gumroad', seen]], sales: [H.gsale({ refunded: true })] }); w.buy(); a = await w.admin('match', { email: B }); m('L02', 'gumroad row, refunded at Gumroad but live at Stripe', a, w);
  w = new W({ members: [[B, 'stripe', seen]], sales: [H.gsale()] }); s = w.buy(); w.refund(s, 'full'); a = await w.admin('match', { email: B }); m('L03', 'stripe row, refunded at Stripe but live at Gumroad', a, w);
  w = new W({ members: [[B, 'stripe', seen]] }); s = w.buy(); w.refund(s, 'full'); a = await w.admin('match', { email: B }); m('L04', 'stripe row, refunded, nothing at Gumroad', a, w);
  w = new W({ members: [[B, 'gumroad', seen]], sales: [H.gsale({ refunded: true })] }); a = await w.admin('match', { email: B }); m('L05', 'gumroad row, refunded, nothing at Stripe', a, w);
  w = new W(); w.buy(); a = await w.admin('match', { email: B }); m('L06', 'not on the list, live at Stripe', a, w);
  w = new W({ sales: [H.gsale()] }); a = await w.admin('match', { email: B }); m('L07', 'not on the list, live at Gumroad', a, w);
  w = new W(); a = await w.admin('match', { email: B }); m('L08', 'not on the list, nothing anywhere', a, w);
  w = new W({ members: [[B, 'manual', seen]] }); s = w.buy(); w.refund(s, 'full'); a = await w.admin('match', { email: B }); m('L09', 'added by hand, refunded everywhere', a, w);
  w = new W({ members: [[B, 'gumroad', seen]], sales: [H.gsale({ refunded: true })] }); w.stripe.mode = '500'; a = await w.admin('match', { email: B }); m('L10', 'gumroad row refunded at Gumroad, STRIPE DOWN', a, w);
  w = new W({ members: [[B, 'stripe', seen]] }); s = w.buy(); w.refund(s, 'full'); w.gum.mode = '500'; a = await w.admin('match', { email: B }); m('L11', 'stripe row refunded at Stripe, GUMROAD DOWN', a, w);
  w = new W({ members: [[B, 'gumroad', seen]], sales: [H.gsale()] }); w.gum.mode = '500'; a = await w.admin('match', { email: B }); m('L12', 'gumroad row, Gumroad down, nothing at Stripe', a, w);
  w = new W({ stripe: false, members: [[B, 'gumroad', seen]], sales: [H.gsale({ refunded: true })] }); a = await w.admin('match', { email: B }); m('L13', 'Stripe NOT SET UP: gumroad row refunded', a, w, 'asked Stripe ' + w.stripe.calls.length + 'x');
  w = new W({ stripe: false, sales: [H.gsale()] }); a = await w.admin('match', { email: B }); m('L14', 'Stripe NOT SET UP: live Gumroad sale, not listed', a, w);
  w = new W({ members: [[B, 'stripe', seen]] }); s = w.buy(); w.refund(s, 'full'); w.failWrites = true; a = await w.admin('match', { email: B }); m('L15', 'the guest list refuses the write', a, w);
  w = new W({ members: [[B, 'gumroad', seen]], sales: [H.gsale({ refunded: true })] }); a = await w.admin('gumroad-sync', { email: B }); out.push('L16  the old gumroad-sync route, untouched  ->  ' + a.text + ' | list: ' + w.on());

  /* P — patience (the slow one, last) ------------------------------- */
  w = new W(); s = w.buy(); w.stripe.delay = 4500; r = await w.send('checkout.session.completed', s);
  line('P01', 'Stripe API slow: two answers of 4.5 s each', r, w, 'answered at the 8 s mark: ' + (r.ms > 7800 && r.ms < 8800) + ', and the attempt still finished afterwards');

  return out;
};
