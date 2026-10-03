// 理解済みの判定（7つの証拠）、難易度の上げ下げ、復習間隔。すべてプログラムが決める。
(function () {
  var BK = (globalThis.BK = globalThis.BK || {});

  BK.EVIDENCE = ['', '基本問題', '数値変更', '条件変更', '複数論点', '理由説明', '数日後の復習', '時間内'];
  BK.STATUSES = ['未学習', '学習中', '基本OK', '応用OK', '理解済み'];
  BK.STEPS = [1, 3, 7, 14, 30];   // 復習間隔（日）
  BK.TIME_FACTOR = 1.5;           // スマホ入力の分を見込んだ目標時間の倍率

  BK.newTopicState = function () {
    return {
      status: '未学習', level: 1, step: 0, due: null,
      ev: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
      basicStreak: 0, numStreak: 0, cond: {}, comp: 0,
      upStreak: 0, downStreak: 0, ratios: [], last: null,
      explained: false, needExplain: false, declared: false, coef: 1,
      stepDate: null, stepBase: 0, dayWorst: 0, firstDay: null
    };
  };
  BK.ts = function (state, id) {
    if (!state.topics[id]) state.topics[id] = BK.newTopicState();
    return state.topics[id];
  };

  BK.statusOf = function (ts) {
    var e = ts.ev;
    if (e[1] && e[2] && e[3] && e[4] && e[5] && e[6] && e[7]) return '理解済み';
    if (e[1] && e[2] && e[3] && e[4] && e[5]) return '応用OK';
    if (e[1]) return '基本OK';
    if (ts.last || ts.explained) return '学習中';
    return '未学習';
  };
  BK.rank = function (status) { return BK.STATUSES.indexOf(status); };

  function refresh(state, id, date, why) {
    var ts = BK.ts(state, id), before = ts.status, after = BK.statusOf(ts);
    if (before !== after) {
      ts.status = after;
      state.events.push({ date: date, topic: id, from: before, to: after, why: why });
    }
  }
  BK.refreshStatus = refresh;

  // 次に出す問題のレベル。まだ成立していない証拠に合わせ、現在のレベルを超えない。
  BK.nextLevel = function (ts, topicId) {
    var need = !ts.ev[1] ? 1 : !ts.ev[2] ? 2 : !ts.ev[3] ? 3 : (!ts.ev[4] && BK.hasComposite(topicId)) ? 4 : 3;
    return Math.min(need, ts.level);
  };

  // 1問の結果を論点の状態に反映する。a = {date, topics, tpl, variant, level, ok, hint, sec, target}
  BK.applyAttempt = function (state, a) {
    a.topics.forEach(function (id) {
      var ts = BK.ts(state, id);
      var valid = a.ok && !a.hint; // ヒントを見た正解は証拠にしない

      if (a.level === 1) {
        if (valid) ts.basicStreak++; else if (!a.ok) { ts.basicStreak = 0; ts.ev[1] = null; }
        if (ts.basicStreak >= 3 && !ts.ev[1]) ts.ev[1] = a.date;
      } else if (a.level === 2) {
        if (valid) ts.numStreak++; else if (!a.ok) { ts.numStreak = 0; ts.ev[2] = null; }
        if (ts.numStreak >= 2 && !ts.ev[2]) ts.ev[2] = a.date;
      } else if (a.level === 3) {
        if (valid) ts.cond[a.tpl + ':' + a.variant] = true;
        var needN = Math.min(2, BK.condVariants(id).length);
        if (needN > 0 && Object.keys(ts.cond).length >= needN && !ts.ev[3]) ts.ev[3] = a.date;
      } else if (a.level === 4) {
        if (valid) ts.comp++;
        if (ts.comp >= 2 && !ts.ev[4]) ts.ev[4] = a.date;
      }

      // そのレベルの証拠が揃ったら、時間がかかっていても次のレベルへ進める（時間は証拠7で別に見る）
      if (valid && a.level <= 3 && ts.ev[a.level] && ts.level <= a.level) ts.level = a.level + 1;

      // 証拠6：前回から7日以上あけて正解。誤答したら取り消す（降格）
      if (valid && ts.last && BK.daysBetween(ts.last, a.date) >= 7) ts.ev[6] = a.date;
      if (!a.ok) ts.ev[6] = null;

      // 証拠7：正解した直近5問の（解答時間 ÷ 目標時間）の中央値が1以下
      if (a.ok) {
        ts.ratios.push(a.sec / a.target);
        if (ts.ratios.length > 5) ts.ratios.shift();
        ts.ev[7] = ts.ratios.length >= 3 && BK.median(ts.ratios) <= 1 ? (ts.ev[7] || a.date) : null;
      }

      // 難易度：ヒントなし・目標の1.5倍以内の正解が2問続けば上げ、誤答が2問続けば下げる
      if (valid && a.sec <= a.target * 1.5) {
        ts.upStreak++; ts.downStreak = 0;
        if (ts.upStreak >= 2) { ts.level = Math.min(4, ts.level + 1); ts.upStreak = 0; }
      } else if (!a.ok) {
        ts.downStreak++; ts.upStreak = 0;
        if (ts.downStreak >= 2) {
          if (ts.level > 1) ts.level--; else ts.needExplain = true;
          ts.downStreak = 0;
        }
      } else {
        ts.upStreak = 0;
      }

      ts.last = a.date;
      refresh(state, id, a.date, a.ok ? '正解' : '誤答');
    });
  };

  // 確定した誤答原因を反映する
  BK.applyCause = function (state, topicId, cause, date) {
    var ts = BK.ts(state, topicId);
    if (cause === '知識不足') {
      ts.basicStreak = 0; ts.ev[1] = null; ts.needExplain = true;
      refresh(state, topicId, date, '知識不足のため解説からやり直し');
    }
  };

  // 復習時期を決める。段の移動は1日1回で、その日のいちばん悪い結果を使う。
  // res = {ok, hint, slow, cause}
  BK.schedule = function (state, topicId, res, date) {
    var ts = BK.ts(state, topicId);
    if (ts.stepDate !== date) {
      ts.stepDate = date; ts.stepBase = ts.step; ts.dayWorst = 0;
      if (ts.due === null) ts.firstDay = date;
    }
    var r = res.ok ? (res.hint || res.slow ? 1 : 0)
      : (res.cause === '知識不足' || res.cause === '解法手順の誤り') ? 3 : 2;
    ts.dayWorst = Math.max(ts.dayWorst, r);
    var s = ts.stepBase;
    if (ts.dayWorst === 0) s = Math.min(BK.STEPS.length - 1, s + 1);
    else if (ts.dayWorst === 2) s = Math.max(0, s - 1);
    else if (ts.dayWorst === 3) s = 0;
    if (ts.firstDay === date) s = 0; // 初めて学習した日は必ず翌日に復習
    ts.step = s;
    var toExam = state.profile.examDate ? BK.daysBetween(date, state.profile.examDate) : 999;
    var interval = Math.min(BK.STEPS[s], Math.max(1, Math.floor(toExam / 3)));
    ts.due = BK.addDays(date, interval);
  };

  // 理由確認の結果。選択式に正解し、記述の自己評価が「できた」で成立
  BK.applyReason = function (state, topicId, mcOk, self, date) {
    var ts = BK.ts(state, topicId);
    ts.ev[5] = mcOk && self === 'できた' ? date : null;
    refresh(state, topicId, date, '理由確認');
  };

  // 市販教材の自己採点結果。証拠1と4にだけ数える。
  BK.applyMaterial = function (state, rec) {
    var ts = BK.ts(state, rec.topic);
    if (rec.ok) {
      ts.basicStreak++;
      if (ts.basicStreak >= 3 && !ts.ev[1]) ts.ev[1] = rec.date;
      if (rec.composite) { ts.comp++; if (ts.comp >= 2 && !ts.ev[4]) ts.ev[4] = rec.date; }
    } else {
      ts.basicStreak = 0; ts.ev[1] = null; ts.ev[6] = null;
    }
    ts.selfGraded = true;
    ts.last = rec.date;
    refresh(state, rec.topic, rec.date, '教材（自己採点）');
    BK.schedule(state, rec.topic, { ok: rec.ok, cause: rec.cause }, rec.date);
  };

  // 証拠6の有効期限（45日）。起動時に確認する。
  BK.expireEvidence = function (state, date) {
    Object.keys(state.topics).forEach(function (id) {
      var ts = state.topics[id];
      if (ts.ev[6] && BK.daysBetween(ts.ev[6], date) > 45) {
        ts.ev[6] = null;
        refresh(state, id, date, '復習から45日経過');
      }
    });
  };
})();
