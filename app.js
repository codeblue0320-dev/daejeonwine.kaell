/* 자양동 오늘의 와인 — GitHub Pages 정적 웹앱
 * 실시간 날씨: Open-Meteo (무료, 키 불필요, CORS 허용)
 * 데이터: wines.js 의 WINES (신뢰 가능한 1~3만원대 와인)
 * 30일 중복 방지: localStorage */

// 자양동(대전 동구) 좌표
const LAT = 36.3373, LON = 127.4340;
const WX_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
  + `&current=temperature_2m,precipitation`
  + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code`
  + `&timezone=Asia%2FSeoul&forecast_days=1`;

// ---------- 알고리즘 ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const CITRUS = ['시트러스', '감귤', '레몬', '라임', '자몽'];
const FRESH = ['시트러스', '감귤', '레몬', '라임', '자몽', '청사과', '사과', '풋', '민트', '허브', '라즈베리', '베리', '체리', '살구', '복숭아', '자두', '열대', '꽃'];

function targetProfile(t, r) {
  const tAcid = clamp(48 + (t - 15) * 1.6, 30, 88);
  const rainBody = clamp(r, 0, 25) * 1.4;
  const tBody = clamp(68 - (t - 15) * 1.3 + rainBody, 30, 90);
  return { tAcid, tBody };
}
function scoreWine(w, tp, t, r) {
  if (!w.ok) return -1e9;
  let s = 0;
  s -= Math.abs(w.ac - tp.tAcid) * 1.0;
  s -= Math.abs(w.bd - tp.tBody) * 1.1;
  const f = w.fl || '';
  const hot = t >= 25, warm = t >= 20, cold = t < 12, rainy = r >= 3;
  if (hot) {
    if (w.c === 'white') s += 18;
    if (CITRUS.some(k => f.includes(k))) s += 16;
    if (FRESH.some(k => f.includes(k))) s += 8;
    s += (w.ac - 50) * 0.35; s -= w.tn * 0.18; s -= Math.max(0, w.bd - 60) * 0.4;
  } else if (warm) {
    if (CITRUS.some(k => f.includes(k))) s += 8; s += (w.ac - 50) * 0.15;
  }
  if (rainy) { s += (w.bd - 55) * 0.5; if (w.c === 'red') s += 10; }
  if (cold) { if (w.c === 'red') s += 14; s += (w.bd - 55) * 0.4; s += w.tn * 0.12; }
  if (w.sw > 45) s -= 15; if (w.sw > 65) s -= 20;
  return s;
}
function seededRand(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function strSeed(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function pick(t, r, dateStr, recentIds, colorFilter) {
  const tp = targetProfile(t, r);
  let pool = WINES.filter(w => w.ok);
  if (colorFilter && colorFilter !== 'all') pool = pool.filter(w => w.c === colorFilter);
  let avail = pool.filter(w => !recentIds.has(w.no + '|' + w.t));
  if (avail.length === 0) avail = pool; // 풀 소진 시 리셋
  const scored = avail.map(w => ({ w, s: scoreWine(w, tp, t, r) })).sort((a, b) => b.s - a.s);
  const top = scored.slice(0, Math.min(10, scored.length));
  const rnd = seededRand(strSeed(dateStr + '|' + t + '|' + r + '|' + (colorFilter || 'all')));
  return { w: top[Math.floor(rnd() * top.length)].w, tp };
}

// ---------- 저장소 ----------
const HKEY = 'jayang_wine_history_v1';
function loadHist() { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } }
function saveHist(h) { localStorage.setItem(HKEY, JSON.stringify(h)); }
function recentIds(hist, days) {
  const cut = Date.now() - days * 86400000;
  const s = new Set();
  hist.forEach(e => { if (new Date(e.date + 'T00:00:00').getTime() >= cut) s.add(e.id); });
  return s;
}

// ---------- 표시 도우미 ----------
function wcEmoji(t, r) { if (r >= 8) return '🌧️'; if (r >= 1) return '🌦️'; if (t >= 28) return '☀️'; if (t >= 20) return '🌤️'; if (t < 5) return '❄️'; return '⛅'; }
function reasonText(w, t, r) {
  const parts = [];
  if (t >= 28) parts.push('무더운 날씨라 산미가 또렷하고 청량한 와인이 갈증을 씻어줘요');
  else if (t >= 24) parts.push('더운 편이라 산뜻한 산미와 과실향이 살아있는 와인이 어울려요');
  else if (t >= 18) parts.push('온화한 날씨엔 균형 잡힌 미디엄 스타일이 좋아요');
  else if (t >= 12) parts.push('선선해서 살짝 무게감 있는 와인이 어울려요');
  else parts.push('쌀쌀한 날씨엔 바디감 있고 따뜻한 느낌의 와인이 제격이에요');
  if (r >= 8) parts.push('비가 많이 와서 바디감이 묵직한 쪽으로 골랐어요');
  else if (r >= 3) parts.push('비가 와서 조금 더 진한 스타일을 담았어요');
  const flav = (w.fl || '').split('·')[0].trim().replace(/\s*\d+%/, '');
  const tail = w.c === 'white'
    ? `특히 ${flav || '상큼한 과실'} 향의 화이트가 오늘 날씨와 잘 맞아요.`
    : `${flav || '농익은 과실'} 풍미의 레드로 완성했어요.`;
  return parts.join(', ') + '. ' + tail;
}
function bar(lb, v) { return `<div class="bar"><span class="lb">${lb}</span><span class="track"><span class="fill" style="width:${Math.min(100, v)}%"></span></span><span class="vv">${v}</span></div>`; }
function cardHTML(w, t, r) {
  const cbadge = w.c === 'red' ? '<span class="badge b-red">레드</span>' : '<span class="badge b-white">화이트</span>';
  return `<div class="badges">${cbadge}<span class="badge b-tier">${w.t}원대</span><span class="badge b-tier">${w.v}</span></div>
   <div class="wname">${w.n}</div>
   <div class="wvar">${w.tag || ''}</div>
   <div class="wregion">📍 ${w.r}</div>
   <div class="reason">${reasonText(w, t, r)}</div>
   <div class="meta"><b>맛·향</b> ${w.fl}</div>
   <div class="pair"><b style="color:var(--wine)">마리아주</b> ${w.pr}</div>
   <div class="bars">${bar('당도', w.sw)}${bar('산도', w.ac)}${bar('타닌', w.tn)}${bar('바디', w.bd)}</div>
   <div class="meta" style="color:var(--muted);font-size:12px">알코올 약 ${w.ab}%</div>`;
}

// ---------- 날짜 (Asia/Seoul) ----------
function todayStr() {
  const d = new Date();
  const kst = new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60000);
  return kst.getFullYear() + '-' + String(kst.getMonth() + 1).padStart(2, '0') + '-' + String(kst.getDate()).padStart(2, '0');
}

// ---------- 상태 & 렌더 ----------
let WX = null; // {tempMax, rain, cur, updated}

async function fetchWeather() {
  const r = await fetch(WX_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return {
    tempMax: Math.round(j.daily.temperature_2m_max[0]),
    tempMin: Math.round(j.daily.temperature_2m_min[0]),
    rain: Math.round(j.daily.precipitation_sum[0]),
    prob: (j.daily.precipitation_probability_max || [null])[0],
    cur: j.current ? j.current.temperature_2m : null,
    updated: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  };
}

function renderWeather() {
  const e = document.getElementById('weather');
  if (!WX) return;
  const probTxt = WX.prob != null ? ` · 강수확률 ${WX.prob}%` : '';
  e.classList.remove('spin');
  e.innerHTML = `<div class="emo">${wcEmoji(WX.tempMax, WX.rain)}</div>
    <div><div class="wx-main">오늘 자양동 · 최고 ${WX.tempMax}° / 최저 ${WX.tempMin}° · 강수 ${WX.rain}mm${probTxt}</div>
    <div class="wx-sub">${WX.cur != null ? '현재 ' + WX.cur + '° · ' : ''}실시간 · ${WX.updated} 기준</div></div>
    <button class="refresh" id="refreshBtn">↻ 새로고침</button>`;
  document.getElementById('refreshBtn').addEventListener('click', init);
}

function renderToday() {
  if (!WX) return;
  const hist = loadHist();
  const ds = todayStr();
  let entry = hist.find(e => e.date === ds);
  let w;
  if (entry) w = WINES.find(x => x.no === entry.no && x.t === entry.tier);
  if (!w) {
    const rec = recentIds(hist, 30);
    w = pick(WX.tempMax, WX.rain, ds, rec, 'all').w;
    hist.unshift({ date: ds, id: w.no + '|' + w.t, no: w.no, tier: w.t, name: w.n, color: w.c });
    saveHist(hist.slice(0, 120));
  }
  document.getElementById('todayCard').innerHTML = cardHTML(w, WX.tempMax, WX.rain);
  renderHist();
}

function renderHist() {
  const hist = loadHist();
  const box = document.getElementById('hist');
  if (hist.length === 0) { box.innerHTML = '<div class="previewline">아직 기록이 없어요.</div>'; return; }
  box.innerHTML = hist.slice(0, 30).map(e =>
    `<div class="hrow"><span class="hd">${e.date.slice(5)}</span><span class="hn">${e.color === 'red' ? '🔴' : '⚪'} ${e.name}</span></div>`).join('');
}

function renderLab() {
  const t = +document.getElementById('tSlider').value;
  const r = +document.getElementById('rSlider').value;
  const cf = document.getElementById('colorFilter').value;
  document.getElementById('tOut').textContent = t + '°C';
  document.getElementById('rOut').textContent = r + 'mm';
  const tp = targetProfile(t, r);
  document.getElementById('labTarget').textContent = `목표 산도 ${Math.round(tp.tAcid)} · 목표 바디 ${Math.round(tp.tBody)}`;
  const rec = recentIds(loadHist(), 30);
  const w = pick(t, r, 'lab-' + todayStr(), rec, cf).w;
  document.getElementById('labPick').innerHTML =
    `👉 ${w.c === 'red' ? '🔴' : '⚪'} <b>${w.n}</b> · ${w.v} <span style="color:var(--muted)">(산도 ${w.ac}·바디 ${w.bd})</span>`;
}

// ---------- 이벤트 ----------
['tSlider', 'rSlider'].forEach(id => document.getElementById(id).addEventListener('input', renderLab));
document.getElementById('colorFilter').addEventListener('change', renderLab);
document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('추천 기록을 모두 지울까요? (중복 방지 기록도 초기화됩니다)')) { localStorage.removeItem(HKEY); renderToday(); }
});
document.getElementById('mGo').addEventListener('click', () => {
  WX = { tempMax: +document.getElementById('mTemp').value, tempMin: +document.getElementById('mTemp').value - 6,
         rain: +document.getElementById('mRain').value, prob: null, cur: null,
         updated: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
  document.getElementById('manual').classList.remove('show');
  document.getElementById('weather').classList.remove('spin');
  document.getElementById('weather').innerHTML =
    `<div class="emo">${wcEmoji(WX.tempMax, WX.rain)}</div><div><div class="wx-main">직접 입력 · 최고 ${WX.tempMax}° · 강수 ${WX.rain}mm</div><div class="wx-sub">수동 입력값</div></div>`;
  renderToday();
});

document.getElementById('foot').innerHTML =
  `추천 풀: 신뢰 가능한 1~3만원대 와인 ${WINES.filter(w => w.ok).length}종 (레드·화이트) · 이마트 대전복합터미널점 기준<br>` +
  `알고리즘: 기온↑ → 산미·과실·시트러스·화이트 가중 / 강수·저온 → 바디·타닌·레드 가중. 최근 30일 추천은 자동 제외.<br>` +
  `날씨: Open-Meteo 실시간 (대전 동구 자양동 좌표 ${LAT}, ${LON}).`;

// ---------- 시작 ----------
async function init() {
  const we = document.getElementById('weather');
  we.classList.add('spin');
  we.innerHTML = '<div class="emo">⏳</div><div><div class="wx-main">자양동 날씨를 불러오는 중…</div></div>';
  try {
    WX = await fetchWeather();
    document.getElementById('manual').classList.remove('show');
    renderWeather();
    renderToday();
  } catch (e) {
    we.classList.remove('spin');
    we.innerHTML = '<div class="emo">📡</div><div><div class="wx-main">실시간 날씨 연결 실패</div><div class="wx-sub">아래에서 직접 입력해 주세요</div></div>';
    document.getElementById('manual').classList.add('show');
  }
  renderLab();
}

init();
