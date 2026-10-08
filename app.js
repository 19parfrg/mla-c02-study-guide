/* MLA-C02 Study Guide — interactive renderer + progress tracking (localStorage only) */
(function () {
  "use strict";
  var DAYS = window.STUDY_DAYS || [];
  var LS_KEY = "mla02.progress.v1";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Inline code spans: `code` -> <code>code</code> (safe: escaped first)
  function md(s) {
    return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(LS_KEY));
      if (p && p.days) return p;
    } catch (e) {}
    return { days: {}, lastDay: 1 };
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch (e) {} }
  var progress = load();
  var current = progress.lastDay >= 1 && progress.lastDay <= DAYS.length ? progress.lastDay : 1;

  var content = document.getElementById("content");
  var nav = document.getElementById("dayNav");

  function st(n) {
    if (!progress.days[n]) progress.days[n] = { tasks: {}, quiz: {}, completed: false };
    return progress.days[n];
  }
  function totalTasks() {
    var t = 0;
    DAYS.forEach(function (d) { (d.blocks || []).forEach(function (b) { t += (b.steps || []).length; }); });
    return t;
  }
  function doneTasks() {
    var t = 0;
    Object.keys(progress.days).forEach(function (n) {
      var tasks = progress.days[n].tasks || {};
      Object.keys(tasks).forEach(function (k) { if (tasks[k]) t++; });
    });
    return t;
  }
  function daysDone() { return DAYS.filter(function (d) { return progress.days[d.day] && progress.days[d.day].completed; }).length; }

  function updateHeader() {
    document.getElementById("daysComplete").textContent = daysDone() + " / " + DAYS.length + " days";
    document.getElementById("tasksComplete").textContent = doneTasks() + " of " + totalTasks() + " tasks";
    document.getElementById("progressFill").style.width = (DAYS.length ? (daysDone() / DAYS.length * 100) : 0) + "%";
  }

  function dayStatus(n) {
    var s = progress.days[n];
    if (s && s.completed) return "done";
    if (s && (Object.keys(s.tasks || {}).some(function (k) { return s.tasks[k]; }) || Object.keys(s.quiz || {}).length)) return "started";
    return "";
  }

  function renderNav() {
    var html = "";
    for (var w = 1; w <= 6; w++) {
      var days = DAYS.filter(function (d) { return d.week === w; });
      if (!days.length) continue;
      var open = days.some(function (d) { return d.day === current; });
      html += '<div class="week-group' + (open ? "" : " closed") + '" data-week="' + w + '">';
      html += '<button class="week-head" data-week-toggle="' + w + '"><span>Week ' + w + '</span><span class="chev">▾</span></button>';
      html += '<div class="week-days">';
      days.forEach(function (d) {
        var status = dayStatus(d.day);
        html += '<button class="day-link' + (d.day === current ? " active" : "") + '" data-day="' + d.day + '">' +
          '<span class="day-num">' + d.day + '</span>' +
          '<span class="day-title-sm">' + esc(d.title) + '</span>' +
          '<span class="dot ' + status + '"></span></button>';
      });
      html += "</div></div>";
    }
    nav.innerHTML = html;
  }

  function taskKey(day, b, s) { return "b" + b + "s" + s; }

  function renderDay(n) {
    var d = DAYS[n - 1];
    if (!d) { content.innerHTML = '<div class="empty">Day not found.</div>'; return; }
    current = n;
    progress.lastDay = n; save();
    var s = st(n);
    var h = "";

    h += '<div class="eyebrow">Day ' + d.day + ' · Week ' + d.week + '</div>';
    h += '<h1 class="day-title">' + esc(d.title) + '</h1>';
    h += '<div class="badges">';
    if (d.domain) h += '<span class="badge">' + esc(d.domain) + '</span>';
    if (d.isReview) h += '<span class="badge review">Review day</span>';
    if (d.isCheckpoint) h += '<span class="badge checkpoint">Checkpoint</span>';
    h += "</div>";

    if (d.objectives && d.objectives.length) {
      h += '<div class="objectives"><h3>Today\'s objectives</h3><ul>';
      d.objectives.forEach(function (o) { h += "<li>" + md(o) + "</li>"; });
      h += "</ul></div>";
    }

    h += '<h2 class="section"><span class="sec-num">01</span>The plan</h2>';
    (d.blocks || []).forEach(function (b, bi) {
      h += '<div class="block"><div class="block-head"><span class="time-pill">' + esc(b.time) + '</span><span class="block-label">' + esc(b.label) + "</span></div>";
      h += '<ul class="block-steps">';
      (b.steps || []).forEach(function (step, si) {
        var k = taskKey(n, bi, si);
        var checked = s.tasks[k] ? " checked" : "";
        h += '<li><input type="checkbox" class="task-check" data-day="' + n + '" data-b="' + bi + '" data-s="' + si + '"' + checked + '><span class="task-text">' + md(step) + "</span></li>";
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
      h += '<h2 class="section"><span class="sec-num">05</span>Quiz</h2>';
      h += '<div class="quiz-head"><span style="color:var(--muted);font-size:13.5px">Answer from memory — click an option to check.</span><span class="quiz-score" id="quizScore"></span></div>';
      d.quiz.forEach(function (q, qi) {
        var answered = s.quiz[qi];
        h += '<div class="q" data-q="' + qi + '"><div class="q-text">' + (qi + 1) + ". " + md(q.q) + "</div><div class='q-opts'>";
        var letters = ["A", "B", "C", "D", "E", "F"];
        q.options.forEach(function (opt, oi) {
          var cls = "";
          if (answered !== undefined) {
            if (oi === q.answer) cls = " correct";
            else if (oi === answered) cls = " wrong";
          }
          var dis = answered !== undefined ? " disabled" : "";
          h += '<button class="q-opt' + cls + '"' + dis + ' data-day="' + n + '" data-q="' + qi + '" data-o="' + oi + '"><span class="opt-key">' + letters[oi] + '</span><span>' + md(opt) + "</span></button>";
        });
        h += "</div>";
        var showWhy = answered !== undefined ? " show" : "";
        h += '<div class="q-why' + showWhy + '"><strong>Why:</strong> ' + md(q.why) + "</div></div>";
      });
    }

    h += '<div class="day-foot">';
    var doneCls = s.completed ? " done" : "";
    h += '<button class="btn primary' + doneCls + '" id="markDone">' + (s.completed ? "✓ Day complete" : "Mark day complete") + "</button>";
    var remaining = (d.blocks || []).reduce(function (acc, b, bi) {
      return acc + (b.steps || []).filter(function (_, si) { return !s.tasks[taskKey(n, bi, si)]; }).length;
    }, 0);
    var unanswered = (d.quiz || []).filter(function (_, qi) { return s.quiz[qi] === undefined; }).length;
    if (!s.completed && (remaining || unanswered)) {
      h += '<span class="day-hint">' + remaining + " tasks and " + unanswered + " quiz questions remaining — or mark complete when you're done for real.</span>";
    }
    h += '<div class="pager" style="width:100%">';
    h += '<button class="btn" id="prevBtn"' + (n <= 1 ? " disabled style='opacity:.4;cursor:default'" : "") + ">← Previous day</button>";
    h += '<button class="btn" id="nextBtn"' + (n >= DAYS.length ? " disabled style='opacity:.4;cursor:default'" : "") + ">Next day →</button>";
    h += "</div></div>";

    content.innerHTML = h;
    renderNav();
    updateHeader();
    updateQuizScore();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateQuizScore() {
    var el = document.getElementById("quizScore");
    if (!el) return;
    var d = DAYS[current - 1];
    var s = st(current);
    var total = (d.quiz || []).length, right = 0, answered = 0;
    (d.quiz || []).forEach(function (q, qi) {
      if (s.quiz[qi] !== undefined) { answered++; if (s.quiz[qi] === q.answer) right++; }
    });
    el.textContent = total ? ("Quiz: " + right + "/" + total + " (" + answered + " answered)") : "";
  }

  // events (delegated)
  content.addEventListener("change", function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains("task-check")) {
      var s = st(+t.dataset.day);
      s.tasks[taskKey(+t.dataset.day, +t.dataset.b, +t.dataset.s)] = t.checked;
      save(); updateHeader(); renderNav();
      // refresh hint counts
      renderDay(current);
    }
  });

  content.addEventListener("click", function (e) {
    var t = e.target;
    var opt = t.closest ? t.closest(".q-opt") : null;
    if (opt && !opt.disabled) {
      var day = +opt.dataset.day, qi = +opt.dataset.q, oi = +opt.dataset.o;
      var s = st(day);
      if (s.quiz[qi] !== undefined) return;
      s.quiz[qi] = oi; save();
      renderDay(current);
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
    if (t.id === "markDone") {
      var s2 = st(current);
      s2.completed = !s2.completed; save();
      renderDay(current); updateHeader();
      return;
    }
    if (t.id === "prevBtn" && current > 1) { renderDay(current - 1); return; }
    if (t.id === "nextBtn" && current < DAYS.length) { renderDay(current + 1); return; }
  });

  nav.addEventListener("click", function (e) {
    var t = e.target;
    var wg = t.closest ? t.closest("[data-week-toggle]") : null;
    if (wg) {
      wg.closest(".week-group").classList.toggle("closed");
      return;
    }
    var dl = t.closest ? t.closest("[data-day]") : null;
    if (dl) {
      renderDay(+dl.dataset.day);
      document.body.classList.remove("nav-open");
    }
  });

  document.getElementById("navToggle").addEventListener("click", function () {
    document.body.classList.toggle("nav-open");
  });
  document.getElementById("resetProgress").addEventListener("click", function () {
    if (confirm("Reset all progress? This clears every checkbox, quiz answer, and completed day.")) {
      progress = { days: {}, lastDay: 1 };
      save(); renderDay(1);
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" && current < DAYS.length) renderDay(current + 1);
    else if (e.key === "ArrowLeft" && current > 1) renderDay(current - 1);
  });

  // init
  if (!DAYS.length) {
    content.innerHTML = '<div class="empty"><h2>Content failed to load</h2><p>data.js is missing or empty.</p></div>';
  } else {
    renderDay(current);
  }
  updateHeader();
})();
