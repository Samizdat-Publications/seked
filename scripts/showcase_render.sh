#!/usr/bin/env bash
# Render the showcase film's three flights (render/films-showcase.json) at full size, then cut them.
# Restartable: render/build.py skips frames already on disk, so a run cut short by memory is tried again.
B="/c/Program Files/Blender Foundation/Blender 5.1/blender.exe"
cd "$(dirname "$0")/.."
for id in show-twilight show-built show-lion; do
  for try in 1 2 3 4; do
    n=$(ls build/films/$id/frames/frame_*.png 2>/dev/null | wc -l)
    [ "$n" -ge 120 ] && break
    echo "$id try $try ($n frames on disk)"
    "$B" -b --factory-startup -P render/build.py -- --films render/films-showcase.json --film $id >> build/films/$id-full.log 2>&1
  done
  echo "$id done with $(ls build/films/$id/frames/frame_*.png 2>/dev/null | wc -l) frames"
done
