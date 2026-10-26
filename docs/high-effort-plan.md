# The high-effort session: what it is for

**Starting cold (a new session after the 22 October quota reset):** claim the repo first
(`python scripts/job.py claim <session name>`; the last owner was `laptop-lead`, whose thread has ended). Read
`CLAUDE.md` (its purpose was sharpened on 22 October), this file, then `build/critic/ch0-2-v3-critique.md`. The
exhibit runs with `cd apps/exhibit; npx vite --port 5196`, the voice lab with `python scripts/voice_lab.py`
(port 5197). Version 3 of the script is live; the order of work is below, the Sphinx models first.

*Written 22 October 2026, from Stewart's direction that day and the Gemini critic's review of chapters 0 to 2
(`build/critic/ch0-2-v2-critique.md`). Run at high effort, or extra high where a step needs it. Credits for Meshy,
Gemini and ElevenLabs are approved: spend what it takes.*

## 0. Done in the high-effort session of 22 October (afternoon)

- **The Sphinx lab** (`scripts/sphinx_lab/`): `lab_sheet.py` renders seven fixed views of an era's statue, in its
  material and in clay, through the renderer's own statue code; `critic.py` scores a sheet with Gemini 3.1 pro
  briefed as a senior modeller, or compares two (`--against`, order swapped each run). Single scores swing a point
  between runs; the pairwise comparison is the signal. Rounds are in `build/sphinx-lab/rounds/`.
- **The claim eras' lion re-cut as rock** (`scripts/sphinx_lab/rock.py`, `render/giza/limestone.py`): the old long
  rains' lion was the master pushed in and smoothed (the melted wax). Now the master is rebuilt as a solid,
  reproportioned towards ARCE (back to 11.6 m, 1.3 times wider), its beds cut in the geometry (coves, ledges with
  broken lips, joints, a worn foot set back under the lowest ledge, the head left hard), and its rock is three
  Poly Haven scans laid bed by bed. The quarry-wall photograph was the "wood grain": its tool marks run
  diagonally. Long rains 3 to 4 single-scored, and preferred in every pairwise run over the old (3 against 7);
  First Time preferred 4 of 4 (4 to 5.75). Installed as the finishes `lion-rock` and `first-time-rock`.
- **Still to do on the Sphinx:** today's (sphinx-meshy) scaffolding is fused into a mesh that is not watertight, so
  the SDF tricks fail; the First Time's flank reads soft and draped close up (the master's own forms); the as-built
  era still uses sphinx-built.
- **The spoken replies were cut off.** Version 3 kept only the first wrapped line of each spoken reply in
  `docs/script.md`, and they were recorded so ("...and geologists that the rock's own layers"). Restored from
  `docs/script-v3-draft.md`, re-recorded and applied (commit 488bb9c).
- **Every reply has its own picture** (2b.1): `replies` in `apps/exhibit/leaves.json`, played by the player while the
  reply speaks, labelled as the survey it is.
- **Chapter 1's seismic survey** is a section figure under the ditch floor (2.3, 2b.3), its depths entered in
  `data/measurements/underground.json` as claimed and unverified; **figures are large cards** (2b.4).
- **ch0-t08, ch7-schoch, ch7-plan** moved from behind the temple wall to the face station (2b.5).
- **Leo at twilight** (2b.2): moment `equinox-twilight` added; the panorama renders in job `sphinx-rock-2`; then move
  `ch2-leo` to it.
- **Leo at twilight is in:** `ch2-leo` stands at `equinox-twilight` (exposure 3.4), Leo rising over the lion's head.
- **The critic on version 4** (`build/critic/ch0-2-v4-critique.md`, chapters 0 to 2, 3:03, the same brief as version
  3 rescored in `ch0-2-v3-rescored.md`): overall 5.5 against 4.3; pacing 4 (3), narration 6 (5), camera 5 (4),
  pictures 6 (6), clarity 7 (5), hook 5 (3). Its asks now: the reply shots need to explain themselves (callouts in
  the scene: "cut from the ditch", the harder band at the head), the Leo hold shorter with the figure drawn sooner,
  callouts drawn into the scene rather than cards, Gobekli Tepe out of the trailer (Stewart keeps it), continuous
  camera motion, the green-era grass and the tourists, two lines it calls redundant ("Nobody disputes that", "You
  can only carve a smaller shape out of a larger one"), and ambient sound.

## 0b. Decisions taken while Stewart was away (22 October, evening)

Stewart: "don't let me be a blocker on anything, make decisions, log them and keep going." These were decided here;
any can be reversed.

1. **The trailer's night shot draws its sky.** `ch0-t05` had no live sky, so it showed a blank night (Stewart's
   note). It now draws 2450 BCE's stars, Orion in gold, the meridian and Alnitak on it, framed to keep the
   pyramids at the foot (view 182/25/84).
2. **The long rains' lion is less deeply channelled** (Stewart: "I don't think the sphinx has channels that deep").
   Coves 1.1 m instead of 1.6, joints 0.6 m and narrow instead of 1.5 m. Reasoning: the body's beds are worn back on
   the order of a metre and its joints are cracks; the deep vertical runnels are mostly a feature of the ditch walls.
   To check against ARCE's elevations when someone reads them.
3. **Every reply shot says what it shows**, with callouts in the scene (chapters 1, 2, 3, 5, 6). Chapter 3's shot
   was re-aimed: the ruin it first pointed at is not Menkaure's temple, which stands at bearing 307 from the station.
   Chapters 4, 7, 8 and 9 have no callouts yet (the plateau today; the ditch floor; the opening view).
4. **Scene callouts are larger** (up to 1.9 times on a wide screen), after the critic's "illegible panels".
5. **Leo is two shots**: the lion facing the eastern glow, then a turn up to Leo rising; the words are unchanged.
6. **The crowds at the Sphinx are gone from today's panoramas** (every critic review called them stiff mannequins;
   the plan listed them). The crowds at the pyramids stay, for scale. `render/giza/scatter.py`.
7. **A loading gap fixed:** a prefetched panorama was evicted as soon as it arrived (the cache stamped it when its
   fetch began), which showed 2 s of "Loading the panorama" before chapter 2's reply.
8. **Version 5's critic** (`build/critic/ch0-2-v5-critique.md`): 5.0 overall, against 5.5 for version 4; within the
   critic's swing of about half a point. It still wants faster narration, no on-screen captions duplicating the
   voice, a tighter cold open without Gobekli Tepe, and the seismic numbers out of the voice: all Stewart's calls.
9. **Version 6 scored 5.5 and is deployed** (seked.pages.dev, 22 October, 21:11): pacing 4, narration 7, camera 5,
   pictures 6, clarity 7, hook 5 (`build/critic/ch0-2-v6-critique.md`). Its top asks: shorter pauses in the narration,
   continuous camera drift on the long holds, the seismic zones lit as they are spoken, the green-era grass, the
   cold open cut down, ambient sound, the scaffolding out of the ditch shots.
   (Before Stewart topped up the Gemini credit, version 6 was captured but not scored: (`build/critic/ch0-2-v6.mp4`, 3:02: no crowds at the Sphinx, every reply
   with its callouts, the loading gap gone). Gemini refused the upload with 402 Payment Required: the account's
   prepaid credit has run out, and topping it up is Stewart's to do. Then: `python scripts/video_critic.py
   build/critic/ch0-2-v6.mp4 --brief build/critic/brief-exhibit.md --out build/critic/ch0-2-v6-critique.md`.)
10. **Pauses tightened, version 7 scored 5.2** (not deployed): the takes' pauses 0.45 to 0.30 s (18 s off the whole
    narration) and the gap between leaves 0.7 to 0.35 s; chapters 0 to 2 run 2:55 against 3:02. The critic's
    narration score went 7 to 5 on the same voice and words, so the pauses are not what it hears: it is the rate.
    Samples at tempo 1.15 and 1.25 (pause 0.30) are in the voice lab's samples for Stewart's ear
    (`python scripts/voice_lab.py`, http://localhost:5197). Stewart listened and kept **1.15**: 1.25 is "a bit too
    fast". The tempo is settled; pace is to come from words and leaves, not the read. Its standing asks: no subtitles mirroring the voice,
    chapter 1's ditch shortened, the callouts projected onto the stone, the cold open without Gobekli Tepe.
11. **Not done, on purpose:** cutting Gobekli Tepe from the trailer, cutting "Nobody disputes that" and "You can
   only carve a smaller shape out of a larger one", and ambient sound. Those change the script or add a new layer,
   and wait for Stewart.

## 0c. The outstanding-items session (23 October, evening)

1. **Deployed** everything to 23 October's Labyrinth (Stewart asked to review on the live site).
2. **Pillar 43 faces west**, radial in the wall, as the DAI's own post describes it (read through the Wayback Machine:
   dainst.blog itself is down, but its archived pages load, which may also unblock Pillars 20, 30 and 38).
3. **The Labyrinth plan is not Kircher's**: his Turris Babel plate is a different design. The captions now say the
   plan's original is not yet traced (found 25 October: Canina, 1839-44, Tav. CXXII; see `docs/to-source.md`).
4. **Göbekli Tepe is in chapter 7** (Stewart: "still not in the exhibit"): `ch7-built` cues four cards before the
   sky card, the excavation today, Enclosure D about 9500 BCE, Pillar 43 and the central pair
   (`scripts/exhibit_gobekli.py`).
5. **The head-size shot shows the face** (Stewart: it "still shows the back right side"): `ch2-nemes` moves to a new
   station, `sphinx-quarter`, south-east of the head, the three-quarter view of the face with the body behind it.
   `ch2-small` cuts from it until a flight between the two stations is rendered.
6. **Figure cards stop above the caption band**: a tall drawing and a long caption ran under the place line
   (Stewart's screenshot of the Pillar 43 sky card); the card's drawing now gives up height instead.
7. **Still open from section 2**: the static holds in chapter 1. (Done since: the temple blocks' weathering, the
   green-era grass, the Sphinx clean-up, and the flood at the temples, item 7 there.)

## 0d. Stewart's calls, 24 October

- **Göbekli Tepe stays in the trailer**, shown off: its shot (`ch0-t06`) now shows Enclosure D as built (the
  `gobekli-ring` card) instead of the Pillar 43 sky diagram over the green grass, which is what the critic was
  reacting to. Do not cut it.
- **"Nobody disputes that" and "You can only carve a smaller shape out of a larger one" stay.**
- **Ambient sound: yes**, ElevenLabs or Gemini as works best, credits approved.
- **Karahan Tepe comes last** (models are hard to find).
- **Today's Sphinx loses its scaffolding** (finish the descaffold work in `scripts/sphinx_lab/`).

Done the same day: the trailer's Göbekli shot shows Enclosure D as built; ambient sound under the narration (five
ElevenLabs beds by place and hour, `scripts/ambient.py`, `apps/exhibit/src/ambient.ts`); today's Sphinx without its
scaffolding (finish `clean`, `scripts/sphinx_lab/descaffold.py` c10), its panoramas, patches and the
`ch2-nemes--ch2-small` flight rendered again. Left: a faint painted ghost of the lattice on the south flank and the
back, and one small hole at the top of the rump; Karahan Tepe, last.

Stewart, the same evening: scaffolding on today's Sphinx would have been fine; keep the scaffold-free one as it
is and stop work on the scaffold. The pole and flat ladder frame still faint in `ch1-rolls` stay. Do not reopen.

Then, from section 2: the seismic section lights its zones as they are named (`ch1-depth`: `seismic-front@front`,
`seismic-rear@behind`, relit in place); chapter 1's static holds (item 2.1) are gone with version 3 of the script,
its longest leaf now 11 s under the slow drift, so nothing was cut.

## 0e. Overnight, 25 October (Stewart asleep: "continue working through all the remaining items")

1. **The flood at the temples** (2.7): a quay round the claim eras' two temples, see 2.7.
2. **The First Time's temple walls** (2.8): laid as stepped megalithic core work (`lay_masonry` in fresh limestone,
   blocks 1 to 3 m high and up to 8 m long, beds stepping along the wall) instead of even courses that read as a
   clean brick wall. The long rains' walls already read as weathered rubble work and are unchanged.
3. **The tourists** (2.8): closed. The crowds at the Sphinx went on 22 October; the only leaf that faces a crowd now is
   `ch9-answer`, 80 m off, where they read as people for scale. That leaf also showed a flat grey shape in the sand:
   a car park drawn as one flat polygon at its corners' heights, sunk under the ground between them. Car parks are
   now cut into small triangles draped on the ground and lifted clear of the ripples, and each road edge takes the
   ground's height under it (`render/giza/roads.py`). The faint outline left in the sand there is OpenStreetMap's
   footpaths, painted as trodden tracks (`_tracks` in `render/giza/materials.py`), as intended.
4. **The Labyrinth plan is Canina's** (Tav. CXXII, 1839-44): credited in the captions, see `docs/to-source.md`.
5. **The trailer's money shot** (section 3): `ch0-t03` now wipes in place from the long rains' lion (`ch0-t02`, the
   flank at 340/15/60) to the First Time's at the same view, instead of cutting to the side station; the words are
   unchanged. Tried first and dropped: wiping all three at the opening view over the temples, where the First Time's
   whole 12 m walls hide all but the lion's head (the critic's "garden ornament"). To undo: give `ch0-t03` back
   `sphinx-side` (356/8/66) and `arrive: cut`.
6. **Pillars 30 and 38**: still not found labelled; left on `docs/to-source.md`.
7. **Karahan Tepe, for Stewart to decide.** Two scans fetched and registered in `blender/models.json`: the site
   from drone video (333DDD, CC BY) and Structure AB, the rock-cut room of pillars with the head in its wall
   (Megalithomania, CC BY-NC-SA), rendered as cards by `render/karahan.py` into `build/karahan/`. Not in the
   exhibit, because the narration does not name the site and adding it means recording chapter 7 again, whose takes
   Stewart chose by ear. A draft line to follow `ch7-built`, if wanted: "Thirty-seven kilometres away, at Karahan
   Tepe, the same people cut a room into the bedrock, with pillars rising from the floor and a head looking out of
   the wall." (37 km is the straight line from Enclosure D to the AB pit, from the scans' coordinates; the
   description is Karul 2021, `karul-2021`, unchecked.) Then the two cards as `karahan-site@Karahan` and
   `karahan-ab@room`.

8. **The critic on version 8** (`build/critic/ch0-2-v8-critique.md`, chapters 0 to 2, 2:51, after all of the above):
   4.8 overall against version 7's 5.2 and version 6's 5.5, inside its swing; pacing 4, narration 6, camera 5,
   pictures 6, clarity 5, hook 3. It called the lion wipe and the head the strongest sequence, and the trailer's
   Göbekli card (the ring from above) "an untextured grey box model": the trailer now shows the central pair
   (`gobekli-pair`) instead. Its other asks are the standing ones that are Stewart's calls (a faster read, no
   captions mirroring the voice, a shorter cold open without Göbekli Tepe, the replies louder in the piece) or larger
   work (a 3D sky dome in motion, push-ins on the ditch's coves, the seismic depths projected onto the floor).

## 0f. Karahan Tepe and the sky in motion (25 October, Stewart's calls)

1. **Karahan Tepe is in chapter 7** (Stewart: yes to the drafted line). `ch7-karahan` follows `ch7-built`: "Thirty-seven
   kilometres away, at Karahan Tepe, the same people cut a room into the bedrock, with pillars rising from the floor and
   a head looking out of the wall." Chapter 7 recorded again (take ch7-narration-091, tightened as the rest), the two
   scans as cards (`karahan-site@Karahan`, `karahan-ab@room`).
2. **Leo winds back over the lion, rendered** (Stewart: "Do both: render the Leo film over the lion first"). A 9 s
   film, `apps/exhibit/flights/ch2-leo-sky.mp4`, plays over `ch2-leo` under its words (the leaf's new `film`): the First
   Time lion from behind at the equinox's nautical twilight, the sky winding from today to C5's 10,500 BCE until Leo
   stands over the lion's head, its figure drawn in gold. Every star of every frame is `scripts/sky-leo.ts`'s bake,
   on the exhibit's own wind and sidereal time, so the last frame is the live sky the panorama hands over to and the
   panel's year runs with it. Rendered by `render/build.py --sky-film ch2-leo` (`render/films-sky.json`), about ten
   seconds a frame.
3. **The live sky winds on more leaves**: `ch0-t05` (today to 2450 BCE, the trailer's Orion), `ch4-turin` (today to
   10,500 BCE) and `ch4-sky` (10,500 BCE forward to 2450 BCE), as `ch5-sinks` already did. The sky's note is one line
   now, keeping the catalogue's and the figures' credit, and the brightest stars bloom more.

## 0g. Stewart's fixes, 25 October (evening)

1. **Today's Sphinx keeps its full scaffold again** (Stewart: "the scaffold looked better when it was just a full
   scaffold"). `render/giza/sphinx.py` gives `buried` and `excavated` the raw sphinx-meshy again; the `clean` finish
   stays on disk. The six panoramas round it, their patches and the `ch2-nemes--ch2-small` flight rendered again.
   This replaces 0d's "do not reopen": the scaffold is back by Stewart's choice.
2. **Menkaure's temple stood in the air.** Its footprint's base is an import's 0 on ground running 5 to 17 m, and the
   renderer treated 0 as unset for the walls but skipped the temple's levelled court, so the walls hung over the low
   side. Now a temple without a base is levelled at its lowest corner (`temples._unset_base`, as
   `scripts/footprints.ts` sets bases). Grounded, the low ruin was hidden behind the rise from the menkaure station,
   so chapter 3's reply looks from a new station, `menkaure-temple`, on the slope east of the court: the ruin in front,
   the pyramid's granite casing behind.
3. **The live sky no longer shows through trees and the statue.** Each panorama with a live sky has a mask of its
   open sky (`render/sky_masks.py`, `apps/walk/pano/mask/`), rendered in the same Blender session straight after the
   panorama (`build.py`'s `mask`: the plants are not laid out the same in two runs). Stars, figures, the meridian and
   their labels are drawn only where the mask is open; the horizon's ticks and the sun are not masked.

## 0h. Chapter 1's geology, the critic on chapters 3 to 9, flights (26 October)

1. **Chapter 1 points at the geology** (the critic's "fails to push in or highlight the exact fissures"): `ch1-rolls`
   turns in along the corridor between the body and the south wall (282/8/52), and its words draw two labels as they
   are spoken: "Soft beds, worn back into coves" on the body's flank at "coves", "Cracks widest at the top" on the ditch
   wall at "cracks", the second saying the wall's fissures are modelled as Schoch describes them
   (`render/publish.py` `leaf_callouts`).
2. **A dark crease along the ditch walls' foot, at low sun, gone.** The ground's 1 m patch made a ramp from floor to
   rim in front of the wall face. The floor now runs 2.5 m behind the faces (`terrain.CUT_BEHIND`), the walls read
   their brink beyond that and carry a cap from the brink down onto the ground behind, and the coarse grid is sunk
   under each camera's patch. A road along the rim no longer hangs an edge into the ditch (`roads.EDGE_DROP`). Every
   panorama and patch round the Sphinx, in every era, rendered again.
3. **The critic on chapters 3 to 9** (`build/critic/ch3-9-v1-critique.md`, the first review of them): 4.5 overall;
   pacing 4, narration 5, camera 5, pictures 6, clarity 5, ending 3. Done from it: picture cards (Göbekli, Karahan,
   the Labyrinth) fill the stage instead of floating as panels; five cuts round the Sphinx are flights
   (`ch2-look--ch2-nemes`, `ch8-dug--ch9-tested`, `ch9-tested--ch9-floor`, `ch9-cores--ch9-underneath`,
   `ch9-story--ch9-look`). Left for Stewart: cut chapter 6 (the numbers), a second voice for the replies, chapter 9
   narrowed to the drill cores, a map between Egypt and Turkey.
4. **From my own sweep of chapters 3 to 9:** scene labels with no room beside a card are left out instead of half
   under it; the Khafre cutaway card fits its room (its retraction ran over the caption); `ch8-paws` and `ch8-dug`
   look from the face's three-quarter view (a paw blurred against the lens); chapters 4 and 7's replies look from the
   east and south stations instead of specks on the horizon from the panorama stand.

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
   **Done 25 October:** a quay (`render/giza/quay.py`, labelled a look choice there and in the render log): the
   two temples stand on a paved terrace 7 m wide at their platform's level, its north, east and south edges laid
   in the same megaliths 1.8 m down into the water, the bank off its east edge dug away so the edge stands in the
   flood. The ground under it is cut below the paving and nothing grows on it. The long rains' plateau grass was
   thinned at the same time (cover 0.85 to 0.75), so it stays barer than the First Time's after the wild-grass pass.
8. The First Time temple blocks, the long-rains weathering, the tourist figures in today's panoramas. **Done 25 October**
   (0e.2 and 0e.3): the First Time's walls laid as stepped megalithic work; the long rains' already read weathered; the
   tourists closed.

## 2b. The critic on version 3 (`build/critic/ch0-2-v3-critique.md`, 22 October, trailer to chapter 2, 3:01)

It praised the writing, the head shots and the era wipes. Its ranked asks, with what to do:
1. **Give every spoken reply its own shot** (its top change): the reply plays over the claimants' own pictures, so
   viewers forget it. One line of reply over one picture of the reply: for chapter 1, Khafre's quarry blocks and
   Old Kingdom tool marks; for chapter 2, the harder band of rock at the head. A reply shot list per chapter, then
   renders, then a `replyView` (station, era, view) per chapter that the player turns to while the reply speaks.
2. Pre-dawn twilight for the Leo sky (chapter 2, `ch2-leo`): stars over a dark sky, the sun's glow below the
   horizon, not lines over daylight. A new moment, rendered.
3. Close-ups of the ditch wall's coves beside a wind-scoured face; cut the dirty-concrete floor shot.
4. Figures as clean full-screen graphics or overlays drawn into the scene, not small panels with tiny text.
5. The green-era grass and the head over the wall "like a garden ornament" (`ch0-t08`, borrowed from `ch0-claim`).
Done at the end of 22 October's medium session: the trailer's agenda line cut, Orion's trailer shot lowered, each
reply's audio fetched ahead (commit e5d150f, tested in code only: confirm in the next capture that the 3.8 s gap
before a reply is gone), and the critic's brief (`build/critic/brief-exhibit.md`) now asks for scores out of 10.
Ignored, on purpose: cutting Göbekli Tepe from the trailer (Stewart wants all nine beats; the critic does not know
the piece covers it) and a 25-second trailer (too short for nine beats).

## 3. The new script: version 3 is in (`docs/script.md`), first cut 22 October

Done: the trailer and nine beats recorded in the voice lab, tightened (pause 0.45 s, tempo 1.15), recut
(`scripts/recut_leaves.py`) and the trailer's leaves built (`scripts/trailer_leaves.py`, shots borrowed from version
2's leaves). 8.9 minutes of narration. Still to do: re-roll any take Stewart flags in the voice lab; better shots
for the trailer (flights and wipes as the money shots); the leaves the recut dropped (chapter 2 went from 11 to 7)
where a picture was lost; then record chapters 0 to 2 again and run the critic.

## 3a. (Superseded) the plan before version 3 was approved

Apply it to `docs/script.md`, record it in the voice lab (`python scripts/voice_lab.py`), let Stewart pick takes,
apply (tightened at pause 0.45 s, tempo 1.15), recut the leaves (`scripts/recut_leaves.py`), and build the trailer's
leaves from the money shots. Then record chapters 0 to 2 again and run the critic (`scripts/capture_exhibit.py`,
`scripts/video_critic.py`) to see the score move.
