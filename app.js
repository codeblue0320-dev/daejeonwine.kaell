/* 자양동 와인 + 포도 품종 학습 앱 (GitHub Pages PWA)
 * 탭: 와인 추천 / 오늘의 품종 / 퀴즈
 * 데이터: wines.js(WINES), varieties.js(VARIETIES)
 * 저장: localStorage / 이미지: Wikipedia REST(무료) / 알림: 로컬+백그라운드(가능 기기) */

/* ===================== 공통 ===================== */
function todayStr() {
  var d = new Date();
  var kst = new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60000);
  return kst.getFullYear() + '-' + String(kst.getMonth() + 1).padStart(2, '0') + '-' + String(kst.getDate()).padStart(2, '0');
}
function kstNow() { var d = new Date(); return new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60000); }
function seededRand(seed) { var t = seed >>> 0; return function () { t += 0x6D2B79F5; var x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function strSeed(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

/* ===================== 탭 ===================== */
function initTabs() {
  var btns = document.querySelectorAll('.tabbtn');
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-tab');
      document.querySelectorAll('.tabbtn').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('.tabpane').forEach(function (p) { p.classList.toggle('show', p.id === 'tab-' + t); });
      if (t === 'variety') renderVariety();
      if (t === 'quiz') renderQuizIntro();
      window.scrollTo(0, 0);
    });
  });
}

/* ===================== 와인 추천 ===================== */
var LAT = 36.3373, LON = 127.4340;
var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON
  + '&current=temperature_2m,precipitation'
  + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code'
  + '&timezone=Asia%2FSeoul&forecast_days=1';
var CITRUS = ['시트러스', '감귤', '레몬', '라임', '자몽'];
var FRESH = ['시트러스', '감귤', '레몬', '라임', '자몽', '청사과', '사과', '풋', '민트', '허브', '라즈베리', '베리', '체리', '살구', '복숭아', '자두', '열대', '꽃'];
function targetProfile(t, r) { var a = clamp(48 + (t - 15) * 1.6, 30, 88); var rb = clamp(r, 0, 25) * 1.4; var b = clamp(68 - (t - 15) * 1.3 + rb, 30, 90); return { tAcid: a, tBody: b }; }
function scoreWine(w, tp, t, r) {
  if (!w.ok) return -1e9; var s = 0; s -= Math.abs(w.ac - tp.tAcid) * 1.0; s -= Math.abs(w.bd - tp.tBody) * 1.1; var f = w.fl || '';
  var hot = t >= 25, warm = t >= 20, cold = t < 12, rainy = r >= 3;
  if (hot) { if (w.c === 'white') s += 18; if (CITRUS.some(function (k) { return f.indexOf(k) >= 0; })) s += 16; if (FRESH.some(function (k) { return f.indexOf(k) >= 0; })) s += 8; s += (w.ac - 50) * 0.35; s -= w.tn * 0.18; s -= Math.max(0, w.bd - 60) * 0.4; }
  else if (warm) { if (CITRUS.some(function (k) { return f.indexOf(k) >= 0; })) s += 8; s += (w.ac - 50) * 0.15; }
  if (rainy) { s += (w.bd - 55) * 0.5; if (w.c === 'red') s += 10; }
  if (cold) { if (w.c === 'red') s += 14; s += (w.bd - 55) * 0.4; s += w.tn * 0.12; }
  if (w.sw > 45) s -= 15; if (w.sw > 65) s -= 20; return s;
}
function pickWine(t, r, dateStr, recent, cf) {
  var tp = targetProfile(t, r);
  var pool = WINES.filter(function (w) { return w.ok; });
  if (cf && cf !== 'all') pool = pool.filter(function (w) { return w.c === cf; });
  var avail = pool.filter(function (w) { return !recent.has(w.no + '|' + w.t); });
  if (avail.length === 0) avail = pool;
  var scored = avail.map(function (w) { return { w: w, s: scoreWine(w, tp, t, r) }; }).sort(function (a, b) { return b.s - a.s; });
  var top = scored.slice(0, Math.min(10, scored.length));
  var rnd = seededRand(strSeed(dateStr + '|' + t + '|' + r + '|' + (cf || 'all')));
  return top[Math.floor(rnd() * top.length)].w;
}
var WHKEY = 'jayang_wine_history_v1';
function loadWH() { try { return JSON.parse(localStorage.getItem(WHKEY) || '[]'); } catch (e) { return []; } }
function saveWH(h) { localStorage.setItem(WHKEY, JSON.stringify(h)); }
function recentW(h, days) { var cut = Date.now() - days * 86400000; var s = new Set(); h.forEach(function (e) { if (new Date(e.date + 'T00:00:00').getTime() >= cut) s.add(e.id); }); return s; }
function wcEmoji(t, r) { if (r >= 8) return '🌧️'; if (r >= 1) return '🌦️'; if (t >= 28) return '☀️'; if (t >= 20) return '🌤️'; if (t < 5) return '❄️'; return '⛅'; }
function reasonText(w, t, r) {
  var parts = [];
  if (t >= 28) parts.push('무더운 날씨라 산미가 또렷하고 청량한 와인이 갈증을 씻어줘요');
  else if (t >= 24) parts.push('더운 편이라 산뜻한 산미와 과실향이 살아있는 와인이 어울려요');
  else if (t >= 18) parts.push('온화한 날씨엔 균형 잡힌 미디엄 스타일이 좋아요');
  else if (t >= 12) parts.push('선선해서 살짝 무게감 있는 와인이 어울려요');
  else parts.push('쌀쌀한 날씨엔 바디감 있고 따뜻한 느낌의 와인이 제격이에요');
  if (r >= 8) parts.push('비가 많이 와서 바디감이 묵직한 쪽으로 골랐어요');
  else if (r >= 3) parts.push('비가 와서 조금 더 진한 스타일을 담았어요');
  var flav = (w.fl || '').split('·')[0].trim().replace(/\s*\d+%/, '');
  var tail = w.c === 'white' ? ('특히 ' + (flav || '상큼한 과실') + ' 향의 화이트가 오늘 날씨와 잘 맞아요.') : ((flav || '농익은 과실') + ' 풍미의 레드로 완성했어요.');
  return parts.join(', ') + '. ' + tail;
}
function bar(lb, v) { return '<div class="bar"><span class="lb">' + lb + '</span><span class="track"><span class="fill" style="width:' + Math.min(100, v) + '%"></span></span><span class="vv">' + v + '</span></div>'; }
function wineCard(w, t, r) {
  var cb = w.c === 'red' ? '<span class="badge b-red">레드</span>' : '<span class="badge b-white">화이트</span>';
  return '<div class="badges">' + cb + '<span class="badge b-tier">' + w.t + '원대</span><span class="badge b-tier">' + esc(w.v) + '</span></div>' +
    '<div class="wname">' + esc(w.n) + '</div>' + (w.tag ? '<div class="wvar">' + esc(w.tag) + '</div>' : '') +
    '<div class="wregion">📍 ' + esc(w.r) + '</div>' +
    '<div class="reason">' + esc(reasonText(w, t, r)) + '</div>' +
    '<div class="meta"><b>맛·향</b> ' + esc(w.fl) + '</div>' +
    '<div class="pair"><b style="color:var(--wine)">마리아주</b> ' + esc(w.pr) + '</div>' +
    '<div class="bars">' + bar('당도', w.sw) + bar('산도', w.ac) + bar('타닌', w.tn) + bar('바디', w.bd) + '</div>' +
    '<div class="meta" style="color:var(--muted);font-size:12px">알코올 약 ' + w.ab + '%</div>';
}
var WX = null;
function fetchWeather() {
  return fetch(WX_URL, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
    return { tempMax: Math.round(j.daily.temperature_2m_max[0]), tempMin: Math.round(j.daily.temperature_2m_min[0]), rain: Math.round(j.daily.precipitation_sum[0]), prob: (j.daily.precipitation_probability_max || [null])[0], cur: j.current ? j.current.temperature_2m : null, updated: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), ok: true };
  });
}
function renderWeather() {
  var e = document.getElementById('weather'); if (!WX) return;
  var probTxt = WX.prob != null ? ' · 강수확률 ' + WX.prob + '%' : '';
  e.innerHTML = '<div class="emo">' + wcEmoji(WX.tempMax, WX.rain) + '</div><div style="flex:1"><div class="wx-main">오늘 자양동 · 최고 ' + WX.tempMax + '° / 최저 ' + WX.tempMin + '° · 강수 ' + WX.rain + 'mm' + probTxt + '</div><div class="wx-sub">' + (WX.cur != null ? '현재 ' + WX.cur + '° · ' : '') + (WX.ok ? '실시간 · ' + WX.updated + ' 기준' : '기본값') + '</div></div><button class="refresh" id="refreshBtn">↻</button>';
  var rb = document.getElementById('refreshBtn'); if (rb) rb.addEventListener('click', initWine);
}
function renderWineToday() {
  if (!WX) return;
  var h = loadWH(); var ds = todayStr(); var e = h.find(function (x) { return x.date === ds; }); var w;
  if (e) w = WINES.find(function (x) { return x.no === e.no && x.t === e.tier; });
  if (!w) { var rec = recentW(h, 30); w = pickWine(WX.tempMax, WX.rain, ds, rec, 'all'); h.unshift({ date: ds, id: w.no + '|' + w.t, no: w.no, tier: w.t, name: w.n, color: w.c }); saveWH(h.slice(0, 120)); }
  document.getElementById('todayCard').innerHTML = wineCard(w, WX.tempMax, WX.rain);
  renderWineHist();
}
function renderWineHist() {
  var h = loadWH(); var box = document.getElementById('hist');
  box.innerHTML = h.length === 0 ? '<div class="previewline">아직 기록이 없어요.</div>' : h.slice(0, 30).map(function (e) { return '<div class="hrow"><span class="hd">' + e.date.slice(5) + '</span><span class="hn">' + (e.color === 'red' ? '🔴' : '⚪') + ' ' + esc(e.name) + '</span></div>'; }).join('');
}
function renderLab() {
  var t = +document.getElementById('tSlider').value, r = +document.getElementById('rSlider').value, cf = document.getElementById('colorFilter').value;
  document.getElementById('tOut').textContent = t + '°C'; document.getElementById('rOut').textContent = r + 'mm';
  var tp = targetProfile(t, r);
  document.getElementById('labTarget').textContent = '목표 산도 ' + Math.round(tp.tAcid) + ' · 목표 바디 ' + Math.round(tp.tBody);
  var w = pickWine(t, r, 'lab-' + todayStr(), recentW(loadWH(), 30), cf);
  document.getElementById('labPick').innerHTML = '👉 ' + (w.c === 'red' ? '🔴' : '⚪') + ' <b>' + esc(w.n) + '</b> · ' + esc(w.v) + ' <span style="color:var(--muted)">(산도 ' + w.ac + '·바디 ' + w.bd + ')</span>';
}
function initWine() {
  var we = document.getElementById('weather'); we.innerHTML = '<div class="emo">⏳</div><div><div class="wx-main">날씨를 불러오는 중…</div></div>';
  fetchWeather().then(function (w) { WX = w; document.getElementById('manual').classList.remove('show'); renderWeather(); renderWineToday(); }).catch(function () {
    we.innerHTML = '<div class="emo">📡</div><div><div class="wx-main">실시간 날씨 연결 실패</div><div class="wx-sub">아래에서 직접 입력해 주세요</div></div>';
    document.getElementById('manual').classList.add('show');
  });
  renderLab();
}

/* ===================== 오늘의 품종 ===================== */
var VHKEY = 'variety_history_v1';
function loadVH() { try { return JSON.parse(localStorage.getItem(VHKEY) || '[]'); } catch (e) { return []; } }
function saveVH(h) { localStorage.setItem(VHKEY, JSON.stringify(h)); }
function todayVariety() {
  var h = loadVH(); var ds = todayStr(); var e = h.find(function (x) { return x.date === ds; });
  if (e) return VARIETIES[e.no - 1];
  var studied = new Set(h.map(function (x) { return x.no; }));
  var pool = VARIETIES.filter(function (v) { return !studied.has(v.no); });
  if (pool.length === 0) pool = VARIETIES.slice();
  var v = pool[Math.floor(seededRand(strSeed('var-' + ds))() * pool.length)];
  h.unshift({ date: ds, no: v.no }); saveVH(h.slice(0, 400));
  return v;
}
function weekStudied() {
  var h = loadVH(); var cut = Date.now() - 7 * 86400000; var seen = new Set(); var out = [];
  h.forEach(function (e) { if (new Date(e.date + 'T00:00:00').getTime() >= cut && !seen.has(e.no)) { seen.add(e.no); out.push(VARIETIES[e.no - 1]); } });
  return out;
}
var imgCache = {};
function loadWikiImage(v, imgEl) {
  var title = v.wiki;
  if (imgCache[title] !== undefined) { applyImg(imgCache[title]); return; }
  fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var src = j && ((j.thumbnail && j.thumbnail.source) || (j.originalimage && j.originalimage.source));
      imgCache[title] = src || null; applyImg(imgCache[title]);
    }).catch(function () { imgCache[title] = null; applyImg(null); });
  function applyImg(src) {
    if (!imgEl) return;
    if (src) { imgEl.style.backgroundImage = 'url("' + src + '")'; imgEl.classList.add('has'); imgEl.innerHTML = ''; }
    else { imgEl.classList.remove('has'); imgEl.style.backgroundImage = ''; imgEl.innerHTML = '<span>🍇 (이미지 없음)</span>'; }
  }
}
function field(label, val) { return val ? '<div class="vfield"><span class="vlab">' + label + '</span><span class="vval">' + esc(val) + '</span></div>' : ''; }
function renderVariety() {
  var v = todayVariety();
  var box = document.getElementById('vCard');
  var cb = v.c === 'red' ? '<span class="badge b-red">레드</span>' : '<span class="badge b-white">화이트</span>';
  box.innerHTML =
    '<div class="vimg" id="vImg"><span>🍇</span></div>' +
    '<div class="badges" style="margin-top:14px">' + cb + '<span class="badge b-tier">오늘의 품종</span></div>' +
    '<div class="vorig">' + esc(v.orig) + '</div>' +
    '<div class="vko">' + esc(v.ko) + '</div>' +
    (v.tag ? '<div class="wvar">' + esc(v.tag) + '</div>' : '') +
    '<div class="vfields">' +
    field('맛·향', v.flavor) +
    field('고향', v.home) +
    field('유전적 유래', v.gen) +
    field('주요 산지', v.regions) +
    field('떼루아', v.terroir) +
    field('식별 단서', v.idc) +
    field('마리아주', v.pairing) +
    '</div>';
  loadWikiImage(v, document.getElementById('vImg'));
  document.getElementById('vDate').textContent = todayStr() + ' · 매일 하나씩 배워요';
  renderWeekList();
}
function renderWeekList() {
  var list = weekStudied(); var box = document.getElementById('vWeekList');
  if (!box) return;
  if (list.length <= 1) { box.innerHTML = '<div class="previewline">이번 주 학습한 품종이 쌓이면 금요일 퀴즈에 나와요.</div>'; return; }
  box.innerHTML = list.map(function (v) { return '<div class="hrow"><span class="hn">' + (v.c === 'red' ? '🔴' : '⚪') + ' <b>' + esc(v.orig) + '</b> · ' + esc(v.ko) + '</span></div>'; }).join('');
}

/* ===================== 퀴즈 ===================== */
var quiz = null;
function norm(s) { return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFC').replace(/[^a-z0-9가-힣]/g, ''); }
function checkAns(input, v) {
  var n = norm(input); if (!n || n.length < 2) return false;
  var cands = [];
  v.orig.split('/').forEach(function (p) { cands.push(norm(p)); });
  v.ko.split('/').forEach(function (p) { cands.push(norm(p)); });
  cands.push(norm(v.orig.replace(/\(.*?\)/g, '')));
  cands.push(norm(v.ko.replace(/\(.*?\)/g, '')));
  return cands.some(function (c) { return c && (c === n || (n.length >= 3 && (c.indexOf(n) >= 0 || n.indexOf(c) >= 0))); });
}
function renderQuizIntro() {
  var wk = weekStudied();
  var isFri = kstNow().getDay() === 5;
  var intro = document.getElementById('quizIntro');
  var area = document.getElementById('quizArea');
  area.classList.remove('show');
  var msg = isFri ? '<div class="fribadge">🎉 금요일! 이번 주 복습 퀴즈</div>' : '';
  if (wk.length >= 2) {
    intro.innerHTML = msg + '<p>이번 주 학습한 <b>' + wk.length + '개 품종</b>으로 퀴즈를 봐요. 사진과 특징을 보고 <b>원어명</b>을 서술식으로 입력하세요.</p>' +
      '<button class="btn" id="quizStart">이번 주 퀴즈 시작</button> <button class="btn ghost" id="quizPractice">전체에서 연습</button>';
  } else {
    intro.innerHTML = msg + '<p>아직 이번 주 학습한 품종이 적어요. <b>오늘의 품종</b>을 며칠 보면 금요일 퀴즈가 채워집니다.<br>지금은 전체 품종으로 연습할 수 있어요.</p>' +
      '<button class="btn" id="quizPractice">연습 퀴즈 시작</button>';
  }
  var s = document.getElementById('quizStart'); if (s) s.addEventListener('click', function () { startQuiz(wk); });
  var p = document.getElementById('quizPractice'); if (p) p.addEventListener('click', function () { startQuiz(shuffle(VARIETIES.slice()).slice(0, 8)); });
}
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function startQuiz(list) {
  if (!list || list.length === 0) return;
  quiz = { items: shuffle(list.slice()).slice(0, Math.min(10, list.length)), i: 0, score: 0, answered: false };
  document.getElementById('quizIntro').innerHTML = '';
  document.getElementById('quizArea').classList.add('show');
  renderQuestion();
}
function renderQuestion() {
  var v = quiz.items[quiz.i]; quiz.answered = false;
  document.getElementById('qProgress').textContent = '문제 ' + (quiz.i + 1) + ' / ' + quiz.items.length + ' · 점수 ' + quiz.score;
  document.getElementById('qClues').innerHTML =
    field('색', v.c === 'red' ? '레드' : '화이트') +
    field('맛·향', v.flavor) +
    field('식별 단서', v.idc) +
    field('고향', v.home) +
    field('주요 산지', v.regions) +
    field('떼루아', v.terroir) +
    field('유전적 유래', v.gen) +
    field('마리아주', v.pairing);
  var img = document.getElementById('qImg'); img.className = 'vimg'; img.innerHTML = '<span>🍇</span>'; img.style.backgroundImage = '';
  loadWikiImage(v, img);
  document.getElementById('qInput').value = '';
  document.getElementById('qInput').disabled = false;
  document.getElementById('qFeedback').innerHTML = '';
  document.getElementById('qSubmit').style.display = '';
  document.getElementById('qNext').style.display = 'none';
  document.getElementById('qInput').focus();
}
function submitAnswer() {
  if (!quiz || quiz.answered) return;
  var v = quiz.items[quiz.i];
  var ok = checkAns(document.getElementById('qInput').value, v);
  quiz.answered = true;
  if (ok) quiz.score++;
  document.getElementById('qInput').disabled = true;
  document.getElementById('qFeedback').innerHTML = (ok ? '<div class="fb ok">✅ 정답! ' : '<div class="fb no">❌ 아쉬워요. ') + '정답: <b>' + esc(v.orig) + '</b> (' + esc(v.ko) + ')</div>';
  document.getElementById('qSubmit').style.display = 'none';
  document.getElementById('qNext').style.display = '';
  document.getElementById('qNext').textContent = quiz.i + 1 < quiz.items.length ? '다음 문제' : '결과 보기';
}
function nextQuestion() {
  if (!quiz) return;
  if (quiz.i + 1 < quiz.items.length) { quiz.i++; renderQuestion(); }
  else {
    document.getElementById('quizArea').classList.remove('show');
    var pct = Math.round(quiz.score / quiz.items.length * 100);
    document.getElementById('quizIntro').innerHTML = '<div class="result"><div class="rbig">' + quiz.score + ' / ' + quiz.items.length + '</div><div class="rsub">' + (pct >= 80 ? '🏆 훌륭해요!' : pct >= 50 ? '👍 좋아요, 조금만 더!' : '📚 복습이 필요해요') + '</div></div><button class="btn" id="quizAgain">다시 풀기</button>';
    document.getElementById('quizAgain').addEventListener('click', renderQuizIntro);
  }
}

/* ===================== 알림 (best-effort) ===================== */
var swReg = null;
function setupNotifButton() {
  var btn = document.getElementById('vNotifBtn'); if (!btn) return;
  if (!('Notification' in window)) { btn.style.display = 'none'; return; }
  function refresh() { btn.textContent = Notification.permission === 'granted' ? '🔔 알림 켜짐' : '🔔 매일 12시 알림 켜기'; }
  refresh();
  btn.addEventListener('click', function () {
    Notification.requestPermission().then(function (p) { refresh(); if (p === 'granted') { enableBackground(); maybeNotify(true); } });
  });
}
function enableBackground() {
  if (!swReg || !('periodicSync' in swReg)) return;
  navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (st) {
    if (st.state === 'granted') { swReg.periodicSync.register('daily-variety', { minInterval: 12 * 60 * 60 * 1000 }).catch(function () {}); }
  }).catch(function () {});
}
function maybeNotify(force) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  var now = kstNow(); var ds = todayStr();
  var last = localStorage.getItem('variety_notif_date');
  if (!force && (now.getHours() < 12 || last === ds)) return;
  localStorage.setItem('variety_notif_date', ds);
  var v = todayVariety();
  var body = '오늘의 품종: ' + v.orig + ' (' + v.ko + ') — 탭해서 학습하세요';
  if (now.getDay() === 5) body = '🎉 금요일 복습 퀴즈가 준비됐어요! · ' + body;
  try {
    if (swReg && swReg.showNotification) swReg.showNotification('🍇 오늘의 포도 품종', { body: body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'daily-variety' });
    else new Notification('🍇 오늘의 포도 품종', { body: body, icon: 'icon-192.png' });
  } catch (e) {}
}

/* ===================== 시작 ===================== */
function bindStatic() {
  document.getElementById('mGo').addEventListener('click', function () {
    WX = { tempMax: +document.getElementById('mTemp').value, tempMin: +document.getElementById('mTemp').value - 6, rain: +document.getElementById('mRain').value, prob: null, cur: null, ok: false };
    document.getElementById('manual').classList.remove('show');
    document.getElementById('weather').innerHTML = '<div class="emo">' + wcEmoji(WX.tempMax, WX.rain) + '</div><div><div class="wx-main">직접 입력 · 최고 ' + WX.tempMax + '° · 강수 ' + WX.rain + 'mm</div><div class="wx-sub">수동 입력값</div></div>';
    renderWineToday();
  });
  ['tSlider', 'rSlider'].forEach(function (id) { document.getElementById(id).addEventListener('input', renderLab); });
  document.getElementById('colorFilter').addEventListener('change', renderLab);
  document.getElementById('resetBtn').addEventListener('click', function () { if (confirm('와인 추천 기록을 초기화할까요?')) { localStorage.removeItem(WHKEY); renderWineToday(); } });
  document.getElementById('qSubmit').addEventListener('click', submitAnswer);
  document.getElementById('qNext').addEventListener('click', nextQuestion);
  document.getElementById('qInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { if (quiz && quiz.answered) nextQuestion(); else submitAnswer(); } });
  document.getElementById('foot').innerHTML =
    '와인 추천 풀 ' + WINES.filter(function (w) { return w.ok; }).length + '종 · 포도 품종 ' + VARIETIES.length + '종 · 이마트 대전복합터미널점 기준<br>이미지: Wikipedia · 날씨: Open-Meteo 실시간 · 알림은 기기 지원 범위 내 동작.';
}
function init() {
  initTabs(); bindStatic(); initWine();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(function (reg) { swReg = reg; setupNotifButton(); maybeNotify(false); }).catch(function () { setupNotifButton(); maybeNotify(false); });
  } else { setupNotifButton(); }
}
init();
