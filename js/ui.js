// 画面。判断はすべて planner / mastery / grade に任せ、ここは表示と入力だけを行う。
(function () {
  var BK = globalThis.BK;
  var S = BK.load(), app = document.getElementById('app');
  var route = 'today', arg = null, run = null, tickId = null, lastMark = Date.now();

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function save() { if (!BK.save(S)) alert('学習データを保存できませんでした。ブラウザの設定を確認してください。'); }
  function go(r, a) { route = r; arg = a; render(); window.scrollTo(0, 0); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function num(id) { return parseInt(String(val(id)).replace(/[^0-9]/g, ''), 10) || 0; }
  function today() { return BK.today(); }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + BK.pad2(sec % 60); }
  // 学習時間の記録。1画面あたり最大5分まで数える（放置した時間を入れないため）
  function mark() {
    var now = Date.now(), d = today();
    S.sessions[d] = (S.sessions[d] || 0) + Math.min((now - lastMark) / 60000, 5);
    lastMark = now;
  }
  function badge(status) { return '<span class="badge s' + BK.rank(status) + '">' + status + '</span>'; }
  function dots(ts) {
    var h = '';
    for (var i = 1; i <= 7; i++) h += '<span class="' + (ts.ev[i] ? 'on' : 'off') + '">●</span>';
    return '<span class="dots">' + h + '</span>';
  }
  function tname(id) { return esc(BK.topic(id).name); }
  var TYPE = { retry: '誤答の再確認', review: '復習', 'continue': '続き', 'new': '新しい論点', practice: '演習', material: '教材' };

  // ---------- 今日のメニュー ----------
  function menu() {
    var d = today(), budget = BK.budgetFor(S, d), m = S.menus[d];
    if (!m || m.budget !== budget) {
      var done = m ? m.items.filter(function (x) { return x.done; }) : [];
      m = S.menus[d] = BK.buildMenu(S, d, budget, done);
      save();
    }
    return m;
  }
  function nextItem() { return menu().items.filter(function (x) { return !x.done; })[0]; }

  function vToday() {
    var d = today(), m = menu(), doneN = m.items.filter(function (x) { return x.done; }).length;
    var total = m.items.reduce(function (s, x) { return s + x.min; }, 0);
    var h = '<div class="card"><div class="row"><div><label class="f">今日使える時間（分）</label><input id="budget" inputmode="numeric" value="' + m.budget + '"></div>' +
      '<div style="flex:none;align-self:flex-end"><button data-act="budget">更新</button></div></div></div>';
    h += '<div class="card"><h3>今日のメニュー（約' + total + '分）</h3>';
    if (!m.items.length) h += '<p class="sub">今日の項目はありません。</p>';
    m.items.forEach(function (x) {
      h += '<div class="menu-item' + (x.done ? ' done' : '') + '"><div class="mark">' + (x.done ? '✓' : '・') + '</div><div><div><b>' + TYPE[x.type] + '</b>　' + tname(x.topic) + '　<span class="sub">約' + x.min + '分</span></div><div class="sub">' + esc(x.reason) + '</div></div></div>';
    });
    h += '</div>';
    m.notes.forEach(function (n) { h += '<div class="note">' + esc(n) + '</div>'; });
    if (nextItem()) h += '<button class="primary" data-act="start">' + (doneN ? '続ける' : '開始') + '</button>';
    else h += '<div class="note">今日のメニューは完了です。</div><div class="row"><button data-act="more">もう少しやる（＋10分）</button><button data-act="nav" data-r="review">振り返りを見る</button></div>';
    var dl = BK.delay(S, d);
    h += '<div class="card"><div class="sub">計画に対する状況</div><div class="' + (dl.label === '順調' ? 'ok' : dl.label === '注意' ? 'warn' : 'ng') + ' big">' + dl.label + '</div><div class="sub">必要 約' + Math.round(dl.required / 60) + '時間 ／ 使える時間 約' + Math.round(dl.available / 60) + '時間（遅延率 ' + dl.ratio.toFixed(2) + '）</div></div>';
    return h;
  }

  // ---------- 初期設定・診断 ----------
  function vSetup() {
    var def = today() < '2026-11-30' ? '2026-11-30' : '';
    return '<div class="card"><h3>はじめに</h3><p>受験日と学習できる時間を登録します。あとで設定から変更できます。</p>' +
      '<label class="f">受験日</label><input id="exam" type="date" value="' + (S.profile.examDate || def) + '">' +
      '<label class="f">平日の学習時間（分）</label><input id="wd" inputmode="numeric" value="10">' +
      '<label class="f">土日の学習時間（分）</label><input id="we" inputmode="numeric" value="60">' +
      '<label class="f">使用する教材</label><input id="mat" value="' + esc(S.profile.material) + '"></div>' +
      '<button class="primary" data-act="setup">次へ</button>';
  }
  function vDeclare() {
    var h = '<div class="card"><h3>学習済みの範囲</h3><p class="sub">すでに学習した論点にチェックを入れてください。チェックした範囲から診断問題を出します。分からなければ空のままで構いません。</p></div>';
    ['3級基礎', '商業簿記', '工業簿記'].forEach(function (area) {
      h += '<div class="card"><h3>' + area + '</h3>';
      BK.TOPICS.filter(function (t) { return t.area === area; }).forEach(function (t) {
        h += '<label class="check"><input type="checkbox" class="decl" value="' + t.id + '"><span>' + esc(t.name) + '</span></label>';
      });
      h += '</div>';
    });
    return h + '<button class="primary" data-act="declare">診断を始める</button>';
  }

  // ---------- 学習の進行 ----------
  var MAXQ = { retry: 1, review: 1, 'continue': 3, 'new': 3, practice: 2, free: 3 };
  function startItem(item) {
    if (item.type === 'material') return go('material', { item: item });
    run = { mode: 'menu', item: item, topic: item.topic, phase: 'start', asked: 0, maxQ: MAXQ[item.type] };
    lastMark = Date.now();
    advance();
  }
  function wrongToday(id) {
    var d = today();
    return S.attempts.filter(function (a) { return a.date === d && !a.ok && a.topics[0] === id; }).length;
  }
  function newQuestion() {
    var ts = BK.ts(S, run.topic), q = null;
    if (run.follow) {
      for (var i = 0; i < 20 && !q; i++) q = BK.makeQuestion(run.follow.tpl, run.follow.variant, run.follow.level, BK.newSeed());
      run.isFollow = true; run.follow = null;
    } else {
      q = BK.pickQuestion(run.topic, BK.nextLevel(ts, run.topic), ts.cond);
      run.isFollow = false; run.asked++;
    }
    run.q = q; run.hint = false; run.started = Date.now();
    run.rows = { D: 2, C: 2 }; run.vals = {};
    return q;
  }
  function advance() {
    var ts = BK.ts(S, run.topic), L = BK.LESSONS[run.topic], d = today();
    if (run.phase === 'start') {
      run.phase = (L && (!ts.explained || ts.needExplain)) ? 'explain' : 'q';
      if (run.phase === 'explain') return go('study');
    } else if (run.phase === 'explain') {
      ts.explained = true; ts.needExplain = false;
      BK.refreshStatus(S, run.topic, d, '解説');
      run.phase = 'check'; run.ci = 0; run.picked = null; save();
      return go('study');
    } else if (run.phase === 'check') {
      run.ci++; run.picked = null;
      if (run.ci < L.checks.length) return go('study');
      run.phase = 'q';
    } else if (run.phase === 'result') {
      run.phase = 'q';
    } else if (run.phase === 'reason') {
      run.phase = 'done';
    }
    if (run.phase === 'q') {
      if (ts.needExplain && L) { run.phase = 'explain'; return go('study'); } // 誤答が続いたら解説へ戻る
      if ((run.follow || run.asked < run.maxQ) && newQuestion()) return go('study');
      if (L && ts.ev[1] && ts.ev[2] && ts.ev[3] && !ts.ev[5]) { run.phase = 'reason'; run.picked = null; return go('study'); }
      run.phase = 'done';
    }
    finishItem();
  }
  function finishItem() {
    var d = today();
    if (run.mode === 'menu') {
      run.item.done = true;
      if (!BK.ts(S, run.topic).due) BK.schedule(S, run.topic, { ok: true, hint: true }, d);
      save();
      var n = nextItem();
      run = null;
      if (n) return startItem(n);
      return go('review');
    }
    var id = run.topic; run = null; save();
    go('topic', id);
  }

  function vStudy() {
    var L = BK.LESSONS[run.topic], h = '<div class="row"><div class="sub">' + tname(run.topic) + '</div><div style="flex:none"><button class="small" data-act="quit">中断</button></div></div>';
    if (run.phase === 'explain') {
      h += '<div class="card"><h3>解説</h3>' + L.text.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div><button class="primary" data-act="next">理解確認へ</button>';
    } else if (run.phase === 'check') {
      h += vChoice('理解確認 ' + (run.ci + 1) + '／' + L.checks.length, L.checks[run.ci]);
    } else if (run.phase === 'reason') {
      h += '<div class="note">この処理になる理由を、まず自分の言葉で（頭の中か声に出して）説明してから答えてください。</div>' + vChoice('理由の確認', L.reason);
      if (run.picked !== null) {
        h = h.replace('<button class="primary" data-act="next">次へ</button>', '');
        h += '<div class="card"><h3>模範説明</h3><p>' + esc(L.model) + '</p><p class="sub">自分の説明と比べて、どうでしたか。</p><div class="row">' +
          ['できた', 'あいまい', 'できない'].map(function (s) { return '<button data-act="self" data-v="' + s + '">' + s + '</button>'; }).join('') + '</div></div>';
      }
    } else if (run.phase === 'q') {
      h += vQuestion();
    } else if (run.phase === 'result') {
      h += vResult();
    }
    return h;
  }
  function vChoice(title, c) {
    var h = '<div class="card"><div class="sub">' + title + '</div><p class="qtext">' + esc(c.q) + '</p>';
    c.opts.forEach(function (o, i) {
      var cls = 'opt', mk = '';
      if (run.picked !== null) { if (i === c.a) { cls += ' sel'; mk = ' ○'; } else if (i === run.picked) mk = ' ×'; }
      h += '<button class="' + cls + '" data-act="pick" data-i="' + i + '"' + (run.picked !== null ? ' disabled' : '') + '>' + esc(o) + mk + '</button>';
    });
    if (run.picked !== null) {
      h += '<p class="' + (run.picked === c.a ? 'ok' : 'ng') + '"><b>' + (run.picked === c.a ? '正解' : '不正解') + '</b></p>' + (c.why ? '<p>' + esc(c.why) + '</p>' : '');
    }
    h += '</div>';
    if (run.picked !== null) h += '<button class="primary" data-act="next">次へ</button>';
    return h;
  }

  var LV = ['', '基本', '数値変更', '条件変更', '複数論点'];
  function vQuestion() {
    var q = run.q, h = '<div class="card"><div class="row"><div class="sub">' + (run.mode === 'diag' ? '診断　' : '') + (run.isFollow ? '類題　' : '') + 'レベル' + q.level + '（' + LV[q.level] + '）</div><div class="sub timer" style="text-align:right">経過 <span id="timer">0:00</span>／目標 ' + mmss(q.target) + '</div></div>' +
      '<p class="qtext">' + esc(q.text) + '</p><p class="sub">仕訳を答えてください。使わない行は空のままで構いません。</p>';
    ['D', 'C'].forEach(function (side) {
      h += '<div class="side">' + (side === 'D' ? '借方' : '貸方') + '</div>';
      for (var i = 0; i < run.rows[side]; i++) {
        var k = side + i, v = run.vals[k] || {};
        h += '<div class="jrow"><select id="acc' + k + '"><option value="">勘定科目</option>' + q.choices.map(function (c) { return '<option' + (v.acc === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select><input id="amt' + k + '" inputmode="numeric" placeholder="金額" value="' + esc(v.amt || '') + '"></div>';
      }
      h += '<button class="small" data-act="addrow" data-side="' + side + '">＋ 行を追加</button>';
    });
    h += '<p class="sub" id="totals" style="margin-top:10px"></p>';
    if (run.hint) h += '<div class="note">ヒント：' + esc(q.hint) + '</div>';
    h += '</div><div class="row">' + (run.hint || run.mode === 'diag' ? '' : '<button data-act="hint">ヒント</button>') + '<button data-act="answer" data-skip="1">わからない</button></div><div style="height:8px"></div><button class="primary" data-act="answer">解答する</button>';
    return h;
  }
  function readRows() {
    var out = [];
    ['D', 'C'].forEach(function (side) {
      for (var i = 0; i < run.rows[side]; i++) {
        var k = side + i, acc = val('acc' + k), a = num('amt' + k);
        run.vals[k] = { acc: acc, amt: val('amt' + k) };
        if (acc && a) out.push({ side: side, acc: acc, amt: a });
      }
    });
    return out;
  }
  function showTotals() {
    var el = document.getElementById('totals');
    if (!el || !run || run.phase !== 'q') return;
    var e = readRows(), dsum = BK.sideTotal(e, 'D'), csum = BK.sideTotal(e, 'C');
    el.innerHTML = '借方合計 ' + BK.yen(dsum) + '　貸方合計 ' + BK.yen(csum) + (dsum !== csum ? '　<span class="ng">一致していません</span>' : '');
  }
  function jtable(entries) {
    var n = BK.normalize(entries);
    if (!n.length) return '<p class="sub">（解答なし）</p>';
    var Dn = n.filter(function (e) { return e.side === 'D'; }), Cn = n.filter(function (e) { return e.side === 'C'; }), h = '<table><tr><th>借方</th><th class="num">金額</th><th>貸方</th><th class="num">金額</th></tr>';
    for (var i = 0; i < Math.max(Dn.length, Cn.length); i++) {
      h += '<tr><td>' + (Dn[i] ? esc(Dn[i].acc) : '') + '</td><td class="num">' + (Dn[i] ? BK.yen(Dn[i].amt) : '') + '</td><td>' + (Cn[i] ? esc(Cn[i].acc) : '') + '</td><td class="num">' + (Cn[i] ? BK.yen(Cn[i].amt) : '') + '</td></tr>';
    }
    return h + '</table>';
  }
  function vResult() {
    var a = run.last, q = run.q, slow = a.sec > q.target;
    var h = '<div class="card"><div class="big ' + (a.ok ? 'ok' : 'ng') + '">' + (a.ok ? '正解' : '不正解') + '</div><div class="sub">解答時間 ' + mmss(a.sec) + '（目標 ' + mmss(q.target) + '）' + (a.ok && slow ? '　目標時間を超えました' : '') + (a.hint ? '　ヒント使用' : '') + '</div></div>';
    if (!a.ok) h += '<div class="card"><h3>あなたの解答</h3>' + jtable(a.user) + '</div>';
    h += '<div class="card"><h3>正解</h3>' + jtable(q.answer) + '<p style="margin-top:10px">' + esc(q.explain) + '</p></div>';
    if (!a.ok && run.mode !== 'diag') {
      h += '<div class="card"><h3>誤答の原因</h3><p class="sub">機械判定の候補：<b>' + a.machine + '</b>　' + esc(run.diagNote) + '</p><p class="sub">合っていればそのまま、違う場合は選び直してください。</p><select id="cause">' +
        BK.CAUSES.map(function (c) { return '<option' + (c === a.machine ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>';
    }
    return h + '<button class="primary" data-act="next">次へ</button>';
  }

  function submitAnswer(skip) {
    var q = run.q, user = skip ? [] : readRows(), d = today();
    var sec = Math.round((Date.now() - run.started) / 1000), ok = BK.sameJournal(user, q.answer);
    var a = { date: d, ts: Date.now(), topics: q.topics, tpl: q.tpl, variant: q.variant, level: q.level, seed: q.seed, ok: ok, hint: run.hint, sec: sec, target: q.target, kind: run.mode === 'menu' ? run.item.type : run.mode, user: user, cause: null, machine: null };
    if (!ok) { var dg = BK.diagnose(user, q.answer, q.traps, false); a.machine = dg.cause; run.diagNote = dg.note; }
    S.attempts.push(a);
    if (run.mode !== 'diag') {
      BK.applyAttempt(S, a);
      if (ok) BK.schedule(S, run.topic, { ok: true, hint: a.hint, slow: sec > q.target }, d);
    }
    run.last = a; run.phase = 'result';
    mark(); save(); go('study');
  }
  function afterResult() {
    var a = run.last, d = today();
    if (run.mode === 'diag') return diagNext(a.ok);
    if (!a.ok) {
      a.cause = val('cause') || a.machine;
      a.causeBy = a.cause === a.machine ? '機械判定を承認' : '利用者が選択';
      BK.applyCause(S, run.topic, a.cause, d);
      BK.schedule(S, run.topic, { ok: false, cause: a.cause }, d);
      // 誤答のまま終わらせない。ただし同じ論点で1日3回誤答したら翌日に回す
      if (wrongToday(run.topic) < 3) run.follow = { tpl: a.tpl, variant: a.variant, level: a.level };
      else run.asked = run.maxQ;
      save();
    }
    advance();
  }

  // ---------- 初回診断 ----------
  function startDiag(ids) {
    run = { mode: 'diag', queue: ids, qi: 0, stage: 'basic', phase: 'q' };
    if (!ids.length) return endDiag();
    diagQuestion();
  }
  function diagQuestion() {
    run.topic = run.queue[run.qi];
    var q = BK.pickQuestion(run.topic, run.stage === 'basic' ? 1 : 3, {});
    run.q = q; run.hint = false; run.started = Date.now(); run.rows = { D: 2, C: 2 }; run.vals = {}; run.isFollow = false; run.phase = 'q';
    go('study');
  }
  function diagNext(ok) {
    var ts = BK.ts(S, run.topic), d = today();
    if (run.stage === 'basic' && ok) { run.stage = 'cond'; return diagQuestion(); }
    // 設計書2章の表：基本で不正解／基本のみ正解／基本＋条件変更に正解
    if (run.stage === 'basic') { ts.coef = 0.8; ts.explained = false; }
    else if (!ok) { ts.coef = 0.5; ts.explained = true; }
    else { ts.coef = 0.3; ts.explained = true; ts.basicStreak = 3; ts.ev[1] = d; ts.cond[run.q.tpl + ':' + run.q.variant] = true; ts.level = 2; }
    ts.last = d;
    BK.refreshStatus(S, run.topic, d, '初回診断');
    BK.schedule(S, run.topic, { ok: ok, hint: true }, d);
    run.qi++; run.stage = 'basic';
    save();
    if (run.qi < run.queue.length) diagQuestion(); else endDiag();
  }
  function endDiag() {
    S.profile.diagDone = true; run = null; save(); go('plan');
  }

  // ---------- 論点 ----------
  function vMap() {
    var c = BK.statusCounts(S), h = '<div class="card"><div class="sub">論点の状態（●は7つの証拠）</div><p>' + BK.STATUSES.map(function (s) { return s + ' ' + c[s]; }).join('　') + '</p></div>';
    ['3級基礎', '商業簿記', '工業簿記'].forEach(function (area) {
      h += '<div class="card"><h3>' + area + '</h3>';
      BK.TOPICS.filter(function (t) { return t.area === area; }).forEach(function (t) {
        var ts = BK.ts(S, t.id);
        h += '<div class="topic-line" data-act="topic" data-id="' + t.id + '"><div>' + esc(t.name) + (ts.declared ? ' <span class="sub">（自己申告）</span>' : '') + '<br>' + dots(ts) + (ts.due ? ' <span class="sub">次回 ' + ts.due.slice(5) + '</span>' : '') + '</div>' + badge(ts.status) + '</div>';
      });
      h += '</div>';
    });
    return h;
  }
  function vTopic(id) {
    var t = BK.topic(id), ts = BK.ts(S, id), L = BK.LESSONS[id];
    var h = '<button class="small" data-act="nav" data-r="map">← 論点一覧</button><div class="card"><h3>' + esc(t.name) + '</h3><p>' + badge(ts.status) + '　<span class="sub">レベル' + ts.level + '　次回復習 ' + (ts.due || '未定') + '</span></p><table>';
    for (var i = 1; i <= 7; i++) h += '<tr><td>' + i + '. ' + BK.EVIDENCE[i] + '</td><td class="' + (ts.ev[i] ? 'ok' : 'sub') + '">' + (ts.ev[i] ? '成立 ' + ts.ev[i] : '未成立') + '</td></tr>';
    h += '</table>' + (ts.selfGraded ? '<p class="sub">教材の自己採点結果を含みます。</p>' : '') + '</div>';
    if (BK.hasTemplates(id)) h += '<button class="primary" data-act="free" data-id="' + id + '">この論点を練習する</button>';
    else h += '<div class="note">この論点の内蔵問題は未整備です。教材「' + esc(S.profile.material) + '」で学習し、結果を記録してください。</div><button class="primary" data-act="matfor" data-id="' + id + '">教材の結果を記録する</button>';
    if (L) h += '<div class="card"><h3>解説</h3>' + L.text.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
    var ev = S.events.filter(function (e) { return e.topic === id; }).slice(-5).reverse();
    if (ev.length) h += '<div class="card"><h3>状態の変化</h3>' + ev.map(function (e) { return '<p class="sub">' + e.date + '　' + e.from + ' → ' + e.to + '（' + esc(e.why) + '）</p>'; }).join('') + '</div>';
    return h;
  }

  // ---------- 教材記録 ----------
  function vMaterial(ctx) {
    ctx = ctx || {};
    var tid = ctx.item ? ctx.item.topic : ctx.topic, d = today(), h = '';
    if (ctx.item) h += '<div class="card"><h3>' + TYPE.material + '：' + tname(tid) + '</h3><p>教材「' + esc(S.profile.material) + '」でこの論点の範囲を読み、問題を解いてください（目安 ' + ctx.item.min + '分）。解いた問題ごとに結果を記録します。</p><p class="sub">' + esc(ctx.item.reason) + '</p></div>';
    h += '<div class="card"><h3>教材の結果を記録</h3><label class="f">論点</label><select id="mtopic">' + BK.TOPICS.map(function (t) { return '<option value="' + t.id + '"' + (t.id === tid ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select>' +
      '<label class="f">問題番号（例：問題12）</label><input id="mno">' +
      '<label class="f">結果</label><select id="mok"><option value="1">正解</option><option value="0">不正解</option></select>' +
      '<label class="f">かかった時間（分）</label><input id="mmin" inputmode="numeric">' +
      '<label class="f">不正解の場合の原因</label><select id="mcause"><option value="">（正解の場合は不要）</option>' + BK.CAUSES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>' +
      '<label class="check"><input type="checkbox" id="mcomp"><span>複数の論点を含む総合問題</span></label>' +
      '<div style="height:8px"></div><button class="primary" data-act="matsave">記録する</button></div>';
    var recs = S.materials.filter(function (m) { return m.date === d; });
    if (recs.length) h += '<div class="card"><h3>今日の記録</h3>' + recs.map(function (m) { return '<p class="sub">' + tname(m.topic) + '　' + esc(m.no) + '　' + (m.ok ? '正解' : '不正解（' + esc(m.cause || '原因未選択') + '）') + '</p>'; }).join('') + '</div>';
    if (ctx.item) h += '<button data-act="matdone" style="width:100%">この項目を終える</button>';
    return h;
  }

  // ---------- 計画 ----------
  function vPlan() {
    var d = today(), dl = BK.delay(S, d), wp = BK.weekPlan(S, d), toExam = BK.daysBetween(d, S.profile.examDate);
    var h = '<div class="card"><h3>学習計画</h3><p>受験日 ' + S.profile.examDate + '（あと' + toExam + '日）</p><p>残りの必要時間 約' + Math.round(dl.required / 60) + '時間<br>受験日までに使える時間 約' + Math.round(dl.available / 60) + '時間（予備15%を除く）</p><p>遅延率 <b class="' + (dl.label === '順調' ? 'ok' : dl.label === '注意' ? 'warn' : 'ng') + '">' + dl.ratio.toFixed(2) + '（' + dl.label + '）</b></p><p class="sub">必要時間は標準的な所要時間と現在の状態からの見積りです。学習が進むと減ります。</p></div>';
    if (dl.ratio > 1.15) {
      var weeks = Math.max(1, toExam / 7), gap = dl.required - dl.available, perWeek = dl.available / weeks;
      var needWeeks = perWeek > 0 ? Math.ceil(dl.required / perWeek) : 0;
      h += '<div class="card"><h3>時間が足りない場合の選択肢</h3><p class="sub">どれを選ぶかはご自身で決めてください。</p>' +
        '<p>(a) 学習時間を増やす：週あたり あと約' + Math.ceil(gap / weeks / 60 * 10) / 10 + '時間</p>' +
        '<p>(b) 範囲を絞る：配点への寄与が小さい論点を後回しにする（下の「計画に入りきらない論点」' + wp.overflow.length + '個）</p>' +
        '<p>(c) 受験日を変更する：今の学習時間のままなら 約' + needWeeks + '週間後（' + BK.addDays(d, needWeeks * 7) + ' ごろ）</p>' +
        (BK.suggestDateChange(S) ? '<p class="ng">遅延率1.4超が2週続いています。受験日の変更を検討してください。</p>' : '') + '</div>';
    }
    h += '<div class="card"><h3>週ごとの目標</h3>';
    wp.weeks.forEach(function (w) {
      h += '<p><b>' + w.start.slice(5) + '〜' + w.end.slice(5) + '</b> <span class="sub">（約' + Math.round(w.cap / 6) / 10 + '時間）</span><br><span class="sub">' + (w.topics.map(tname).join('、') || '復習・模試') + '</span></p>';
    });
    if (wp.overflow.length) h += '<p class="ng"><b>計画に入りきらない論点</b></p><p class="sub">' + wp.overflow.map(tname).join('、') + '</p>';
    h += '</div>';
    h += S.profile.planApprovedAt ? '<p class="sub">計画の確認日：' + S.profile.planApprovedAt + '</p><button data-act="nav" data-r="settings" style="width:100%">受験日・学習時間を変更する</button>'
      : '<button class="primary" data-act="approve">この計画で始める</button><div style="height:8px"></div><button data-act="nav" data-r="settings" style="width:100%">受験日・学習時間を変更する</button>';
    return h;
  }

  // ---------- 振り返り ----------
  function sumCard(title, s) {
    var h = '<div class="card"><h3>' + title + '</h3><p>学習時間 ' + s.minutes + '分　解いた数 ' + s.count + '問　正答率 ' + (s.count ? Math.round(s.correct / s.count * 100) + '%' : '―') + '</p>';
    if (s.up.length) h += '<p class="ok">上がった論点：' + s.up.map(function (e) { return tname(e.topic) + '（' + e.to + '）'; }).join('、') + '</p>';
    if (s.down.length) h += '<p class="ng">下がった論点：' + s.down.map(function (e) { return tname(e.topic) + '（' + e.to + '）'; }).join('、') + '</p>';
    var keys = Object.keys(s.causes);
    if (keys.length) h += '<p>誤答原因：' + keys.map(function (k) { return k + ' ' + s.causes[k]; }).join('、') + '</p>' + (s.topCause ? '<div class="note">いちばん多い原因「' + s.topCause + '」：' + BK.CAUSE_ADVICE[s.topCause] + '</div>' : '');
    return h + '</div>';
  }
  function vReview() {
    var d = today(), dl = BK.delay(S, d);
    var lastW = S.weekly[S.weekly.length - 1];
    if (S.profile.diagDone && (!lastW || BK.daysBetween(lastW.date, d) >= 7)) { S.weekly.push({ date: d, ratio: dl.ratio }); save(); }
    var h = sumCard('今日', BK.rangeSummary(S, d, d));
    var tm = BK.buildMenu(S, BK.addDays(d, 1), BK.budgetFor(S, BK.addDays(d, 1)), []);
    var cnt = function (ty) { return tm.items.filter(function (x) { return ty.indexOf(x.type) >= 0; }).length; };
    h += '<div class="card"><h3>明日の予定</h3><p>復習・再確認 ' + cnt(['review', 'retry']) + '件、続き ' + cnt(['continue', 'practice']) + '件、新しい論点 ' + cnt(['new']) + '件、教材 ' + cnt(['material']) + '件</p>' + tm.notes.map(function (n) { return '<p class="sub">' + esc(n) + '</p>'; }).join('') + '</div>';
    h += sumCard('この1週間', BK.rangeSummary(S, BK.addDays(d, -6), d));
    h += '<div class="card"><h3>次の1週間の優先事項</h3>' + BK.priorities(S, d).map(function (p, i) { return '<p>' + (i + 1) + '. ' + esc(p) + '</p>'; }).join('') + '<p class="sub">計画の状況：' + dl.label + '（遅延率 ' + dl.ratio.toFixed(2) + '）</p>' + (BK.suggestDateChange(S) ? '<p class="ng">遅延率1.4超が2週続いています。受験日の変更を検討してください（計画画面）。</p>' : '') + '</div>';
    h += sumCard('この30日', BK.rangeSummary(S, BK.addDays(d, -29), d));
    var est = BK.estimate(S), c = BK.statusCounts(S);
    h += '<div class="card"><h3>推定得点（推定）</h3><p class="big">' + est.total + '点 <span class="sub">／合格 ' + BK.EXAM.pass + '点</span></p><table>' + est.sections.map(function (s) { return '<tr><td>' + esc(s.name) + '</td><td class="num">' + s.score + '／' + s.points + '</td></tr>'; }).join('') + '</table><p class="sub">論点の状態と直近の正答率からの推定です。模試の得点を優先してください。</p><p class="sub">論点の状態：' + BK.STATUSES.map(function (s) { return s + ' ' + c[s]; }).join('　') + '</p></div>';
    return h;
  }

  // ---------- 模試 ----------
  function mockLeft() {
    var r = S.mockRun, now = r.pausedAt || Date.now();
    return BK.EXAM.minutes * 60 - (now - r.start - r.pausedMs) / 1000;
  }
  function vMock() {
    var h = '', j = BK.mockJudge(S);
    if (S.mockRun && S.mockRun.entering) {
      h += '<div class="card"><h3>得点の入力：' + esc(S.mockRun.name) + '</h3><p class="sub">教材の解答で自己採点し、大問ごとの得点を入力してください。</p>';
      BK.EXAM.sections.forEach(function (s) { h += '<label class="f">' + esc(s.name) + '（' + s.points + '点満点）</label><input id="sc_' + s.id + '" inputmode="numeric">'; });
      h += '<label class="f">90分を超えて延長した時間（分）</label><input id="mext" inputmode="numeric" value="' + S.mockRun.ext + '"></div><button class="primary" data-act="mocksave">保存する</button>';
      return h;
    }
    if (S.mockRun) {
      h += '<div class="card"><h3>' + esc(S.mockRun.name) + '</h3><div class="big timer" id="mocktimer">' + mmss(mockLeft()) + '</div><p class="sub">教材の模試を紙で解いてください。' + (S.mockRun.pauses ? '一時停止 ' + S.mockRun.pauses + '回' : '') + '</p><p class="sub">目標の時間配分：' + BK.EXAM.sections.map(function (s) { return s.id.replace('q', '第') + '問 ' + s.minutes + '分'; }).join('、') + '</p></div><div class="row"><button data-act="mockpause">' + (S.mockRun.pausedAt ? '再開' : '一時停止') + '</button><button data-act="mockend">終了して採点</button></div>';
      return h;
    }
    h += '<div class="card"><h3>合格基準への到達状況</h3><p class="big">' + j.label + '</p><p class="sub">' + esc(j.why) + '</p><p class="sub">判定は目安です。受験するかどうかはご自身で決めてください。</p></div>';
    h += '<div class="card"><h3>模擬試験を始める（90分）</h3><p class="sub">教材の模試・過去問を使います。アプリは時間の管理と得点の記録・分析を行います。内蔵の模試問題はまだありません。</p><label class="f">教材名・回（例：予想問題集 第1回）</label><input id="mockname"><div style="height:8px"></div><button class="primary" data-act="mockstart">開始</button></div>';
    S.mocks.slice().reverse().forEach(function (m) {
      var worst = BK.EXAM.sections.slice().sort(function (a, b) { return (m.scores[a.id] || 0) / a.points - (m.scores[b.id] || 0) / b.points; })[0];
      var tot = BK.mockTotal(m);
      h += '<div class="card"><h3>' + m.date + '　' + esc(m.name) + '</h3><p class="big ' + (tot >= BK.EXAM.pass ? 'ok' : 'ng') + '">' + tot + '点</p><table>' + BK.EXAM.sections.map(function (s) { return '<tr><td>' + esc(s.name) + '</td><td class="num">' + (m.scores[s.id] || 0) + '／' + s.points + '</td></tr>'; }).join('') + '</table>' +
        '<p class="sub">' + (tot < BK.EXAM.pass ? '合格点まであと' + (BK.EXAM.pass - tot) + '点。' : '') + '得点率が最も低いのは ' + esc(worst.name) + '（失点 ' + (worst.points - (m.scores[worst.id] || 0)) + '点）。' + (m.ext ? '延長 ' + m.ext + '分。' : '') + '</p></div>';
    });
    return h;
  }

  // ---------- その他・設定 ----------
  function vMore() {
    return '<div class="card"><button class="opt" data-act="nav" data-r="material">教材の結果を記録する</button><button class="opt" data-act="nav" data-r="mock">模擬試験</button><button class="opt" data-act="nav" data-r="settings">設定・バックアップ</button></div>' +
      '<div class="note">学習データはこの端末のブラウザ内にだけ保存されます。ブラウザのデータを消すと履歴も消えるので、週に1回は「設定」からファイルに書き出してください。</div>';
  }
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  function vSettings() {
    var h = '<div class="card"><h3>受験日と学習時間</h3><label class="f">受験日</label><input id="exam" type="date" value="' + (S.profile.examDate || '') + '"><label class="f">曜日ごとの学習時間（分）</label><div class="row">';
    WD.forEach(function (w, i) { h += '<div style="min-width:70px"><label class="f">' + w + '</label><input id="min' + i + '" inputmode="numeric" value="' + S.profile.mins[i] + '"></div>'; });
    h += '</div><label class="f">使用する教材</label><input id="mat" value="' + esc(S.profile.material) + '"><div style="height:8px"></div><button class="primary" data-act="setsave">保存する</button></div>';
    h += '<div class="card"><h3>バックアップ</h3><p class="sub">学習データをファイルに書き出します。機種変更のときは、新しい端末で読み込んでください。</p><button data-act="export" style="width:100%">ファイルに書き出す</button><label class="f">ファイルから読み込む（今のデータは置き換わります）</label><input type="file" id="impfile" accept="application/json,.json"><div style="height:8px"></div><button data-act="import" style="width:100%">読み込む</button></div>';
    h += '<div class="card"><h3>データの消去</h3><button data-act="reset" style="width:100%" class="ng">すべての学習データを消去する</button></div>';
    return h;
  }

  // ---------- 描画 ----------
  var NAV = [['today', '今日'], ['map', '論点'], ['plan', '計画'], ['review', '振り返り'], ['more', 'その他']];
  function render() {
    clearInterval(tickId);
    if (!S.profile.setupDone) route = 'setup';
    else if (!S.profile.diagDone && route !== 'study' && route !== 'declare') route = 'declare';
    if (route === 'study' && !run) route = S.profile.diagDone ? 'today' : 'declare';
    var body = route === 'setup' ? vSetup() : route === 'declare' ? vDeclare() : route === 'study' ? vStudy() : route === 'map' ? vMap() : route === 'topic' ? vTopic(arg) :
      route === 'material' ? vMaterial(arg) : route === 'plan' ? vPlan() : route === 'review' ? vReview() : route === 'mock' ? vMock() : route === 'more' ? vMore() : route === 'settings' ? vSettings() : vToday();
    var left = S.profile.examDate ? '受験日まで ' + BK.daysBetween(today(), S.profile.examDate) + '日' : '';
    var showNav = S.profile.diagDone && route !== 'study';
    app.innerHTML = '<header class="top"><h1>簿記2級コーチ</h1><span>' + left + '</span></header>' + body +
      (showNav ? '<nav class="bottom">' + NAV.map(function (n) { return '<button data-act="nav" data-r="' + n[0] + '"' + (route === n[0] ? ' class="cur"' : '') + '>' + n[1] + '</button>'; }).join('') + '</nav>' : '');
    if (route === 'study' && run && run.phase === 'q') {
      showTotals();
      tickId = setInterval(function () {
        var el = document.getElementById('timer');
        if (el) el.textContent = mmss((Date.now() - run.started) / 1000);
      }, 1000);
    }
    if (route === 'mock' && S.mockRun && !S.mockRun.entering) {
      tickId = setInterval(function () {
        var el = document.getElementById('mocktimer');
        if (el) { var l = mockLeft(); el.textContent = l >= 0 ? mmss(l) : '時間切れ（超過 ' + mmss(-l) + '）'; }
      }, 1000);
    }
  }

  // ---------- 操作 ----------
  var ACT = {
    nav: function (el) { go(el.dataset.r); },
    setup: function () {
      if (!val('exam')) return alert('受験日を入力してください。');
      var wd = num('wd'), we = num('we');
      S.profile.examDate = val('exam'); S.profile.mins = [we, wd, wd, wd, wd, wd, we];
      S.profile.material = val('mat') || S.profile.material; S.profile.setupDone = true;
      save(); go('declare');
    },
    declare: function () {
      var ids = [];
      document.querySelectorAll('.decl:checked').forEach(function (c) {
        var ts = BK.ts(S, c.value);
        ts.declared = true; ts.explained = true; ts.coef = 0.5;
        BK.refreshStatus(S, c.value, today(), '学習済みと申告');
        if (BK.hasTemplates(c.value)) ids.push(c.value);
      });
      save(); startDiag(ids);
    },
    budget: function () { S.budget[today()] = num('budget'); save(); go('today'); },
    more: function () { var d = today(); S.budget[d] = BK.budgetFor(S, d) + 10; save(); go('today'); },
    start: function () { var n = nextItem(); if (n) startItem(n); },
    quit: function () {
      if (run && run.mode === 'diag') return alert('診断は最後まで行ってください。分からない問題は「わからない」で進めます。');
      mark(); save(); run = null; go('today');
    },
    next: function () { mark(); if (run.phase === 'result') afterResult(); else advance(); },
    pick: function (el) { run.picked = +el.dataset.i; go('study'); },
    self: function (el) {
      BK.applyReason(S, run.topic, run.picked === BK.LESSONS[run.topic].reason.a, el.dataset.v, today());
      mark(); save(); advance();
    },
    hint: function () { readRows(); run.hint = true; render(); },
    addrow: function (el) { readRows(); run.rows[el.dataset.side]++; render(); },
    answer: function (el) { submitAnswer(!!el.dataset.skip); },
    topic: function (el) { go('topic', el.dataset.id); },
    free: function (el) { run = { mode: 'free', topic: el.dataset.id, phase: 'start', asked: 0, maxQ: MAXQ.free }; lastMark = Date.now(); advance(); },
    matfor: function (el) { go('material', { topic: el.dataset.id }); },
    matsave: function () {
      var ok = val('mok') === '1';
      if (!val('mno')) return alert('問題番号を入力してください。');
      var rec = { date: today(), book: S.profile.material, no: val('mno'), topic: val('mtopic'), topics: [val('mtopic')], ok: ok, min: num('mmin'), cause: ok ? null : (val('mcause') || '判定不能'), composite: document.getElementById('mcomp').checked };
      S.materials.push(rec);
      BK.applyMaterial(S, rec);
      S.sessions[rec.date] = (S.sessions[rec.date] || 0) + rec.min;
      lastMark = Date.now();
      save(); render();
    },
    matdone: function () {
      var it = arg.item;
      if (!S.materials.some(function (m) { return m.date === today() && m.topic === it.topic; }) && !confirm('この論点の記録がまだありません。終えてよいですか。')) return;
      it.done = true; save();
      var n = nextItem();
      if (n) startItem(n); else go('review');
    },
    approve: function () { S.profile.planApprovedAt = today(); save(); go('today'); },
    mockstart: function () {
      S.mockRun = { name: val('mockname') || '模擬試験', start: Date.now(), pausedMs: 0, pausedAt: null, pauses: 0 };
      save(); render();
    },
    mockpause: function () {
      var r = S.mockRun;
      if (r.pausedAt) { r.pausedMs += Date.now() - r.pausedAt; r.pausedAt = null; } else { r.pausedAt = Date.now(); r.pauses++; }
      save(); render();
    },
    mockend: function () {
      var r = S.mockRun;
      r.ext = Math.max(0, Math.ceil(-mockLeft() / 60)); r.entering = true;
      save(); render();
    },
    mocksave: function () {
      var scores = {};
      BK.EXAM.sections.forEach(function (s) { scores[s.id] = Math.min(s.points, num('sc_' + s.id)); });
      S.mocks.push({ date: today(), name: S.mockRun.name, scores: scores, ext: num('mext'), pauses: S.mockRun.pauses });
      S.sessions[today()] = (S.sessions[today()] || 0) + BK.EXAM.minutes;
      S.mockRun = null; save(); render();
    },
    setsave: function () {
      if (!val('exam')) return alert('受験日を入力してください。');
      S.profile.examDate = val('exam');
      S.profile.mins = WD.map(function (w, i) { return num('min' + i); });
      S.profile.material = val('mat') || S.profile.material;
      delete S.menus[today()];
      save(); go('plan');
    },
    'export': function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([BK.exportData(S)], { type: 'application/json' }));
      a.download = 'boki_coach_' + today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
    },
    'import': function () {
      var f = document.getElementById('impfile').files[0];
      if (!f) return alert('ファイルを選んでください。');
      if (!confirm('今の学習データを、選んだファイルの内容に置き換えます。よろしいですか。')) return;
      var rd = new FileReader();
      rd.onload = function () {
        try { S = BK.importData(rd.result); save(); go('today'); } catch (e) { alert('読み込めませんでした：' + e.message); }
      };
      rd.readAsText(f);
    },
    reset: function () {
      if (!confirm('すべての学習データを消去します。元に戻せません。よろしいですか。')) return;
      S = BK.newState(); save(); run = null; go('setup');
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el);
  });
  document.addEventListener('input', showTotals);
  document.addEventListener('change', showTotals);

  // テストページから内部状態を確認するための入口
  BK.ui = { run: function () { return run; }, state: function () { return S; }, route: function () { return route; } };

  BK.expireEvidence(S, today());
  render();
})();
