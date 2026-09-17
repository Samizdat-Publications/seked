"""
Run long jobs outside any Claude session, and say which session owns the repo.

    python scripts/job.py claim SESSION            # this session now owns the repo
    python scripts/job.py start NAME --then "..." -- COMMAND ARGS...
    python scripts/job.py status [NAME]            # owner, and every job with its state

Why this exists. A render started as a session's background task wakes that
session when it exits. Twice a session was continued in a new one while its
render ran; the render finished, woke the old session, and the old session did
the render's wrap-up in the same files the new one was committing (snapshot
0016 got two rows, the plan's numbering broke). A job started here is detached
from the shell that started it, so its exit wakes nobody. What should happen
after it goes in `--then`, which is stored with the job; whichever session owns
the repo when it ends does that, and a session that does not own the repo does
nothing to it.

State lives in build/jobs/ (gitignored): NAME.json holds the command, the pid,
the log, the follow-up, and the exit code once the job ends; NAME.log holds
its output. build/owner.json names the owning session.

Standard library only.
"""
import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
JOBS = os.path.join(ROOT, "build", "jobs")
OWNER = os.path.join(ROOT, "build", "owner.json")


def now():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write(path, value):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(value, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def alive(pid):
    if not pid:
        return False
    if os.name == "nt":
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True).stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def claim(args):
    previous = read(OWNER)
    write(OWNER, {"session": args.session, "since": now(), "previous": previous})
    if previous and previous.get("session") != args.session:
        print(f"{args.session} now owns the repo (was {previous['session']} since {previous['since']});"
              f" message {previous['session']} to stand down if it is still open")
    else:
        print(f"{args.session} owns the repo")


def start(args):
    if not args.command:
        sys.exit("give the command after --")
    # CreateProcess does not search PATH the way a shell does, so resolve the program here.
    resolved = shutil.which(args.command[0])
    if resolved:
        args.command[0] = resolved
    record_path = os.path.join(JOBS, f"{args.name}.json")
    existing = read(record_path)
    if existing and existing.get("exit") is None and alive(existing.get("runner_pid")):
        sys.exit(f"job {args.name} is still running (pid {existing['runner_pid']})")
    log = os.path.join(JOBS, f"{args.name}.log")
    owner = read(OWNER) or {}
    record = {
        "name": args.name,
        "command": args.command,
        "cwd": os.getcwd(),
        "log": log,
        "then": args.then,
        "started_by": owner.get("session"),
        "started": now(),
        "runner_pid": None,
        "pid": None,
        "ended": None,
        "exit": None,
    }
    write(record_path, record)
    flags = 0
    if os.name == "nt":
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    runner = [sys.executable, os.path.abspath(__file__), "_run", args.name]
    kwargs = dict(stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)
    try:
        proc = subprocess.Popen(runner, creationflags=flags | getattr(subprocess, "CREATE_BREAKAWAY_FROM_JOB", 0), **kwargs) \
            if os.name == "nt" else subprocess.Popen(runner, start_new_session=True, **kwargs)
    except OSError:
        # The parent's job object may forbid breakaway; detached is still enough to outlive the shell.
        proc = subprocess.Popen(runner, creationflags=flags, **kwargs)
    record["runner_pid"] = proc.pid
    write(record_path, record)
    print(f"started {args.name} (runner pid {proc.pid}); log {os.path.relpath(log, ROOT)}")


def run(args):
    record_path = os.path.join(JOBS, f"{args.name}.json")
    record = read(record_path)
    with open(record["log"], "w", encoding="utf-8", errors="replace") as log:
        try:
            # Unbuffered, so a Python job's log shows its progress while it runs.
            env = dict(os.environ, PYTHONUNBUFFERED="1")
            child = subprocess.Popen(record["command"], cwd=record["cwd"], stdout=log, stderr=subprocess.STDOUT,
                                     stdin=subprocess.DEVNULL, env=env)
        except OSError as error:
            log.write(f"could not start: {error}\n")
            code = -1
        else:
            record = read(record_path)
            record["pid"] = child.pid
            write(record_path, record)
            code = child.wait()
    record = read(record_path)
    record["ended"] = now()
    record["exit"] = code
    write(record_path, record)


def status(args):
    owner = read(OWNER)
    if owner:
        print(f"owner: {owner['session']} since {owner['since']}")
    else:
        print("owner: nobody has claimed the repo (python scripts/job.py claim SESSION)")
    if not os.path.isdir(JOBS):
        print("no jobs")
        return
    names = [args.name] if args.name else sorted(n[:-5] for n in os.listdir(JOBS) if n.endswith(".json"))
    for name in names:
        record = read(os.path.join(JOBS, f"{name}.json"))
        if not record:
            print(f"{name}: no record")
            continue
        if record["exit"] is not None:
            state = f"ended {record['ended']} with exit {record['exit']}"
        elif alive(record.get("runner_pid")):
            state = f"running since {record['started']}"
        else:
            state = "died without recording an exit (runner gone)"
        print(f"{name}: {state}; started by {record.get('started_by')}; log {os.path.relpath(record['log'], ROOT)}")
        if record.get("then"):
            print(f"  then: {record['then']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="action", required=True)
    p = sub.add_parser("claim")
    p.add_argument("session")
    p.set_defaults(func=claim)
    p = sub.add_parser("start")
    p.add_argument("name")
    p.add_argument("--then", default="")
    p.set_defaults(func=start)
    p = sub.add_parser("status")
    p.add_argument("name", nargs="?")
    p.set_defaults(func=status)
    p = sub.add_parser("_run")
    p.add_argument("name")
    p.set_defaults(func=run)
    # Everything after the first -- is the job's own command line, untouched by argparse.
    argv = sys.argv[1:]
    command = []
    if "--" in argv:
        at = argv.index("--")
        argv, command = argv[:at], argv[at + 1:]
    args = parser.parse_args(argv)
    args.command = command
    args.func(args)


if __name__ == "__main__":
    main()
