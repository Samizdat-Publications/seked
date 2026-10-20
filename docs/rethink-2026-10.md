# The rethink, October 2026

Agreed with Stewart on 19 and 20 October 2026. This replaces the goal in `CLAUDE.md`'s
"What this is for" once the new plan is written; until then this file is the brief.

## The new goal

Seked becomes **the strongest case for an older Giza, illustrated for an ordinary viewer**:
a steelman of Hancock and Bauval, beautiful enough to show someone. The checking machinery
stays (every number still comes from `data/`), but it moves from the front of the piece to a
supporting role. The question the piece answers is no longer "does the claim hold?" but
"what exactly is the claim, shown as well as it can be shown?".

Archaeologists get a reply wherever they have one: per chapter, quieter than the claim,
never omitted.

## The format: a scroll documentary

One long page. Each chapter pins a full-bleed render and the reader's scroll drives it: the
lion weathers, the sky turns, π draws itself over the profile. The reader sets the pace;
nothing waits on a transition. Taken from the other two options considered:

- **From the realtime option:** one live figure where interaction teaches, the sky time
  slider (drag from today to 10,500 BCE, watch the belt's angle meet the pyramids').
- **From the film option:** an autoplay mode that scrolls the page in time with a narrated
  voice (ElevenLabs), which also records into a short trailer for sharing.

Scrapped: the tour's stop-and-dissolve slideshow (`apps/walk/tour.json` and its player).
Kept: the renders, the eras, the panoramas (as an optional "look around" inside a chapter),
`@seked/sky`, the claims engine (now the receipts), the measurement database.

## The argument as its proponents make it

The 10,500 BCE state shows **the Sphinx, its temples and the plan, and no pyramids**. The
pyramids are built c. 2500 BCE to the older plan. Finished, gold-capped pyramids in a
10,500 BCE forest is the weakest form of the claim and the current First Time render shows
it; that state is to be rebuilt.

## Chapters

0. **Cold open.** Giza at dawn, today. The question.
1. **Older than it should be.** The weathering of the Sphinx and its ditch (Schoch).
2. **A lion, not a king.** The head re-carved and too small; the lion facing Leo at the
   equinox sunrise of 10,500 BCE.
3. **Temples of the same stone.** The valley and Sphinx temples' megaliths cut from the ditch;
   granite cladding laid over limestone already weathered.
4. **The First Time.** Zep Tepi, the Followers of Horus, the Inventory Stela, and the Pyramid
   Texts' king who becomes a star with Orion (Unas, Saqqara, c. 2350 BCE).
5. **The sky as a clock.** Orion's belt on the ground and at its lowest in 10,500 BCE; the
   shafts at Orion and Sirius c. 2450 BCE. The live slider sits here.
6. **Numbers in the stone.** π and φ in the profile, 1 : 43,200, true north to arcminutes.
7. **Before the flood.** The Younger Dryas, and Göbekli Tepe: monumental carved enclosures
   c. 9600 BCE, before farming, pottery or metal, later buried. Stewart's view, and the
   piece's: this is what makes the rest worth taking seriously. The reply here must include
   the post-2019 excavation reports (domestic buildings and cisterns found; the backfill
   possibly slope slides as well as deliberate burial).
8. **What would settle it.** Drilling the ditch floor, the cavities under the Sphinx, the
   surveys not yet made.

Each chapter: the claim at full strength, its receipts (the residual from the claims engine,
where it has one), and the archaeologists' reply, collapsed.

## The Sphinx: one master, subtracted

The lions disagree between eras because each is a separate Meshy generation. Replace them
with **one master lion** (the First Time), and derive every later state from it:

- **c. 10,500 BCE:** the master, fresh cut.
- **c. 7000 BCE:** the same mesh weathered, softer members receding faster than harder ones,
  rounded profiles, fissured ditch walls.
- **c. 2500 BCE:** the king's head carved **inside** the weathered lion head (a boolean the
  head must fit), which is the steelman's account of why it is too small.
- **Today:** further loss from that.

The lion head ghosted around the king's head is a hero image in its own right.

## How the work is split

- **This cloud environment thinks:** plan, script, code, data, Blender geometry and low-sample
  Cycles previews (Blender 5.1.2 runs headless here on CPU, with no GPU; Workbench and EEVEE run too once Mesa's software EGL is installed: `apt-get install -y libegl1 libegl-mesa0 libgl1-mesa-dri`, about 5 s a Workbench frame and 30 to 45 s an EEVEE one at 900 by 500).
- **Stewart's laptop renders:** a local session pulls the branch and runs final renders
  through `scripts/job.py`. Git is the hand-off; one session owns the repo at a time.
- **Bulk research and drafting** run as headless `claude -p` jobs on the API key in
  `SEKED_ANTHROPIC_API_KEY` (the Max plan's monthly API credit, which interactive sessions
  cannot spend). `python scripts/headless.py -p "..."` starts every such job the same way:
  `claude -p` with `ANTHROPIC_API_KEY` set to that key, which outranks a subscription login
  in print mode, in an environment with the host session's `CLAUDE_*` and `ANTHROPIC_*`
  stripped and a config directory of its own (`build/headless/config`) that holds no login.
  A long one goes through `scripts/job.py`; chapter research goes through
  `scripts/research.py`, which writes `docs/research/chN.md`.
- **The one-line test ran on 20 October, 01:54 to 01:57 UTC**, all on `claude-haiku-5-5`, under a
  cent in all: a plain `claude -p` ($0.0022, most of it 17,273 tokens of Claude Code's own
  prompt and tool list written to the cache), then the same call through `headless.py`
  ($0.0003, and it reached for a tool), then with `--tools ""` ($0.00001, 83 tokens in,
  "ready" out), then that once more detached through `job.py`. A bogus key in the same
  setup is refused ("Invalid API key"), so the calls that succeeded went on this key and
  nothing else. **For Stewart:** the Console's usage page should show these four Haiku
  calls against the key; if it shows nothing, the credit is not where we think it is.
- **Not `--bare`.** The first version ran `claude --bare`, which forbids any login, but it
  also cuts the built-in tools to Bash, Edit and Read whatever `--tools` asks for. The first
  chapter-1 pilot therefore had no web search, wrote 27 citations from memory and none
  checked, and cost $1.23 for a draft that had to be thrown away. Without `--bare`, the job
  has WebSearch, WebFetch, Read, Grep and Glob, a bogus key is still refused, and one search
  cost $0.02 on Haiku.
- **Effort:** planning and the script at extra; building at high; max only for a named, narrow
  hard problem, and said so first.

## Next

1. The new plan (`docs/plan.html` replaced or superseded), with the chapter script and its
   sources, the asset list per chapter and what each reuses.
   **20 October:** the plan is written and the September one kept as `docs/plan-2026-09.html`.
   The research for chapters 1 to 8 is in `docs/research/`. The script's first draft is
   `docs/script.md`, to be edited.
2. The master Sphinx and its subtracted eras. **Blocked in the cloud** until the Meshy GLBs
   reach it (the plan's decision 1).
3. The First Time rebuilt without pyramids. **20 October:** done in code, in both the renders
   (`render/giza/states.py`, `pyramids.py`) and the realtime viewer (`apps/web/src/model.ts`,
   `Pyramids.tsx`). Its render is still to be looked at, on the laptop, because a cloud preview
   lacks the Sketchfab props and the Meshy GLBs.
