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

Day content lives in `content/days-*.json`. After editing, regenerate `data.js`:

```bash
python3 -c "
import json
days = []
for f in ['days-01-10.json','days-11-20.json','days-21-30.json']:
    days += json.load(open('content/'+f))
open('data.js','w').write('window.STUDY_DAYS = ' + json.dumps(days, ensure_ascii=False, indent=1) + ';\n')
"
```

## Exam facts

- Exam: MLA-C02 (beta, code ME1-C02) · $75 beta · 85 questions · 170 minutes
- Domains: Data Preparation 28% · Model/FM Development 24% · Deployment & Orchestration 24% · Operating/Monitoring/Securing 24%
