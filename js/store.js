// 学習データの保存。端末のブラウザ内（localStorage）にだけ置き、外部へは送らない。
(function () {
  var BK = (globalThis.BK = globalThis.BK || {});
  var KEY = BK.STORE_KEY || 'boki_coach_v1'; // テストは別のキーを使い、本番のデータに触れない

  BK.newState = function () {
    return {
      v: 1,
      profile: {
        examDate: null, mins: [60, 10, 10, 10, 10, 10, 60], // 日〜土の学習可能時間（分）
        material: 'スッキリわかる 日商簿記2級', setupDone: false, diagDone: false, planApprovedAt: null
      },
      topics: {}, attempts: [], materials: [], menus: {}, sessions: {},
      mocks: [], mockRun: null, events: [], weekly: [], budget: {}
    };
  };

  BK.load = function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw), d = BK.newState();
        Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; });
        return s;
      }
    } catch (e) { /* 保存領域が使えない場合は新規状態で動かす */ }
    return BK.newState();
  };

  BK.save = function (state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  };

  BK.exportData = function (state) { return JSON.stringify(state); };

  BK.importData = function (text) {
    var s = JSON.parse(text);
    if (!s || s.v !== 1 || !s.profile || !s.topics || !Array.isArray(s.attempts)) throw new Error('このアプリのデータではありません');
    return s;
  };
})();
