// The 15 gate and lookup cases first run on 5 October 2026. Kept as
// they were run; only the product ids are stand-ins.
window.__GUMROAD_REGRESS = async function(){
  var src = await (await fetch('/cloudflare/vault-worker.js?cb='+Date.now())).text();
  src = src.replace(/^export default \{/m, 'var __w = {');
  var PID = 'STANDINproductID0000==';
  function sale(extra){ return Object.assign({ email:'buyer@example.com', product_name:'Purchase Early Digital Access', product_id: PID, product_permalink:'abcxyz', refunded:false, chargedback:false, disputed:false, dispute_won:false, access_revoked:false }, extra||{}); }
  function build(o){ o=o||{}; var members=new Map(o.members||[]); var codes=new Map(); var throttle=new Map(); var calls={gumroad:0,mail:0};
    function stmt(sql,args){ args=args||[]; return { bind:function(){return stmt(sql,[].slice.call(arguments));},
      first: async function(){ if(/FROM throttle/.test(sql)) return throttle.get(args[0])||null; if(/FROM members WHERE email/.test(sql)) return members.get(args[0])||null; if(/FROM codes/.test(sql)) return codes.get(args[0])||null; return null; },
      run: async function(){ if(/INSERT INTO throttle/.test(sql)) throttle.set(args[0],{count:1,window_until:args[1]}); else if(/UPDATE throttle/.test(sql)){var t=throttle.get(args[0]); if(t)t.count++;} else if(/INSERT INTO members/.test(sql)){ if(!members.has(args[0])) members.set(args[0],{email:args[0],source:args[1]}); } else if(/DELETE FROM members WHERE email = \? AND source/.test(sql)){ var m=members.get(args[0]); if(m&&m.source==='gumroad') members.delete(args[0]); } else if(/INSERT INTO codes/.test(sql)) codes.set(args[0],{sent_at:args[3],expires_at:args[2]}); else if(/DELETE FROM codes WHERE email/.test(sql)) codes.delete(args[0]); return {}; } }; }
    var env={ SESSION_SECRET:'s', RESEND_API_KEY:'k', GUMROAD_TOKEN:'tok', GUMROAD_PRODUCT:o.product||PID, MEMBERS:{ prepare:function(sql){return stmt(sql);}, batch: async function(l){ for(var i=0;i<l.length;i++) await l[i].run(); return []; } } };
    var fakeFetch = async function(url){ url=String(url); if(url.indexOf('resend')>-1){ calls.mail++; return new Response('{"id":"x"}',{status:200}); } calls.gumroad++; if(o.api==='500') return new Response('x',{status:500}); var list=o.api; if(url.indexOf('email=')<0 && o.recent) list=o.recent; return new Response(JSON.stringify({success:true,sales:list}),{status:200}); };
    var api = new Function('fetch', src+'\n; return { worker: __w, gumroadLookup: gumroadLookup, hasLiveSale: hasLiveSale };')(fakeFetch);
    return { api: api, env: env, members: members, calls: calls };
  }
  async function gate(name, o, email){ var x=build(o); var pending=[]; var req=new Request('https://graymanmusical.com/vault-api/request-code',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'203.0.113.5'},body:JSON.stringify({email:email})}); var reply=await x.api.worker.fetch(req,x.env,{waitUntil:function(p){pending.push(p);}}); var body=await reply.json(); await Promise.all(pending); return 'GATE  '+name+'  ->  '+reply.status+' '+JSON.stringify(body)+' | code emailed: '+x.calls.mail+' | on list: '+x.members.has(email); }
  var out=[]; var member=[['fan@example.com',{email:'fan@example.com',source:'manual'}]];
  out.push(await gate('address on the list', {members:member, api:[]}, 'fan@example.com'));
  out.push(await gate('buyer whose ping was missed (the safety net)', {members:member, api:[sale()]}, 'buyer@example.com'));
  out.push(await gate('stranger', {members:member, api:[]}, 'stranger@example.com'));
  out.push(await gate('stranger while Gumroad is down', {members:member, api:'500'}, 'stranger@example.com'));
  var x;
  x=build({api:[sale()]}); out.push('LIVE? plain sale  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:[sale({refunded:true})]}); out.push('LIVE? refunded  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:[sale({chargedback:true})]}); out.push('LIVE? chargedback:true  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:[sale({disputed:true})]}); out.push('LIVE? disputed  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:[sale({disputed:true,dispute_won:true})]}); out.push('LIVE? dispute won  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:[sale({access_revoked:true})]}); out.push('LIVE? access revoked  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:[sale({product_id:'OTHER==',product_permalink:'zzzzz'})]}); out.push('LIVE? other product  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:[sale({email:'someone.else@example.com'})]}); out.push('LIVE? sale under another address  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:'500'}); out.push('LIVE? Gumroad down  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  x=build({api:[sale(), sale({refunded:true}), sale({chargedback:true}), sale({product_id:'OTHER==',product_permalink:'zzzzz'})]}); var look=await x.api.gumroadLookup(x.env,'buyer@example.com'); out.push('ADMIN CHECK verdicts  ->  '+look.found.map(function(f){return f.verdict;}).join(' / '));
  x=build({api:[sale()], product:'https://example.gumroad.com/l/abcxyz'}); out.push('LIVE? GUMROAD_PRODUCT given as a full address  ->  '+await x.api.hasLiveSale(x.env,'buyer@example.com'));
  return out;
};
