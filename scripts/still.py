"""
Catch a still off the running viewer.

    python scripts/still.py                      # listen on 8787 until stopped
    python scripts/still.py --once --out build/stills/track-b.png

The viewer draws into a WebGL canvas, and a canvas without
`preserveDrawingBuffer` reads back empty to anything outside the frame that
drew it. `?still=1` in the address bar turns that option on (see
`Scene.tsx`), after which the page can hand its own canvas over at any
moment. What it cannot do is write a file, and a 2400 by 1350 PNG is five
megabytes of base64, which is too much to carry back through a tool result a
few hundred kilobytes at a time.

So this is the other end: a server that does nothing but accept one POST of
image bytes and write them to disk. Standard library, no dependency, and no
route but the one. Run it, then from the page:

    await fetch('http://127.0.0.1:8787/still?name=track-b', {
      method: 'POST',
      body: await (await fetch(document.querySelector('canvas').toDataURL('image/png'))).blob(),
    })

It answers with the path it wrote. `scripts/log-render.py` then files the
frame in `docs/progress/log/` with its view and its commit, exactly as it
files a Blender render, because a screenshot of the viewer is as much a
record of how this was built as a render is.

It binds to 127.0.0.1 and nothing else: this is a hole in the wall for one
browser tab on the same machine, not a service.
"""
import argparse
import http.server
import os
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STILLS = os.path.join(ROOT, "build", "stills")

MAX_BYTES = 64 * 1024 * 1024


def safe_name(raw):
    """A file name out of a query string: letters, digits, dash and underscore."""
    cleaned = "".join(c if (c.isalnum() or c in "-_") else "-" for c in (raw or "still"))
    return cleaned.strip("-") or "still"


class Sink(http.server.BaseHTTPRequestHandler):
    once = False
    out = None
    wrote = None

    def log_message(self, fmt, *args):
        sys.stderr.write("still.py: " + (fmt % args) + "\n")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_BYTES:
            self.send_response(413)
            self._cors()
            self.end_headers()
            return
        body = self.rfile.read(length)
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        path = Sink.out or os.path.join(STILLS, safe_name((query.get("name") or ["still"])[0]) + ".png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
        Sink.wrote = path
        print(f"wrote {path} ({len(body)} bytes)", flush=True)
        answer = path.encode("utf-8")
        self.send_response(200)
        self._cors()
        self.send_header("content-type", "text/plain; charset=utf-8")
        self.send_header("content-length", str(len(answer)))
        self.end_headers()
        self.wfile.write(answer)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--out", help="write every still to this one path, ignoring ?name")
    ap.add_argument("--once", action="store_true", help="serve one still and stop")
    args = ap.parse_args(argv)

    Sink.once = args.once
    Sink.out = os.path.abspath(args.out) if args.out else None
    server = http.server.HTTPServer(("127.0.0.1", args.port), Sink)
    print(f"still.py listening on http://127.0.0.1:{args.port}/still", flush=True)
    if args.once:
        server.handle_request()  # the preflight, if the page sends one
        while Sink.wrote is None:
            server.handle_request()
    else:
        server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
