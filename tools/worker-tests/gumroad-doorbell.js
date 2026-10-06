// The 25 doorbell cases first run on 5 October 2026, when the ping was
// made to ask for a re-send. Kept as they were run; only the product ids
// are stand-ins.
window.__GUMROAD_DOORBELL = async function(){
  var src = await (await fetch('/cloudflare/vault-worker.js?cb='+Date.now())).text();
  src = src.replace(/^export default \{/m, 'var __w = {');
  var PID = 'STANDINproductID0000==';
  function sale(extra){ return Object.assign({ email:'buyer@example.com', product_id: PID, product_permalink:'abcxyz', refunded:false, partially_refunded:false, chargedback:false, disputed:false, dispute_won:false, access_revoked:false }, extra||{}); }
  function ping(extra){ var p = Object.assign({ seller_id:'x', product_id: PID, product_name:'Purchase Early Digital Access', permalink:'earlyaccess', product_permalink:'https://example.gumroad.com/l/earlyaccess', short_product_id:'abcxyz', email:'buyer@example.com', price:'1708', referrer:'direct', 'card[type]':'visa', refunded:'false', resource_name:'sale', disputed:'false', dispute_won:'false' }, extra||{}); return new URLSearchParams(p).toString(); }
  function World(o){ o=o||{}; var self=this; this.members=new Map(o.members||[]); this.failWrites=!!o.failWrites; this.product=o.product===undefined?PID:o.product; this.api=o.api; this.apiDelay=o.apiDelay||0; this.asked=0; this.unhandled=0;
    function stmt(sql,args){ args=args||[]; return { bind:function(){return stmt(sql,[].slice.call(arguments));}, first: async function(){ if(/FROM members WHERE email/.test(sql)) return self.members.get(args[0])||null; return null; }, run: async function(){ if(/INSERT INTO members/.test(sql)){ if(self.failWrites) throw new Error('D1 write refused'); if(!self.members.has(args[0])) self.members.set(args[0],{email:args[0],source:args[1]}); } else if(/DELETE FROM members WHERE email = \? AND source/.test(sql)){ if(self.failWrites) throw new Error('D1 write refused'); var m=self.members.get(args[0]); if(m&&m.source==='gumroad') self.members.delete(args[0]); } return {}; } }; }
    this.env={ SESSION_SECRET:'s', GUMROAD_PING_SECRET:'bell', GUMROAD_TOKEN:'tok', MEMBERS:{ prepare:function(sql){return stmt(sql);}, batch: async function(l){ for(var i=0;i<l.length;i++) await l[i].run(); return []; } } };
    if(this.product!==null) this.env.GUMROAD_PRODUCT=this.product;
    var fakeFetch = async function(){ self.asked++; if(self.apiDelay) await new Promise(function(r){setTimeout(r,self.apiDelay);}); var a=self.api; if(a==='500') return new Response('x',{status:500}); if(a==='429') return new Response('x',{status:429}); if(a==='throws') throw new Error('unreachable'); if(a==='junk') return new Response('<html>',{status:200}); return new Response(JSON.stringify({success:true,sales:a}),{status:200}); };
    this.worker = new Function('fetch', src+'\n; return __w;')(fakeFetch);
  }
  World.prototype.ring = async function(body, opts){ opts=opts||{}; var pending=[]; var ctx={ waitUntil:function(p){ pending.push(p); } }; var t0=performance.now(); var req=new Request('https://graymanmusical.com/vault-api/gumroad/'+(opts.secret||'bell'), { method: opts.method||'POST', headers: opts.method==='GET'?{}:{'content-type': opts.ctype||'application/x-www-form-urlencoded'}, body: opts.method==='GET'?undefined:body }); var reply=await this.worker.fetch(req,this.env,ctx); var ms=Math.round(performance.now()-t0); var bgErr=null; try{ await Promise.all(pending);}catch(e){ bgErr=e.message; } return { status: reply.status, ms: ms, bgErr: bgErr }; };
  function has(w){ var m=w.members.get('buyer@example.com'); return m ? 'ON (' + m.source + ')' : 'off'; }
  var out=[]; var w, r, r2;
  function line(n, what, r, w, extra){ out.push(n + '  ' + what + '  ->  ' + r.status + (r.ms>1000?' after '+(r.ms/1000).toFixed(1)+'s':'') + ' | list: ' + has(w) + ' | asked Gumroad ' + w.asked + 'x' + (r.bgErr?' | UNHANDLED: '+r.bgErr:'') + (extra?' | '+extra:'')); }
  w=new World({api:[sale()]}); r=await w.ring(ping()); line('01','sale ping, sale on record',r,w);
  w=new World({api:[sale({referrer:'https://l.instagram.com/'})]}); r=await w.ring(ping({referrer:'https://l.instagram.com/','card[type]':'link','url_params[fbclid]':'PAZXh0example','offer_code':'EARLYACCESS25'})); line('02','Instagram sale ping',r,w);
  w=new World({api:[]}); r=await w.ring(ping()); var first=r.status+' list '+has(w); w.api=[sale()]; r2=await w.ring(ping({retry_count:'1'})); line('03','sale ping, not on record yet; then Gumroad re-sends',r2,w,'first answer was '+first);
  w=new World({api:'500'}); r=await w.ring(ping()); first=r.status+' list '+has(w); w.api=[sale()]; r2=await w.ring(ping({retry_count:'1'})); line('04','Gumroad API 500; then re-sent',r2,w,'first answer was '+first);
  w=new World({api:'429'}); r=await w.ring(ping()); line('05','Gumroad API 429 busy',r,w);
  w=new World({api:'throws'}); r=await w.ring(ping()); line('06','Gumroad API unreachable',r,w);
  w=new World({api:'junk'}); r=await w.ring(ping()); line('07','Gumroad API answers nonsense',r,w);
  w=new World({api:[sale()],failWrites:true}); r=await w.ring(ping()); first=r.status+' list '+has(w); w.failWrites=false; r2=await w.ring(ping({retry_count:'1'})); line('08','guest list refuses the write; then re-sent',r2,w,'first answer was '+first);
  w=new World({api:[sale()],apiDelay:5000}); r=await w.ring(ping()); line('09','Gumroad API takes 5s (longer than patience)',r,w,'the slow attempt still finished in the background');
  w=new World({api:[sale({refunded:true})],members:[['buyer@example.com',{email:'buyer@example.com',source:'gumroad'}]]}); r=await w.ring(ping({refunded:'true',resource_name:'refund'})); line('10','refund ping, refund on record',r,w);
  w=new World({api:[sale()],members:[['buyer@example.com',{email:'buyer@example.com',source:'gumroad'}]]}); r=await w.ring(ping({refunded:'true',resource_name:'refund'})); first=r.status+' list '+has(w); w.api=[sale({refunded:true})]; r2=await w.ring(ping({refunded:'true',resource_name:'refund',retry_count:'1'})); line('11','refund ping, refund not on record yet; then re-sent',r2,w,'first answer was '+first);
  w=new World({api:[sale({refunded:true})],members:[['buyer@example.com',{email:'buyer@example.com',source:'manual'}]]}); r=await w.ring(ping({refunded:'true',resource_name:'refund'})); line('12','refund ping for someone Eric added by hand',r,w);
  w=new World({api:[sale({partially_refunded:true})],members:[['buyer@example.com',{email:'buyer@example.com',source:'gumroad'}]]}); r=await w.ring(ping({refunded:'false',resource_name:'refund'})); line('13','partial refund ping',r,w);
  w=new World({api:[sale({disputed:true,chargedback:true})],members:[['buyer@example.com',{email:'buyer@example.com',source:'gumroad'}]]}); r=await w.ring(ping({disputed:'true',resource_name:'dispute'})); line('14','dispute ping, dispute on record',r,w);
  w=new World({api:[sale({disputed:true,dispute_won:true})]}); r=await w.ring(ping({disputed:'true',dispute_won:'true',resource_name:'dispute_won'})); line('15','dispute-won ping',r,w);
  w=new World({api:[]}); r=await w.ring(ping({product_id:'OTHERPRODUCT==',permalink:'tshirt',product_permalink:'https://example.gumroad.com/l/tshirt',short_product_id:'abcde'})); line('16','sale ping for a DIFFERENT product of yours',r,w);
  w=new World({api:[]}); r=await w.ring(ping({test:'true'})); line('17','Gumroad test ping',r,w);
  w=new World({api:[sale()]}); r=await w.ring(ping(),{secret:'wrong'}); line('18','wrong doorbell secret',r,w);
  w=new World({api:[sale()]}); r=await w.ring(null,{method:'GET'}); line('19','a GET to the doorbell',r,w);
  w=new World({api:[sale()]}); r=await w.ring(ping({email:''})); line('20','ping with no email',r,w);
  w=new World({api:[sale()]}); r=await w.ring('{not a form',{ctype:'multipart/form-data'}); line('21','ping that cannot be read',r,w);
  w=new World({api:[sale({chargedback:true})],members:[['buyer@example.com',{email:'buyer@example.com',source:'gumroad'}]]}); r=await w.ring(ping({disputed:'true',resource_name:'dispute'})); line('22','sale marked chargedback only (the corrected field)',r,w);
  w=new World({api:[sale()],product:'abcxyz'}); r=await w.ring(ping()); line('23','GUMROAD_PRODUCT = short id',r,w);
  w=new World({api:[sale()],product:'earlyaccess'}); r=await w.ring(ping()); line('24','GUMROAD_PRODUCT = shop name (the known trap)',r,w);
  w=new World({api:[sale({access_revoked:true})],members:[['buyer@example.com',{email:'buyer@example.com',source:'gumroad'}]]}); r=await w.ring(ping()); line('25','sale ping re-sent after access was revoked',r,w);
  return out;
};
