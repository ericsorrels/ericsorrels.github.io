// Stand-ins for testing cloudflare/vault-worker.js in a browser pane:
// a fake D1, a fake Stripe API, a fake Gumroad API and a fake mail relay.
// Loaded by index.html beside it, as a module — which is what allows
// the top-level await below. Nothing here is part of the site.
window.__H = await (async function () {
  var src = '';
  async function reload() {
    src = await (await fetch('/cloudflare/vault-worker.js?cb=' + Date.now())).text();
    src = src.replace(/^export default \{/m, 'var __w = {');
    return src.length;
  }
  await reload();

  var TAIL = '\n; return { worker: __w, stripeLive: stripeLive, reconcileStripe: reconcileStripe, stripeLookup: stripeLookup, stripeStatus: stripeStatus, hmacHex: hmacHex, hasLiveSale: hasLiveSale, reconcile: reconcile, gumroadLookup: gumroadLookup, issueSession: issueSession, ADMIN_PAGE: ADMIN_PAGE, STRIPE_EVENTS: STRIPE_EVENTS };';
  var PROD = 'prod_TGMaccess', PRICE = 'price_TGMearly', PLINK = 'plink_TGMearly';
  var GPID = 'STANDINproductID0000==';
  var WHSEC = 'whsec_standin_0123456789';
  var KEY = 'rk_test_standin51Nabc';
  var NOW = function () { return Math.floor(Date.now() / 1000); };

  async function hmac(text, secret) {
    var enc = new TextEncoder();
    var k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    var mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
    return Array.from(mac).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  async function sigHeader(raw, secret, t) {
    t = t == null ? NOW() : t;
    return 't=' + t + ',v1=' + (await hmac(t + '.' + raw, secret)) + ',v0=ignored';
  }
  var serial = 0;

  function World(o) {
    o = o || {}; var self = this;
    this.members = new Map(); this.codes = new Map(); this.throttle = new Map();
    (o.members || []).forEach(function (m) {
      self.members.set(m[0], { email: m[0], source: m[1], added_at: '2026-09-01T00:00:00Z', last_login: m[2] || null });
    });
    this.failWrites = false; this.unknownSql = [];
    this.stripe = { sessions: [], disputes: [], mode: 'ok', delay: 0, caseSensitive: true, calls: [], sawKeyInUrl: false, versions: {}, auth: {} };
    this.gum = { sales: o.sales || [], mode: 'ok', calls: 0 };
    this.mail = 0; this.mailed = [];

    function stmt(sql, args) {
      args = args || [];
      return {
        bind: function () { return stmt(sql, [].slice.call(arguments)); },
        first: async function () {
          if (/FROM throttle/.test(sql)) return self.throttle.get(args[0]) || null;
          if (/count\(\*\) AS n FROM members/.test(sql)) return { n: self.members.size };
          if (/FROM members WHERE email = \?/.test(sql)) { var m = self.members.get(args[0]); return m ? Object.assign({}, m) : null; }
          if (/FROM codes/.test(sql)) return self.codes.get(args[0]) || null;
          self.unknownSql.push(sql); return null;
        },
        all: async function () {
          if (/FROM members ORDER BY/.test(sql)) return { results: Array.from(self.members.values()) };
          self.unknownSql.push(sql); return { results: [] };
        },
        run: async function () {
          var writesMembers = /(INSERT INTO|UPDATE|DELETE FROM) members/.test(sql);
          if (writesMembers && self.failWrites) throw new Error('D1 write refused');
          var m = self.members.get(args[0]);
          if (/INSERT INTO throttle/.test(sql)) self.throttle.set(args[0], { count: 1, window_until: args[1] });
          else if (/UPDATE throttle/.test(sql)) { var t = self.throttle.get(args[0]); if (t) t.count++; }
          else if (/DELETE FROM throttle/.test(sql)) { /* swept */ }
          else if (/INSERT INTO members[\s\S]*DO UPDATE SET source = 'stripe'\s+WHERE members\.source = 'gumroad'/.test(sql)) {
            if (!m) self.members.set(args[0], { email: args[0], source: args[1], added_at: args[2], last_login: null });
            else if (m.source === 'gumroad') m.source = 'stripe';
          }
          else if (/INSERT INTO members[\s\S]*DO NOTHING/.test(sql)) {
            if (!m) self.members.set(args[0], { email: args[0], source: args[1], added_at: args[2], last_login: null });
          }
          else if (/UPDATE members SET source = 'gumroad' WHERE email = \? AND source = 'stripe'/.test(sql)) { if (m && m.source === 'stripe') m.source = 'gumroad'; }
          else if (/UPDATE members SET last_login/.test(sql)) { var mm = self.members.get(args[1]); if (mm) mm.last_login = args[0]; }
          else if (/DELETE FROM members WHERE email = \? AND source = 'gumroad'/.test(sql)) { if (m && m.source === 'gumroad') self.members.delete(args[0]); }
          else if (/DELETE FROM members WHERE email = \? AND source = 'stripe'/.test(sql)) { if (m && m.source === 'stripe') self.members.delete(args[0]); }
          else if (/DELETE FROM members WHERE email = \?$/.test(sql)) self.members.delete(args[0]);
          else if (/INSERT INTO codes/.test(sql)) self.codes.set(args[0], { code_hash: args[1], expires_at: args[2], tries: 0, sent_at: args[3] });
          else if (/DELETE FROM codes WHERE email/.test(sql)) self.codes.delete(args[0]);
          else if (/DELETE FROM codes WHERE expires_at/.test(sql)) { /* swept */ }
          else if (/UPDATE codes SET tries/.test(sql)) { /* counted */ }
          else self.unknownSql.push(sql);
          return {};
        }
      };
    }

    this.env = {
      SESSION_SECRET: 's', RESEND_API_KEY: 'k', ADMIN_EMAIL: 'eric@example.com',
      MEMBERS: {
        prepare: function (sql) { return stmt(sql); },
        batch: async function (l) { for (var i = 0; i < l.length; i++) await l[i].run(); return []; }
      }
    };
    if (o.gumroad !== false) { this.env.GUMROAD_TOKEN = 'tok'; this.env.GUMROAD_PRODUCT = GPID; this.env.GUMROAD_PING_SECRET = 'bell'; }
    if (o.stripe !== false) { this.env.STRIPE_SECRET_KEY = o.key || KEY; this.env.STRIPE_WEBHOOK_SECRET = WHSEC; this.env.STRIPE_PRODUCT = o.product || PROD; }

    function J(data, status) { return new Response(JSON.stringify(data), { status: status || 200, headers: { 'content-type': 'application/json' } }); }
    function wants(q, name) { return q.getAll('expand[]').indexOf(name) > -1; }

    // Only what was asked for is folded in, as the real API does.
    function show(s, q, prefix) {
      var out = {}; Object.keys(s).forEach(function (k) { if (k[0] !== '_') out[k] = s[k]; });
      if (wants(q, prefix + 'line_items')) out.line_items = { object: 'list', data: s._items, has_more: false };
      if (s._intent) {
        if (wants(q, prefix + 'payment_intent.latest_charge')) out.payment_intent = Object.assign({}, s._intent.pub, { latest_charge: s._intent.charge });
        else if (wants(q, prefix + 'payment_intent')) out.payment_intent = Object.assign({}, s._intent.pub, { latest_charge: s._intent.charge.id });
        else out.payment_intent = s._intent.pub.id;
      } else out.payment_intent = null;
      return out;
    }

    async function stripeApi(u, init) {
      var S = self.stripe; var q = u.searchParams; var path = u.pathname.replace('/v1/', '');
      S.calls.push(path + (u.search ? '?' + decodeURIComponent(u.search.slice(1)) : ''));
      var wantKey = self.env.STRIPE_SECRET_KEY || KEY;
      if (u.href.indexOf(wantKey) > -1) S.sawKeyInUrl = true;
      var h = new Headers((init && init.headers) || {});
      S.versions[h.get('stripe-version')] = true;
      if (init && init.method && init.method !== 'GET') S.wrote = true;
      if (S.delay) await new Promise(function (r) { setTimeout(r, S.delay); });
      if (S.mode === 'throws') throw new Error('unreachable');
      if (S.mode === '500') return J({ error: { message: 'boom' } }, 500);
      if (S.mode === 'junk') return new Response('<html>', { status: 200 });
      if (h.get('authorization') !== 'Bearer ' + wantKey || S.mode === '401') {
        return J({ error: { type: 'invalid_request_error', message: 'Invalid API Key provided: rk_test_*********bc' } }, 401);
      }
      if (S.mode === 'no-disputes' && path === 'disputes') {
        return J({ error: { type: 'invalid_request_error', message: "The provided key 'rk_test_*****************3Nabc' does not have the required permissions for this endpoint on account 'acct_1ABC'. Having the 'rak_dispute_read' permission would allow this request to continue." } }, 403);
      }
      var m;
      if ((m = path.match(/^checkout\/sessions\/([^/]+)\/line_items$/))) {
        var s0 = S.sessions.find(function (x) { return x.id === m[1]; });
        return s0 ? J({ object: 'list', data: s0._items, has_more: false }) : J({ error: { code: 'resource_missing' } }, 404);
      }
      if ((m = path.match(/^checkout\/sessions\/([^/]+)$/))) {
        var s1 = S.sessions.find(function (x) { return x.id === m[1]; });
        return s1 ? J(show(s1, S.noExpand ? new URLSearchParams() : q, '')) : J({ error: { code: 'resource_missing', message: 'No such checkout.session' } }, 404);
      }
      if (path === 'checkout/sessions') {
        var list = S.sessions.slice().reverse();
        var em = q.get('customer_details[email]');
        if (em != null) list = list.filter(function (x) {
          var e = (x.customer_details && x.customer_details.email) || '';
          return S.caseSensitive ? e === em : e.toLowerCase() === em.toLowerCase();
        });
        if (q.get('payment_intent')) list = list.filter(function (x) { return x._intent && x._intent.pub.id === q.get('payment_intent'); });
        if (q.get('status')) list = list.filter(function (x) { return x.status === q.get('status'); });
        var lim = Number(q.get('limit') || 10); var more = list.length > lim || !!S.forceMore;
        return J({ object: 'list', has_more: more, data: list.slice(0, lim).map(function (x) { return show(x, S.noExpand ? new URLSearchParams() : q, 'data.'); }) });
      }
      if ((m = path.match(/^payment_intents\/([^/]+)$/))) {
        var s2 = S.sessions.find(function (x) { return x._intent && x._intent.pub.id === m[1]; });
        if (!s2) return J({ error: { code: 'resource_missing' } }, 404);
        return J(Object.assign({}, s2._intent.pub, { latest_charge: (wants(q, 'latest_charge') && !S.noExpand) ? s2._intent.charge : s2._intent.charge.id }));
      }
      if ((m = path.match(/^charges\/([^/]+)$/))) {
        var s3 = S.sessions.find(function (x) { return x._intent && x._intent.charge.id === m[1]; });
        if (s3) return J(s3._intent.charge);
        var lone = (S.loneCharges || []).find(function (c) { return c.id === m[1]; });
        return lone ? J(lone) : J({ error: { code: 'resource_missing' } }, 404);
      }
      if (path === 'disputes') {
        var ds = S.disputes.filter(function (d) { return !q.get('charge') || d.charge === q.get('charge'); });
        if (S.hideDisputes) ds = [];
        return J({ object: 'list', has_more: false, data: ds });
      }
      return J({ error: { message: 'fake Stripe: no such route ' + path } }, 404);
    }

    this.fetch = async function (url, init) {
      var u = new URL(String(url));
      if (u.host === 'api.stripe.com') return stripeApi(u, init);
      if (u.host === 'api.resend.com') {
        self.mail++;
        try { self.mailed.push(JSON.parse(init.body).to[0]); } catch (e) { /* not needed */ }
        return J({ id: 'x' });
      }
      if (u.host === 'api.gumroad.com') {
        self.gum.calls++;
        if (self.gum.delay) await new Promise(function (r) { setTimeout(r, self.gum.delay); });
        if (self.gum.mode === '500') return new Response('x', { status: 500 });
        if (self.gum.mode === 'throws') throw new Error('unreachable');
        var em2 = u.searchParams.get('email');
        var sales = self.gum.sales.filter(function (x) { return !em2 || x.email === em2; });
        return J({ success: true, sales: sales });
      }
      throw new Error('fake fetch: unexpected host ' + u.host);
    };
    this.api = new Function('fetch', src + TAIL)(this.fetch);
  }

  World.prototype.buy = function (o) {
    o = o || {}; var k = ++serial; var paid = o.payment_status || 'paid';
    var s = {
      id: 'cs_test_' + k, object: 'checkout.session', status: o.status || 'complete', payment_status: paid,
      mode: o.mode || 'payment', created: NOW() - 60, livemode: false, amount_total: 1500, currency: 'usd',
      customer_details: { email: o.email || 'buyer@example.com', name: 'Pat Buyer', address: { line1: '1 Ocean Blvd', city: 'Pawleys Island', postal_code: '29585', country: 'US' } },
      customer_email: null,
      payment_link: o.plink === undefined ? PLINK : o.plink,
      _items: [{ id: 'li_' + k, object: 'item', quantity: 1, amount_total: 1500, description: 'Early Digital Access', price: { id: o.price || PRICE, object: 'price', product: o.product || PROD, unit_amount: 1500 } }]
    };
    if (paid !== 'no_payment_required' && s.status === 'complete') {
      s._intent = {
        pub: { id: 'pi_' + k, object: 'payment_intent', status: paid === 'paid' ? 'succeeded' : 'processing', amount: 1500 },
        charge: { id: 'ch_' + k, object: 'charge', amount: 1500, amount_refunded: 0, refunded: false, disputed: false, payment_intent: 'pi_' + k, billing_details: { name: 'Pat Buyer', email: s.customer_details.email, address: { line1: '1 Ocean Blvd' } }, payment_method_details: { card: { brand: 'visa', last4: '4242' } } }
      };
    }
    this.stripe.sessions.push(s); return s;
  };
  World.prototype.refund = function (s, how) {
    var c = s._intent.charge;
    if (how === 'part') { c.amount_refunded = 500; c.refunded = false; }
    else { c.amount_refunded = c.amount; c.refunded = true; }
  };
  World.prototype.dispute = function (s, status) {
    var c = s._intent.charge; c.disputed = true;
    var d = this.stripe.disputes.find(function (x) { return x.charge === c.id; });
    if (!d) { d = { id: 'dp_' + (++serial), object: 'dispute', charge: c.id, payment_intent: c.payment_intent, amount: 1500 }; this.stripe.disputes.push(d); }
    d.status = status; return d;
  };
  // What Stripe would post: the object as an event carries it, nothing folded in.
  World.prototype.eventFor = function (type, s) {
    var obj;
    if (type.indexOf('checkout.') === 0) {
      obj = {}; Object.keys(s).forEach(function (k2) { if (k2[0] !== '_') obj[k2] = s[k2]; });
      obj.payment_intent = s._intent ? s._intent.pub.id : null;
    }
    else if (type === 'charge.refunded') obj = s._intent.charge;
    else obj = this.stripe.disputes.find(function (x) { return x.charge === s._intent.charge.id; });
    return JSON.stringify({ id: 'evt_' + (++serial), object: 'event', api_version: '2026-09-30.endive', created: NOW(), livemode: false, type: type, data: { object: obj } });
  };
  World.prototype.hook = async function (raw, o) {
    o = o || {}; var pending = []; var headers = { 'content-type': 'application/json' };
    if (o.header !== null) headers['stripe-signature'] = o.header || await sigHeader(raw, o.secret || WHSEC, o.t);
    var req = new Request('https://graymanmusical.com/vault-api/' + (o.path || 'stripe/webhook'),
      o.method === 'GET' ? { method: 'GET', headers: headers } : { method: 'POST', headers: headers, body: o.body === undefined ? raw : o.body });
    var t0 = performance.now();
    var reply = await this.api.worker.fetch(req, this.env, { waitUntil: function (p) { pending.push(p); } });
    var ms = Math.round(performance.now() - t0);
    var body = await reply.text(); var bg = null;
    try { await Promise.all(pending); } catch (e) { bg = e.message; }
    return { status: reply.status, body: body, ms: ms, bg: bg };
  };
  World.prototype.send = async function (type, s, o) { return this.hook(this.eventFor(type, s), o); };
  World.prototype.on = function (email) { var m = this.members.get(email || 'buyer@example.com'); return m ? 'ON (' + m.source + ')' : 'off'; };
  World.prototype.gate = async function (email) {
    var pending = [];
    var req = new Request('https://graymanmusical.com/vault-api/request-code', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.' + (++serial % 250) }, body: JSON.stringify({ email: email }) });
    var t0 = performance.now();
    var reply = await this.api.worker.fetch(req, this.env, { waitUntil: function (p) { pending.push(p); } });
    var ms = Math.round(performance.now() - t0);
    var body = await reply.text(); var t1 = performance.now(); var bg = null;
    try { await Promise.all(pending); } catch (e) { bg = e.message; }
    return { status: reply.status, body: body, ms: ms, after: Math.round(performance.now() - t1), bg: bg };
  };
  // Eric, signed in, calling one of the admin page's own routes.
  World.prototype.admin = async function (action, body) {
    this.members.set('eric@example.com', this.members.get('eric@example.com') || { email: 'eric@example.com', source: 'manual', added_at: '2026-09-01T00:00:00Z', last_login: null });
    var token = await this.api.issueSession('eric@example.com', this.env);
    // A plain stand-in rather than a real Request: a browser will not let
    // a page set a Cookie header on one, and the cookie is the point.
    var sent = { cookie: 'tgm_vault=' + token, 'content-type': 'application/json' };
    var req = {
      method: body ? 'POST' : 'GET',
      url: 'https://graymanmusical.com/vault-api/admin/' + action,
      headers: { get: function (name) { return sent[String(name).toLowerCase()] || null; } },
      json: async function () { return body; },
      text: async function () { return JSON.stringify(body); }
    };
    var reply = await this.api.worker.fetch(req, this.env, { waitUntil: function () {} });
    var text = await reply.text(); var data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    return { status: reply.status, text: text, data: data };
  };

  function gsale(extra) {
    return Object.assign({ email: 'buyer@example.com', product_name: 'Purchase Early Digital Access', product_id: GPID, product_permalink: 'abcxyz', refunded: false, chargedback: false, disputed: false, dispute_won: false, access_revoked: false }, extra || {});
  }

  // Puts the real admin page on screen, talking to this world instead of
  // to Cloudflare — the only way to see that page from here, since the
  // live one needs Eric's own sign-in. Everything it shows is made up.
  function showAdmin(w) {
    window.fetch = async function (url, init) {
      var path = String(url).split('/vault-api/admin/')[1];
      var body = init && init.body ? JSON.parse(init.body) : null;
      var a = await w.admin(path, body);
      return new Response(a.text, { status: a.status, headers: { 'content-type': 'application/json' } });
    };
    var page = w.api.ADMIN_PAGE;
    document.open(); document.write(page); document.close();
  }

  return { World: World, reload: reload, showAdmin: showAdmin, sigHeader: sigHeader, hmac: hmac, gsale: gsale, PROD: PROD, PRICE: PRICE, PLINK: PLINK, WHSEC: WHSEC, KEY: KEY, NOW: NOW, bytes: function () { return src.length; } };
})();
