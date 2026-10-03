// ブラウザで開くテスト。採点・ソルバー・理解判定・計画を、手計算の正解と突き合わせる。
(function () {
  var BK = globalThis.BK, out = [], pass = 0, fail = 0;
  function ok(cond, name) { if (cond) pass++; else { fail++; out.push('NG: ' + name); } }
  function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name + ' 期待=' + JSON.stringify(b) + ' 実際=' + JSON.stringify(a)); }
  function D(acc, amt) { return { side: 'D', acc: acc, amt: amt }; }
  function C(acc, amt) { return { side: 'C', acc: acc, amt: amt }; }
  function ans(tpl, v, p) { return BK.normalize(BK.tpl(tpl).build(p, v).answer); }
  function same(tpl, v, p, expect) { ok(BK.sameJournal(BK.tpl(tpl).build(p, v).answer, expect), tpl + ':' + v + ' 実際=' + JSON.stringify(ans(tpl, v, p))); }

  // ---- 採点 ----
  var correct = [D('当座預金', 95000), D('手形売却損', 5000), C('受取手形', 100000)];
  ok(BK.sameJournal([D('手形売却損', 5000), C('受取手形', 100000), D('当座預金', 95000)], correct), '順不同で一致');
  ok(BK.sameJournal([D('仕入', 300), D('仕入', 700), C('買掛金', 1000)], [D('仕入', 1000), C('買掛金', 1000)]), '同じ科目の行は合算');
  ok(!BK.sameJournal([D('当座預金', 100000), C('受取手形', 100000)], correct), '金額違いは不一致');
  ok(BK.isBalanced(correct), '貸借一致');
  ok(!BK.isBalanced([D('仕入', 100), C('買掛金', 90)]), '貸借不一致を検出');
  ok(!BK.isBalanced([]), '空は不一致扱い');
  var base = [D('仕入', 1000), C('買掛金', 1000)];
  eq(BK.diagnose([D('買掛金', 1000), C('仕入', 1000)], base, []).cause, '借方・貸方の誤り', '貸借逆');
  eq(BK.diagnose([D('仕入', 1000), C('未払金', 1000)], base, []).cause, '勘定科目の誤り', '科目違い');
  eq(BK.diagnose([D('仕入', 900), C('買掛金', 900)], base, []).cause, '計算ミス', '金額違い');
  eq(BK.diagnose([D('仕入', 900), C('買掛金', 900)], base, [{ entries: [D('仕入', 900), C('買掛金', 900)], cause: '条件の読み落とし', note: '' }]).cause, '条件の読み落とし', '典型誤りに一致');
  eq(BK.diagnose([], base, [], true).cause, '時間不足', '時間切れ');
  eq(BK.diagnose([D('仕入', 1000), C('現金', 400), C('買掛金', 500)], base, []).cause, '取引認識の誤り', '行数違い');

  // ---- ソルバー（手計算と照合）----
  same('dep', 'basic', { c: 1000000, pct: 20 }, [D('減価償却費', 160000), C('備品減価償却累計額', 160000)]);
  same('dep', 'monthly', { k: 5000, n: 5, mo: 8 }, [D('減価償却費', 40000), C('備品減価償却累計額', 40000)]);
  same('dep', 'production', { cc: 2000000, tot: 100000, km: 15000 }, [D('減価償却費', 270000), C('車両運搬具減価償却累計額', 270000)]);
  same('div', 'basic', { dv: 1000000, cap: 20000000, room: 500000, s1: 3000000, s2: 1500000 }, [D('繰越利益剰余金', 1100000), C('未払配当金', 1000000), C('利益準備金', 100000)]);
  same('div', 'cap', { dv: 1000000, cap: 20000000, room: 60000, s1: 3000000, s2: 1940000 }, [D('繰越利益剰余金', 1060000), C('未払配当金', 1000000), C('利益準備金', 60000)]);
  same('div', 'reserve', { dv: 1000000, cap: 20000000, room: 500000, s1: 3000000, s2: 1500000, other: 200000 }, [D('繰越利益剰余金', 1300000), C('未払配当金', 1000000), C('利益準備金', 100000), C('別途積立金', 200000)]);
  same('allow', 'basic', { rec: 5000000, pct: 2, bal: 30000 }, [D('貸倒引当金繰入', 70000), C('貸倒引当金', 70000)]);
  same('allow', 'bonus', { t: 6000000 }, [D('賞与引当金繰入', 4000000), C('賞与引当金', 4000000)]);
  same('allow', 'repair', { x: 500000, b: 300000 }, [D('修繕引当金', 300000), D('修繕費', 200000), C('当座預金', 500000)]);
  same('fx', 'settle', { d: 1000, r1: 110, r2: 115 }, [D('買掛金', 110000), D('為替差損益', 5000), C('当座預金', 115000)]);
  same('fx', 'settle', { d: 1000, r1: 110, r2: 105 }, [D('買掛金', 110000), C('当座預金', 105000), C('為替差損益', 5000)]);
  same('fx', 'closing', { d: 1000, r1: 110, r2: 115 }, [D('為替差損益', 5000), C('買掛金', 5000)]);
  same('sec_eval', 'amortized', { face: 1000000, k: 1000, n: 5, mo: 6 }, [D('満期保有目的債券', 6000), C('有価証券利息', 6000)]);
  same('sec_eval', 'basic', { b: 500000, m: 460000 }, [D('有価証券評価損', 40000), C('売買目的有価証券', 40000)]);
  same('sec_eval', 'other', { b: 500000, m: 560000 }, [D('その他有価証券', 60000), C('その他有価証券評価差額金', 60000)]);
  same('sec_trade', 'basic', { n: 1000, b: 500, f: 3000 }, [D('売買目的有価証券', 503000), C('当座預金', 503000)]);
  same('sec_trade', 'sell', { n: 1000, b: 500, s: 450 }, [D('当座預金', 450000), D('有価証券売却損', 50000), C('売買目的有価証券', 500000)]);
  same('fa_sale', 'midyear', { k: 5000, n: 5, yrs: 2, mo: 6, s: 100000 }, [D('備品減価償却累計額', 120000), D('減価償却費', 30000), D('未収入金', 100000), D('固定資産売却損', 50000), C('備品', 300000)]);
  same('fa_sale', 'basic', { k: 5000, n: 5, yrs: 2, s: 200000 }, [D('備品減価償却累計額', 120000), D('未収入金', 200000), C('備品', 300000), C('固定資産売却益', 20000)]);
  same('fa_sale', 'disposal', { k: 5000, n: 5, yrs: 2, val: 50000 }, [D('備品減価償却累計額', 120000), D('貯蔵品', 50000), D('固定資産除却損', 130000), C('備品', 300000)]);
  same('lease', 'pay_excl', { a: 300000, i: 20000, n: 5 }, [D('リース債務', 280000), D('支払利息', 20000), C('当座預金', 300000)]);
  same('lease', 'excl', { a: 300000, i: 20000, n: 5 }, [D('リース資産', 1400000), C('リース債務', 1400000)]);
  same('lease', 'basic', { a: 300000, i: 20000, n: 5 }, [D('リース資産', 1500000), C('リース債務', 1500000)]);
  same('stock', 'min', { n: 1000, pr: 5000, f: 0 }, [D('当座預金', 5000000), C('資本金', 2500000), C('資本準備金', 2500000)]);
  same('tax', 'purchase_tax', { x: 200000 }, [D('仕入', 200000), D('仮払消費税', 20000), C('買掛金', 220000)]);
  same('tax', 'corp', { t: 900000, m: 400000 }, [D('法人税、住民税及び事業税', 900000), C('仮払法人税等', 400000), C('未払法人税等', 500000)]);
  same('overhead', 'rate', { rate: 500, yh: 12000, h: 900 }, [D('仕掛品', 450000), C('製造間接費', 450000)]);
  same('overhead', 'variance', { rate: 500, h: 900, d: 20000, unfav: true }, [D('製造間接費配賦差異', 20000), C('製造間接費', 20000)]);
  same('material', 'basic', { a: 400000, b: 50000 }, [D('仕掛品', 400000), D('製造間接費', 50000), C('材料', 450000)]);
  same('note', 'dishonor', { f: 300000, e: 2000 }, [D('不渡手形', 302000), C('受取手形', 300000), C('現金', 2000)]);
  same('cogs', 'sale', { c: 300000, s: 400000 }, [D('売掛金', 400000), C('売上', 400000), D('売上原価', 300000), C('商品', 300000)]);
  same('intangible', 'monthly', { k: 5000, n: 5, mo: 9 }, [D('ソフトウェア償却', 45000), C('ソフトウェア', 45000)]);
  same('comp_fx_adv', 'basic', { d: 5000, a: 1000, r0: 100, r1: 110 }, [D('仕入', 540000), C('前払金', 100000), C('買掛金', 440000)]);
  same('comp_fa_tax', 'basic', { x: 500000, f: 20000 }, [D('備品', 520000), D('仮払消費税', 52000), C('未払金', 572000)]);

  // ---- 型ごとの大量生成：貸借一致・正の整数・選択肢・再現性 ----
  var gen = 0, bad = [];
  BK.TEMPLATES.forEach(function (t) {
    t.variants.forEach(function (v) {
      var levels = t.composite ? [4] : v === 'basic' ? [1, 2] : [3];
      levels.forEach(function (lv) {
        var nulls = 0;
        for (var s = 1; s <= 300; s++) {
          gen++;
          var p = t.params(BK.rng(s * 7919), v, lv), raw = t.build(p, v);
          raw.choices = t.choices;
          var errs = BK.checkQuestion(raw);
          if (errs.length) { nulls++; if (nulls === 1) bad.push(t.id + ':' + v + ' L' + lv + ' ' + errs.join('/') + ' ' + JSON.stringify(p)); }
          var q1 = BK.makeQuestion(t.id, v, lv, s * 7919), q2 = BK.makeQuestion(t.id, v, lv, s * 7919);
          if (q1 && q2 && q1.text !== q2.text) bad.push(t.id + ' 同じ種で問題文が変わる');
          if (q1 && /NaN|undefined/.test(q1.text + q1.explain + q1.hint)) bad.push(t.id + ':' + v + ' 文中に不正な値');
        }
        if (nulls) bad[bad.length - 1] += ' （300問中' + nulls + '問）';
      });
    });
  });
  ok(bad.length === 0, '型の生成検査 ' + bad.join(' | '));
  BK.TOPICS.forEach(function (t) {
    if (BK.hasTemplates(t.id)) {
      ok(!!BK.LESSONS[t.id], '解説がある ' + t.id);
      [1, 2, 3].forEach(function (lv) { ok(!!BK.pickQuestion(t.id, lv, {}), '出題できる ' + t.id + ' L' + lv); });
    }
    t.pre.forEach(function (p) { ok(!!BK.topic(p), '前提論点が存在 ' + p); });
  });
  eq(BK.EXAM.sections.reduce(function (s, x) { return s + x.points; }, 0), 100, '配点合計');
  eq(BK.EXAM.sections.reduce(function (s, x) { return s + x.minutes; }, 0), 90, '時間配分合計');

  // ---- 理解判定と復習間隔 ----
  var S = BK.newState(); S.profile.examDate = '2027-12-31';
  function att(date, level, okk, extra) {
    var a = { date: date, ts: Date.now(), topics: ['c07'], tpl: 'dep', variant: 'basic', level: level, ok: okk, hint: false, sec: 60, target: 135 };
    for (var k in (extra || {})) a[k] = extra[k];
    S.attempts.push(a); BK.applyAttempt(S, a);
    return a;
  }
  var ts = BK.ts(S, 'c07');
  att('2026-10-01', 1, true); eq(ts.status, '学習中', '1問正解では基本OKにしない');
  att('2026-10-01', 1, true); att('2026-10-01', 1, true);
  eq(ts.status, '基本OK', '基本3問連続で基本OK');
  ok(ts.level >= 2, 'レベルが上がる');
  BK.schedule(S, 'c07', { ok: true }, '2026-10-01');
  eq(ts.due, '2026-10-02', '初日は翌日に復習');
  att('2026-10-02', 2, true); att('2026-10-02', 2, true);
  ok(!!ts.ev[2], '数値変更2問で証拠2');
  BK.schedule(S, 'c07', { ok: true }, '2026-10-02');
  eq(ts.due, '2026-10-05', '正解で3日後');
  att('2026-10-05', 3, true, { variant: 'monthly' }); ok(!ts.ev[3], '条件1種類では証拠3にならない');
  att('2026-10-05', 3, true, { variant: 'production' }); ok(!!ts.ev[3], '条件2種類で証拠3');
  att('2026-10-05', 3, true, { variant: 'monthly', hint: true });
  BK.schedule(S, 'c07', { ok: true }, '2026-10-05'); eq(ts.due, '2026-10-12', '正解で7日後');
  att('2026-10-12', 4, true, { tpl: 'comp_fa_tax', topics: ['c07', 'c13'] }); att('2026-10-12', 4, true, { tpl: 'comp_fa_tax', topics: ['c07', 'c13'] });
  ok(!!ts.ev[4] && !!ts.ev[6] && !!ts.ev[7], '複合・保持・時間の証拠');
  ok(BK.ts(S, 'c13').comp === 2, '複合問題は関連論点にも数える');
  eq(ts.status, '基本OK', '理由説明がないと応用OKにしない');
  BK.applyReason(S, 'c07', true, 'あいまい', '2026-10-12'); ok(!ts.ev[5], '自己評価あいまいは不成立');
  BK.applyReason(S, 'c07', true, 'できた', '2026-10-12');
  eq(ts.status, '理解済み', '7つ揃って理解済み');
  att('2026-10-20', 3, false, { variant: 'monthly' });
  eq(ts.status, '応用OK', '復習で誤答すると降格');
  BK.schedule(S, 'c07', { ok: false, cause: '知識不足' }, '2026-10-20'); eq(ts.due, '2026-10-21', '知識不足は最初の段へ');
  BK.applyCause(S, 'c07', '知識不足', '2026-10-20'); eq(ts.status, '学習中', '知識不足で学習中へ');
  ok(ts.needExplain, '解説へ戻す');
  var S2 = BK.newState(); S2.profile.examDate = '2026-10-10'; BK.ts(S2, 'c01').due = '2026-10-01'; BK.ts(S2, 'c01').step = 3;
  BK.schedule(S2, 'c01', { ok: true }, '2026-10-01'); eq(BK.ts(S2, 'c01').due, '2026-10-04', '受験日が近いと間隔を詰める');
  var hintS = BK.newState(), ha = { date: '2026-10-01', topics: ['c01'], tpl: 'cogs', variant: 'basic', level: 1, ok: true, hint: true, sec: 30, target: 90 };
  BK.applyAttempt(hintS, ha); BK.applyAttempt(hintS, ha); BK.applyAttempt(hintS, ha);
  ok(!BK.ts(hintS, 'c01').ev[1], 'ヒント使用の正解は証拠にしない');

  // ---- 計画とメニュー ----
  var order = BK.planOrder(), pos = {};
  order.forEach(function (id, i) { pos[id] = i; });
  eq(order.length, BK.TOPICS.length, '全論点が順序に入る');
  ok(BK.TOPICS.every(function (t) { return t.pre.every(function (p) { return pos[p] < pos[t.id]; }); }), '前提論点が先');
  var P = BK.newState(); P.profile.examDate = '2026-11-30'; P.profile.mins = [60, 10, 10, 10, 10, 10, 60];
  var m = BK.buildMenu(P, '2026-10-05', 10, []);
  eq(m.items.map(function (x) { return x.type + ':' + x.topic; }), ['new:b01'], '初日は最初の論点');
  var dl = BK.delay(P, '2026-10-05');
  ok(dl.ratio > 1.15 && dl.label === '遅れ', '時間不足を遅れと判定 ratio=' + dl.ratio.toFixed(2));
  eq(dl.available, Math.round((8 * 120 + 8 * 50) * 0.85), '使える時間の計算'); // 10/5(月)〜11/29(日)＝8週
  var wp = BK.weekPlan(P, '2026-10-05');
  ok(wp.weeks.length === 8 && wp.overflow.length > 0, '週計画と入りきらない論点');
  BK.ts(P, 'b01').status = '基本OK'; BK.ts(P, 'b01').ev[1] = '2026-10-05'; BK.ts(P, 'b01').due = '2026-10-06'; BK.ts(P, 'b01').last = '2026-10-05';
  var m2 = BK.buildMenu(P, '2026-10-06', 10, []);
  ok(m2.items[0].type === 'review' && m2.items[0].topic === 'b01', '期限の来た復習が先');
  ok(m2.items.some(function (x) { return x.topic !== 'b01' && (x.type === 'new' || x.type === 'material'); }), '前提を満たせば新しい論点');
  var G = BK.newState(); G.profile.examDate = '2026-11-30';
  var m3 = BK.buildMenu(G, '2026-10-05', 10, []);
  ok(!m3.items.some(function (x) { return x.topic === 'b02'; }), '前提未達の論点は出さない');
  P.mocks = [{ scores: { q1: 16, q2: 12, q3: 14, q4: 24, q5: 10 }, ext: 0 }, { scores: { q1: 16, q2: 14, q3: 14, q4: 22, q5: 8 }, ext: 0 }, { scores: { q1: 18, q2: 14, q3: 16, q4: 24, q5: 8 }, ext: 0 }];
  eq(BK.mockJudge(P).label, '合格圏', '模試判定 76,74,80');
  P.mocks[1].ext = 20; eq(BK.mockJudge(P).label, '判定不能', '延長した模試は除く');
  ok(BK.estimate(P).total >= 0 && BK.estimate(P).total <= 100, '推定得点の範囲');
  ok(BK.priorities(P, '2026-10-06').length > 0, '優先事項');
  var ex = BK.importData(BK.exportData(P)); eq(ex.profile.examDate, '2026-11-30', '書き出し・読み込み');

  document.getElementById('out').textContent = 'PASS ' + pass + ' / FAIL ' + fail + ' / 生成 ' + gen + '問\n' + out.join('\n');
})();
