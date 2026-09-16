# The render log

Every render, not just the ones that were chosen.

`docs/progress/` holds the numbered snapshots: one per milestone, each written
up in a table, each picked because something had changed that was worth
showing. This folder holds the other kind of record, the one nobody picks.
When a view is being worked on it gets rendered ten or twenty times, and
nineteen of those frames are written over the twentieth. The washed-out first
attempt, the one where the casing was too opaque to see through, the one where
the Grand Gallery's corbels came back twice and hatched it: those are worth as
much to a record of how this was built as the frame that survived, and they
are exactly the frames that get lost.

Add one with:

```
python scripts/log-render.py build/section.png --view section --note "what was being tried"
```

## What a file knows about itself

A frame is named `<utc timestamp>--<view>--<commit>.png`, so the folder sorts
by when it was taken and each frame says which commit of the project drew it.
A commit with a dirty tree is marked `-dirty`, because a frame rendered from
uncommitted work cannot be reproduced from that commit alone and should not
pretend it can.

The same facts are written into the PNG's own `tEXt` chunks, so a frame that
leaves this folder still knows what it is:

| Key | What it holds |
|---|---|
| `Creation Time` | when it was rendered, UTC, ISO 8601 |
| `seked:view` | `section`, `dawn`, `cutaway`, `akhet`, `night` |
| `seked:commit` | the short hash the project stood at |
| `seked:tree` | `clean` or `dirty` |
| `seked:kept` | `yes` where the frame also became a numbered snapshot |
| `Comment` | the note given on the command line |

Blender writes its own metadata alongside these and it is left alone, so each
frame also carries its sample count, its render time and the `.blend` it came
from.

## index.json

The same rows again, sorted by when they were taken, so the sequence can be
worked with without opening any of the images or parsing any file names. Each
row is `{file, taken, view, commit, tree, kept, note, bytes}`.

Nothing here is generated from anything else, and nothing regenerates it: a
render that happened, happened. If a frame is deleted, take its row out too.
