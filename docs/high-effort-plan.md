# The high-effort session: what it is for

*Written 22 October 2026, from Stewart's direction that day and the Gemini critic's review of chapters 0 to 2
(`build/critic/ch0-2-v2-critique.md`). Run at high effort, or extra high where a step needs it. Credits for Meshy,
Gemini and ElevenLabs are approved: spend what it takes.*

## 1. The Sphinx models, first and above all (a focused session of their own)

Stewart: the Sphinx models are the main thing to get right before this is finished, and the older one needs a lot of
cleaning up. Generate as many as it takes.

**What is wrong now** (the critic, and Stewart's screenshot of the long-rains flank, leaf 11 of 80): the eroded lion
reads as "melted wax or untextured digital clay", with no stone grain, bedding or fracture; loose frills and flaps
stick out along the back and the neck; the surface is one smooth brown with no strata, which is the very thing
chapter 1 is about (soft beds cut back into coves, hard beds standing out as ridges).

**The loop.** A senior-modeller critic, separate from the video critic:
1. Generate or refine a candidate (Meshy from clay views and photographs, as in the existing pipeline: clay views,
   then nano banana, then the 2D lengthening, then Meshy; see the memory note on the Sphinx pipeline).
2. Render the candidate in Blender from a fixed set of views (front, both flanks, three-quarter, the head close, the
   back), in clay and in the era's material, at the same lighting each time.
3. Send the sheet to Gemini, briefed as a senior 3D modeller reviewing a junior's sculpt of a weathered limestone
   monument: what reads wrong, in order, with where on the model (head, neck, back, flank, paws), and what to change.
   Give it the reference photographs of the real Sphinx and the brief's rules, nothing about how the model was made.
4. Fix (Meshy refine, Blender sculpt or displacement from the bedding, retexture), re-render the same views, re-score.
   Keep every round's sheet and score in `build/sphinx-lab/`, and stop when the score stops climbing.

**Stewart's standing rules for the Sphinx** (from the September and October sessions): realism over stylisation; the
monument body stylised only where the source is; damage on Member II; the paws on the floor; the bedding must read.

**Which models:** the long-rains lion (c. 7000 BCE, eroded), the First Time lion (fresh-cut, its paw material still
wrong), and the recarved today's Sphinx where it is ours rather than the scan.

## 2. The critic's other fixes, in order of its ranking

1. Cut static holds: the 26-second temple-wall hold and the 30-second scaffolding hold in chapter 1. (The slow drift
   is in; these need shorter leaves or new shots.)
2. The head-proportion shot: a side profile or the front, not over the shoulder at the back of the head.
3. The seismic survey: a cross-section graphic under the ditch floor (depths in front and behind), not the floor
   seen from eye level.
4. The black pop-up card at 2:41: an overlay ghosted onto the 3D Sphinx (lion skull to Khafre's headcloth) instead.
5. The temple blocks: weathering and variation instead of clean, uniform, grouted blocks.
6. The green Sahara vegetation: Stewart would accept it as is if it had to stay; improve if time allows.
7. The water at the temples in the green eras (`render/giza/water.py`, `LEVELS["flood"]`, -42.6 m, a look choice):
   it laps the Valley Temple's bare wall. Drop it below the temple platforms or give it a stone quay, and label it.
8. The First Time temple blocks, the long-rains weathering, the tourist figures in today's panoramas.

## 3. Then the new script (`docs/script-v3-draft.md`), once Stewart approves it

Apply it to `docs/script.md`, record it in the voice lab (`python scripts/voice_lab.py`), let Stewart pick takes,
apply (tightened at pause 0.45 s, tempo 1.15), recut the leaves (`scripts/recut_leaves.py`), and build the trailer's
leaves from the money shots. Then record chapters 0 to 2 again and run the critic (`scripts/capture_exhibit.py`,
`scripts/video_critic.py`) to see the score move.
