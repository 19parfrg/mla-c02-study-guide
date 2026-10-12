/* MLA-C02 Study Quest — renderer, game engine, progress tracking (localStorage only) */
(function () {
  "use strict";
  var DAYS = window.STUDY_DAYS || [];
  var LS_KEY = "mla02.progress.v2";

  var CHAPTERS = { 1: "Data", 2: "Models", 3: "Deploy", 4: "Operate", 5: "Endgame" };
  var DOMAINS = [
    { id: 1, name: "Data Preparation", weight: 0.28 },
    { id: 2, name: "Model & FM Development", weight: 0.24 },
    { id: 3, name: "Deployment & Orchestration", weight: 0.24 },
    { id: 4, name: "Operate, Monitor, Secure", weight: 0.24 }
  ];
  var RANKS = [
    [0, "Cloud Rookie"], [300, "Data Wrangler"], [800, "Feature Smith"], [1500, "Model Trainer"],
    [2500, "Hyperparameter Tuner"], [3800, "Endpoint Deployer"], [5300, "Pipeline Architect"],
    [7000, "Drift Hunter"], [8500, "ML Engineer"]
  ];
  var XP = { task: 5, right: 20, wrong: 5, bossHit: 30, bossWin: 100, day: 50, mission: 40, card: 3, bounty: 30 };
  var DAILY_GOAL = 100;            // XP that makes a day count toward the streak
  var CARD_GAPS = [0, 1, 2, 4, 7, 14]; // Leitner box -> days until next review
  var BOUNTY_GAPS = [1, 3, 7];     // a missed question returns after 1, 3, then 7 days
  var MAX_FREEZES = 2;
  var SESSION_CARDS = 20;

  var SETUP = [
    "Sign in to your AWS account as an admin user, not root, with multi-factor authentication (MFA) on the root user",
    "Billing console → Budgets: create a $25 monthly cost budget with an email alert at 50% and 100%",
    "Install the AWS command line interface (CLI): `winget install Amazon.AWSCLI`, then reopen the terminal",
    "Run `aws configure sso` (or `aws configure`) and confirm `aws sts get-caller-identity` returns your account",
    "Pick one Region for every mission — `us-east-1` has the widest Bedrock model list",
    "Bedrock console → Model access: enable Amazon Nova and Titan Text Embeddings V2",
    "`pip install boto3 sagemaker scikit-learn xgboost pandas`",
    "Run `tools/aws-sweep.ps1` once so you know what a clean account looks like",
    "Book the exam (code ME1-C02 while in beta) and set the date in the countdown above"
  ];

  var ACHIEVEMENTS = [
    { id: "first", icon: "🎯", name: "First Blood", desc: "Answer a quiz question correctly", test: function (c) { return c.right >= 1; } },
    { id: "perfect", icon: "💎", name: "Flawless", desc: "Ace a daily quiz on the first try", test: function (c) { return c.perfectDays >= 1; } },
    { id: "basecamp", icon: "⛺", name: "Base Camp", desc: "Finish the AWS setup checklist", test: function (c) { return c.setupDone; } },
    { id: "labrat", icon: "🧪", name: "Lab Rat", desc: "Complete 5 hands-on missions", test: function (c) { return c.missions >= 5; } },
    { id: "cloudnative", icon: "☁️", name: "Cloud Native", desc: "Complete 12 AWS missions", test: function (c) { return c.awsMissions >= 12; } },
    { id: "streak3", icon: "🔥", name: "Warming Up", desc: "3-day streak", test: function (c) { return c.streak >= 3; } },
    { id: "streak7", icon: "🔥", name: "On Fire", desc: "7-day streak", test: function (c) { return c.streak >= 7; } },
    { id: "streak14", icon: "🌋", name: "Unstoppable", desc: "14-day streak", test: function (c) { return c.streak >= 14; } },
    { id: "boss1", icon: "🐍", name: "Hydra Slayer", desc: "Defeat the Chapter 1 boss", test: function (c) { return c.bosses >= 1; } },
    { id: "boss4", icon: "👑", name: "Boss Rush", desc: "Defeat all four bosses", test: function (c) { return c.bosses >= 4; } },
    { id: "hunter", icon: "🏹", name: "Bounty Hunter", desc: "Clear 10 bounties for good", test: function (c) { return c.redeemed >= 10; } },
    { id: "scholar", icon: "📚", name: "Card Shark", desc: "Recall 150 flashcards", test: function (c) { return c.cardsRight >= 150; } },
    { id: "halfway", icon: "⛰️", name: "Halfway", desc: "Complete 13 days", test: function (c) { return c.daysDone >= 13; } },
    { id: "ready", icon: "🚀", name: "Exam Ready", desc: "Reach 80% readiness", test: function (c) { return c.readiness >= 0.8; } }
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Inline markdown: [label](url), **bold**, `code` (safe: escaped first)
  function md(s) {
    return esc(s)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  // ---------- dates ----------
  function fmt(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return fmt(new Date()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function pretty(s) { return parse(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }

  // ---------- state ----------
  function blank() {
    return { days: {}, lastDay: 1, view: "hq", log: {}, cards: {}, bounty: {}, redeemed: {}, ach: {},
      setup: {}, examDate: "", freezes: 0, frozen: {}, freezeAt: 0, stats: { cardsRight: 0 } };
  }
  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(LS_KEY));
      if (p && p.days) {
        var b = blank();
        Object.keys(b).forEach(function (k) { if (p[k] === undefined) p[k] = b[k]; });
        return p;
      }
    } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch (e) {} }
  var progress = load();
  var current = progress.lastDay >= 1 && progress.lastDay <= DAYS.length ? progress.lastDay : 1;
  var view = progress.view || "hq";

  var content = document.getElementById("content");
  var nav = document.getElementById("dayNav");
  var toasts = document.getElementById("toasts");

  function st(n) {
    var s = progress.days[n];
    if (!s) s = progress.days[n] = {};
    ["tasks", "taskXp", "quiz", "boss", "bossXp", "missionXp"].forEach(function (k) { if (!s[k]) s[k] = {}; });
    return s;
  }

  // ---------- question bank ----------
  var QUESTIONS = {};
  DAYS.forEach(function (d) {
    (d.quiz || []).forEach(function (q, i) { QUESTIONS["d" + d.day + "q" + i] = { q: q, day: d.day, dom: q.dom || d.dom || 0 }; });
    if (d.boss) d.boss.quiz.forEach(function (q, i) { QUESTIONS["d" + d.day + "b" + i] = { q: q, day: d.day, dom: q.dom || d.dom || 0, boss: true }; });
  });
  function firstAnswer(id) {
    var m = /^d(\d+)([qb])(\d+)$/.exec(id), s = progress.days[m[1]];
    if (!s) return undefined;
    return (m[2] === "q" ? s.quiz : s.bossFirst || {})[m[3]];
  }

  // ---------- XP, ranks, streak ----------
  function totalXp() {
    var t = 0;
    Object.keys(progress.log).forEach(function (k) { t += progress.log[k]; });
    return t;
  }
  function rankOf(xp) {
    var i = 0;
    while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
    var next = RANKS[i + 1];
    return { level: i + 1, name: RANKS[i][1], floor: RANKS[i][0], next: next ? next[0] : null, nextName: next ? next[1] : null };
  }
  function counted(d) { return (progress.log[d] || 0) >= DAILY_GOAL || progress.frozen[d]; }
  function streak() {
    var d = today(), n = 0;
    if (!counted(d)) d = addDays(d, -1);
    while (counted(d)) { n++; d = addDays(d, -1); }
    return n;
  }
  // Spend freeze tokens on missed days between the last counted day and yesterday.
  function reconcileFreezes() {
    var days = Object.keys(progress.log).filter(counted).sort();
    if (!days.length) return;
    var d = addDays(days[days.length - 1], 1), t = today();
    while (d < t && progress.freezes > 0) {
      progress.frozen[d] = 1; progress.freezes--;
      d = addDays(d, 1);
    }
    save();
  }
  function toast(msg, cls) {
    if (!toasts) return;
    var el = document.createElement("div");
    el.className = "toast" + (cls ? " " + cls : "");
    el.textContent = msg;
    while (toasts.children.length >= 4) toasts.removeChild(toasts.firstChild);
    toasts.appendChild(el);
    setTimeout(function () { el.classList.add("out"); }, 2200);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2700);
  }
  function earn(n, why) {
    var before = rankOf(totalXp()), wasCounted = counted(today());
    progress.log[today()] = (progress.log[today()] || 0) + n;
    toast("+" + n + " XP · " + why);
    var after = rankOf(totalXp());
    if (after.level > before.level) toast("Rank up: " + after.name, "gold");
    if (!wasCounted && counted(today())) {
      var s = streak();
      toast("Daily goal hit — streak " + s + (s === 1 ? " day" : " days"), "gold");
      if (s > 0 && s % 7 === 0 && progress.freezeAt !== s && progress.freezes < MAX_FREEZES) {
        progress.freezes++; progress.freezeAt = s;
        toast("Streak freeze earned", "gold");
      }
    }
    checkAchievements();
    save();
    updateHeader();
  }

  // ---------- derived stats ----------
  function mastery() {
    var out = {};
    DOMAINS.forEach(function (d) { out[d.id] = { total: 0, got: 0, seen: 0 }; });
    Object.keys(QUESTIONS).forEach(function (id) {
      var Q = QUESTIONS[id], m = out[Q.dom];
      if (!m) return;
      m.total++;
      var a = firstAnswer(id);
      if (a === undefined) return;
      m.seen++;
      if (a === Q.q.answer || progress.redeemed[id]) m.got++;
    });
    return out;
  }
  function readiness() {
    var m = mastery(), r = 0;
    DOMAINS.forEach(function (d) { r += d.weight * (m[d.id].total ? m[d.id].got / m[d.id].total : 0); });
    return r;
  }
  function daysDone() { return DAYS.filter(function (d) { return progress.days[d.day] && progress.days[d.day].completed; }).length; }
  function nextDay() {
    for (var i = 0; i < DAYS.length; i++) if (!(progress.days[DAYS[i].day] && progress.days[DAYS[i].day].completed)) return DAYS[i].day;
    return DAYS.length;
  }
  function reached() {
    var m = 0;
    Object.keys(progress.days).forEach(function (n) {
      var s = progress.days[n];
      if (s.completed || Object.keys(s.tasks || {}).length || Object.keys(s.quiz || {}).length) m = Math.max(m, +n);
    });
    return m;
  }
  function dueBounties() {
    var t = today();
    return Object.keys(progress.bounty).filter(function (id) { return QUESTIONS[id] && progress.bounty[id].due <= t; });
  }
  function cardPool() {
    var max = reached(), seen = {}, pool = [];
    DAYS.forEach(function (d) {
      if (d.day > max) return;
      (d.keyTerms || []).forEach(function (t, i) {
        var k = t.term.toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
        pool.push({ id: "d" + d.day + "t" + i, term: t.term, def: t.def, day: d.day });
      });
    });
    return pool;
  }
  function dueCards() {
    var t = today();
    return cardPool().filter(function (c) { var s = progress.cards[c.id]; return !s || s.due <= t; });
  }
  function setupDone() { return SETUP.every(function (_, i) { return progress.setup[i]; }); }
  function counters() {
    var c = { right: 0, perfectDays: 0, missions: 0, awsMissions: 0, bosses: 0, daysDone: daysDone(), streak: streak(),
      redeemed: Object.keys(progress.redeemed).length, cardsRight: progress.stats.cardsRight, readiness: readiness(), setupDone: setupDone() };
    DAYS.forEach(function (d) {
      var s = progress.days[d.day];
      if (!s) return;
      var right = (d.quiz || []).filter(function (q, i) { return (s.quiz || {})[i] === q.answer; }).length;
      c.right += right;
      if (d.quiz && d.quiz.length && right === d.quiz.length) c.perfectDays++;
      (d.blocks || []).forEach(function (b, bi) {
        if (b.mission && (s.missionXp || {})[bi]) { c.missions++; if (b.aws) c.awsMissions++; }
      });
      if (s.bossWon) c.bosses++;
    });
    return c;
  }
  function checkAchievements() {
    var c = counters();
    ACHIEVEMENTS.forEach(function (a) {
      if (!progress.ach[a.id] && a.test(c)) {
        progress.ach[a.id] = today();
        toast(a.icon + " Achievement: " + a.name, "gold");
      }
    });
  }

  // ---------- chrome ----------
  function updateHeader() {
    var xp = totalXp(), r = rankOf(xp), s = streak();
    document.getElementById("rankName").textContent = "Lv " + r.level + " · " + r.name;
    document.getElementById("xpTotal").textContent = xp + " XP";
    document.getElementById("streakCount").textContent = "🔥 " + s;
    document.getElementById("streakCount").title = s + "-day streak · " + progress.freezes + " freeze" + (progress.freezes === 1 ? "" : "s") + " banked";
    document.getElementById("daysComplete").textContent = daysDone() + " / " + DAYS.length + " days";
    var span = r.next ? (xp - r.floor) / (r.next - r.floor) : 1;
    document.getElementById("progressFill").style.width = Math.round(span * 100) + "%";
    document.getElementById("tasksComplete").textContent = r.next ? (r.next - xp) + " XP to " + r.nextName : "Max rank";
  }

  function dayStatus(n) {
    var s = progress.days[n];
    if (s && s.completed) return "done";
    if (s && (Object.keys(s.tasks || {}).some(function (k) { return s.tasks[k]; }) || Object.keys(s.quiz || {}).length)) return "started";
    return "";
  }

  function renderNav() {
    var b = dueBounties().length, c = dueCards().length;
    var html = '<div class="hub-links">';
    html += '<button class="hub-link' + (view === "hq" ? " active" : "") + '" data-view="hq"><span>🏠 HQ</span></button>';
    html += '<button class="hub-link' + (view === "bounty" ? " active" : "") + '" data-view="bounty"><span>🏹 Bounty board</span>' + (b ? '<span class="pill">' + b + "</span>" : "") + "</button>";
    html += '<button class="hub-link' + (view === "cards" ? " active" : "") + '" data-view="cards"><span>🃏 Flashcards</span>' + (c ? '<span class="pill">' + c + "</span>" : "") + "</button>";
    html += "</div>";
    Object.keys(CHAPTERS).forEach(function (w) {
      var days = DAYS.filter(function (d) { return d.week === +w; });
      if (!days.length) return;
      var open = view !== "day" ? days.some(function (d) { return d.day === nextDay(); }) : days.some(function (d) { return d.day === current; });
      html += '<div class="week-group' + (open ? "" : " closed") + '" data-week="' + w + '">';
      html += '<button class="week-head" data-week-toggle="' + w + '"><span>Ch ' + w + " · " + CHAPTERS[w] + '</span><span class="chev">▾</span></button>';
      html += '<div class="week-days">';
      days.forEach(function (d) {
        html += '<button class="day-link' + (view === "day" && d.day === current ? " active" : "") + '" data-day="' + d.day + '">' +
          '<span class="day-num">' + d.day + "</span>" +
          '<span class="day-title-sm">' + (d.boss ? "⚔️ " : "") + esc(d.title) + "</span>" +
          '<span class="dot ' + dayStatus(d.day) + '"></span></button>';
      });
      html += "</div></div>";
    });
    nav.innerHTML = html;
  }

  function show(v, n) {
    view = v; progress.view = v;
    if (n) { current = n; progress.lastDay = n; }
    save();
    if (v === "day") renderDay(current);
    else if (v === "bounty") renderBounty();
    else if (v === "cards") renderCards();
    else renderHQ();
    renderNav(); updateHeader();
    window.scrollTo({ top: 0 });
  }
  // Re-render in place after an answer or checkbox, keeping the scroll position.
  function refresh() {
    var y = window.scrollY;
    if (view === "day") renderDay(current); else if (view === "bounty") renderBounty(); else if (view === "cards") renderCards(); else renderHQ();
    renderNav(); updateHeader();
    window.scrollTo(0, y);
  }

  // ---------- shared question renderer ----------
  var LETTERS = ["A", "B", "C", "D", "E", "F"];
  function questionHtml(q, num, answered, attrs, order) {
    var h = '<div class="q"><div class="q-text">' + (num ? num + ". " : "") + md(q.q) + '</div><div class="q-opts">';
    (order || q.options.map(function (_, i) { return i; })).forEach(function (oi, pos) {
      var cls = "";
      if (answered !== undefined) {
        if (oi === q.answer) cls = " correct"; else if (oi === answered) cls = " wrong";
      }
      h += '<button class="q-opt' + cls + '"' + (answered !== undefined ? " disabled" : "") + " " + attrs + ' data-o="' + oi + '"><span class="opt-key">' + LETTERS[pos] + "</span><span>" + md(q.options[oi]) + "</span></button>";
    });
    h += "</div>";
    h += '<div class="q-why' + (answered !== undefined ? " show" : "") + '"><strong>Why:</strong> ' + md(q.why) + "</div></div>";
    return h;
  }

  // ---------- HQ ----------
  function renderHQ() {
    var xp = totalXp(), r = rankOf(xp), s = streak(), m = mastery(), ready = readiness();
    var nd = nextDay(), d = DAYS[nd - 1], left = DAYS.length - daysDone();
    var todayXp = progress.log[today()] || 0;
    var h = '<div class="eyebrow">Headquarters</div><h1 class="day-title">MLA-C02 Study Quest</h1>';

    h += '<div class="hq-grid">';
    h += '<div class="stat"><div class="stat-k">Rank</div><div class="stat-v">Lv ' + r.level + '</div><div class="stat-s">' + esc(r.name) + "</div></div>";
    h += '<div class="stat"><div class="stat-k">Streak</div><div class="stat-v">🔥 ' + s + '</div><div class="stat-s">' + progress.freezes + " freeze" + (progress.freezes === 1 ? "" : "s") + " banked</div></div>";
    h += '<div class="stat"><div class="stat-k">Today</div><div class="stat-v">' + todayXp + ' XP</div><div class="stat-s">' + (todayXp >= DAILY_GOAL ? "Daily goal hit ✓" : (DAILY_GOAL - todayXp) + " XP to keep the streak") + "</div></div>";
    h += '<div class="stat"><div class="stat-k">Readiness</div><div class="stat-v">' + Math.round(ready * 100) + '%</div><div class="stat-s">weighted by exam domain</div></div>';
    h += "</div>";

    // countdown + pace
    var finish = addDays(today(), Math.max(left - 1, 0));
    h += '<div class="panel"><div class="panel-row"><div><div class="panel-title">Exam countdown</div>';
    if (progress.examDate) {
      var until = daysBetween(today(), progress.examDate);
      h += '<div class="panel-big">' + (until > 0 ? until + (until === 1 ? " day" : " days") + " to go" : until === 0 ? "Exam day. Go get it." : "Exam date has passed") + "</div>";
      var slack = daysBetween(finish, progress.examDate) - 1;
      if (until > 0 && left > 0) {
        h += '<div class="panel-sub">' + left + " study days left · at one a day you finish " + pretty(finish) + " · " +
          (slack >= 0 ? slack + " spare day" + (slack === 1 ? "" : "s") : '<span class="bad">' + (-slack) + " day" + (slack === -1 ? "" : "s") + " short — double up or move the exam</span>") + "</div>";
      }
    } else {
      h += '<div class="panel-big">No exam date set</div><div class="panel-sub">At one study day per day you finish ' + pretty(finish) + ". Book for a day or two after that.</div>";
    }
    h += '</div><label class="date-pick">Exam date <input type="date" id="examDate" value="' + esc(progress.examDate) + '"></label></div></div>';

    // today's quest
    h += '<h2 class="section"><span class="sec-num">▶</span>Today\'s quest</h2>';
    var bn = dueBounties().length, cn = Math.min(dueCards().length, SESSION_CARDS);
    h += '<div class="quest-list">';
    h += '<button class="quest" data-view="bounty"' + (bn ? "" : " disabled") + '><span class="quest-ico">🏹</span><span><span class="quest-t">Bounty board</span><span class="quest-s">' + (bn ? bn + " missed question" + (bn === 1 ? "" : "s") + " back for a rematch · +" + XP.bounty + " XP each" : "Nothing due — missed questions return here") + "</span></span></button>";
    h += '<button class="quest" data-view="cards"' + (cn ? "" : " disabled") + '><span class="quest-ico">🃏</span><span><span class="quest-t">Flashcards</span><span class="quest-s">' + (cn ? cn + " card" + (cn === 1 ? "" : "s") + " due · +" + XP.card + " XP each" : "No cards due — they unlock as you reach each day") + "</span></span></button>";
    if (left > 0) {
      h += '<button class="quest main" data-day="' + nd + '"><span class="quest-ico">' + (d.boss ? "⚔️" : "📘") + '</span><span><span class="quest-t">Day ' + nd + " · " + esc(d.title) + '</span><span class="quest-s">Ch ' + d.week + " · " + esc(CHAPTERS[d.week]) + " · " +
        d.blocks.map(function (b) { return b.time; }).join(" + ") + (d.boss ? " · boss: " + esc(d.boss.name) : "") + "</span></span></button>";
    } else {
      h += '<div class="quest main"><span class="quest-ico">🏁</span><span><span class="quest-t">All " + DAYS.length + " days complete</span><span class="quest-s">Keep the bounty board empty until exam day.</span></span></div>';
    }
    h += "</div>";

    // mastery
    h += '<h2 class="section"><span class="sec-num">◆</span>Domain mastery</h2><div class="panel">';
    DOMAINS.forEach(function (dm) {
      var x = m[dm.id], pct = x.total ? Math.round(x.got / x.total * 100) : 0;
      var acc = x.seen ? Math.round(x.got / x.seen * 100) : null;
      h += '<div class="mastery"><div class="mastery-head"><span>D' + dm.id + " · " + esc(dm.name) + ' <span class="faint">' + Math.round(dm.weight * 100) + "% of exam</span></span><span>" +
        (acc === null ? "not started" : acc + "% accuracy · " + x.seen + "/" + x.total + " seen") + "</span></div>" +
        '<div class="bar"><div class="bar-fill' + (acc !== null && acc < 70 ? " low" : "") + '" style="width:' + pct + '%"></div></div></div>';
    });
    h += '<div class="panel-sub">Bars fill as you answer correctly the first time or clear the bounty. Readiness tracks this question bank, not a predicted exam score.</div></div>';

    // base camp
    var doneSetup = SETUP.filter(function (_, i) { return progress.setup[i]; }).length;
    h += '<h2 class="section"><span class="sec-num">⛺</span>Base camp — AWS setup <span class="faint">' + doneSetup + "/" + SETUP.length + "</span></h2>";
    h += '<div class="block"><ul class="block-steps">';
    SETUP.forEach(function (step, i) {
      h += '<li><input type="checkbox" class="task-check" data-setup="' + i + '"' + (progress.setup[i] ? " checked" : "") + '><span class="task-text">' + md(step) + "</span></li>";
    });
    h += "</ul></div>";

    // achievements
    h += '<h2 class="section"><span class="sec-num">★</span>Achievements <span class="faint">' + Object.keys(progress.ach).length + "/" + ACHIEVEMENTS.length + "</span></h2><div class=\"ach-grid\">";
    ACHIEVEMENTS.forEach(function (a) {
      var got = progress.ach[a.id];
      h += '<div class="ach' + (got ? " got" : "") + '"><div class="ach-ico">' + (got ? a.icon : "🔒") + '</div><div><div class="ach-name">' + esc(a.name) + '</div><div class="ach-desc">' + esc(a.desc) + "</div></div></div>";
    });
    h += "</div>";

    h += '<div class="panel rules"><div class="panel-title">How scoring works</div><ul>' +
      "<li>Checklist step +" + XP.task + " · quiz right +" + XP.right + " / wrong +" + XP.wrong + " · mission complete +" + XP.mission + " · day complete +" + XP.day + "</li>" +
      "<li>Boss hit +" + XP.bossHit + ", victory (80%) +" + XP.bossWin + " · bounty cleared +" + XP.bounty + " · flashcard recalled +" + XP.card + "</li>" +
      "<li>" + DAILY_GOAL + " XP in a day keeps the streak. Every 7-day streak banks a freeze (max " + MAX_FREEZES + ") that covers one missed day.</li></ul></div>";

    content.innerHTML = h;
  }

  // ---------- day ----------
  function taskKey(b, s) { return "b" + b + "s" + s; }

  function renderDay(n) {
    var d = DAYS[n - 1];
    if (!d) { content.innerHTML = '<div class="empty">Day not found.</div>'; return; }
    var s = st(n);
    var h = "";

    h += '<div class="eyebrow">Day ' + d.day + " · Chapter " + d.week + " · " + esc(CHAPTERS[d.week] || "") + "</div>";
    h += '<h1 class="day-title">' + esc(d.title) + "</h1>";
    h += '<div class="badges">';
    if (d.domain) h += '<span class="badge">' + esc(d.domain) + "</span>";
    if (d.isNew) h += '<span class="badge review">New in MLA-C02</span>';
    if (d.boss) h += '<span class="badge checkpoint">Boss fight</span>';
    if (d.isCheckpoint) h += '<span class="badge checkpoint">Checkpoint</span>';
    if (d.isLight) h += '<span class="badge">Light day</span>';
    h += "</div>";

    if (d.objectives && d.objectives.length) {
      h += '<div class="objectives"><h3>Today\'s objectives</h3><ul>';
      d.objectives.forEach(function (o) { h += "<li>" + md(o) + "</li>"; });
      h += "</ul></div>";
    }

    h += '<h2 class="section"><span class="sec-num">01</span>The plan</h2>';
    (d.blocks || []).forEach(function (b, bi) {
      var cleared = b.mission && s.missionXp[bi];
      h += '<div class="block' + (b.mission ? " mission" : "") + (cleared ? " cleared" : "") + '"><div class="block-head"><span class="time-pill">' + esc(b.time) + '</span><span class="block-label">' + esc(b.label) + "</span>";
      if (b.aws) h += '<span class="tag aws">AWS</span>';
      if (b.cost) h += '<span class="tag">' + esc(b.cost) + "</span>";
      if (b.mission) h += '<span class="tag xp">' + (cleared ? "✓ cleared" : "+" + XP.mission + " XP") + "</span>";
      h += "</div>";
      h += '<ul class="block-steps">';
      (b.steps || []).forEach(function (step, si) {
        var checked = s.tasks[taskKey(bi, si)] ? " checked" : "";
        h += '<li><input type="checkbox" class="task-check" data-b="' + bi + '" data-s="' + si + '"' + checked + '><span class="task-text">' + md(step) + "</span></li>";
      });
      h += "</ul>";
      if (b.code) {
        h += '<div class="code-wrap"><div class="code-head"><span>' + esc(b.codeLang || "python") + '</span><button class="copy-btn" data-copy>Copy</button></div><pre><code>' + esc(b.code) + "</code></pre></div>";
      }
      h += "</div>";
    });

    if (d.notes && d.notes.length) {
      h += '<h2 class="section"><span class="sec-num">02</span>Key notes</h2>';
      d.notes.forEach(function (sec) {
        h += '<div class="note-sec"><h4>' + esc(sec.heading) + "</h4><ul>";
        (sec.points || []).forEach(function (p) { h += "<li>" + md(p) + "</li>"; });
        h += "</ul></div>";
      });
    }

    if (d.keyTerms && d.keyTerms.length) {
      h += '<h2 class="section"><span class="sec-num">03</span>Key terms</h2><dl class="terms">';
      d.keyTerms.forEach(function (t) {
        h += '<div class="term"><dt>' + esc(t.term) + "</dt><dd>" + md(t.def) + "</dd></div>";
      });
      h += "</dl>";
    }

    if (d.resources && d.resources.length) {
      h += '<h2 class="section"><span class="sec-num">04</span>Resources</h2><div class="res-grid">';
      d.resources.forEach(function (r) {
        h += '<a class="res-card" href="' + esc(r.url) + '" target="_blank" rel="noopener">' +
          '<div class="res-label">' + esc(r.label) + "</div>" +
          (r.note ? '<div class="res-note">' + esc(r.note) + "</div>" : "") +
          '<div class="res-ext">Open ↗</div></a>';
      });
      h += "</div>";
    }

    if (d.quiz && d.quiz.length) {
      var right = 0, answered = 0;
      d.quiz.forEach(function (q, qi) { if (s.quiz[qi] !== undefined) { answered++; if (s.quiz[qi] === q.answer) right++; } });
      h += '<h2 class="section"><span class="sec-num">05</span>Quiz</h2>';
      h += '<div class="quiz-head"><span class="hint">Answer from memory. Right +' + XP.right + " XP; a miss goes to the bounty board.</span><span class=\"quiz-score\">Quiz: " + right + "/" + d.quiz.length + " (" + answered + " answered)</span></div>";
      d.quiz.forEach(function (q, qi) { h += questionHtml(q, qi + 1, s.quiz[qi], 'data-kind="quiz" data-q="' + qi + '"'); });
    }

    if (d.boss) h += bossHtml(d, s);

    h += '<div class="day-foot">';
    h += '<button class="btn primary' + (s.completed ? " done" : "") + '" id="markDone">' + (s.completed ? "✓ Day complete" : "Mark day complete · +" + XP.day + " XP") + "</button>";
    var remaining = (d.blocks || []).reduce(function (acc, b, bi) {
      return acc + (/^bonus/i.test(b.time) ? 0 : (b.steps || []).filter(function (_, si) { return !s.tasks[taskKey(bi, si)]; }).length);
    }, 0);
    var unanswered = (d.quiz || []).filter(function (_, qi) { return s.quiz[qi] === undefined; }).length;
    if (!s.completed && (remaining || unanswered)) {
      h += '<span class="day-hint">' + remaining + " tasks and " + unanswered + " quiz questions remaining — or mark complete when you're done for real.</span>";
    }
    h += '<div class="pager" style="width:100%">';
    h += '<button class="btn" id="prevBtn"' + (n <= 1 ? " disabled" : "") + ">← Previous day</button>";
    h += '<button class="btn" id="nextBtn"' + (n >= DAYS.length ? " disabled" : "") + ">Next day →</button>";
    h += "</div></div>";

    content.innerHTML = h;
  }

  function bossHtml(d, s) {
    var qs = d.boss.quiz, total = qs.length, hits = 0, answered = 0;
    qs.forEach(function (q, i) { if (s.boss[i] !== undefined) { answered++; if (s.boss[i] === q.answer) hits++; } });
    var need = Math.ceil(total * 0.8), over = answered === total, won = hits >= need;
    var h = '<h2 class="section"><span class="sec-num">⚔️</span>Boss fight</h2>';
    h += '<div class="boss' + (s.bossWon ? " won" : "") + '"><div class="boss-name">' + esc(d.boss.name) + (s.bossWon ? " — defeated" : "") + '</div><div class="boss-intro">' + esc(d.boss.intro) + "</div>";
    h += '<div class="boss-hp"><div class="boss-hp-fill" style="width:' + Math.round((1 - Math.min(hits / need, 1)) * 100) + '%"></div></div>';
    h += '<div class="boss-stat">' + hits + " / " + need + " hits needed · " + (total - answered) + " questions left</div>";
    if (over) {
      h += '<div class="boss-result ' + (won ? "win" : "lose") + '">' + (won ? "Victory. " + hits + "/" + total + "." : "It survived with " + hits + "/" + total + ". Misses are on the bounty board — review and rematch.") +
        ' <button class="btn" id="bossRematch">Rematch</button></div>';
    }
    h += "</div>";
    qs.forEach(function (q, i) { h += questionHtml(q, i + 1, s.boss[i], 'data-kind="boss" data-q="' + i + '"'); });
    return h;
  }

  // ---------- bounty board ----------
  var bountyDone = {};   // id -> picked option, for bounties answered in this sitting
  var bountyOrder = {};
  function shuffled(n) {
    var a = [], i, j, t;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function renderBounty() {
    var due = dueBounties(), shown = Object.keys(bountyDone).concat(due.filter(function (id) { return bountyDone[id] === undefined; }));
    var waiting = Object.keys(progress.bounty).length - due.length;
    var h = '<div class="eyebrow">Spaced repetition</div><h1 class="day-title">Bounty board</h1>';
    h += '<p class="lede">Every question you miss comes back after ' + BOUNTY_GAPS.join(", ") + " days. Answer it right three times in a row and it is cleared for good. A miss resets it. Options are shuffled each time.</p>";
    h += '<div class="hq-grid three"><div class="stat"><div class="stat-k">Due now</div><div class="stat-v">' + due.length + '</div></div><div class="stat"><div class="stat-k">Waiting</div><div class="stat-v">' + waiting + '</div></div><div class="stat"><div class="stat-k">Cleared for good</div><div class="stat-v">' + Object.keys(progress.redeemed).length + "</div></div></div>";
    if (!shown.length) h += '<div class="empty"><h2>Board is clear</h2><p>' + (waiting ? "Next bounty returns " + pretty(Object.keys(progress.bounty).map(function (id) { return progress.bounty[id].due; }).sort()[0]) + "." : "Miss a quiz question and it lands here.") + "</p></div>";
    shown.forEach(function (id) {
      var Q = QUESTIONS[id];
      if (!bountyOrder[id]) bountyOrder[id] = shuffled(Q.q.options.length);
      h += '<div class="bounty-tag">Day ' + Q.day + (Q.boss ? " boss" : "") + " · " + esc(DAYS[Q.day - 1].title) + "</div>";
      h += questionHtml(Q.q, 0, bountyDone[id], 'data-kind="bounty" data-id="' + id + '"', bountyOrder[id]);
    });
    content.innerHTML = h;
  }

  // ---------- flashcards ----------
  var deck = null, deckPos = 0, deckShown = false, deckRight = 0;
  function renderCards() {
    var pool = cardPool();
    if (!deck) { deck = dueCards().slice(0, SESSION_CARDS); deckPos = 0; deckShown = false; deckRight = 0; }
    var h = '<div class="eyebrow">Spaced repetition</div><h1 class="day-title">Flashcards</h1>';
    h += '<p class="lede">Say the definition out loud before you flip. Cards unlock as you reach each day and come back on a widening schedule.</p>';
    if (!pool.length) {
      h += '<div class="empty"><h2>No cards yet</h2><p>Start Day 1 and its key terms unlock here.</p></div>';
    } else if (deckPos >= deck.length) {
      var more = dueCards().length;
      h += '<div class="empty"><h2>' + (deck.length ? "Session done: " + deckRight + "/" + deck.length + " recalled" : "No cards due") + "</h2><p>" + pool.length + " cards unlocked · " + more + " still due.</p>" +
        (more ? '<button class="btn primary" id="cardsMore">Another round</button>' : "") + "</div>";
    } else {
      var c = deck[deckPos];
      h += '<div class="card-count">Card ' + (deckPos + 1) + " of " + deck.length + " · from Day " + c.day + "</div>";
      h += '<div class="flash"><div class="flash-term">' + esc(c.term) + "</div>" + (deckShown ? '<div class="flash-def">' + md(c.def) + "</div>" : "") + "</div>";
      h += '<div class="flash-btns">' + (deckShown
        ? '<button class="btn" id="cardMiss">Missed it <kbd>1</kbd></button><button class="btn primary" id="cardGot">Got it · +' + XP.card + " XP <kbd>2</kbd></button>"
        : '<button class="btn primary" id="cardFlip">Flip <kbd>Space</kbd></button>') + "</div>";
    }
    content.innerHTML = h;
  }
  function gradeCard(got) {
    var c = deck[deckPos], s = progress.cards[c.id] || { box: 0 };
    s.box = got ? Math.min(s.box + 1, CARD_GAPS.length - 1) : 1;
    s.due = addDays(today(), got ? CARD_GAPS[s.box] : 1);
    progress.cards[c.id] = s;
    if (got) { deckRight++; progress.stats.cardsRight++; }
    deckPos++; deckShown = false;
    save();
    if (got) earn(XP.card, "recalled " + c.term);
    refresh();
  }

  // ---------- events (delegated) ----------
  function missBounty(id) { progress.bounty[id] = { due: addDays(today(), BOUNTY_GAPS[0]), stage: 0 }; }

  content.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "examDate") { progress.examDate = t.value; save(); refresh(); return; }
    if (!t.classList || !t.classList.contains("task-check")) return;
    if (t.dataset.setup !== undefined) {
      progress.setup[t.dataset.setup] = t.checked;
      if (t.checked && !progress.setupXp) progress.setupXp = {};
      if (t.checked && !progress.setupXp[t.dataset.setup]) { progress.setupXp[t.dataset.setup] = 1; earn(XP.task, "base camp"); }
      checkAchievements(); save(); refresh();
      return;
    }
    var s = st(current), d = DAYS[current - 1], bi = +t.dataset.b, k = taskKey(bi, +t.dataset.s);
    s.tasks[k] = t.checked;
    save();
    if (t.checked && !s.taskXp[k]) { s.taskXp[k] = 1; earn(XP.task, "step done"); }
    var b = d.blocks[bi];
    if (b.mission && !s.missionXp[bi] && b.steps.every(function (_, si) { return s.tasks[taskKey(bi, si)]; })) {
      s.missionXp[bi] = 1;
      earn(XP.mission, b.aws ? "AWS mission cleared" : "lab cleared");
    }
    refresh();
  });

  content.addEventListener("click", function (e) {
    var t = e.target;
    var opt = t.closest ? t.closest(".q-opt") : null;
    if (opt && !opt.disabled) {
      var kind = opt.dataset.kind, oi = +opt.dataset.o, s = st(current), d = DAYS[current - 1], qi = +opt.dataset.q, id, ok;
      if (kind === "quiz") {
        if (s.quiz[qi] !== undefined) return;
        s.quiz[qi] = oi; ok = oi === d.quiz[qi].answer;
        if (!ok) missBounty("d" + current + "q" + qi);
        save();
        earn(ok ? XP.right : XP.wrong, ok ? "correct" : "missed — sent to bounty board");
      } else if (kind === "boss") {
        if (s.boss[qi] !== undefined) return;
        s.boss[qi] = oi; ok = oi === d.boss.quiz[qi].answer; id = "d" + current + "b" + qi;
        if (!s.bossFirst) s.bossFirst = {};
        if (s.bossFirst[qi] === undefined) { s.bossFirst[qi] = oi; if (!ok) missBounty(id); }
        save();
        if (ok && !s.bossXp[qi]) { s.bossXp[qi] = 1; earn(XP.bossHit, "boss hit"); }
        var total = d.boss.quiz.length, hits = d.boss.quiz.filter(function (q, i) { return s.boss[i] === q.answer; }).length;
        if (!s.bossWon && Object.keys(s.boss).length === total && hits >= Math.ceil(total * 0.8)) {
          s.bossWon = today(); save();
          earn(XP.bossWin, d.boss.name + " defeated");
        }
      } else if (kind === "bounty") {
        id = opt.dataset.id;
        var Q = QUESTIONS[id], bt = progress.bounty[id];
        if (!bt || bountyDone[id] !== undefined) return;
        bountyDone[id] = oi; ok = oi === Q.q.answer;
        if (ok) {
          bt.stage++;
          if (bt.stage >= BOUNTY_GAPS.length) { delete progress.bounty[id]; progress.redeemed[id] = today(); }
          else bt.due = addDays(today(), BOUNTY_GAPS[bt.stage]);
        } else { missBounty(id); }
        save();
        if (ok) earn(XP.bounty, progress.redeemed[id] ? "bounty cleared for good" : "bounty hit " + bt.stage + "/" + BOUNTY_GAPS.length);
        else toast("Missed — back tomorrow", "bad");
      }
      refresh();
      return;
    }
    if (t.closest && t.closest("[data-copy]")) {
      var code = t.closest(".code-wrap").querySelector("code").innerText;
      var btn = t.closest("[data-copy]");
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function () {
          btn.textContent = "Copied ✓";
          setTimeout(function () { btn.textContent = "Copy"; }, 1500);
        });
      }
      return;
    }
    var q = t.closest ? t.closest(".quest") : null;
    if (q && !q.disabled) {
      if (q.dataset.day) show("day", +q.dataset.day);
      else if (q.dataset.view) openView(q.dataset.view);
      return;
    }
    if (t.id === "markDone") {
      var s2 = st(current);
      s2.completed = !s2.completed; save();
      if (s2.completed && !s2.dayXp) { s2.dayXp = 1; earn(XP.day, "Day " + current + " complete"); }
      checkAchievements(); save(); refresh();
      return;
    }
    if (t.id === "bossRematch") { st(current).boss = {}; save(); refresh(); return; }
    if (t.id === "prevBtn" && current > 1) { show("day", current - 1); return; }
    if (t.id === "nextBtn" && current < DAYS.length) { show("day", current + 1); return; }
    if (t.id === "cardFlip") { deckShown = true; refresh(); return; }
    if (t.id === "cardGot") { gradeCard(true); return; }
    if (t.id === "cardMiss") { gradeCard(false); return; }
    if (t.id === "cardsMore") { deck = null; refresh(); return; }
  });

  function openView(v) {
    if (v === "bounty") { bountyDone = {}; bountyOrder = {}; }
    if (v === "cards") deck = null;
    show(v);
  }

  nav.addEventListener("click", function (e) {
    var t = e.target;
    var wg = t.closest ? t.closest("[data-week-toggle]") : null;
    if (wg) { wg.closest(".week-group").classList.toggle("closed"); return; }
    var hv = t.closest ? t.closest("[data-view]") : null;
    if (hv) { openView(hv.dataset.view); document.body.classList.remove("nav-open"); return; }
    var dl = t.closest ? t.closest("[data-day]") : null;
    if (dl) { show("day", +dl.dataset.day); document.body.classList.remove("nav-open"); }
  });

  document.getElementById("navToggle").addEventListener("click", function () {
    document.body.classList.toggle("nav-open");
  });
  document.getElementById("brandHome").addEventListener("click", function () { openView("hq"); });
  document.getElementById("resetProgress").addEventListener("click", function () {
    if (confirm("Reset all progress? This clears XP, streak, every checkbox, quiz answer, bounty, and flashcard.")) {
      progress = blank(); current = 1; deck = null; bountyDone = {};
      save(); show("hq");
    }
  });
  document.addEventListener("keydown", function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ""))) return;
    if (view === "day") {
      if (e.key === "ArrowRight" && current < DAYS.length) show("day", current + 1);
      else if (e.key === "ArrowLeft" && current > 1) show("day", current - 1);
    } else if (view === "cards" && deck && deckPos < deck.length) {
      if (!deckShown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); deckShown = true; refresh(); }
      else if (deckShown && e.key === "1") gradeCard(false);
      else if (deckShown && e.key === "2") gradeCard(true);
    }
  });

  // init
  if (!DAYS.length) {
    content.innerHTML = '<div class="empty"><h2>Content failed to load</h2><p>The data-N.js files are missing or empty. Run <code>python tools/build.py</code>.</p></div>';
  } else {
    reconcileFreezes();
    show(view === "day" ? "day" : "hq");
  }
})();
