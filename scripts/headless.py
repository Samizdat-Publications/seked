"""
Run a headless `claude -p` job on the project's API key, never on a subscription.

    python scripts/headless.py -p "PROMPT" [claude flags...]
    python scripts/job.py start NAME --then "..." -- python scripts/headless.py -p "..." --output-format json

The one-line test that first proved the key (2026-10-20; see docs/rethink-2026-10.md):

    python scripts/headless.py -p "Seked API-key test: reply with the one word ready." \\
        --model claude-haiku-5-5 --max-turns 1 --output-format json

Why this exists. Bulk research and drafting for the rethink run on the Max plan's monthly
API credit, which only an API key spends; an interactive session spends the plan itself. So
this starts `claude --bare`, whose Anthropic auth is strictly ANTHROPIC_API_KEY (no OAuth, no
keychain, no hooks, no CLAUDE.md discovery: a job's prompt names what it should read), with
an environment cut down to the path, the proxy and the CA settings. Nothing a host-managed
session sets (CLAUDE_*, ANTHROPIC_*) reaches the child. Its config and transcripts go to
build/headless/config (gitignored), so a job can be read back after it ends. A job longer
than about ten minutes goes through job.py, like any long job.

The key is read from SEKED_ANTHROPIC_API_KEY, or a line `SEKED_ANTHROPIC_API_KEY=...` in
~/.seked/keys.env, and is never printed. Standard library only.
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONFIG = os.path.join(ROOT, "build", "headless", "config")
KEYS = os.path.join(os.path.expanduser("~"), ".seked", "keys.env")
NAME = "SEKED_ANTHROPIC_API_KEY"

# What the child keeps of this environment: enough to find programs, reach the network
# through a proxy and trust its CA, on Linux, macOS and Windows.
KEEP = (
    "PATH", "PATHEXT", "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA",
    "LOCALAPPDATA", "SYSTEMROOT", "SYSTEMDRIVE", "COMSPEC", "TEMP", "TMP", "TMPDIR",
    "LANG", "LC_ALL", "TERM",
    "HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy",
    "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE",
)


def key():
    value = os.environ.get(NAME)
    if not value and os.path.exists(KEYS):
        for line in open(KEYS, encoding="utf-8"):
            if line.strip().startswith(f"{NAME}="):
                value = line.split("=", 1)[1].strip()
    if not value:
        sys.exit(f"no API key: set {NAME} or put {NAME}=... in {KEYS}")
    return value


def main():
    if not sys.argv[1:]:
        sys.exit(__doc__)
    env = {name: os.environ[name] for name in KEEP if name in os.environ}
    env["ANTHROPIC_API_KEY"] = key()
    env["CLAUDE_CONFIG_DIR"] = CONFIG
    os.makedirs(CONFIG, exist_ok=True)
    # CreateProcess does not search PATH the way a shell does, so resolve the program here.
    program = shutil.which("claude", path=env.get("PATH"))
    if not program:
        sys.exit("no `claude` on PATH")
    sys.exit(subprocess.run([program, "--bare", *sys.argv[1:]], env=env).returncode)


if __name__ == "__main__":
    main()
