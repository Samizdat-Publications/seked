"""
The sky alignments, drawn as the lost-civilisation reading's strongest case.

Three claims, each a Blender render of the plateau with a registered overlay drawn on it:
C4, Orion's belt over the three pyramids (the night of 10,450 BCE, and a plan with the belt
fitted onto the pyramids); C5, the lion Sphinx facing Leo at the equinox dawn of 10,500 BCE,
with Taurus in its place at 2500 BCE; C2, the Great Pyramid's four shafts reaching out to
their stars in 2450 BCE, and to what they met in 10,450 BCE.

    blender -b --factory-startup -P render/alignments.py -- render --era first-time [--views c4-night,...]
            [--size 960x540] [--samples 24]
    python render/alignments.py overlay [--final] [--only c4-night,...]
    python render/alignments.py page           # the finals as apps/alignments/ (JPEGs and an index); deploys nothing
    python render/alignments.py lines          # import the constellation figures from Stellarium

Look development: `render ... --bracket -1.5,1.5` renders a view at those exposure offsets too, into
build/alignments/render/bracket/; `--cpu` keeps a check off the shared GPU.

The views are render/alignments.json's. Renders go to build/alignments/render/<view>.png with a
sidecar carrying the camera; `overlay` composes build/alignments/<picture>.png from them, the sky
bake (build/sky-bake.json, `pnpm run sky-bake`) and docs/shafts.md (`pnpm shafts`). Stars and
numbers come only from those; where a claim's match is loose, its caption says so.
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

VIEWS = os.path.join(HERE, "alignments.json")


def parse(argv):
    """The mode and its options: `--key value`, or a bare `--flag` for True."""
    argv = argv[argv.index("--") + 1:] if "--" in argv else argv[1:]
    mode = "overlay"
    if argv and not argv[0].startswith("--"):
        mode, argv = argv[0], argv[1:]
    opts, i = {}, 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
            opts[key], i = argv[i + 1], i + 2
        else:
            opts[key], i = True, i + 1
    return mode, opts


def views():
    with io.open(VIEWS, encoding="utf-8") as f:
        return json.load(f)


def main():
    mode, opts = parse(sys.argv)
    if mode == "lines":
        from giza.alignments import lines
        lines.import_lines()
    elif mode == "render":
        from giza.alignments import scenes
        scenes.render(views(), opts)
    elif mode == "overlay":
        from giza.alignments import compose
        compose.main(views(), opts)
    elif mode == "page":
        from giza.alignments import page
        page.build()
    else:
        raise SystemExit(f"unknown mode {mode!r}: render, overlay, page or lines")


main()
