// 問題の型。数値は乱数で決め、正解は必ずここの計算で求める（AIには決めさせない）。
// 各型: params(r, variant, level) で数値を決め、build(p, variant) で問題文・正解・典型的な誤りを作る。
// variant 'basic' はレベル1（素直な数値）とレベル2（数値変更）で使い、それ以外はレベル3（条件変更）。
// composite:true の型はレベル4（複数論点）。
(function () {
  var BK = (globalThis.BK = globalThis.BK || {});

  function D(acc, amt) { return { side: 'D', acc: acc, amt: amt }; }
  function C(acc, amt) { return { side: 'C', acc: acc, amt: amt }; }
  // レベル1は粗い単位、レベル2以上は細かい単位の金額にする
  function amt(r, level, lo, hi, u1, u2) {
    var u = level <= 1 ? u1 : u2;
    return r.int(Math.ceil(lo / u), Math.floor(hi / u)) * u;
  }
  var y = BK.yen;

  var T = [];

  // ---------- 3級基礎：商品の仕入 ----------
  T.push({
    id: 'purchase', topics: ['b01'], target: 45, variants: ['basic', 'part_cash', 'advance'],
    choices: ['現金', '当座預金', '売掛金', '前払金', '買掛金', '前受金', '仕入', '売上'],
    params: function (r, v, lv) {
      var x = amt(r, lv, 100000, 900000, 10000, 100);
      return { x: x, a: amt(r, lv, x * 0.1, x * 0.5, 10000, 100) };
    },
    build: function (p, v) {
      var plain = [D('仕入', p.x), C('買掛金', p.x)];
      if (v === 'part_cash') return {
        text: '商品 ' + y(p.x) + '円を仕入れ、代金のうち ' + y(p.a) + '円は現金で支払い、残額は掛けとした。',
        answer: [D('仕入', p.x), C('現金', p.a), C('買掛金', p.x - p.a)],
        traps: [{ entries: plain, cause: '条件の読み落とし', note: '現金で支払った分を買掛金に含めています。' }],
        hint: '代金の支払方法が2つあります。貸方は2行になります。',
        explain: '仕入は全額 ' + y(p.x) + '円。貸方は現金 ' + y(p.a) + '円と、残額 ' + y(p.x) + ' − ' + y(p.a) + ' ＝ ' + y(p.x - p.a) + '円の買掛金。'
      };
      if (v === 'advance') return {
        text: '商品 ' + y(p.x) + '円を仕入れ、注文時に支払っていた手付金 ' + y(p.a) + '円を充当し、残額は掛けとした。',
        answer: [D('仕入', p.x), C('前払金', p.a), C('買掛金', p.x - p.a)],
        traps: [{ entries: plain, cause: '条件の読み落とし', note: '手付金（前払金）の充当を処理していません。' }],
        hint: '手付金を支払ったときに計上した資産を、ここで取り崩します。',
        explain: '手付金は支払時に前払金（資産）として計上済み。仕入時に前払金 ' + y(p.a) + '円を取り崩し、残額 ' + y(p.x - p.a) + '円が買掛金。'
      };
      return {
        text: '商品 ' + y(p.x) + '円を仕入れ、代金は掛けとした。',
        answer: plain, traps: [],
        hint: '費用（仕入）の発生は借方、負債（買掛金）の増加は貸方。',
        explain: '仕入（費用）の発生を借方、買掛金（負債）の増加を貸方に ' + y(p.x) + '円。'
      };
    }
  });

  // ---------- 商品売買：売上原価対立法 ----------
  T.push({
    id: 'cogs', topics: ['c01'], target: 60, variants: ['basic', 'sale', 'return'],
    choices: ['現金', '売掛金', '商品', '繰越商品', '買掛金', '売上', '仕入', '売上原価'],
    params: function (r, v, lv) {
      var c = amt(r, lv, 100000, 800000, 10000, 100);
      return { c: c, s: c + amt(r, lv, c * 0.1, c * 0.5, 10000, 100), x: amt(r, lv, 10000, c * 0.3, 10000, 100) };
    },
    build: function (p, v) {
      var note = '当社は商品売買について、販売のつど売上原価を売上原価勘定に振り替える方法で記帳している。';
      if (v === 'sale') return {
        text: '商品（原価 ' + y(p.c) + '円）を ' + y(p.s) + '円で売り上げ、代金は掛けとした。' + note,
        answer: [D('売掛金', p.s), C('売上', p.s), D('売上原価', p.c), C('商品', p.c)],
        traps: [{ entries: [D('売掛金', p.s), C('売上', p.s)], cause: '解法手順の誤り', note: '売上原価への振替の仕訳が抜けています。' }],
        hint: '仕訳は2組。売上の計上と、商品から売上原価への振替。',
        explain: '売上は売価 ' + y(p.s) + '円で計上。同時に、引き渡した商品の原価 ' + y(p.c) + '円を商品（資産）から売上原価（費用）へ振り替える。'
      };
      if (v === 'return') return {
        text: '掛けで仕入れた商品のうち ' + y(p.x) + '円分を品違いのため返品した。' + note,
        answer: [D('買掛金', p.x), C('商品', p.x)],
        traps: [{ entries: [D('買掛金', p.x), C('仕入', p.x)], cause: '知識不足', note: '三分法の処理になっています。この方法では仕入勘定を使いません。' }],
        hint: '仕入れたときの仕訳の逆。仕入時に借方に計上した勘定は何でしたか。',
        explain: '売上原価対立法では仕入時に「商品／買掛金」と処理しているので、返品はその逆仕訳。'
      };
      return {
        text: '商品 ' + y(p.c) + '円を仕入れ、代金は掛けとした。' + note,
        answer: [D('商品', p.c), C('買掛金', p.c)],
        traps: [{ entries: [D('仕入', p.c), C('買掛金', p.c)], cause: '知識不足', note: '三分法の処理になっています。この方法では仕入時に商品勘定（資産）を使います。' }],
        hint: '三分法ではありません。仕入れた商品は資産として記録します。',
        explain: '売上原価対立法では、仕入時に商品（資産）の増加として ' + y(p.c) + '円を記録する。'
      };
    }
  });

  // ---------- 手形・電子記録債権 ----------
  T.push({
    id: 'note', topics: ['c03'], target: 60, variants: ['basic', 'dishonor', 'densai'],
    choices: ['現金', '当座預金', '受取手形', '不渡手形', '売掛金', '電子記録債権', '電子記録債務', '手形売却損', '支払手数料', '支払利息'],
    params: function (r, v, lv) {
      var f = amt(r, lv, 200000, 900000, 100000, 10000);
      return { f: f, d: amt(r, lv, 1000, 9000, 1000, 100), e: amt(r, lv, 1000, 5000, 1000, 100) };
    },
    build: function (p, v) {
      if (v === 'dishonor') return {
        text: '所有していた得意先振出の約束手形 ' + y(p.f) + '円が不渡りとなったため、得意先に償還請求を行った。その際、償還請求の諸費用 ' + y(p.e) + '円を現金で支払った。',
        answer: [D('不渡手形', p.f + p.e), C('受取手形', p.f), C('現金', p.e)],
        traps: [{ entries: [D('不渡手形', p.f), D('支払手数料', p.e), C('受取手形', p.f), C('現金', p.e)], cause: '知識不足', note: '償還請求の諸費用は費用にせず、不渡手形の金額に含めます。' }],
        hint: '償還請求の費用も相手に請求できます。',
        explain: '不渡手形 ＝ 手形金額 ' + y(p.f) + ' ＋ 諸費用 ' + y(p.e) + ' ＝ ' + y(p.f + p.e) + '円。諸費用も得意先に請求できるため不渡手形に含める。'
      };
      if (v === 'densai') return {
        text: '得意先に対する売掛金 ' + y(p.f) + '円について、取引銀行を通じて電子記録債権の発生記録が行われた。',
        answer: [D('電子記録債権', p.f), C('売掛金', p.f)], traps: [],
        hint: '売掛金が別の債権に置き換わります。',
        explain: '売掛金（資産）が減り、電子記録債権（資産）が ' + y(p.f) + '円増える。'
      };
      return {
        text: '所有していた約束手形 ' + y(p.f) + '円を取引銀行で割り引き、割引料 ' + y(p.d) + '円を差し引かれた残額が当座預金口座に入金された。',
        answer: [D('当座預金', p.f - p.d), D('手形売却損', p.d), C('受取手形', p.f)],
        traps: [{ entries: [D('当座預金', p.f), C('受取手形', p.f)], cause: '条件の読み落とし', note: '割引料を処理していません。' }],
        hint: '割引料は手形を売却したことによる損失として処理します。',
        explain: '入金額 ＝ ' + y(p.f) + ' − ' + y(p.d) + ' ＝ ' + y(p.f - p.d) + '円。割引料 ' + y(p.d) + '円は手形売却損。受取手形は額面で減らす。'
      };
    }
  });

  // ---------- 有価証券の取得と売却 ----------
  T.push({
    id: 'sec_trade', topics: ['c05'], target: 75, variants: ['basic', 'sell', 'purpose'],
    choices: ['当座預金', '売買目的有価証券', '満期保有目的債券', '子会社株式', 'その他有価証券', '支払手数料', '有価証券売却益', '有価証券売却損', '有価証券利息'],
    params: function (r, v, lv) {
      var n = r.int(1, 9) * (lv <= 1 ? 1000 : 100);
      var b = amt(r, lv, 300, 1500, 100, 10);
      var diff = amt(r, lv, 10, 200, 100, 10) || 100;
      return { n: n, b: b, f: amt(r, lv, 1000, 9000, 1000, 100), s: r() < 0.5 ? b + diff : Math.max(b - diff, 10), sub: r() < 0.5 };
    },
    build: function (p, v) {
      var cost = p.n * p.b + p.f;
      if (v === 'sell') {
        var book = p.n * p.b, sale = p.n * p.s, ans = [D('当座預金', sale), C('売買目的有価証券', book)];
        if (sale > book) ans.push(C('有価証券売却益', sale - book)); else ans.push(D('有価証券売却損', book - sale));
        return {
          text: '売買目的で保有しているA社株式 ' + y(p.n) + '株（帳簿価額は1株あたり ' + y(p.b) + '円）を、1株あたり ' + y(p.s) + '円で売却し、代金は当座預金口座に振り込まれた。',
          answer: ans, traps: [],
          hint: '売却額と帳簿価額の差額が売却損益です。',
          explain: '売却額 ' + y(p.n) + '株 × ' + y(p.s) + ' ＝ ' + y(sale) + '円、帳簿価額 ' + y(p.n) + '株 × ' + y(p.b) + ' ＝ ' + y(book) + '円。差額 ' + y(Math.abs(sale - book)) + '円が' + (sale > book ? '売却益。' : '売却損。')
        };
      }
      if (v === 'purpose') {
        var acc = p.sub ? '子会社株式' : 'その他有価証券';
        return {
          text: (p.sub ? 'B社の支配を目的として、同社の発行済株式の60%にあたる ' : '長期的な取引関係の維持を目的として、取引先B社の株式 ') + y(p.n) + '株を1株あたり ' + y(p.b) + '円で取得し、購入手数料 ' + y(p.f) + '円とともに当座預金口座から支払った。',
          answer: [D(acc, cost), C('当座預金', cost)], traps: [],
          hint: '保有目的によって勘定科目が変わります。',
          explain: (p.sub ? '発行済株式の過半数を取得して支配するので子会社株式。' : '売買目的でも満期保有目的でも子会社・関連会社株式でもないので、その他有価証券。') + '取得原価 ＝ ' + y(p.n) + ' × ' + y(p.b) + ' ＋ 手数料 ' + y(p.f) + ' ＝ ' + y(cost) + '円。'
        };
      }
      return {
        text: '売買目的でA社株式 ' + y(p.n) + '株を1株あたり ' + y(p.b) + '円で購入し、購入手数料 ' + y(p.f) + '円とともに当座預金口座から支払った。',
        answer: [D('売買目的有価証券', cost), C('当座預金', cost)],
        traps: [
          { entries: [D('売買目的有価証券', p.n * p.b), D('支払手数料', p.f), C('当座預金', cost)], cause: '知識不足', note: '購入手数料は費用にせず、取得原価に含めます。' },
          { entries: [D('売買目的有価証券', p.n * p.b), C('当座預金', p.n * p.b)], cause: '条件の読み落とし', note: '購入手数料を含めていません。' }
        ],
        hint: '購入手数料は取得原価に含めます。',
        explain: '取得原価 ＝ ' + y(p.n) + '株 × ' + y(p.b) + ' ＋ 手数料 ' + y(p.f) + ' ＝ ' + y(cost) + '円。'
      };
    }
  });

  // ---------- 有価証券の期末評価 ----------
  T.push({
    id: 'sec_eval', topics: ['c06'], target: 75, variants: ['basic', 'other', 'amortized'],
    choices: ['売買目的有価証券', '満期保有目的債券', 'その他有価証券', '有価証券評価益', '有価証券評価損', 'その他有価証券評価差額金', '有価証券利息', '投資有価証券売却益'],
    params: function (r, v, lv) {
      var b = amt(r, lv, 300000, 2000000, 100000, 1000);
      var d = amt(r, lv, 10000, 200000, 10000, 1000);
      var n = r.pick([3, 4, 5]), k = r.int(1, 5) * 500;
      return { b: b, m: r() < 0.5 ? b + d : b - d, n: n, k: k, face: r.pick([1, 2, 3, 5]) * 1000000, mo: v === 'amortized' ? r.pick([9, 6, 3]) : 12 };
    },
    build: function (p, v) {
      var d = Math.abs(p.m - p.b), up = p.m > p.b;
      if (v === 'other') return {
        text: '決算にあたり、その他有価証券（帳簿価額 ' + y(p.b) + '円）を時価 ' + y(p.m) + '円に評価替えする。全部純資産直入法によることとし、税効果は考慮しない。',
        answer: up ? [D('その他有価証券', d), C('その他有価証券評価差額金', d)] : [D('その他有価証券評価差額金', d), C('その他有価証券', d)],
        traps: [],
        hint: '評価差額は損益にしません。純資産の項目に直接計上します。',
        explain: '時価 ' + y(p.m) + ' − 帳簿価額 ' + y(p.b) + ' の差額 ' + y(d) + '円を、損益ではなく、その他有価証券評価差額金（純資産）として計上する。'
      };
      if (v === 'amortized') {
        var total = p.k * p.n * 12, cost = p.face - total, x = p.k * p.mo;
        return {
          text: '決算にあたり、満期保有目的で当期中に取得した社債（額面 ' + y(p.face) + '円、取得価額 ' + y(cost) + '円、取得日から満期日までの期間は' + p.n + '年）について、償却原価法（定額法）を適用する。取得日から決算日までの期間は' + p.mo + 'か月であり、月割で計算する。額面と取得価額の差額は金利の調整と認められる。',
          answer: [D('満期保有目的債券', x), C('有価証券利息', x)],
          traps: [
            { entries: [D('満期保有目的債券', total / p.n), C('有価証券利息', total / p.n)], cause: '条件の読み落とし', note: '1年分を計上しています。保有期間は' + p.mo + 'か月です。' },
            { entries: [D('満期保有目的債券', total), C('有価証券利息', total)], cause: '解法手順の誤り', note: '差額の全額を計上しています。満期までの期間で配分します。' }
          ],
          hint: '額面と取得価額の差額を、満期までの月数で割って当期分を求めます。',
          explain: '差額 ' + y(p.face) + ' − ' + y(cost) + ' ＝ ' + y(total) + '円。これを ' + (p.n * 12) + 'か月で配分し、当期分は ' + y(total) + ' × ' + p.mo + ' ÷ ' + (p.n * 12) + ' ＝ ' + y(x) + '円。帳簿価額を増やし、相手は有価証券利息。'
        };
      }
      return {
        text: '決算にあたり、売買目的有価証券（帳簿価額 ' + y(p.b) + '円）を時価 ' + y(p.m) + '円に評価替えする。',
        answer: up ? [D('売買目的有価証券', d), C('有価証券評価益', d)] : [D('有価証券評価損', d), C('売買目的有価証券', d)],
        traps: [],
        hint: '時価が帳簿価額より高いか低いかを確認します。',
        explain: '時価 ' + y(p.m) + ' と帳簿価額 ' + y(p.b) + ' の差額 ' + y(d) + '円が' + (up ? '評価益。帳簿価額を増やす。' : '評価損。帳簿価額を減らす。')
      };
    }
  });

  // ---------- 減価償却 ----------
  T.push({
    id: 'dep', topics: ['c07'], target: 90, variants: ['basic', 'monthly', 'production'],
    choices: ['備品', '車両運搬具', '減価償却費', '備品減価償却累計額', '車両運搬具減価償却累計額', '未払金'],
    params: function (r, v, lv) {
      var n = r.pick([4, 5, 8, 10]), k = r.int(2, 20) * (lv <= 1 ? 5000 : 500);
      return {
        c: amt(r, lv, 400000, 3000000, 100000, 10000), pct: r.pick([20, 25, 40, 50]),
        n: n, k: k, mo: r.int(2, 11),
        cc: r.int(10, 40) * 100000, tot: r.pick([100000, 200000]), km: r.int(8, 40) * 1000
      };
    },
    build: function (p, v) {
      if (v === 'monthly') {
        var cost = p.k * 12 * p.n, x = p.k * p.mo;
        return {
          text: '決算にあたり、当期中に取得し使用を開始した備品（取得原価 ' + y(cost) + '円）について、定額法（耐用年数' + p.n + '年、残存価額ゼロ、間接法）により減価償却を行う。当期の使用期間は' + p.mo + 'か月であり、月割で計算する。',
          answer: [D('減価償却費', x), C('備品減価償却累計額', x)],
          traps: [{ entries: [D('減価償却費', cost / p.n), C('備品減価償却累計額', cost / p.n)], cause: '条件の読み落とし', note: '1年分を計上しています。当期の使用期間は' + p.mo + 'か月です。' }],
          hint: '1年分を求めてから、使用した月数分に直します。',
          explain: '1年分 ＝ ' + y(cost) + ' ÷ ' + p.n + '年 ＝ ' + y(cost / p.n) + '円。当期分 ＝ ' + y(cost / p.n) + ' × ' + p.mo + ' ÷ 12 ＝ ' + y(x) + '円。'
        };
      }
      if (v === 'production') {
        var z = p.cc * 9 * p.km / (10 * p.tot);
        return {
          text: '決算にあたり、車両運搬具（取得原価 ' + y(p.cc) + '円、残存価額は取得原価の10%、見積総走行可能距離 ' + y(p.tot) + 'km）について、生産高比例法（間接法）により減価償却を行う。当期の走行距離は ' + y(p.km) + 'kmであった。',
          answer: [D('減価償却費', z), C('車両運搬具減価償却累計額', z)],
          traps: [{ entries: [D('減価償却費', p.cc * p.km / p.tot), C('車両運搬具減価償却累計額', p.cc * p.km / p.tot)], cause: '条件の読み落とし', note: '残存価額を差し引いていません。' }],
          hint: '（取得原価 − 残存価額）× 当期の利用量 ÷ 総利用可能量。',
          explain: '（' + y(p.cc) + ' − 残存価額 ' + y(p.cc / 10) + '）× ' + y(p.km) + 'km ÷ ' + y(p.tot) + 'km ＝ ' + y(z) + '円。'
        };
      }
      var acc = p.c * p.pct / 100, dep = (p.c - acc) * p.pct / 100;
      return {
        text: '決算にあたり、備品（取得原価 ' + y(p.c) + '円、期首の減価償却累計額 ' + y(acc) + '円）について、定率法（償却率 年' + p.pct + '%、間接法）により減価償却を行う。',
        answer: [D('減価償却費', dep), C('備品減価償却累計額', dep)],
        traps: [{ entries: [D('減価償却費', acc), C('備品減価償却累計額', acc)], cause: '解法手順の誤り', note: '取得原価に償却率を掛けています。定率法は期首の未償却残高に償却率を掛けます。' }],
        hint: '定率法は（取得原価 − 期首の減価償却累計額）に償却率を掛けます。',
        explain: '（' + y(p.c) + ' − ' + y(acc) + '）× ' + p.pct + '% ＝ ' + y(dep) + '円。'
      };
    }
  });

  // ---------- 固定資産の売却・除却 ----------
  T.push({
    id: 'fa_sale', topics: ['c08'], target: 100, variants: ['basic', 'midyear', 'disposal'],
    choices: ['現金', '未収入金', '備品', '貯蔵品', '備品減価償却累計額', '減価償却費', '固定資産売却益', '固定資産売却損', '固定資産除却損'],
    params: function (r, v, lv) {
      var n = r.pick([5, 8, 10]), k = r.int(2, 10) * (lv <= 1 ? 5000 : 500), yrs = r.int(1, n - 2), mo = r.int(2, 10);
      var book = k * 12 * (n - yrs) - (v === 'midyear' ? k * mo : 0);
      var delta = amt(r, lv, 10000, book * 0.3, 10000, 1000) || 10000;
      return { n: n, k: k, yrs: yrs, mo: mo, s: r() < 0.5 ? book + delta : book - delta, val: amt(r, lv, 10000, book * 0.5, 10000, 1000) || 10000 };
    },
    build: function (p, v) {
      var cost = p.k * 12 * p.n, acc = p.k * 12 * p.yrs;
      function pl(arr, book, s) {
        if (s > book) arr.push(C('固定資産売却益', s - book)); else if (s < book) arr.push(D('固定資産売却損', book - s));
        return arr;
      }
      if (v === 'midyear') {
        var d = p.k * p.mo, book = cost - acc - d;
        return {
          text: '当期の期首から' + p.mo + 'か月が経過した時点で、備品（取得原価 ' + y(cost) + '円、期首の減価償却累計額 ' + y(acc) + '円、定額法、耐用年数' + p.n + '年、残存価額ゼロ、間接法）を ' + y(p.s) + '円で売却し、代金は月末に受け取ることとした。当期分の減価償却費は月割で計上する。',
          answer: pl([D('備品減価償却累計額', acc), D('減価償却費', d), D('未収入金', p.s), C('備品', cost)], book, p.s),
          traps: [{ entries: pl([D('備品減価償却累計額', acc), D('未収入金', p.s), C('備品', cost)], cost - acc, p.s), cause: '条件の読み落とし', note: '当期分の減価償却費を計上していません。' }],
          hint: '売却時点までの当期分の減価償却費も借方に計上します。',
          explain: '当期分の減価償却費 ＝ ' + y(cost) + ' ÷ ' + p.n + '年 × ' + p.mo + ' ÷ 12 ＝ ' + y(d) + '円。売却時の帳簿価額 ＝ ' + y(cost) + ' − ' + y(acc) + ' − ' + y(d) + ' ＝ ' + y(book) + '円。売却額 ' + y(p.s) + '円との差額 ' + y(Math.abs(p.s - book)) + '円が' + (p.s > book ? '売却益。' : '売却損。')
        };
      }
      var book0 = cost - acc;
      if (v === 'disposal') return {
        text: '当期首に、備品（取得原価 ' + y(cost) + '円、減価償却累計額 ' + y(acc) + '円、間接法）を除却した。除却した備品の処分価値は ' + y(p.val) + '円と見積もられた。',
        answer: [D('備品減価償却累計額', acc), D('貯蔵品', p.val), D('固定資産除却損', book0 - p.val), C('備品', cost)],
        traps: [{ entries: [D('備品減価償却累計額', acc), D('固定資産除却損', book0), C('備品', cost)], cause: '条件の読み落とし', note: '処分価値（貯蔵品）を計上していません。' }],
        hint: '処分価値は貯蔵品として資産に計上します。',
        explain: '帳簿価額 ＝ ' + y(cost) + ' − ' + y(acc) + ' ＝ ' + y(book0) + '円。処分価値 ' + y(p.val) + '円は貯蔵品。差額 ' + y(book0 - p.val) + '円が固定資産除却損。'
      };
      return {
        text: '当期首に、備品（取得原価 ' + y(cost) + '円、減価償却累計額 ' + y(acc) + '円、間接法）を ' + y(p.s) + '円で売却し、代金は月末に受け取ることとした。',
        answer: pl([D('備品減価償却累計額', acc), D('未収入金', p.s), C('備品', cost)], book0, p.s),
        traps: [],
        hint: '帳簿価額（取得原価 − 減価償却累計額）と売却額を比べます。',
        explain: '帳簿価額 ＝ ' + y(cost) + ' − ' + y(acc) + ' ＝ ' + y(book0) + '円。売却額 ' + y(p.s) + '円との差額 ' + y(Math.abs(p.s - book0)) + '円が' + (p.s > book0 ? '売却益。' : '売却損。') + '商品以外の売却代金の未収は未収入金。'
      };
    }
  });

  // ---------- 引当金 ----------
  T.push({
    id: 'allow', topics: ['c11'], target: 75, variants: ['basic', 'repair', 'bonus'],
    choices: ['当座預金', '売掛金', '貸倒引当金', '修繕引当金', '賞与引当金', '貸倒引当金繰入', '修繕引当金繰入', '賞与引当金繰入', '修繕費', '賞与'],
    params: function (r, v, lv) {
      var rec = amt(r, lv, 1000000, 9000000, 100000, 10000), pct = r.pick([1, 2, 3]);
      var need = rec * pct / 100, x = amt(r, lv, 300000, 900000, 100000, 10000);
      return { rec: rec, pct: pct, bal: amt(r, lv, need * 0.1, need * 0.8, 1000, 100), x: x, b: amt(r, lv, x * 0.3, x * 0.8, 100000, 10000), t: r.int(3, 30) * (lv <= 1 ? 600000 : 60000) };
    },
    build: function (p, v) {
      if (v === 'repair') return {
        text: '建物の定期修繕を行い、代金 ' + y(p.x) + '円は小切手を振り出して支払った。なお、この修繕に備えて修繕引当金 ' + y(p.b) + '円が設定されている。',
        answer: [D('修繕引当金', p.b), D('修繕費', p.x - p.b), C('当座預金', p.x)],
        traps: [{ entries: [D('修繕費', p.x), C('当座預金', p.x)], cause: '条件の読み落とし', note: '修繕引当金を取り崩していません。' }],
        hint: 'まず引当金を取り崩し、足りない分だけが当期の費用です。',
        explain: '修繕引当金 ' + y(p.b) + '円を取り崩し、不足する ' + y(p.x) + ' − ' + y(p.b) + ' ＝ ' + y(p.x - p.b) + '円を修繕費とする。'
      };
      if (v === 'bonus') {
        var z = p.t * 4 / 6;
        return {
          text: '決算（3月31日）にあたり、次期の6月に支給する賞与（支給見込額 ' + y(p.t) + '円、支給対象期間は12月1日から5月31日まで）について、当期に負担すべき金額を賞与引当金として計上する。',
          answer: [D('賞与引当金繰入', z), C('賞与引当金', z)],
          traps: [{ entries: [D('賞与引当金繰入', p.t), C('賞与引当金', p.t)], cause: '条件の読み落とし', note: '支給見込額の全額を計上しています。当期に属するのは12月から3月の4か月分です。' }],
          hint: '支給対象期間6か月のうち、当期に属するのは何か月ですか。',
          explain: '支給対象期間6か月のうち当期分は12月〜3月の4か月。' + y(p.t) + ' × 4 ÷ 6 ＝ ' + y(z) + '円。'
        };
      }
      var need = p.rec * p.pct / 100;
      return {
        text: '決算にあたり、売掛金の期末残高 ' + y(p.rec) + '円に対して' + p.pct + '%の貸倒引当金を差額補充法により設定する。貸倒引当金の残高は ' + y(p.bal) + '円である。',
        answer: [D('貸倒引当金繰入', need - p.bal), C('貸倒引当金', need - p.bal)],
        traps: [{ entries: [D('貸倒引当金繰入', need), C('貸倒引当金', need)], cause: '条件の読み落とし', note: '貸倒引当金の残高を差し引いていません。' }],
        hint: '差額補充法は、設定額と残高の差額だけを繰り入れます。',
        explain: '設定額 ＝ ' + y(p.rec) + ' × ' + p.pct + '% ＝ ' + y(need) + '円。残高 ' + y(p.bal) + '円との差額 ' + y(need - p.bal) + '円を繰り入れる。'
      };
    }
  });

  // ---------- 外貨建取引 ----------
  T.push({
    id: 'fx', topics: ['c12'], target: 75, variants: ['basic', 'settle', 'closing'],
    choices: ['当座預金', '売掛金', '前払金', '買掛金', '仕入', '売上', '為替差損益'],
    params: function (r, v, lv) {
      var r1 = r.int(100, 150), dr = r.int(1, 9);
      return { d: r.int(1, 9) * (lv <= 1 ? 1000 : 100) + (lv <= 1 ? 0 : r.int(0, 9) * 10), r1: r1, r2: r() < 0.5 ? r1 + dr : r1 - dr };
    },
    build: function (p, v) {
      var a1 = p.d * p.r1, a2 = p.d * p.r2, diff = Math.abs(a2 - a1), weak = p.r2 > p.r1;
      if (v === 'settle') return {
        text: '米国の仕入先に対する買掛金 ' + y(p.d) + 'ドル（仕入時の為替相場は1ドル ' + p.r1 + '円）を、当座預金口座から支払った。支払時の為替相場は1ドル ' + p.r2 + '円であった。',
        answer: weak ? [D('買掛金', a1), D('為替差損益', diff), C('当座預金', a2)] : [D('買掛金', a1), C('当座預金', a2), C('為替差損益', diff)],
        traps: [{ entries: [D('買掛金', a2), C('当座預金', a2)], cause: '解法手順の誤り', note: '買掛金を支払時の相場で換算しています。買掛金は計上したときの金額で減らします。' }],
        hint: '買掛金は仕入時の相場、支払額は支払時の相場で計算し、差額が為替差損益です。',
        explain: '買掛金 ＝ ' + y(p.d) + ' × ' + p.r1 + ' ＝ ' + y(a1) + '円。支払額 ＝ ' + y(p.d) + ' × ' + p.r2 + ' ＝ ' + y(a2) + '円。差額 ' + y(diff) + '円は為替差損益（' + (weak ? '多く支払ったので借方' : '少ない支払で済んだので貸方') + '）。'
      };
      if (v === 'closing') return {
        text: '決算にあたり、買掛金のうち米国の仕入先に対する ' + y(p.d) + 'ドル（仕入時の為替相場は1ドル ' + p.r1 + '円）を決算時の為替相場1ドル ' + p.r2 + '円で換算替えする。',
        answer: weak ? [D('為替差損益', diff), C('買掛金', diff)] : [D('買掛金', diff), C('為替差損益', diff)],
        traps: [],
        hint: '円に直した買掛金が増えるのか減るのかを考えます。',
        explain: '換算後 ' + y(a2) + '円 と帳簿 ' + y(a1) + '円の差額 ' + y(diff) + '円。買掛金（負債）が' + (weak ? '増えるので為替差損益は借方（損）。' : '減るので為替差損益は貸方（益）。')
      };
      return {
        text: '米国の仕入先から商品 ' + y(p.d) + 'ドルを掛けで仕入れた。仕入時の為替相場は1ドル ' + p.r1 + '円であった。',
        answer: [D('仕入', a1), C('買掛金', a1)], traps: [],
        hint: '取引が発生したときの為替相場で円に換算します。',
        explain: y(p.d) + 'ドル × ' + p.r1 + '円 ＝ ' + y(a1) + '円。'
      };
    }
  });

  // ---------- 税金 ----------
  T.push({
    id: 'tax', topics: ['c13'], target: 60, variants: ['basic', 'corp', 'purchase_tax'],
    choices: ['買掛金', '仮払消費税', '仮受消費税', '未払消費税', '仮払法人税等', '未払法人税等', '仕入', '法人税、住民税及び事業税', '租税公課'],
    params: function (r, v, lv) {
      var paid = amt(r, lv, 200000, 800000, 100000, 1000), t = amt(r, lv, 500000, 2000000, 100000, 1000);
      return { paid: paid, recv: paid + amt(r, lv, 100000, 600000, 100000, 1000), t: t, m: amt(r, lv, t * 0.3, t * 0.6, 100000, 1000), x: amt(r, lv, 100000, 900000, 10000, 100) };
    },
    build: function (p, v) {
      if (v === 'corp') return {
        text: '決算にあたり、当期の法人税、住民税及び事業税 ' + y(p.t) + '円を計上する。なお、中間申告により ' + y(p.m) + '円を納付済みであり、仮払法人税等として処理している。',
        answer: [D('法人税、住民税及び事業税', p.t), C('仮払法人税等', p.m), C('未払法人税等', p.t - p.m)],
        traps: [{ entries: [D('法人税、住民税及び事業税', p.t), C('未払法人税等', p.t)], cause: '条件の読み落とし', note: '中間納付額（仮払法人税等）を差し引いていません。' }],
        hint: '中間納付した分は、もう払ってあります。',
        explain: '年税額 ' + y(p.t) + '円から中間納付額 ' + y(p.m) + '円を差し引いた ' + y(p.t - p.m) + '円が未払法人税等。'
      };
      if (v === 'purchase_tax') {
        var tax = p.x / 10;
        return {
          text: '商品 ' + y(p.x) + '円（税抜価格）を仕入れ、代金は消費税（税率10%）とともに掛けとした。消費税は税抜方式で記帳している。',
          answer: [D('仕入', p.x), D('仮払消費税', tax), C('買掛金', p.x + tax)],
          traps: [{ entries: [D('仕入', p.x + tax), C('買掛金', p.x + tax)], cause: '知識不足', note: '税込方式の処理になっています。税抜方式では消費税を仮払消費税として分けます。' }],
          hint: '支払った消費税は仕入とは別の勘定で記録します。',
          explain: '消費税 ＝ ' + y(p.x) + ' × 10% ＝ ' + y(tax) + '円を仮払消費税とする。買掛金は税込の ' + y(p.x + tax) + '円。'
        };
      }
      return {
        text: '決算にあたり、消費税の納付額を計算する。当期の仮払消費税は ' + y(p.paid) + '円、仮受消費税は ' + y(p.recv) + '円である（税抜方式）。',
        answer: [D('仮受消費税', p.recv), C('仮払消費税', p.paid), C('未払消費税', p.recv - p.paid)], traps: [],
        hint: '仮受と仮払を相殺し、差額が納付額です。',
        explain: '仮受消費税 ' + y(p.recv) + ' − 仮払消費税 ' + y(p.paid) + ' ＝ ' + y(p.recv - p.paid) + '円を未払消費税とする。'
      };
    }
  });

  // ---------- 株式の発行 ----------
  T.push({
    id: 'stock', topics: ['c15'], target: 75, variants: ['basic', 'min', 'cost'],
    choices: ['現金', '当座預金', '資本金', '資本準備金', '利益準備金', '創立費', '株式交付費', '繰越利益剰余金'],
    params: function (r, v, lv) {
      return { n: r.int(1, 9) * (lv <= 1 ? 1000 : 100), pr: r.int(2, 40) * (lv <= 1 ? 1000 : 100), f: amt(r, lv, 100000, 500000, 100000, 1000) };
    },
    build: function (p, v) {
      var tot = p.n * p.pr, half = tot / 2;
      var split = [D('当座預金', tot), C('資本金', half), C('資本準備金', half)];
      if (v === 'min') return {
        text: '会社の設立にあたり、株式 ' + y(p.n) + '株を1株あたり ' + y(p.pr) + '円で発行し、全額の払込みを受けて当座預金とした。資本金とする額は、会社法が認める最低限度額とする。',
        answer: split,
        traps: [{ entries: [D('当座預金', tot), C('資本金', tot)], cause: '条件の読み落とし', note: '全額を資本金にしています。最低限度額は払込金額の2分の1です。' }],
        hint: '払込金額の2分の1までは資本金にしないことができます。',
        explain: '払込金額 ' + y(tot) + '円。最低限度額はその2分の1の ' + y(half) + '円で、残りは資本準備金。'
      };
      if (v === 'cost') return {
        text: '増資にあたり、株式 ' + y(p.n) + '株を1株あたり ' + y(p.pr) + '円で発行し、全額の払込みを受けて当座預金とした。資本金とする額は、会社法が認める最低限度額とする。また、株式の発行費用 ' + y(p.f) + '円を現金で支払った。',
        answer: split.concat([D('株式交付費', p.f), C('現金', p.f)]),
        traps: [{ entries: split, cause: '条件の読み落とし', note: '株式の発行費用を処理していません。' }],
        hint: '増資のときの発行費用と、設立のときの発行費用は勘定科目が違います。',
        explain: '払込金額 ' + y(tot) + '円の2分の1ずつを資本金と資本準備金に。増資時の発行費用 ' + y(p.f) + '円は株式交付費（設立時なら創立費）。'
      };
      return {
        text: '会社の設立にあたり、株式 ' + y(p.n) + '株を1株あたり ' + y(p.pr) + '円で発行し、全額の払込みを受けて当座預金とした。払込金額の全額を資本金とする。',
        answer: [D('当座預金', tot), C('資本金', tot)], traps: [],
        hint: '原則どおり、払込金額の全額が資本金です。',
        explain: '払込金額 ＝ ' + y(p.n) + '株 × ' + y(p.pr) + ' ＝ ' + y(tot) + '円。原則として全額を資本金とする。'
      };
    }
  });

  // ---------- 剰余金の配当 ----------
  T.push({
    id: 'div', topics: ['c16'], target: 100, variants: ['basic', 'cap', 'reserve'],
    choices: ['当座預金', '未払配当金', '資本金', '資本準備金', '利益準備金', '別途積立金', '繰越利益剰余金'],
    params: function (r, v, lv) {
      var cap = r.int(5, 25) * 4000000, dv = amt(r, lv, 500000, 3000000, 100000, 10000), tenth = dv / 10;
      // room = 資本金の4分の1 − 準備金合計。cap のときだけ10分の1より小さくする
      var room = v === 'cap' ? amt(r, lv, tenth * 0.2, tenth * 0.8, 10000, 1000) : tenth + r.int(1, 20) * 100000;
      var total = cap / 4 - room, s1 = Math.floor(total * r.int(4, 7) / 10 / 1000) * 1000;
      return { cap: cap, dv: dv, room: room, s1: s1, s2: total - s1, other: amt(r, lv, 100000, 900000, 100000, 10000) };
    },
    build: function (p, v) {
      var tenth = p.dv / 10, res = Math.min(tenth, p.room);
      var head = '株主総会において、繰越利益剰余金を財源とする剰余金の配当等が次のとおり決議された。株主配当金 ' + y(p.dv) + '円、利益準備金 会社法が定める金額';
      var tail = '。なお、資本金は ' + y(p.cap) + '円、資本準備金は ' + y(p.s1) + '円、利益準備金は ' + y(p.s2) + '円である。';
      var calc = '配当の10分の1 ＝ ' + y(tenth) + '円。積立の上限 ＝ 資本金の4分の1 ' + y(p.cap / 4) + ' −（資本準備金 ' + y(p.s1) + ' ＋ 利益準備金 ' + y(p.s2) + '）＝ ' + y(p.room) + '円。小さいほうの ' + y(res) + '円を積み立てる。';
      var noRes = { entries: [D('繰越利益剰余金', p.dv), C('未払配当金', p.dv)], cause: '解法手順の誤り', note: '利益準備金の積立てが抜けています。' };
      if (v === 'reserve') return {
        text: head + '、別途積立金 ' + y(p.other) + '円' + tail,
        answer: [D('繰越利益剰余金', p.dv + res + p.other), C('未払配当金', p.dv), C('利益準備金', res), C('別途積立金', p.other)],
        traps: [noRes],
        hint: '借方は、配当・利益準備金・別途積立金の合計です。',
        explain: calc + '繰越利益剰余金の減少は ' + y(p.dv) + ' ＋ ' + y(res) + ' ＋ ' + y(p.other) + ' ＝ ' + y(p.dv + res + p.other) + '円。'
      };
      var traps = [noRes];
      if (v === 'cap') traps.push({ entries: [D('繰越利益剰余金', p.dv + tenth), C('未払配当金', p.dv), C('利益準備金', tenth)], cause: '条件の読み落とし', note: '配当の10分の1を積み立てていますが、上限（資本金の4分の1までの残り）を超えています。' });
      return {
        text: head + tail,
        answer: [D('繰越利益剰余金', p.dv + res), C('未払配当金', p.dv), C('利益準備金', res)],
        traps: traps,
        hint: '「配当の10分の1」と「資本金の4分の1 − 準備金の合計」の小さいほうを積み立てます。',
        explain: calc
      };
    }
  });

  // ---------- リース取引 ----------
  T.push({
    id: 'lease', topics: ['c09'], target: 75, variants: ['basic', 'excl', 'pay_incl', 'pay_excl'],
    choices: ['当座預金', 'リース資産', 'リース債務', '支払リース料', '支払利息', '減価償却費', '未払金'],
    params: function (r, v, lv) {
      var n = r.pick([3, 4, 5, 6]);
      return { n: n, a: amt(r, lv, 200000, 900000, 100000, 10000), i: amt(r, lv, 10000, 60000, 10000, 1000) };
    },
    build: function (p, v) {
      var tot = p.a * p.n, cash = (p.a - p.i) * p.n;
      var base = '備品のリース契約（ファイナンス・リース取引、リース期間' + p.n + '年、リース料は年額 ' + y(p.a) + '円を毎年末に支払う';
      if (v === 'excl') return {
        text: '期首に' + base + '、見積現金購入価額 ' + y(cash) + '円）を締結し、リース物件の引渡しを受けた。利子抜き法により処理する。',
        answer: [D('リース資産', cash), C('リース債務', cash)],
        traps: [{ entries: [D('リース資産', tot), C('リース債務', tot)], cause: '条件の読み落とし', note: 'リース料総額で計上しています。利子抜き法では見積現金購入価額を使います。' }],
        hint: '利子抜き法は、利息を含まない金額で計上します。',
        explain: '利子抜き法では、利息を除いた見積現金購入価額 ' + y(cash) + '円でリース資産とリース債務を計上する。'
      };
      if (v === 'pay_incl') return {
        text: base + '）について、当期分のリース料を当座預金口座から支払った。利子込み法により処理している。',
        answer: [D('リース債務', p.a), C('当座預金', p.a)], traps: [],
        hint: '利子込み法では、支払額の全額がリース債務の返済です。',
        explain: '利子込み法ではリース料総額でリース債務を計上しているので、支払った ' + y(p.a) + '円の全額をリース債務の減少とする。'
      };
      if (v === 'pay_excl') return {
        text: base + '、見積現金購入価額 ' + y(cash) + '円）について、当期分のリース料を当座預金口座から支払った。利子抜き法により処理しており、利息相当額は定額法で各期に配分する。',
        answer: [D('リース債務', p.a - p.i), D('支払利息', p.i), C('当座預金', p.a)],
        traps: [{ entries: [D('リース債務', p.a), C('当座預金', p.a)], cause: '条件の読み落とし', note: '利子込み法の処理になっています。利子抜き法では利息相当額を支払利息とします。' }],
        hint: '利息相当額の総額 ＝ リース料総額 − 見積現金購入価額。これを年数で割ります。',
        explain: '利息相当額の総額 ＝ ' + y(tot) + ' − ' + y(cash) + ' ＝ ' + y(tot - cash) + '円。1年分は ÷ ' + p.n + ' ＝ ' + y(p.i) + '円（支払利息）。残り ' + y(p.a - p.i) + '円がリース債務の返済。'
      };
      return {
        text: '期首に' + base + '）を締結し、リース物件の引渡しを受けた。利子込み法により処理する。',
        answer: [D('リース資産', tot), C('リース債務', tot)], traps: [],
        hint: '利子込み法は、リース料の総額で計上します。',
        explain: 'リース料総額 ＝ ' + y(p.a) + ' × ' + p.n + '年 ＝ ' + y(tot) + '円でリース資産とリース債務を計上する。'
      };
    }
  });

  // ---------- 無形固定資産・研究開発費 ----------
  T.push({
    id: 'intangible', topics: ['c10'], target: 60, variants: ['basic', 'rnd', 'goodwill', 'monthly'],
    choices: ['当座預金', '備品', 'ソフトウェア', 'のれん', 'ソフトウェア償却', 'のれん償却', '研究開発費', '給料'],
    params: function (r, v, lv) {
      return { n: r.pick([3, 4, 5]), k: r.int(2, 20) * (lv <= 1 ? 5000 : 500), mo: r.int(2, 11), gn: r.pick([10, 20]), gk: r.int(1, 9) * (lv <= 1 ? 100000 : 10000), x: amt(r, lv, 300000, 900000, 100000, 1000), w: amt(r, lv, 200000, 800000, 100000, 1000) };
    },
    build: function (p, v) {
      var cost = p.k * 12 * p.n;
      if (v === 'rnd') return {
        text: '研究開発部門で使用する目的で、研究開発専用の測定機器 ' + y(p.x) + '円を購入し、研究開発に従事する従業員の給料 ' + y(p.w) + '円とあわせて小切手を振り出して支払った。',
        answer: [D('研究開発費', p.x + p.w), C('当座預金', p.x + p.w)],
        traps: [{ entries: [D('備品', p.x), D('給料', p.w), C('当座預金', p.x + p.w)], cause: '知識不足', note: '研究開発のための支出は、資産や給料にせず、すべて研究開発費とします。' }],
        hint: '研究開発だけに使う支出は、発生時に全額を1つの費用にします。',
        explain: '研究開発専用の機器も研究員の給料も、すべて研究開発費（費用）。' + y(p.x) + ' ＋ ' + y(p.w) + ' ＝ ' + y(p.x + p.w) + '円。'
      };
      if (v === 'goodwill') {
        var g = p.gk * p.gn;
        return {
          text: '決算にあたり、当期首の合併により生じたのれん ' + y(g) + '円を、' + p.gn + '年間にわたり定額法により償却する。',
          answer: [D('のれん償却', p.gk), C('のれん', p.gk)], traps: [],
          hint: '無形固定資産は直接法で償却します。',
          explain: y(g) + ' ÷ ' + p.gn + '年 ＝ ' + y(p.gk) + '円。無形固定資産は累計額を使わず、のれんを直接減らす。'
        };
      }
      if (v === 'monthly') return {
        text: '決算にあたり、当期中に取得し利用を開始した自社利用のソフトウェア（取得原価 ' + y(cost) + '円）を、利用可能期間' + p.n + '年の定額法により償却する。当期の利用期間は' + p.mo + 'か月であり、月割で計算する。',
        answer: [D('ソフトウェア償却', p.k * p.mo), C('ソフトウェア', p.k * p.mo)],
        traps: [{ entries: [D('ソフトウェア償却', cost / p.n), C('ソフトウェア', cost / p.n)], cause: '条件の読み落とし', note: '1年分を計上しています。当期の利用期間は' + p.mo + 'か月です。' }],
        hint: '1年分を求めてから、利用した月数分に直します。',
        explain: '1年分 ＝ ' + y(cost) + ' ÷ ' + p.n + ' ＝ ' + y(cost / p.n) + '円。当期分 ＝ × ' + p.mo + ' ÷ 12 ＝ ' + y(p.k * p.mo) + '円。'
      };
      return {
        text: '決算にあたり、当期首に取得した自社利用のソフトウェア（取得原価 ' + y(cost) + '円）を、利用可能期間' + p.n + '年の定額法により償却する。',
        answer: [D('ソフトウェア償却', cost / p.n), C('ソフトウェア', cost / p.n)], traps: [],
        hint: '無形固定資産は直接法で償却します。',
        explain: y(cost) + ' ÷ ' + p.n + '年 ＝ ' + y(cost / p.n) + '円。ソフトウェアを直接減らす。'
      };
    }
  });

  // ---------- 工業簿記：材料費 ----------
  T.push({
    id: 'material', topics: ['k02'], target: 60, variants: ['basic', 'purchase', 'shrink'],
    choices: ['現金', '買掛金', '材料', '仕掛品', '製造間接費', '製品', '賃金・給料'],
    params: function (r, v, lv) {
      var a = amt(r, lv, 200000, 900000, 100000, 1000), bk = amt(r, lv, 100000, 500000, 10000, 1000);
      return { a: a, b: amt(r, lv, 20000, 150000, 10000, 1000), f: amt(r, lv, 5000, 30000, 1000, 100), bk: bk, loss: amt(r, lv, 1000, bk * 0.05, 1000, 100) || 1000 };
    },
    build: function (p, v) {
      if (v === 'purchase') return {
        text: '材料 ' + y(p.a) + '円を掛けで購入し、引取運賃 ' + y(p.f) + '円は現金で支払った。',
        answer: [D('材料', p.a + p.f), C('買掛金', p.a), C('現金', p.f)],
        traps: [{ entries: [D('材料', p.a), C('買掛金', p.a)], cause: '条件の読み落とし', note: '引取運賃を処理していません。' }],
        hint: '引取運賃などの付随費用は、材料の購入原価に含めます。',
        explain: '購入原価 ＝ 購入代価 ' + y(p.a) + ' ＋ 引取運賃 ' + y(p.f) + ' ＝ ' + y(p.a + p.f) + '円。'
      };
      if (v === 'shrink') return {
        text: '月末に材料の実地棚卸を行ったところ、帳簿棚卸高 ' + y(p.bk) + '円に対し、実地棚卸高は ' + y(p.bk - p.loss) + '円であった。この棚卸減耗は正常な範囲のものである。',
        answer: [D('製造間接費', p.loss), C('材料', p.loss)], traps: [],
        hint: '正常な棚卸減耗は間接経費です。',
        explain: '棚卸減耗 ＝ ' + y(p.bk) + ' − ' + y(p.bk - p.loss) + ' ＝ ' + y(p.loss) + '円。正常な減耗は間接経費として製造間接費に振り替える。'
      };
      return {
        text: '当月、材料 ' + y(p.a + p.b) + '円を消費した。このうち ' + y(p.a) + '円は特定の製品の製造のために消費した直接材料費であり、残りは間接材料費である。',
        answer: [D('仕掛品', p.a), D('製造間接費', p.b), C('材料', p.a + p.b)],
        traps: [{ entries: [D('仕掛品', p.a + p.b), C('材料', p.a + p.b)], cause: '条件の読み落とし', note: '間接材料費も仕掛品に振り替えています。' }],
        hint: '直接費は仕掛品へ、間接費は製造間接費へ振り替えます。',
        explain: '直接材料費 ' + y(p.a) + '円は仕掛品へ。間接材料費 ' + y(p.a + p.b) + ' − ' + y(p.a) + ' ＝ ' + y(p.b) + '円は製造間接費へ。'
      };
    }
  });

  // ---------- 工業簿記：製造間接費の予定配賦 ----------
  T.push({
    id: 'overhead', topics: ['k05'], target: 75, variants: ['basic', 'variance', 'rate'],
    choices: ['材料', '仕掛品', '製造間接費', '製造間接費配賦差異', '製品', '賃金・給料', '売上原価'],
    params: function (r, v, lv) {
      var rate = r.int(5, 30) * (lv <= 1 ? 100 : 10), h = r.int(2, 20) * (lv <= 1 ? 100 : 10), d = amt(r, lv, 5000, 60000, 10000, 100) || 10000;
      return { rate: rate, h: h, unfav: r() < 0.5, d: d, yh: r.int(2, 6) * 6000 };
    },
    build: function (p, v) {
      var applied = p.rate * p.h;
      if (v === 'variance') {
        var actual = p.unfav ? applied + p.d : applied - p.d;
        return {
          text: '当月の製造間接費の予定配賦額は ' + y(applied) + '円、実際発生額は ' + y(actual) + '円であった。予定配賦額と実際発生額の差額を製造間接費配賦差異勘定に振り替える。',
          answer: p.unfav ? [D('製造間接費配賦差異', p.d), C('製造間接費', p.d)] : [D('製造間接費', p.d), C('製造間接費配賦差異', p.d)],
          traps: [],
          hint: '実際発生額のほうが多いときは、配賦が足りていません（不利差異）。',
          explain: '差額 ' + y(p.d) + '円。実際発生額が予定配賦額より' + (p.unfav ? '多い（不利差異・借方差異）ので、製造間接費勘定の貸方から差異勘定の借方へ振り替える。' : '少ない（有利差異・貸方差異）ので、製造間接費勘定の借方から差異勘定の貸方へ振り替える。')
        };
      }
      if (v === 'rate') {
        var budget = p.rate * p.yh;
        return {
          text: '製造間接費は直接作業時間を基準として予定配賦している。年間の製造間接費予算は ' + y(budget) + '円、年間の予定直接作業時間は ' + y(p.yh) + '時間である。当月の実際直接作業時間は ' + y(p.h) + '時間であった。当月の予定配賦の仕訳を示しなさい。',
          answer: [D('仕掛品', applied), C('製造間接費', applied)],
          traps: [{ entries: [D('仕掛品', budget / 12), C('製造間接費', budget / 12)], cause: '解法手順の誤り', note: '年間予算を12で割っています。予定配賦額は 予定配賦率 × 実際の作業時間 です。' }],
          hint: 'まず予定配賦率（予算 ÷ 予定時間）を求め、当月の実際時間を掛けます。',
          explain: '予定配賦率 ＝ ' + y(budget) + ' ÷ ' + y(p.yh) + '時間 ＝ ' + y(p.rate) + '円／時間。予定配賦額 ＝ ' + y(p.rate) + ' × ' + y(p.h) + '時間 ＝ ' + y(applied) + '円。'
        };
      }
      return {
        text: '製造間接費は直接作業時間を基準として予定配賦している。予定配賦率は1時間あたり ' + y(p.rate) + '円、当月の実際直接作業時間は ' + y(p.h) + '時間であった。当月の予定配賦の仕訳を示しなさい。',
        answer: [D('仕掛品', applied), C('製造間接費', applied)], traps: [],
        hint: '予定配賦額 ＝ 予定配賦率 × 実際の作業時間。',
        explain: y(p.rate) + '円 × ' + y(p.h) + '時間 ＝ ' + y(applied) + '円を製造間接費から仕掛品へ振り替える。'
      };
    }
  });

  // ---------- 複数論点 ----------
  T.push({
    id: 'comp_fa_tax', topics: ['c07', 'c13'], composite: true, target: 90, variants: ['basic'],
    choices: ['当座預金', '備品', '仮払消費税', '仮受消費税', '買掛金', '未払金', '支払手数料', '租税公課'],
    params: function (r, v, lv) { return { x: amt(r, lv, 300000, 2000000, 10000, 1000), f: amt(r, lv, 10000, 50000, 10000, 1000) }; },
    build: function (p) {
      var base = p.x + p.f, tax = base / 10;
      return {
        text: '備品 ' + y(p.x) + '円（税抜価格）を購入し、据付費 ' + y(p.f) + '円（税抜価格）とあわせて、消費税（税率10%）を含めた代金を翌月末に支払うこととした。消費税は税抜方式で記帳している。',
        answer: [D('備品', base), D('仮払消費税', tax), C('未払金', base + tax)],
        traps: [
          { entries: [D('備品', p.x), D('支払手数料', p.f), D('仮払消費税', tax), C('未払金', base + tax)], cause: '知識不足', note: '据付費は費用にせず、備品の取得原価に含めます。' },
          { entries: [D('備品', base + tax), C('未払金', base + tax)], cause: '条件の読み落とし', note: '税込方式の処理になっています。' }
        ],
        hint: '据付費は取得原価に含めます。商品以外の購入代金の未払いは買掛金ではありません。',
        explain: '取得原価 ＝ ' + y(p.x) + ' ＋ 据付費 ' + y(p.f) + ' ＝ ' + y(base) + '円。消費税 ＝ ' + y(base) + ' × 10% ＝ ' + y(tax) + '円。商品以外の代金の未払いは未払金。'
      };
    }
  });

  T.push({
    id: 'comp_fx_adv', topics: ['c12', 'b01'], composite: true, target: 100, variants: ['basic'],
    choices: ['当座預金', '売掛金', '前払金', '買掛金', '前受金', '仕入', '売上', '為替差損益'],
    params: function (r, v, lv) {
      var d = r.int(2, 9) * 1000, r0 = r.int(100, 150);
      return { d: d, a: r.int(1, d / 1000 - 1) * (lv <= 1 ? 1000 : 500), r0: r0, r1: r0 + r.pick([-5, -3, -2, 2, 3, 5]) };
    },
    build: function (p) {
      var adv = p.a * p.r0, rest = (p.d - p.a) * p.r1;
      return {
        text: '米国の仕入先から商品 ' + y(p.d) + 'ドルを仕入れた。代金のうち ' + y(p.a) + 'ドルは注文時に支払っていた手付金（支払時の為替相場は1ドル ' + p.r0 + '円）を充当し、残額は掛けとした。仕入時の為替相場は1ドル ' + p.r1 + '円であった。',
        answer: [D('仕入', adv + rest), C('前払金', adv), C('買掛金', rest)],
        traps: [{ entries: [D('仕入', p.d * p.r1), C('前払金', p.a * p.r1), C('買掛金', rest)], cause: '解法手順の誤り', note: '前払金を仕入時の相場で換算しています。前払金は支払ったときの円額のままです。' }],
        hint: '前払金は支払時の相場、掛けの部分は仕入時の相場で換算します。仕入はその合計です。',
        explain: '前払金 ＝ ' + y(p.a) + ' × ' + p.r0 + ' ＝ ' + y(adv) + '円（支払時の円額）。買掛金 ＝ ' + y(p.d - p.a) + ' × ' + p.r1 + ' ＝ ' + y(rest) + '円。仕入はその合計 ' + y(adv + rest) + '円。'
      };
    }
  });

  BK.TEMPLATES = T;
  BK.tpl = function (id) { return T.filter(function (t) { return t.id === id; })[0]; };

  // 論点 → 出題できる型（レベル別）
  BK.templatesFor = function (topicId, level) {
    return T.filter(function (t) {
      if (t.topics.indexOf(topicId) < 0) return false;
      return level === 4 ? !!t.composite : !t.composite;
    });
  };
  BK.hasTemplates = function (topicId) { return BK.templatesFor(topicId, 1).length > 0; };
  BK.hasComposite = function (topicId) { return BK.templatesFor(topicId, 4).length > 0; };
  BK.condVariants = function (topicId) {
    var out = [];
    BK.templatesFor(topicId, 3).forEach(function (t) {
      t.variants.forEach(function (v) { if (v !== 'basic') out.push(t.id + ':' + v); });
    });
    return out;
  };

  // 出題してよい問題かをプログラムで検査する（貸借一致・正の整数・選択肢に正解の科目がある・典型誤りが正解と別物）
  BK.checkQuestion = function (q) {
    var errs = [];
    if (!q.text) errs.push('問題文なし');
    q.answer.forEach(function (e) {
      if (!Number.isInteger(e.amt) || e.amt <= 0) errs.push('金額が正の整数でない: ' + e.acc + ' ' + e.amt);
      if (q.choices.indexOf(e.acc) < 0) errs.push('選択肢にない科目: ' + e.acc);
    });
    if (!BK.isBalanced(q.answer)) errs.push('貸借不一致');
    (q.traps || []).forEach(function (t) {
      if (BK.sameJournal(t.entries, q.answer)) errs.push('典型誤りが正解と同じ');
      t.entries.forEach(function (e) { if (!Number.isInteger(e.amt) || e.amt <= 0) errs.push('典型誤りの金額が不正'); });
    });
    return errs;
  };

  // 種から問題を再現する。検査に通らなければ null（出題しない）
  BK.makeQuestion = function (tplId, variant, level, seed) {
    var t = BK.tpl(tplId);
    if (!t) return null;
    var p = t.params(BK.rng(seed), variant, level);
    var q = t.build(p, variant);
    q.tpl = tplId; q.variant = variant; q.level = level; q.seed = seed;
    q.topics = t.topics; q.choices = t.choices; q.target = Math.round(t.target * (BK.TIME_FACTOR || 1));
    q.traps = (q.traps || []).filter(function (x) { return !BK.sameJournal(x.entries, q.answer); });
    return BK.checkQuestion(q).length ? null : q;
  };

  // 論点とレベルから問題を1問作る。avoid は出題済みの条件パターン（未成立のものを優先するため）
  BK.pickQuestion = function (topicId, level, avoid) {
    if (level === 4 && !BK.hasComposite(topicId)) level = 3;
    var tpls = BK.templatesFor(topicId, level);
    if (!tpls.length) return null;
    var cands = [];
    tpls.forEach(function (t) {
      t.variants.forEach(function (v) {
        if (level <= 2 || level === 4 ? v === 'basic' : v !== 'basic') cands.push({ t: t.id, v: v });
      });
    });
    if (!cands.length) cands = tpls.map(function (t) { return { t: t.id, v: 'basic' }; });
    var fresh = cands.filter(function (c) { return !(avoid || {})[c.t + ':' + c.v]; });
    var pool = fresh.length ? fresh : cands;
    for (var i = 0; i < 20; i++) {
      var c = pool[Math.floor(Math.random() * pool.length)];
      var q = BK.makeQuestion(c.t, c.v, level, BK.newSeed());
      if (q) return q;
    }
    return null;
  };
})();
