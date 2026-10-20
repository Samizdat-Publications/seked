# Two proposed claims: H1 and W1

Chapters 1 and 2 each have a receipt that is not yet a claim file (`docs/script.md`, chapter 1's and
chapter 2's receipts; `docs/plan.html`, the chapter table). This note says what each would compare, what
it needs from `data/`, what it has, and what stops it. Neither goes into `data/claims/` until every input
is in `data/`: a claim file whose inputs are missing would fail the registry, and an input typed in to
make it pass would break the first rule.

Written 20 October 2026 by the overnight builder (item 9 of `docs/night-2026-10-20.md`).

## H1, "the head inside the lion" (chapter 2)

**The claim.** The Sphinx's head is too small for its body because it was re-carved out of a larger,
weathered lion's head (West, Schoch). The steelman's number is how large a king's head the
lion's could have held. The comparison is that number against the head the monument has.

**What is computed.** `render/giza/sphinx_eras.py` (era `built`) finds the largest king's head, of the
shape of the `sphinx-king-head` stand-in, whose head and nemes lie wholly inside the weathered master
lion's head (`fit` in `build/models/sphinx-master-built/era.json`). Two results, both recorded:

| Fit | Of the lion head's height | King's head (test part) | Chin to crown | Crown under the lion's | Fore (+) or aft (−) |
|---|---|---|---|---|---|
| Centred, standing where the lion's head stood | 0.393 | 3.17 m | 3.39 m | 0.67 m | 0 |
| Searched fore and aft, ±0.25 of the upper head's length (±2.45 m) | 0.61 | 4.93 m | 5.27 m | 2.02 m | −1.47 m |
| *The monument* (`sphinx.head.height`) | | | *5.73 ± 0.09 m* | | |

The lion head is 8.08 m. The searched fit holds a much larger head only by setting it 1.5 m back into
the mane and 2 m lower, where the lion's head is broadest. The carving in the renders uses the centred
fit (decision 54), because carved at 0.61 the bust is short and the head is not the monument's.

**What it would compare.**

- *Formula:* the fit's king's head height, against the monument's head height (`sphinx.head.height`, the
  chin to the top of the nemes).
- *Target:* the monument's head. *Tolerance:* none is natural. The proposal is to state the ratio, with
  the residual in metres, and no "holds" verdict, as W1 has none: the claim is an explanation, and the
  number shows how much room the explanation has.
- *Free choices (4):* the master mesh (a Meshy stand-in scaled to ARCE's length, height and width); how
  deep the long rains wore (the weathering's rates are look choices); the king's head stand-in's
  proportions; and whether the head may move fore and aft (the two rows above).

**What it has.** `sphinx.length`, `.height` and `.width` (`arce-sphinx-1991`, unverified) scale the
master. The target is now in `data/` too: `sphinx.head.height`, **5.731 ± 0.093 m** from the chin's
underside to the top of the head, scaled off ARCE drawing d-ss-047, Kapp's photogrammetric south
elevation, against its own elevation axis (`arce-sphinx-south-elevation-oc`, scaled from plate, never
verified).

**What stops it.**

1. ~~*The two heights are not yet the same measure.*~~ Done: the fit reports the placed head chin to crown
   (`render/giza/profile.py`), the measure the plate gives. **The centred head is 0.59 of the monument's,
   the searched 0.92**: even set back and down, the largest king's head the master's lion head can hold is
   0.46 m short of the head the Sphinx has, five times the plate's sigma. Read plainly, on these two
   stand-ins the monument's head is not too small to have been cut from the lion's; it is too large. That
   is a statement about the master (Meshy drew its lion head "about half as large again" as the present
   head, by our prompt), not about the claim, and the receipt has to say so.
2. *The fit is not a measurement.* It is read off two stand-ins, and the stand-in rule says nothing about
   a stand-in's form is entered as a measurement. The recommended way in is the star catalogue's: a file
   written by a script and never typed, `data/derived/sphinx-fit.json`, written by `sphinx_eras.py`
   with the meshes' checksums in its header, read by the claims engine under a `model.` prefix that the
   dossier marks "computed from stand-ins". That is a change to `@seked/data` and the expression
   environment, so it is a question for Stewart, not a night's decision.

**Draft, not in `data/claims/`:**

```yaml
id: H1
title: The head inside the lion
group: proportion
status: proposed
summary: >-
  The Sphinx's head is small for its body because it was re-carved from a
  larger, weathered lion's head. How large a king's head could the lion's
  have held?
comparisons:
  - label: The largest king's head the weathered lion's could hold, against the monument's
    formula: model.sphinx.fit.searched.king_head
    target: sphinx.head.height
    unit: m
free_choices:
  - the master lion, a stand-in scaled to ARCE's length, height and width
  - how deep the long rains wore the lion's head
  - the king's head stand-in's proportions
  - the head free to stand fore or aft of the lion's, by a quarter of its length
sources:
  for: [west-1993-film, schoch-1992-kmt]
  against: [lacovara-2026]
  context: [arce-sphinx-1991]
```

The source ids in both drafts are in `data/sources.json` today, all `verified: false`.

## W1, "the date from depth of weathering" (chapter 1)

**The claim.** Under the ditch floor the rock is weathered about twice as deep in front and along the
flanks as behind the rump, which was cut under Khafre. If the depth grows with time, the front was cut
long before Khafre (Schoch, after Dobecki and Schoch 1992).

**What it would compute.** t_front = t_rear × (d_front / d_rear)^n, counted back from the 1991 survey,
for each front line against the rear line S3. `docs/script.md` carries the arithmetic for n = 1 and 2.

- *No target, no tolerance:* the receipt is a date under each set of free choices, and the spread shows
  that the choices set the date more than the depths do.
- *Free choices (2):* when the rear was first exposed (Khafre, c. 2500 BCE, `lehner-hawass-2017`); the
  exponent n.

**What it has.** `dobecki-schoch-1992` is in `data/sources.json` (`verified: false`); so is
`lehner-hawass-2017` for the rear's date.

**What stops it.**

1. *The depths are not in `data/`.* They have to be read from the paper's own figures, as records
   `sphinx.enclosure.weathering.depth.s1` to `.s4` and `sphinx_temple.floor.weathering.depth.s9`, `method:
   "seismic refraction"`, with whatever sigma the paper gives. The figures in circulation (S3 about 1.2 m;
   S1, S2 and S4 1.8 to 2.5 m; S4 "about 4 m") come through Reader and Harrell quoting Schoch's *KMT*
   article, and they stay in notes until the paper is read (`docs/script.md`, open question 1).
2. *The rear's date is a free choice, not a record.* The expression environment has no place for a
   claim's own parameter yet; C5 carries its epoch as a top-level field. W1 needs the same: `epoch:
   -2499` for the rear and a parameter `n` swept over 1 and 2. Sweeping a parameter is new to the
   engine; the alternative is two comparisons, one per n, which the engine already does.

**Draft, not in `data/claims/`:**

```yaml
id: W1
title: The date from depth of weathering
group: dating            # a new group: the four there are sky, proportion, site-plan and earth-scale
status: proposed
epoch: -2499
summary: >-
  Under the ditch floor the rock is weathered about twice as deep in front
  as behind the rump. If the depth grows with time, the front was cut long
  before Khafre.
comparisons:
  - label: The front's first exposure, S1 against S3, weathering linear in time (n = 1)
    formula: 1991 - (1991 - epoch) * (sphinx.enclosure.weathering.depth.s1 / sphinx.enclosure.weathering.depth.s3)
    unit: year
  - label: The same, the front slowing as the square root of time (n = 2)
    formula: 1991 - (1991 - epoch) * (sphinx.enclosure.weathering.depth.s1 / sphinx.enclosure.weathering.depth.s3) ^ 2
    unit: year
free_choices:
  - the rear's first exposure, under Khafre
  - the exponent n, one row each
sources:
  for: [dobecki-schoch-1992]
  against: [gauri-1995, harrell-1994]
  context: [lehner-hawass-2017, reader-2001]
```

Whether `epoch` may be used inside a formula, and a comparison without a target, are both checked against
the claims package before the file is written; if either is not supported, that is the change to make, in
`packages/claims`, with its tests.

## For Stewart

- H1's way in: a script-written `data/derived/` file under a `model.` prefix, or keep the head fit as a
  receipt computed outside the engine and shown with the stand-in caveat.
- H1's verdict: a ratio with no "holds", or a tolerance (and whose).
- Which fit H1 reports: the centred (0.39 of the lion head, the head where the lion's stood) or the searched
  (0.61, the largest anywhere along the head). The searched is the honest answer to "how large could it be".
- What H1 says when the fit comes out *smaller* than the monument's head (5.27 m against 5.73 m): the master's
  lion head is then too small to have held the head the Sphinx has, so the test speaks to the stand-in, not to
  the claim. A larger master lion head is a Meshy spend and a look choice; the claim gives no size for it.
