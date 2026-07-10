// 자양동 오늘의 와인 — 데일리 추천 스크립트 (v2: 전체 매대 200병 데이터 기반)
// 사용: node recommend.js <최고기온> <강수mm>
// 데일리 풀: 1~3만원대 · 재고(ok) · 디저트 제외. 최근 30일 중복 제외, 같은 날 재실행 시 동일 결과.
const fs=require('fs'),path=require('path');
const DIR=__dirname;
const WINES=JSON.parse(fs.readFileSync(path.join(DIR,'wines.json'),'utf8'));
const t=parseInt(process.argv[2],10), r=parseInt(process.argv[3]||'0',10);
if(isNaN(t)){console.error('사용법: node recommend.js <최고기온> <강수mm>');process.exit(1);}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
const CITRUS=['시트러스','감귤','레몬','라임','자몽'];
const FRESH=['시트러스','감귤','레몬','라임','자몽','청사과','사과','풋','민트','허브','라즈베리','베리','체리','살구','복숭아','자두','열대','꽃','배'];
function targetProfile(t,r){const tAcid=clamp(48+(t-15)*1.6,30,88);const tBody=clamp(68-(t-15)*1.3+clamp(r,0,25)*1.4,30,90);return{tAcid,tBody};}
function scoreWine(w,tp,t,r){
  if(!w.ok)return -1e9;let s=0;
  s-=Math.abs(w.ac-tp.tAcid)*1.0;s-=Math.abs(w.bd-tp.tBody)*1.1;
  const f=w.fl||'';const hot=t>=25,warm=t>=20,cold=t<12,rainy=r>=3;
  if(hot){if(w.c==='white')s+=18;if(w.c==='sparkling')s+=16;if(w.c==='rose')s+=10;
    if(CITRUS.some(k=>f.includes(k)))s+=16;if(FRESH.some(k=>f.includes(k)))s+=8;
    s+=(w.ac-50)*0.35;s-=w.tn*0.18;s-=Math.max(0,w.bd-60)*0.4;}
  else if(warm){if(CITRUS.some(k=>f.includes(k)))s+=8;if(w.c==='sparkling')s+=6;s+=(w.ac-50)*0.15;}
  if(rainy){s+=(w.bd-55)*0.5;if(w.c==='red')s+=10;if(w.c==='sparkling')s-=6;}
  if(cold){if(w.c==='red')s+=14;s+=(w.bd-55)*0.4;s+=w.tn*0.12;if(w.c==='sparkling')s-=8;}
  if(w.sw>45)s-=15;if(w.sw>65)s-=20;return s;
}
function seededRand(seed){let x=seed>>>0;return function(){x+=0x6D2B79F5;let y=Math.imul(x^(x>>>15),1|x);y^=y+Math.imul(y^(y>>>7),61|y);return((y^(y>>>14))>>>0)/4294967296;};}
function strSeed(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function todayStr(){const d=new Date();const kst=new Date(d.getTime()+(9*60+d.getTimezoneOffset())*60000);return kst.getFullYear()+'-'+String(kst.getMonth()+1).padStart(2,'0')+'-'+String(kst.getDate()).padStart(2,'0');}
function reasonText(w,t,r){
  const parts=[];
  if(t>=28)parts.push('무더운 날씨라 산미가 또렷하고 청량한 와인이 갈증을 씻어줘요');
  else if(t>=24)parts.push('더운 편이라 산뜻한 산미와 과실향이 살아있는 와인이 어울려요');
  else if(t>=18)parts.push('온화한 날씨엔 균형 잡힌 미디엄 스타일이 좋아요');
  else if(t>=12)parts.push('선선해서 살짝 무게감 있는 와인이 어울려요');
  else parts.push('쌀쌀한 날씨엔 바디감 있고 따뜻한 느낌의 와인이 제격이에요');
  if(r>=8)parts.push('비가 많이 와서 바디감이 묵직한 쪽으로 골랐어요');
  else if(r>=3)parts.push('비가 와서 조금 더 진한 스타일을 담았어요');
  const flav=(w.fl||'').split('·')[0].replace(/\s*\d+%/,'').trim();
  const sw={red:'레드',white:'화이트',sparkling:'스파클링',rose:'로제',dessert:'디저트 와인'}[w.c];
  return parts.join(', ')+`. 특히 ${flav||'과실'} 향의 ${sw}가 오늘 날씨와 잘 맞아요.`;
}
const HFILE=path.join(DIR,'history.json');
let hist=[];try{hist=JSON.parse(fs.readFileSync(HFILE,'utf8'));}catch(e){}
const ds=todayStr();
let entry=hist.find(e=>e.date===ds);
let w;
if(entry){w=WINES.find(x=>'w'+x.id===entry.id);}
if(!w){
  const cut=Date.now()-30*86400000;
  const rec=new Set(hist.filter(e=>new Date(e.date+'T00:00:00').getTime()>=cut).map(e=>e.id));
  const tp=targetProfile(t,r);
  let pool=WINES.filter(x=>x.ok&&(x.t==='1만'||x.t==='3만')&&x.c!=='dessert');
  let avail=pool.filter(x=>!rec.has('w'+x.id));
  if(avail.length===0)avail=pool;
  const scored=avail.map(x=>({x,s:scoreWine(x,tp,t,r)})).sort((a,b)=>b.s-a.s);
  const top=scored.slice(0,Math.min(10,scored.length));
  const rnd=seededRand(strSeed(ds+'|'+t+'|'+r+'|all|daily'));
  w=top[Math.floor(rnd()*top.length)].x;
  hist.unshift({date:ds,id:'w'+w.id,name:w.n,color:w.c});
  fs.writeFileSync(HFILE,JSON.stringify(hist.slice(0,120),null,1));
}
const TIER_LB={'1만':'1만원대','3만':'3만원대','5만':'5만원대','10만':'10만 내외'};
const COL_LB={red:'레드',white:'화이트',sparkling:'스파클링',dessert:'디저트',rose:'로제'};
console.log(JSON.stringify({
  date:ds,tempMax:t,rain:r,
  name:w.n+(w.kn?' ('+w.kn+')':''),tier:TIER_LB[w.t],color:COL_LB[w.c],
  variety:w.v,region:w.r,price:w.price,flavor:w.fl,pairing:w.pr,
  reason:reasonText(w,t,r)
},null,1));
