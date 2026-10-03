// 学習計画、今日のメニュー、遅延判定、振り返りの集計、推定得点、模試の判定。
(function () {
  var BK = (globalThis.BK = globalThis.BK || {});

  // 論点の配点への寄与：関連する大問の配点を、その大問の論点数で割って合計する
  BK.topicPoints = function (id) {
    var t = BK.topic(id), pts = 0;
    t.sec.forEach(function (s) {
      var sec = BK.EXAM.sections.filter(function (x) { return x.id === s; })[0];
      var n = BK.TOPICS.filter(function (x) { return x.sec.indexOf(s) >= 0; }).length;
      pts += sec.points / n;
    });
    return pts;
  };

  // 学習順：前提論点を先にしたうえで「配点への寄与 ÷ 所要時間」が高い順
  BK.planOrder = function () {
    var placed = {}, order = [], rest = BK.TOPICS.slice();
    while (rest.length) {
      var ready = rest.filter(function (t) { return t.pre.every(function (p) { return placed[p]; }); });
      ready.sort(function (a, b) { return BK.topicPoints(b.id) / b.min - BK.topicPoints(a.id) / a.min; });
      var pick = ready[0];
      placed[pick.id] = true; order.push(pick.id);
      rest.splice(rest.indexOf(pick), 1);
    }
    return order;
  };

  // 残りの必要時間の係数（状態と診断結果から）
  BK.coefOf = function (ts) {
    if (ts.status === '理解済み') return 0;
    if (ts.status === '応用OK') return 0.1;
    if (ts.status === '基本OK') return Math.min(ts.coef, 0.3);
    if (ts.status === '学習中') return Math.min(ts.coef, 0.6);
    return ts.coef;
  };
  BK.needMin = function (state, id) {
    return BK.topic(id).min * BK.coefOf(BK.ts(state, id)) * 1.3; // 復習分として3割を上乗せ
  };

  BK.MOCK_COUNT = 3;
  BK.requiredMin = function (state) {
    var m = BK.TOPICS.reduce(function (s, t) { return s + BK.needMin(state, t.id); }, 0);
    return Math.round(m + Math.max(0, BK.MOCK_COUNT - state.mocks.length) * 120);
  };

  BK.budgetFor = function (state, date) {
    if (state.budget[date] !== undefined) return state.budget[date];
    return state.profile.mins[BK.weekday(date)];
  };

  BK.availableMin = function (state, from) {
    var total = 0, d = from;
    while (state.profile.examDate && d < state.profile.examDate) {
      total += state.profile.mins[BK.weekday(d)];
      d = BK.addDays(d, 1);
    }
    return Math.round(total * 0.85); // 15%は予備
  };

  BK.delay = function (state, date) {
    var req = BK.requiredMin(state), av = BK.availableMin(state, date);
    var ratio = av > 0 ? req / av : (req > 0 ? 99 : 0);
    var label = ratio <= 1 ? '順調' : ratio <= 1.15 ? '注意' : '遅れ';
    return { required: req, available: av, ratio: ratio, label: label };
  };

  // 遅延率1.4超が2週続いたら受験日変更の検討を提案する（決めるのは人間）
  BK.suggestDateChange = function (state) {
    var w = state.weekly;
    return w.length >= 2 && w[w.length - 1].ratio > 1.4 && w[w.length - 2].ratio > 1.4;
  };

  // 週ごとの目標：学習順に、各週の使える時間へ詰める
  BK.weekPlan = function (state, date) {
    var weeks = [], d = date;
    while (state.profile.examDate && d < state.profile.examDate) {
      var end = d, cap = 0;
      do { cap += state.profile.mins[BK.weekday(end)]; end = BK.addDays(end, 1); }
      while (BK.weekday(end) !== 1 && end < state.profile.examDate);
      weeks.push({ start: d, end: BK.addDays(end, -1), cap: Math.round(cap * 0.85), topics: [] });
      d = end;
    }
    var i = 0, left = weeks.length ? weeks[0].cap : 0, overflow = [];
    BK.planOrder().forEach(function (id) {
      var need = BK.needMin(state, id);
      if (need <= 0) return;
      while (i < weeks.length && left <= 0) { i++; left = i < weeks.length ? weeks[i].cap : 0; }
      if (i >= weeks.length) { overflow.push(id); return; }
      weeks[i].topics.push(id);
      // 1週で終わらない論点は次の週以降にまたがる
      while (need > 0 && i < weeks.length) {
        var use = Math.min(need, left);
        need -= use; left -= use;
        if (need > 0) { i++; left = i < weeks.length ? weeks[i].cap : 0; if (i < weeks.length) weeks[i].topics.push(id); }
      }
      if (need > 0) overflow.push(id);
    });
    return { weeks: weeks, overflow: overflow };
  };

  var WEAK = { '未学習': 1, '学習中': 1, '基本OK': 0.8, '応用OK': 0.5, '理解済み': 0.3 };
  function prereqOK(state, id) {
    return BK.topic(id).pre.every(function (p) {
      var ts = BK.ts(state, p);
      return BK.rank(ts.status) >= 2 || ts.declared;
    });
  }
  function touched(state, id) {
    return state.attempts.some(function (a) { return a.topics.indexOf(id) >= 0; }) ||
      state.materials.some(function (m) { return m.topic === id; });
  }

  // 前回の学習日に誤答し、その後まだ正解していない論点
  BK.retryTopics = function (state, date) {
    var prev = state.attempts.filter(function (a) { return a.date < date; });
    if (!prev.length) return [];
    var lastDay = prev[prev.length - 1].date, out = [];
    prev.filter(function (a) { return a.date === lastDay && !a.ok; }).forEach(function (a) {
      var id = a.topics[0];
      var fixed = state.attempts.some(function (b) { return b.ts > a.ts && b.ok && b.topics[0] === id; });
      if (!fixed && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  };

  // 今日のメニューを決める（設計書4.1）。done は今日すでに終えた項目。
  BK.buildMenu = function (state, date, budget, done) {
    var items = (done || []).slice(), notes = [];
    var used = items.reduce(function (s, x) { return s + x.min; }, 0);
    var inMenu = function (id) { return items.some(function (x) { return x.topic === id && !x.done; }); };
    var add = function (type, id, min, reason) {
      items.push({ id: date + '-' + items.length, type: type, topic: id, min: min, reason: reason, done: false });
      used += min;
    };

    // 1. 前回誤答の再確認
    BK.retryTopics(state, date).slice(0, 3).forEach(function (id) {
      if (BK.hasTemplates(id)) add('retry', id, 2, '前回の学習で誤答したため、類題で確認します');
    });

    // 2. 期限の来た復習（枠の50%まで）
    var due = BK.TOPICS.filter(function (t) {
      var ts = BK.ts(state, t.id);
      // 学習中で内蔵問題のある論点は、下の「続き」でまとめて扱う
      if (ts.status === '学習中' && BK.hasTemplates(t.id)) return false;
      return ts.due && ts.due <= date && ts.status !== '未学習' && !inMenu(t.id);
    }).sort(function (a, b) {
      var f = function (t) {
        var ts = BK.ts(state, t.id);
        return BK.topicPoints(t.id) * WEAK[ts.status] + BK.daysBetween(ts.due, date) * 0.1;
      };
      return f(b) - f(a);
    });
    var cap = Math.max(budget * 0.5, 2), usedRev = 0, backlog = 0;
    due.forEach(function (t) {
      var tpl = BK.hasTemplates(t.id), m = tpl ? 2 : 10;
      if (usedRev + m <= cap || usedRev === 0) {
        add(tpl ? 'review' : 'material', t.id, m, '復習の期限です（' + BK.ts(state, t.id).due + '）');
        usedRev += m;
      } else backlog += m;
    });
    if (backlog > 0) notes.push('復習が約' + backlog + '分ぶん残っています。明日以降に回します。');

    // 3. 学習中の論点の続き
    var learning = BK.TOPICS.filter(function (t) {
      return BK.ts(state, t.id).status === '学習中' && BK.hasTemplates(t.id);
    });
    learning.filter(function (t) { return !inMenu(t.id); }).slice(0, 2).forEach(function (t) {
      if (used + 6 <= budget || used === 0) add('continue', t.id, 6, '基本問題がまだ安定していないため、続きを行います');
    });

    // 4. 新しい論点（進行ゲート）
    var next = BK.planOrder().filter(function (id) {
      var ts = BK.ts(state, id);
      return (ts.status === '未学習' || (ts.declared && !touched(state, id))) && !inMenu(id);
    });
    var cand = next.filter(function (id) { return prereqOK(state, id); })[0];
    if (!next.length) {
      notes.push('すべての論点に着手済みです。復習と演習を続けます。');
    } else if (backlog > budget * 0.5) {
      notes.push('復習がたまっているため、今日は新しい論点に進みません。');
    } else if (learning.length > 3) {
      notes.push('学習中の論点が' + learning.length + '個あるため、今日は新しい論点に進みません。');
    } else if (!cand) {
      notes.push('次の論点の前提となる論点がまだ「基本OK」になっていないため、新しい論点に進みません。');
    } else {
      var isTpl = BK.hasTemplates(cand), m = isTpl ? 6 : 15, declared = BK.ts(state, cand).declared;
      if (used + m <= budget || !items.some(function (x) { return !x.done && (x.type === 'continue' || x.type === 'new' || x.type === 'material'); })) {
        add(isTpl ? 'new' : 'material', cand, isTpl ? m : Math.max(10, Math.min(30, budget - used)),
          declared ? '学習済みと申告した範囲を、教材の問題で確認します' : '学習計画の次の論点です');
      } else notes.push('今日の時間では新しい論点に入りきらないため、明日以降に回します。');
    }

    // 時間が余っていれば、状態の弱い着手済み論点を追加で練習する
    var extra = BK.TOPICS.filter(function (t) {
      var ts = BK.ts(state, t.id);
      return BK.hasTemplates(t.id) && ts.status !== '未学習' && ts.status !== '理解済み' && !inMenu(t.id);
    }).sort(function (a, b) {
      return BK.topicPoints(b.id) * WEAK[BK.ts(state, b.id).status] - BK.topicPoints(a.id) * WEAK[BK.ts(state, a.id).status];
    });
    extra.forEach(function (t) {
      if (used + 4 <= budget) add('practice', t.id, 4, '時間に余裕があるため、まだ揃っていない証拠の問題を解きます');
    });

    return { date: date, budget: budget, items: items, notes: notes };
  };

  // ---------- 振り返りの集計 ----------
  BK.rangeSummary = function (state, from, to) {
    var at = state.attempts.filter(function (a) { return a.date >= from && a.date <= to; });
    var mt = state.materials.filter(function (m) { return m.date >= from && m.date <= to; });
    var causes = {};
    at.concat(mt).forEach(function (a) { if (!a.ok && a.cause) causes[a.cause] = (causes[a.cause] || 0) + 1; });
    var minutes = 0;
    Object.keys(state.sessions).forEach(function (d) { if (d >= from && d <= to) minutes += state.sessions[d]; });
    var ev = state.events.filter(function (e) { return e.date >= from && e.date <= to; });
    var up = [], down = [];
    ev.forEach(function (e) { (BK.rank(e.to) > BK.rank(e.from) ? up : down).push(e); });
    var top = Object.keys(causes).sort(function (a, b) { return causes[b] - causes[a]; })[0] || null;
    return {
      count: at.length + mt.length, correct: at.concat(mt).filter(function (a) { return a.ok; }).length,
      minutes: Math.round(minutes), causes: causes, topCause: top, up: up, down: down
    };
  };

  BK.statusCounts = function (state) {
    var c = {};
    BK.STATUSES.forEach(function (s) { c[s] = 0; });
    BK.TOPICS.forEach(function (t) { c[BK.ts(state, t.id).status]++; });
    return c;
  };

  // 推定得点。論点ごとの見込み正答率を配点に掛ける。あくまで推定。
  var BASE = { '未学習': 0, '学習中': 0.25, '基本OK': 0.5, '応用OK': 0.75, '理解済み': 0.9 };
  BK.estimate = function (state) {
    var out = { total: 0, sections: [] };
    BK.EXAM.sections.forEach(function (sec) {
      var ts = BK.TOPICS.filter(function (t) { return t.sec.indexOf(sec.id) >= 0; });
      var p = ts.reduce(function (s, t) {
        var recent = state.attempts.filter(function (a) { return a.topics.indexOf(t.id) >= 0 && a.level >= 3; }).slice(-5);
        var base = BASE[BK.ts(state, t.id).status];
        if (recent.length >= 3) {
          var acc = recent.filter(function (a) { return a.ok; }).length / recent.length;
          base = Math.min(base + 0.1, acc); // 実績が良くても状態から大きくは上振れさせない
        }
        return s + base;
      }, 0) / ts.length;
      var score = Math.round(sec.points * p);
      out.sections.push({ id: sec.id, name: sec.name, points: sec.points, score: score });
      out.total += score;
    });
    return out;
  };

  // 模試による合格到達状況（設計書10章）。延長15分以上の回は除く。
  BK.mockJudge = function (state) {
    var valid = state.mocks.filter(function (m) { return (m.ext || 0) < 15; }).slice(-3);
    if (valid.length < 3) return { label: '判定不能', why: '有効な模試が' + valid.length + '回です。判定には3回必要です。' };
    var tot = valid.map(function (m) { return BK.mockTotal(m); });
    var avg = tot.reduce(function (a, b) { return a + b; }, 0) / 3, min = Math.min.apply(null, tot);
    var why = '直近3回 ' + tot.join('・') + '点（平均' + avg.toFixed(1) + '点、最低' + min + '点）';
    if (avg >= 75 && min >= 70) return { label: '合格圏', why: why };
    if (avg >= 65) return { label: 'ボーダー', why: why };
    return { label: '未達', why: why };
  };
  BK.mockTotal = function (m) {
    return BK.EXAM.sections.reduce(function (s, sec) { return s + (m.scores[sec.id] || 0); }, 0);
  };

  // 次の1週間の優先事項（最大3つ、根拠の数値つき）
  BK.priorities = function (state, date) {
    var out = [], from = BK.addDays(date, -6), sum = BK.rangeSummary(state, from, date);
    var wrong = sum.count - sum.correct;
    if (sum.topCause && wrong >= 3 && sum.causes[sum.topCause] / wrong >= 0.4) {
      out.push('誤答原因「' + sum.topCause + '」への対策（今週の誤答' + wrong + '問中' + sum.causes[sum.topCause] + '問）。' + BK.CAUSE_ADVICE[sum.topCause]);
    }
    var overdue = BK.TOPICS.filter(function (t) { var ts = BK.ts(state, t.id); return ts.due && ts.due <= date; }).length;
    if (overdue >= 3) out.push('たまっている復習の消化（期限の来た論点が' + overdue + '個）');
    var est = BK.estimate(state).sections.slice().sort(function (a, b) { return a.score / a.points - b.score / b.points; })[0];
    var next = BK.planOrder().filter(function (id) { return BK.ts(state, id).status === '未学習'; }).slice(0, 2);
    if (next.length) out.push('新しい論点：' + next.map(function (id) { return BK.topic(id).name; }).join('、'));
    out.push('推定得点の比率が最も低い ' + est.name + '（推定' + est.score + '／' + est.points + '点）に関する論点');
    return out.slice(0, 3);
  };
})();
