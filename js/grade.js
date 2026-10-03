// 仕訳の採点と誤答原因の機械判定。AIは使わない。
// 仕訳は [{side:'D'|'C', acc:'勘定科目', amt:整数}] で表す（D=借方、C=貸方）。
(function () {
  var BK = (globalThis.BK = globalThis.BK || {});

  BK.CAUSES = [
    '知識不足', '取引認識の誤り', '勘定科目の誤り', '借方・貸方の誤り', '計算ミス',
    '条件の読み落とし', '解法手順の誤り', '時間不足', 'ケアレスミス', 'その他', '判定不能'
  ];

  // 同じ側・同じ科目の行を合算し、金額0と未入力の行を捨てる
  BK.normalize = function (entries) {
    var map = {};
    (entries || []).forEach(function (e) {
      if (!e || !e.acc || !e.amt) return;
      var k = e.side + '|' + e.acc;
      map[k] = (map[k] || 0) + e.amt;
    });
    return Object.keys(map).sort().map(function (k) {
      var p = k.split('|');
      return { side: p[0], acc: p[1], amt: map[k] };
    });
  };

  BK.sideTotal = function (entries, side) {
    return BK.normalize(entries).reduce(function (s, e) {
      return s + (e.side === side ? e.amt : 0);
    }, 0);
  };

  BK.isBalanced = function (entries) {
    var d = BK.sideTotal(entries, 'D');
    return d > 0 && d === BK.sideTotal(entries, 'C');
  };

  function key(entries, f) {
    return BK.normalize(entries).map(f).sort().join(';');
  }
  function full(e) { return e.side + '|' + e.acc + '|' + e.amt; }

  // 行の順序は問わずに一致を判定する
  BK.sameJournal = function (a, b) {
    return key(a, full) === key(b, full);
  };

  BK.swapSides = function (entries) {
    return entries.map(function (e) {
      return { side: e.side === 'D' ? 'C' : 'D', acc: e.acc, amt: e.amt };
    });
  };

  // 機械判定。戻り値は {cause, note}。確定は利用者が行う。
  // traps: [{entries, cause, note}] 型が用意した「典型的な誤りの答え」
  BK.diagnose = function (user, correct, traps, timedOut) {
    var u = BK.normalize(user);
    if (u.length === 0) {
      return timedOut
        ? { cause: '時間不足', note: '時間内に解答が入力されませんでした。' }
        : { cause: '知識不足', note: '解答が入力されていません。' };
    }
    if (BK.sameJournal(BK.swapSides(u), correct)) {
      return { cause: '借方・貸方の誤り', note: '借方と貸方を入れ替えると正解と一致します。' };
    }
    for (var i = 0; i < (traps || []).length; i++) {
      if (BK.sameJournal(u, traps[i].entries)) {
        return { cause: traps[i].cause, note: traps[i].note };
      }
    }
    var sideAmt = function (e) { return e.side + '|' + e.amt; };
    var sideAcc = function (e) { return e.side + '|' + e.acc; };
    if (key(u, sideAmt) === key(correct, sideAmt)) {
      return { cause: '勘定科目の誤り', note: '金額は合っていますが、勘定科目が違います。' };
    }
    if (key(u, sideAcc) === key(correct, sideAcc)) {
      return { cause: '計算ミス', note: '勘定科目は合っていますが、金額が違います。条件の読み落としの可能性もあります。' };
    }
    if (u.length !== BK.normalize(correct).length) {
      return { cause: '取引認識の誤り', note: '仕訳の行数が正解と違います。取引の捉え方を確認してください。' };
    }
    return { cause: '判定不能', note: '機械判定では原因を特定できませんでした。' };
  };
})();
