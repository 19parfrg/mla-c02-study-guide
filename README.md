# MLA-C02 Study Quest — 26-Day Gamified Prep

Gamified study plan for the **AWS Certified Machine Learning Engineer – Associate (MLA-C02)** exam (currently in beta).

**Live site:** https://19parfrg.github.io/mla-c02-study-guide/ (GitHub Pages, served from `main`).

## The plan

26 days at 4–5 hours each, in five chapters that follow the exam domains:

| Chapter | Days | Covers | Boss |
|---|---|---|---|
| 1 · Data | 1–7 | Domain 1: Data Preparation (28%) | Day 7 |
| 2 · Models | 8–14 | Domain 2: ML Model and Foundation Model Development (24%) | Day 14 |
| 3 · Deploy | 15–18 | Domain 3: Deployment and Orchestration (24%) | Day 18 |
| 4 · Operate | 19–22 | Domain 4: Operating, Monitoring, Securing (24%) | Day 22 |
| 5 · Endgame | 23–26 | Triage, two timed practice exams, exam eve (light day) | — |

Days 7, 18, and 22 cover the generative AI skills added in MLA-C02: vector stores, embeddings, Retrieval Augmented Generation (RAG) data prep, knowledge bases, agents, prompt management, evaluation, cost, and guardrails.

## Daily loop

1. **Bounty board** — questions you missed come back after 1, 3, and 7 days.
2. **Flashcards** — key terms from every day you have reached, on a widening schedule.
3. **Today's quest** — the day's timed blocks: warm-up, new material, mission, practice.
4. **Quiz**, and on chapter-ending days a **boss fight** (10 questions, 8 to win).

## Game rules

- XP: checklist step 5 · quiz right 20 / wrong 5 · mission 40 · day complete 50 · boss hit 30 · boss win 100 · bounty 30 · flashcard 3.
- 100 XP in a day keeps the streak. Every 7-day streak banks a freeze (max 2) that covers one missed day.
- Four domain mastery bars roll up, weighted 28/24/24/24, into a readiness score. It measures this question bank, not a predicted exam score.
- Progress lives in this browser's `localStorage`. Nothing leaves the device, and a different browser or URL starts from zero.

## AWS missions

17 of the days have a hands-on mission in a real AWS account. Work through **Base camp** on the HQ page first: budget alert, AWS command line interface (CLI), Region, and Bedrock model access.

After every mission, check for leftovers that keep billing:

```powershell
.\tools\aws-sweep.ps1 -Region us-east-1
```

The script is read-only. It lists endpoints, notebooks, running jobs, knowledge bases, vector stores, and similar resources; it deletes nothing.

## Structure

| File | Purpose |
|---|---|
| `index.html` | Page shell |
| `styles.css` | Dark theme |
| `app.js` | Rendering, game engine, progress tracking |
| `data-1.js` … `data-3.js` | Generated content bundles |
| `content/` | Source JSON per block of days |
| `tools/build.py` | Regenerates the `data-N.js` bundles from `content/` |
| `tools/aws-sweep.ps1` | Read-only billing-leftover check |

## Authoring

Edit `content/days-*.json`, then rebuild and bump the `?v=` number on the script tags in `index.html` so browsers pick up the change:

```bash
python tools/build.py
```

Day fields beyond the basics: `week` (chapter 1–5), `dom` (exam domain 1–4 for mastery, 0 to exclude), `boss` (`name`, `intro`, `quiz`), and on blocks `mission`, `aws`, `cost`.

## Exam facts

- Exam: MLA-C02 (beta, code ME1-C02) · $75 beta · 85 questions · 170 minutes · passing score 720/1000
- Domains: Data Preparation 28% · Model/FM Development 24% · Deployment & Orchestration 24% · Operating/Monitoring/Securing 24%
- Standard (non-beta) version launches January 14, 2027
