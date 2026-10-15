// The Report a Sighting cases for cloudflare/vault-worker.js, run against
// stand-ins (see harness.js). One line each, compared with expected.json.
window.__REPORT_CASES = async function () {
  var H = window.__H, W = H.World, out = [];
  var B = 'buyer@example.com';
  var w, r, a, stored;

  function base(extra) {
    return Object.assign({ sentence: 'A storm you can hear coming for sixty years.' }, extra || {});
  }
  function kept(w, who) {
    var row = w.reports.get(who || B);
    if (!row) return 'nothing stored';
    var ans = JSON.parse(row.answers);
    return 'stored: ' + JSON.stringify({ sentence: ans.sentence, credit: ans.credit, may_quote: row.may_quote, approved: row.approved, filed: row.filed_at === row.updated_at ? 'once' : 'revised' });
  }
  function line(n, what, r, w, extra) {
    out.push(n + '  ' + what + '  ->  ' + r.status + ' ' + (r.text || '').replace(/"updated_at":"[^"]+"/, '"updated_at":"…"') +
      ' | ' + kept(w) + (w.unknownSql.length ? ' | UNKNOWN SQL: ' + w.unknownSql[0] : '') + (extra ? ' | ' + extra : ''));
  }

  /* A — who may file ------------------------------------------------- */
  w = new W(); r = await w.report('GET', undefined, { noSession: true }); line('R01', 'no session, asking for a report', r, w);
  w = new W(); r = await w.report('POST', base(), { noSession: true }); line('R02', 'no session, filing a report', r, w);
  w = new W(); r = await w.report('POST', base(), { notListed: true }); line('R03', 'a good session, but taken off the guest list since', r, w);
  w = new W(); r = await w.report('POST', base()); line('R04', 'a valid session files the one required answer', r, w);
  r = await w.report('GET'); line('R05', '...and asks for it back', r, w);
  w = new W(); r = await w.report('PUT', base()); line('R06', 'a PUT', r, w);
  w = new W(); r = await w.report('POST', base({ email: 'someone.else@example.com' })); line('R07', 'an address slipped into the body', r, w, 'filed under somebody else: ' + w.reports.has('someone.else@example.com'));

  /* B — filing again ------------------------------------------------- */
  w = new W(); await w.report('POST', base({ may_quote: true }));
  w.reports.get(B).filed_at = '2026-10-15T09:00:00Z';
  a = await w.admin('report-approve', { email: B, approved: true });
  var before = kept(w);
  r = await w.report('POST', base({ sentence: 'Changed my mind: a ghost story told by the weather.', may_quote: true }));
  line('R08', 'filed, approved, then filed again with new words', r, w, 'approval was: ' + a.text + ' | before: ' + before + ' | rows: ' + w.reports.size);

  /* C — what is refused ---------------------------------------------- */
  w = new W(); r = await w.report('POST', base({ sentence: 'x'.repeat(281) })); line('R09', 'the one sentence at 281 characters (cap 280)', r, w);
  w = new W(); r = await w.report('POST', base({ sentence: 'x'.repeat(280) })); line('R10', 'the one sentence at exactly 280', r, w);
  w = new W(); r = await w.report('POST', base({ change: 'y'.repeat(1001) })); line('R11', 'the private answer at 1001 (cap 1000)', r, w);
  w = new W(); r = await w.report('POST', base({ last_initial: 'Doe', credit: 'initial', first_name: 'Pat', city: 'Charleston' })); line('R12', 'a last "initial" three letters long', r, w);
  w = new W(); r = await w.report('POST', base({ sentence: '' })); line('R13', 'the required sentence left empty', r, w);
  w = new W(); r = await w.report('POST', base({ sentence: '   \n  ' })); line('R14', 'the required sentence only spaces', r, w);
  w = new W(); r = await w.report('POST', base({ character: 'villain' })); line('R15', 'a character that is not one of the choices', r, w);
  w = new W(); r = await w.report('POST', base({ sentence: 42 })); line('R16', 'a number where words go', r, w);
  w = new W(); r = await w.report('POST', 'email=x&sentence=y', { type: 'application/x-www-form-urlencoded' }); line('R17', 'posted as a form from elsewhere, not JSON', r, w);
  w = new W(); r = await w.report('POST', '{not json'); line('R18', 'JSON that does not parse', r, w);
  w = new W(); r = await w.report('POST', base({ moment: 'z'.repeat(17000) })); line('R19', 'a body over 16 KB', r, w);
  w = new W(); r = await w.report('POST', [base()]); line('R20', 'a list instead of answers', r, w);
  w = new W(); w.failWrites = true; r = await w.report('POST', base()); line('R21', 'the guest list refuses the write', r, w);

  /* D — what is kept ------------------------------------------------- */
  w = new W(); r = await w.report('POST', base({ sentence: '<script>alert("storm")</script> & <b>bold</b>' }));
  line('R22', 'words containing HTML', r, w, 'kept exactly as typed: ' + (JSON.parse(w.reports.get(B).answers).sentence === '<script>alert("storm")</script> & <b>bold</b>'));
  w = new W(); r = await w.report('POST', base({ heard: 'friend', heard_other: 'a ghost', work: 'no', work_title: 'Director', favourite_colour: 'gray' }));
  stored = JSON.parse(w.reports.get(B).answers);
  out.push('R23  answers that no longer apply, and a key nobody asked for  ->  ' + r.status + ' | heard_other: "' + stored.heard_other + '" | work_title: "' + stored.work_title + '" | unknown key kept: ' + ('favourite_colour' in stored));
  w = new W(); r = await w.report('POST', base({ tickets: 'true', video: 1, may_quote: true }));
  stored = JSON.parse(w.reports.get(B).answers);
  out.push('R24  ticks given as the word "true" and the number 1  ->  ' + r.status + ' | tickets: ' + stored.tickets + ' | video: ' + stored.video + ' | may_quote: ' + stored.may_quote);
  w = new W(); r = await w.report('POST', base({ sentence: '  Line one\r\nLine two\u0007  ' }));
  out.push('R25  Windows line endings, a control character, spaces round it  ->  ' + r.status + ' | ' + JSON.stringify(JSON.parse(w.reports.get(B).answers).sentence));

  /* E — credit ------------------------------------------------------- */
  w = new W(); r = await w.report('POST', base({ credit: 'full' })); line('R26', 'credit by full name, but no name', r, w);
  w = new W(); r = await w.report('POST', base({ credit: 'initial', first_name: 'Pat', last_initial: 'D' })); line('R27', 'first name and initial, but no city', r, w);
  var credits = [
    ['full', { credit: 'full', full_name: 'Pat Doe', city: 'Should be dropped' }],
    ['initial', { credit: 'initial', first_name: 'Pat', last_initial: 'd.', city: 'Charleston', kickstarter: true }],
    ['anonymous with a state', { credit: 'anonymous', state: 'Ohio', full_name: 'Should be dropped' }],
    ['anonymous, no state', { credit: '' }]
  ];
  for (var i = 0; i < credits.length; i++) {
    w = new W(); r = await w.report('POST', base(credits[i][1]));
    stored = JSON.parse(w.reports.get(B).answers);
    out.push('R' + (28 + i) + '  credit: ' + credits[i][0] + '  ->  ' + r.status + ' | line: "' + w.api.reportCredit(stored) + '" | dropped: ' + JSON.stringify({ full_name: stored.full_name, city: stored.city }));
  }

  /* F — the brake ----------------------------------------------------- */
  w = new W();
  var codes = [];
  for (var k = 0; k < 31; k++) codes.push((await w.report('POST', base({ sentence: 'try ' + k }))).status);
  out.push('R32  31 filings inside an hour  ->  the first 30: ' + Array.from(new Set(codes.slice(0, 30))).join(',') + ' | the 31st: ' + codes[30]);

  /* G — the admin page's side ----------------------------------------- */
  w = new W();
  await w.report('POST', base({ sentence: 'First', may_quote: true }), { as: 'one@example.com' });
  w.reports.get('one@example.com').updated_at = '2026-10-15T09:00:00Z';
  await w.report('POST', base({ sentence: 'Second', may_quote: false, tickets: true }), { as: 'two@example.com' });
  a = await w.admin('reports');
  out.push('R33  the list  ->  ' + a.status + ' | newest first: ' + a.data.reports.map(function (x) { return x.email + ' (' + (x.may_quote ? 'may quote' : 'private') + ')'; }).join(', ') + ' | credit lines: ' + a.data.reports.map(function (x) { return x.credit_line; }).join(' / '));
  a = await w.admin('report-approve', { email: 'two@example.com', approved: true }); out.push('R34  approving a private one  ->  ' + a.status + ' ' + a.text);
  a = await w.admin('report-approve', { email: 'one@example.com', approved: true }); out.push('R35  approving one that may be quoted  ->  ' + a.status + ' ' + a.text + ' | stored: ' + w.reports.get('one@example.com').approved);

  w = new W();
  await w.report('POST', base({ sentence: '=HYPERLINK("http://evil.example","click")', moment: 'He said "go"', change: 'Private thought' }));
  a = await w.admin('reports.csv');
  var rows = a.text.replace(/^﻿/, '').split('\r\n');
  out.push('R36  the spreadsheet  ->  ' + a.status + ' | starts with the UTF-8 mark (read before decoding strips it): ' + (w.api.reportsCsv([]).charCodeAt(0) === 0xFEFF) + ' | columns: ' + rows[0].split('","').length +
    ' | private marked: ' + (rows[0].indexOf('Anything to change (PRIVATE)') > -1) +
    ' | formula defused: ' + (rows[1].indexOf('"\'=HYPERLINK(""http://evil.example"",""click"")"') > -1) +
    ' | quotes doubled: ' + (rows[1].indexOf('"He said ""go"""') > -1));

  w = new W(); var none = { waitUntil: function () {} };
  var n1 = await w.api.worker.fetch(new Request('https://graymanmusical.com/vault-api/admin/reports'), w.env, none);
  var n2 = await w.api.worker.fetch(new Request('https://graymanmusical.com/vault-api/admin/reports.csv'), w.env, none);
  var n3 = await w.api.worker.fetch(new Request('https://graymanmusical.com/vault-api/admin/report-approve', { method: 'POST', body: '{"email":"x@y.com","approved":true}' }), w.env, none);
  out.push('R37  the three admin routes with no session  ->  ' + [n1.status, n2.status, n3.status].join(', '));

  return out;
};
