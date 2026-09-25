# render/

The plateau at block scale, built in Blender 5.1 and path traced in Cycles. The design
is `docs/superpowers/specs/2026-09-24-path-traced-walkthrough-design.md`.

    blender -b --factory-startup -P render/build.py -- --state today --station south
    blender -b --factory-startup -P render/build.py -- --state built --shot panorama
    blender -b --factory-startup -P render/build.py -- --queue render/queues/walk.json

Blender is at `C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`. A queue
longer than about ten minutes goes through `python scripts/job.py start`.

- `stations.json`: 360-degree panoramas for the walkthrough (`apps/walk`), each with a
  moment chosen so the station is not in a pyramid's shadow unless it is meant to be.
- `shots.json`: framed hero stills.
- `giza/`: the package. `pyramids.py` holds every look choice about the pyramids in
  `LOOK`; survey numbers come from `data.py`, which reads `data/`.
- `tests/`: plain-Python tests of the bpy-free parts, `python -m unittest discover -s render/tests`.

Nothing here writes to `data/`. Everything visual that is not a survey number is a
reconstruction at block scale and is labelled as one wherever it is shown.
