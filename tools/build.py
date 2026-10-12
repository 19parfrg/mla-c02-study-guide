"""Regenerate the data-N.js bundles from content/days-*.json. Run from anywhere: python tools/build.py"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

days = []
for f in sorted((ROOT / "content").glob("days-*.json")):
    days += json.loads(f.read_text(encoding="utf-8"))
days.sort(key=lambda d: d["day"])

if [d["day"] for d in days] != list(range(1, len(days) + 1)):
    sys.exit("Day numbers must run 1..N with no gaps or duplicates")
for d in days:
    for q in d.get("quiz", []) + d.get("boss", {}).get("quiz", []):
        if not 0 <= q["answer"] < len(q["options"]):
            sys.exit(f"Day {d['day']}: answer index out of range in {q['q'][:60]!r}")

# Three chunks keep each file small enough to stay editable and quick to load.
size = -(-len(days) // 3)
for i in range(3):
    blob = json.dumps(days[i * size:(i + 1) * size], ensure_ascii=False, separators=(",", ":"))
    js = f"window.STUDY_DAYS={blob};" if i == 0 else f"window.STUDY_DAYS.push({blob[1:-1]});"
    (ROOT / f"data-{i + 1}.js").write_text(js, encoding="utf-8", newline="\n")

quiz = sum(len(d.get("quiz", [])) + len(d.get("boss", {}).get("quiz", [])) for d in days)
print(f"Built {len(days)} days, {quiz} questions, {sum(len(d.get('keyTerms', [])) for d in days)} key terms")
