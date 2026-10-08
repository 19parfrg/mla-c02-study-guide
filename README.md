# MLA-C02 Study Guide — 30-Day Interactive Prep

Interactive study companion for the **AWS Certified Machine Learning Engineer – Associate (MLA-C02)** exam (currently in beta).

**Live site:** enable GitHub Pages on this repo (Settings → Pages → Deploy from branch → `main` → `/(root)`) and the guide will be served from there.

## What's inside

- **30 study days** across 6 weeks, each with:
  - Timed study blocks (review / new material / hands-on lab / practice + teach-it-back) with checkable tasks
  - Detailed exam-focused notes, key terms, and curated resource links
  - Hands-on labs (with copy-paste code) and cost-hygiene reminders
  - A quiz per day with instant feedback and explanations
- **Review days** every Friday with cumulative 10-question quizzes
- **Checkpoints**: Day 15 (agentic AI + full practice exam) and Days 28–29 (timed practice exams)
- **Progress tracking** — checkboxes, quiz scores, and completed days persist in the browser via `localStorage` (nothing leaves your device)
- Dark-only professional theme, keyboard navigation (←/→), responsive layout

## Structure

| File | Purpose |
|---|---|
| `index.html` | Page shell |
| `styles.css` | Dark theme |
| `app.js` | Rendering, navigation, quizzes, progress tracking |
| `data.js` | All 30 days of study content |
| `content/` | Source JSON per 10-day block (authoring source for `data.js`) |

## Authoring

Day content lives in `content/days-*.json`. After editing, regenerate the `data-N.js` chunks (kept small so they stay editable and load fast):

```bash
python3 - <<'EOF'
import json
days = []
for f in ['days-01-10.json','days-11-20.json','days-21-30.json']:
    days += json.load(open('content/'+f))
for i,(a,b) in enumerate([(1,10),(11,20),(21,30)],1):
    part = [d for d in days if a <= d["day"] <= b]
    blob = json.dumps(part, ensure_ascii=False, separators=(",",":"))
    js = "window.STUDY_DAYS="+blob+";" if i==1 else "window.STUDY_DAYS.push("+blob[1:-1]+");"
    open(f"data-{i}.js","w").write(js)
EOF
```

`index.html` loads `data-1.js`, `data-2.js`, `data-3.js` in order before `app.js`.

## Exam facts

- Exam: MLA-C02 (beta, code ME1-C02) · $75 beta · 85 questions · 170 minutes
- Domains: Data Preparation 28% · Model/FM Development 24% · Deployment & Orchestration 24% · Operating/Monitoring/Securing 24%
