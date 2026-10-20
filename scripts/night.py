"""
Run the overnight builder: successive headless `claude -p` chunks on the API key, each a
fresh context that reads the running list, does its next items, and commits and pushes them.

    python scripts/job.py start night --then "read the running list" -- \
        python scripts/night.py --list docs/night-2026-10-20.md --cap 155
    touch build/night.stop          # no new chunk after the one running

Why this exists. On 20 October the plan's weekly quota stood at 88 per cent with the night
ahead, and the API key held about $187 of credit. A night's building on the key leaves the
quota alone: this runner is the only thing awake, and the interactive session stands down.
Each chunk starts from scripts/night/prompt.md and the running list, so nothing depends on
one long context, and the builder commits and pushes every step as it goes. It is an
unsupervised agent with a shell and push rights on the branch, so it is started by Stewart's
say-so, not by a session on its own.

It stops before a chunk would take the night's spend past --cap, when a chunk ends with NIGHT
DONE, when a chunk fails for want of credit, after two failed chunks in a row, after three
chunks in a row with no commit of the builder's own, or when build/night.stop exists. After
each chunk it appends a row to the ledger beside the list (night-ledger-<date>.md) and commits
and pushes that one file, so the spend is on the branch whatever happens to the container.
--start and --spent carry the count and the spend on after a restart. --minutes stops it
starting chunks after that long, for a run as a session's background task: a cloud container
is reclaimed when its session sits idle, which killed the first night's run at its first chunk.

Standard library only.
"""
import argparse
import datetime
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PROMPT = os.path.join(HERE, "night", "prompt.md")
STOP = os.path.join(ROOT, "build", "night.stop")
OUT = os.path.join(ROOT, "build", "jobs", "night")
BRANCH = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT, capture_output=True,
                        text=True).stdout.strip() or "claude/funny-ramanujan-bopfxb"   # the checkout's own branch
TOOLS = "Bash,Read,Edit,Write,Glob,Grep,WebSearch,WebFetch"
ENDS = ("error_max_turns", "error_max_budget_usd")   # a chunk that ran out of turns or budget ended normally
BROKE = ("credit balance", "billing", "insufficient credit", "payment required")
ATTRIBUTION = ("Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
               "Claude-Session: https://claude.ai/code/session_014X7qhc6nPseZiq9ffN5yBW")


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M")


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)


def own_commits(since):
    """The builder's commits since `since`, leaving out the ledger's own."""
    log = git("log", "--format=%s", f"{since}..HEAD").stdout.splitlines()
    return [s for s in log if not s.startswith("Night ledger:")]


def push():
    for wait in (0, 2, 4, 8, 16):
        time.sleep(wait)
        if git("push", "-u", "origin", BRANCH).returncode == 0:
            return True
    return False


def parse(out):
    try:
        return json.loads(out)
    except ValueError:
        for line in reversed(out.strip().splitlines()):
            try:
                return json.loads(line)
            except ValueError:
                continue
    return None


def chunk(n, budget, effort, spent, args):
    with open(args.prompt or PROMPT, encoding="utf-8") as f:
        text = f.read()
    for name, value in {"chunk": str(n), "budget": f"{budget:.2f}", "spent": f"{spent:.2f}",
                        "cap": f"{args.cap:.2f}", "list": args.list, "branch": BRANCH}.items():
        text = text.replace("{{" + name + "}}", value)
    command = [
        sys.executable, os.path.join(HERE, "headless.py"), "-p", text,
        "--model", args.model, "--effort", effort,
        "--tools", TOOLS, "--allowedTools", TOOLS, "--permission-mode", "acceptEdits",
        "--max-turns", str(args.turns), "--max-budget-usd", f"{budget:.2f}",
        "--output-format", "json",
    ]
    done = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"chunk-{n:02d}.json"), "w", encoding="utf-8") as f:
        f.write(done.stdout)
    if done.stderr:
        with open(os.path.join(OUT, f"chunk-{n:02d}.err"), "w", encoding="utf-8") as f:
            f.write(done.stderr)
    return parse(done.stdout) or {"is_error": True, "subtype": "no answer", "total_cost_usd": 0.0,
                                  "result": (done.stdout + done.stderr)[-2000:]}


def ledger(path, n, answer, cost, spent, how):
    new = not os.path.exists(path)
    with open(path, "a", encoding="utf-8") as f:
        if new:
            f.write("# The night's spend on the API key\n\n"
                    "Written by `scripts/night.py` after each chunk of the overnight builder and committed on"
                    " its own. The two research jobs started before the runner are not in it.\n\n"
                    "| Chunk | Ended (UTC) | Turns | Cost | Tonight | How it ended |\n"
                    "|---|---|---|---|---|---|\n")
        f.write(f"| {n} | {now()} | {answer.get('num_turns', '')} | ${cost:.2f} | ${spent:.2f} | {how} |\n")
    rel = os.path.relpath(path, ROOT)
    git("add", rel)
    git("commit", "-m", f"Night ledger: chunk {n}, ${cost:.2f}, ${spent:.2f} tonight\n\n{ATTRIBUTION}", "--", rel)
    push()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--list", required=True, help="the running list, e.g. docs/night-2026-10-20.md")
    parser.add_argument("--prompt", help="the chunk's prompt (default scripts/night/prompt.md)")
    parser.add_argument("--cap", type=float, required=True, help="the most the night's chunks may spend, in USD")
    parser.add_argument("--chunk", type=float, default=15.0, help="the most one chunk may spend, in USD")
    parser.add_argument("--model", default="claude-opus-5-5")
    parser.add_argument("--effort", default="high")
    parser.add_argument("--extra", type=int, default=1, help="how many chunks run at extra effort first (planning)")
    parser.add_argument("--turns", type=int, default=400)
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--spent", type=float, default=0.0)
    parser.add_argument("--minutes", type=float, default=0.0, help="start no chunk after this long (0: no limit)")
    args = parser.parse_args()
    base = os.path.basename(args.list)
    # night-DATE.md keeps its ledger in night-ledger-DATE.md; any other list in LIST-ledger.md
    base = base.replace("night-", "night-ledger-", 1) if base.startswith("night-") else base[:-3] + "-ledger.md"
    path = os.path.join(ROOT, os.path.dirname(args.list), base)
    spent, failed, idle, n = args.spent, 0, 0, args.start
    began = time.time()
    while True:
        if args.minutes and time.time() - began > args.minutes * 60:
            print(f"{args.minutes:.0f} minutes up: no new chunk; carry on with --start {n} --spent {spent:.2f}")
            break
        if os.path.exists(STOP):
            print(f"{STOP} exists: no new chunk")
            break
        budget = min(args.chunk, args.cap - spent)
        if budget < 2.0:
            print(f"${spent:.2f} spent of the ${args.cap:.2f} cap: stopping with the headroom kept")
            break
        effort = "xhigh" if n - args.start < args.extra else args.effort
        before = git("rev-parse", "HEAD").stdout.strip()
        print(f"{now()} chunk {n}: up to ${budget:.2f} at {effort}", flush=True)
        answer = chunk(n, budget, effort, spent, args)
        cost = float(answer.get("total_cost_usd") or 0.0)
        spent += cost
        text = str(answer.get("result") or "")
        sub = str(answer.get("subtype") or "")
        error = bool(answer.get("is_error")) and sub not in ENDS
        broke = error and any(w in text.lower() for w in BROKE)
        made = own_commits(before)
        how = ("out of credit" if broke else f"failed ({sub})" if error
               else "out of budget" if sub == "error_max_budget_usd" else "out of turns" if sub == "error_max_turns"
               else "finished")
        how += f"; {len(made)} commit{'' if len(made) == 1 else 's'}"
        ledger(path, n, answer, cost, spent, how)
        print(f"{now()} chunk {n}: {how}, ${cost:.2f}, ${spent:.2f} tonight", flush=True)
        if text:
            print(text[-1500:], flush=True)
        if broke:
            break
        failed = failed + 1 if error else 0
        idle = idle + 1 if not made else 0
        if failed >= 2 or idle >= 3:
            print("stopping: two failed chunks in a row" if failed >= 2 else "stopping: three chunks with no commit")
            break
        if "NIGHT DONE" in text:
            break
        n += 1


if __name__ == "__main__":
    main()
