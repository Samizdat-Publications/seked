"""
Research the documentary's chapters as headless jobs on the API key.

    python scripts/research.py start 1 [2 ...] [--model M] [--effort E] [--budget USD]
    python scripts/research.py collect 1 [2 ...]
    python scripts/research.py draft [--effort xhigh] [--budget USD]
    python scripts/research.py collect script

`start` builds each chapter's prompt from scripts/research/brief.md and the chapter's scope in
scripts/research/chapters.json, and runs it through job.py (detached) and headless.py (the API
key only), with web search and read-only access to the repository. `collect` takes a finished
job's answer out of its log into docs/research/chN.md, headed with what it cost. A brief is a
draft: its [unchecked] citations are still to be checked, and nothing in it is data until it
is entered in data/ like any other figure.

`draft` runs the script's first draft the same way, from scripts/research/script.md and every
brief in docs/research/, at extra effort as the brief asks of the script; `collect script`
writes it to docs/script.md, which is then edited by hand.

Standard library only.
"""
import argparse
import datetime
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BRIEF = os.path.join(HERE, "research", "brief.md")
SCRIPT = os.path.join(HERE, "research", "script.md")
CHAPTERS = os.path.join(HERE, "research", "chapters.json")
JOBS = os.path.join(ROOT, "build", "jobs")
OUT = os.path.join(ROOT, "docs", "research")
TOOLS = "WebSearch,WebFetch,Read,Grep,Glob"


def chapters():
    with open(CHAPTERS, encoding="utf-8") as f:
        return json.load(f)


def prompt(number, chapter):
    with open(BRIEF, encoding="utf-8") as f:
        template = f.read()
    return template.replace("{{chapter}}", f"Chapter {number}: {chapter['title']}.\n\nScope: {chapter['scope']}")


def job(name, prompt_text, args, then):
    """Start one detached headless job on the API key, read-only but for the web."""
    command = [
        sys.executable, os.path.join(HERE, "job.py"), "start", name, "--then", then,
        "--", sys.executable, os.path.join(HERE, "headless.py"),
        "-p", prompt_text,
        "--model", args.model, "--effort", args.effort,
        "--tools", TOOLS, "--allowedTools", TOOLS,
        "--max-turns", str(args.turns), "--max-budget-usd", str(args.budget),
        "--output-format", "json",
    ]
    subprocess.run(command, cwd=ROOT, check=True)


def draft(args):
    briefs = [n for n in sorted(chapters(), key=int) if os.path.exists(os.path.join(OUT, f"ch{n}.md"))]
    missing = [n for n in chapters() if n not in briefs]
    if missing:
        sys.exit(f"no brief yet for chapter {', '.join(missing)}: collect them first")
    with open(SCRIPT, encoding="utf-8") as f:
        job("research-script", f.read(), args, "python scripts/research.py collect script, then edit docs/script.md")


def start(args):
    known = chapters()
    for number in args.chapters:
        if number not in known:
            sys.exit(f"no chapter {number} in {os.path.relpath(CHAPTERS, ROOT)}")
    for number in args.chapters:
        job(f"research-ch{number}", prompt(number, known[number]), args,
            f"python scripts/research.py collect {number}, then read docs/research/ch{number}.md")


def result(name):
    """The last JSON object the job printed: headless.py's --output-format json result."""
    path = os.path.join(JOBS, f"{name}.log")
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = [line for line in f if line.lstrip().startswith("{")]
    for line in reversed(lines):
        try:
            return json.loads(line)
        except ValueError:
            continue
    sys.exit(f"no result in {os.path.relpath(path, ROOT)}")


def collect(args):
    known = chapters()
    os.makedirs(OUT, exist_ok=True)
    for number in args.chapters:
        name = "research-script" if number == "script" else f"research-ch{number}"
        record = json.load(open(os.path.join(JOBS, f"{name}.json"), encoding="utf-8"))
        answer = result(name)
        cost = answer.get("total_cost_usd", 0)
        models = ", ".join(sorted(answer.get("modelUsage") or {})) or "unknown model"
        if answer.get("is_error") or not answer.get("result"):
            print(f"chapter {number}: {answer.get('subtype')} after {answer.get('num_turns')} turns, ${cost:.2f};"
                  f" {'; '.join(answer.get('errors') or [])}")
            continue
        command = record["command"]
        effort = command[command.index("--effort") + 1] if "--effort" in command else "default"
        ended = record.get("ended") or datetime.datetime.now().astimezone().isoformat(timespec="seconds")
        how = (f"{models} at {effort} effort, {answer.get('num_turns')} turns, ${cost:.2f} on the API key,"
               f" ended {ended}.")
        if number == "script":
            header = (f"<!-- The first draft, from `python scripts/research.py draft`: {how} Edited by hand from"
                      " here on; its sources are the briefs in docs/research/. -->\n\n")
            path = os.path.join(ROOT, "docs", "script.md")
        else:
            header = (
                f"# Chapter {number} research: {known[number]['title']}\n\n"
                f"A headless draft from `python scripts/research.py start {number}`: {how}"
                " Citations marked [unchecked] are still to be checked against the work itself,"
                " and nothing here is data until it is entered in `data/`.\n\n---\n\n"
            )
            path = os.path.join(OUT, f"ch{number}.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(header + answer["result"].strip() + "\n")
        print(f"chapter {number}: {os.path.relpath(path, ROOT)}, {answer.get('num_turns')} turns, ${cost:.2f}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="action", required=True)
    go = sub.add_parser("start")
    go.add_argument("chapters", nargs="+")
    go.add_argument("--model", default="claude-opus-5-5")
    go.add_argument("--effort", default="high")
    go.add_argument("--budget", type=float, default=4.0, help="the most one chapter may spend, in USD")
    go.add_argument("--turns", type=int, default=120)   # the chapter 1 pilot took 72
    go.set_defaults(func=start)
    write = sub.add_parser("draft")
    write.add_argument("--model", default="claude-opus-5-5")
    write.add_argument("--effort", default="xhigh")
    write.add_argument("--budget", type=float, default=8.0, help="the most the draft may spend, in USD")
    write.add_argument("--turns", type=int, default=80)
    write.set_defaults(func=draft)
    back = sub.add_parser("collect")
    back.add_argument("chapters", nargs="+", help="chapter numbers, or `script`")
    back.set_defaults(func=collect)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
