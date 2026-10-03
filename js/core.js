// 共通の土台：名前空間、日付、乱数。金額はすべて整数の円で扱う。
(function () {
  var BK = (globalThis.BK = globalThis.BK || {});

  BK.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  // 日付は端末のローカル時刻で 'YYYY-MM-DD' の文字列として持つ
  BK.dateStr = function (d) {
    return d.getFullYear() + '-' + BK.pad2(d.getMonth() + 1) + '-' + BK.pad2(d.getDate());
  };
  BK.today = function () { return BK.dateStr(new Date()); };
  BK.parseDate = function (s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  };
  BK.addDays = function (s, n) {
    var d = BK.parseDate(s);
    d.setDate(d.getDate() + n);
    return BK.dateStr(d);
  };
  BK.daysBetween = function (a, b) {
    return Math.round((BK.parseDate(b) - BK.parseDate(a)) / 86400000);
  };
  BK.weekday = function (s) { return BK.parseDate(s).getDay(); }; // 0=日

  // 種から再現できる乱数（同じ種なら同じ問題になる）
  BK.rng = function (seed) {
    var a = seed >>> 0;
    var f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    return f;
  };
  BK.newSeed = function () { return Math.floor(Math.random() * 2147483647); };

  BK.yen = function (n) { return Number(n).toLocaleString('ja-JP'); };

  BK.median = function (arr) {
    var s = arr.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
})();
