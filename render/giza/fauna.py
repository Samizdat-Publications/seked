"""
Animals for the walkthrough's eras: herds of instanced stand-ins, drawn from the third-party
models listed under `animals` in blender/models.json, as figures.py draws its people.

Every animal is a look choice. A model is somebody's giraffe or camel, posed, decimated and
drawn at a size chosen here (MODELS), not measured; nothing of its form is evidence of the
animals of any era, and where a herd grazes and how many it has are look choices too (HERDS).
The claim's two eras get the savanna the African Humid Period would have carried (the animals
of the Saharan rock art: elephants, giraffes, antelopes, ostriches, buffalo, and hippopotamuses
in the flood), labelled a claim with the eras themselves; as built, long-horned cattle, loaded donkeys and goats; in 1800 a few camels,
donkeys and goats by the village; today saddled tourist camels and horses, some with carts.
Every object carries that label ("seked_animal") with its model's licence and attribution.

    library(parent, era, log=print)

returns a collection of the era's animal variants, linked under `parent`, or None for an era
with none or none on disk. It is a set of variants exactly as variants.collection makes them:
one object per variant, named "<collection> NN" so Collection Info picks them in that order,
each parked at PARKED so only its instances render, each standing with its lowest point on
z = 0 and the middle of its feet at the origin, facing +Y, at its real-world size, with no
rotation or scale on the object. A variant is one model in one pose: a rigged model gives
several (a giraffe standing, browsing and walking), baked from its own animations. Each object
carries "variant", "kind", "animal" (the manifest id) and "height" (metres) properties.

    herds(era)

returns where the era's herds are, as Herd(x, y, half_w, half_d, count, kinds): a rectangle
centred on (x, y) in the project frame (+x east, +y north, metres from Khufu's base centre),
half_w east-west and half_d north-south, how many animals, and the kinds they are drawn from
(KINDS; the first kind is three times as likely as each of the others). Plain data, no Blender.

    place(era, terrain, coll, lib, avoid=(), log=print, seed=0)

scatters the herds onto the terrain as one point cloud of instances of `lib` (library's
collection) through instancing.field, linked into `coll`, and returns it (None when there is
nothing to place). It keeps animals out of the era's water (all but the hippopotamuses, which
stand in its shallows), off its monuments and out of its houses, clear of
every station in render/stations.json by STATION_CLEAR metres and of any (x, y, radius) in
`avoid`, pitches each to the slope under it, loosely aligns a herd, turns animals on today's
roads to face along them, mirrors half of them and makes a few of each herd young (smaller).
The scene can wire it in with two lines after its own layers are built:

    lib = fauna.library(self.library, state, self.log)
    if lib is not None:
        fauna.place(state, self.terrain, self.world, lib, log=self.log)

A variant's GLB is found through build/models/index.json, which `python scripts/models.py`
writes. The prepared library of an era is kept in build/fauna/<era>.blend with the key of
everything it was made from, so a later build appends it in a second instead of importing and
decimating every model again; a change to this file's tables, to a model or to the index makes
a new one.

Materials keep each model's base colour, normal and roughness maps, cut to TEXTURE_PX, with
the alpha never used: an animal is opaque, and alpha-card hair (eyelashes, tail tufts, a camel's
hair cards) would cost every ray a transparent bounce and draw black past the renderer's four.
Such cards are dropped where they are a small part of a model (or named in its `drop`), and
made opaque where not. Hide and coats are kept from shining (ROUGHNESS, SPECULAR, no metal) and
given a little sheen, the soft rim a coat takes against a low sun. Each instance's `tone` moves
brightness and saturation a few per cent, so a herd of one model is not a herd of clones.

    blender -b --factory-startup -P render/giza/fauna.py -- sheet --era first-time
    blender -b --factory-startup -P render/giza/fauna.py -- test --era today
    blender -b --factory-startup -P render/giza/fauna.py -- herds --era built
    blender -b --factory-startup -P render/giza/fauna.py -- measure --era built

`sheet` stands the era's variants side by side in profile beside a 1.75 m figure; `test` puts
a few of each at 20, 60 and 150 m from a camera in the late afternoon sun; `herds` builds the
era as the walkthrough does, places its herds and renders HERD_SHOTS, framed views of them from
the stations; `measure` prints each variant's size and triangles and keeps its mesh, with each
triangle's texture colour, under build/fauna/check/. All write into build/fauna/.
"""
import collections
import hashlib
import io
import json
import math
import os
import sys
import time

import numpy as np

if __name__ == "__main__" and not __package__:
    # Run as a script inside Blender (see _main): make the package importable and join it.
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    __package__ = "giza"

from . import data, states  # noqa: E402

try:
    import bpy
    from mathutils import Matrix
except ImportError:          # the tables and herds are read by plain-Python tests
    bpy = None

BLENDER_DIR = os.path.join(data.REPO, "blender")
MANIFEST = os.path.join(BLENDER_DIR, "models.json")
INDEX = os.path.join(data.REPO, "build", "models", "index.json")
OUT = os.path.join(data.REPO, "build", "fauna")
PARKED = (0.0, 0.0, -20000.0)      # where the originals wait, as variants.PARKED
CACHE_VERSION = 1                  # bump to rebuild every cached library

FACES = 12000                      # triangles a variant is decimated to unless MODELS says otherwise (a look choice)
TEXTURE_PX = 1024                  # the most pixels on a side its textures keep (a look and memory choice)
SHARP_DEG = 60.0                   # faces meeting at more than this keep a hard edge (a look choice)
TONE = dict(value=(0.9, 1.1), saturation=(0.88, 1.12))   # what an instance's tone moves (a look choice)
ROUGHNESS = (0.5, 1.0)             # a roughness map is read into this range; hide and hair are matte (a look choice)
SPECULAR = 0.3                     # the Principled BSDF's specular IOR level for every animal material (a look choice)
SHEEN = (0.2, 0.6)                 # sheen weight and roughness (a look choice)
ALPHA_CARDS = 0.05                 # an alpha material on less than this share of a model's faces is dropped
STATION_CLEAR = 12.0               # metres kept clear round every station (a look choice)

# LOOK CHOICES, every one. How each model in the manifest is read. `height`: metres from the
# ground to the highest point of the model in its reference pose `ref` (an action and the
# fraction of its frame range, or None for the pose it imports in), chosen so the animal's
# shoulder stands at a natural height for its kind (the comment gives it); every pose of the
# model is drawn at the same scale. `turn`: degrees about Z that bring it round to face +Y, or
# "axis" with the axis its head points along ("axis-x"): the plan's principal axis is turned
# onto Y, head forward. `faces`: triangles kept. `drop`: fragments of material or object names
# whose faces are removed. `cut`: a plinth, as a share of the model's height from its lowest
# point, cut away with the loose pieces left standing on it. `kneel`, `graze` and `bend` are the
# model's parts for the poses a variant asks for with "@kneel", "@graze" or "@bend" (see _kneel,
# _graze and _bend): its rig's bones, or for a model with no rig the neck's place as shares of
# its size.
MODELS = {
    # The savanna of the claim eras.
    "animal-giraffe": dict(height=4.7, ref=("loopIdle01", 0.5), turn=180.0),            # withers ~2.9 m
    "animal-giraffe-reticulated": dict(height=4.5, turn=-90.0, faces=14000),           # withers ~2.9 m
    "animal-elephant-cow": dict(height=2.7, turn=180.0, faces=14000),                   # shoulder ~2.5 m
    "animal-elephant-bull": dict(height=3.4, turn=180.0, faces=14000),                  # shoulder ~3.2 m
    "animal-elephant-calf": dict(height=1.35, turn=180.0),                              # shoulder ~1.2 m
    "animal-gazelle": dict(height=1.2, turn=180.0,                                      # shoulder ~0.7 m
                           bend=dict(at=0.64, z=0.52, reach=0.2, floor=0.4)),
    "animal-oryx": dict(height=2.0, turn="axis-x", bend=dict(at=0.68, z=0.46, reach=0.16, floor=0.38)),   # shoulder ~1.15 m
    "animal-addax": dict(height=1.75, turn=-90.0, cut=0.075, bend=dict(at=0.64, z=0.52, reach=0.2, floor=0.4)),   # shoulder ~1.05 m
    "animal-hartebeest": dict(height=1.65, turn=180.0, bend=dict(at=0.64, z=0.52, reach=0.2, floor=0.4)),   # shoulder ~1.2 m
    "animal-ostrich": dict(height=2.3, turn=180.0),                                     # head up, back ~1.3 m
    "animal-buffalo": dict(height=1.65, ref=("Animation", 0.0), turn=180.0, faces=14000,   # shoulder ~1.5 m
                           graze=dict(neck=("Neck1_3", "Neck2_2", "Neck3_1", "Head_0"), weights=(0.5, 0.2, 0.1, 0.2),
                                      forward=(0.0, -1.0, 0.0))),
    "animal-hippo": dict(height=1.55, turn=180.0),                                      # shoulder ~1.5 m
    # As built.
    "animal-cattle-ankole": dict(height=2.05, ref=("Animation", 0.0), turn=180.0, faces=14000,    # withers ~1.3 m
                                 graze=dict(neck=("Neck1_3", "Neck2_2", "Neck3_1", "Head_0"), weights=(0.5, 0.2, 0.1, 0.2),
                                            forward=(0.0, -1.0, 0.0))),
    "animal-cattle-piebald": dict(height=1.95, turn="axis-y", faces=14000),             # withers ~1.25 m
    "animal-donkey-pack": dict(height=1.4, turn="axis-x"),                              # withers ~1.05 m
    "animal-donkey-pack-2": dict(height=1.45, turn=90.0),                               # withers ~1.05 m
    "animal-donkey": dict(height=1.45, turn="axis+x"),                                  # withers ~1.05 m
    "animal-goat-white": dict(height=1.2, turn=180.0, bend=dict(at=0.64, z=0.52, reach=0.2, floor=0.4)),   # withers ~0.7 m
    "animal-goat-brown": dict(height=1.05, turn=180.0, bend=dict(at=0.64, z=0.52, reach=0.2, floor=0.4)),   # withers ~0.65 m
    # Today (and 1800).
    "animal-camel-saddled": dict(height=2.35, turn=90.0),                               # shoulder ~1.9 m
    "animal-camel-blanket": dict(height=2.35, ref=("Armature|Idle_02", 0.5), turn=0.0, drop=("CamelHair",),
                                 kneel=dict(body="Back.001_02", forward=(0.0, 1.0, 0.0), ground=0.05, start="rest",
                                            front=(("FrontLeg.001_L_05", "FrontLeg.002_L_06", "FrontFoot_R_07"),
                                                   ("FrontLeg.001_R_010", "FrontLeg.002_R_011", "FrontFoot_L_012")),
                                            hind=(("BackLeg.001_L_060", "BackLeg.002_L_061", "BackFoot_L_062"),
                                                  ("BackLeg.001_R_064", "BackLeg.002_R_065", "BackFoot_R_066")))),
    "animal-camel": dict(height=2.3, ref=("Animation", 0.0), turn=180.0, drop=("EyeSurface",),     # shoulder ~1.85 m
                         kneel=dict(body="Body_25", forward=(0.0, -1.0, 0.0), ground=0.05,
                                    front=(("FrontUpLeg.R_2", "FrontLowLeg.R_1", "FrontFoot.R_0"),
                                           ("FrontUpLeg.L_8", "FrontLowLeg.L_7", "FrontFoot.L_27")),
                                    hind=(("BackUpLeg.R_5", "BackLowLeg.R_4", "BackFoot.R_26"),
                                          ("BackUpLeg.L_11", "BackLowLeg.L_10", "BackFoot.L_28")))),
    "animal-horse-arabian": dict(height=2.15, turn=-90.0),                              # withers ~1.5 m
    "animal-horse-bay": dict(height=2.1, turn=180.0),                                   # withers ~1.55 m
    "animal-horse-cart": dict(height=2.2, turn=90.0, drop=("Floor", "Stone")),          # the horse's withers ~1.5 m
}

# The variants the libraries are built from: a model in a pose, which is an action and the
# fraction of its frame range, None for the pose it imports in, or one of the made poses: a
# camel couched ("@kneel", how far the body drops in the model's units), a head bent down to the
# grass ("@graze" through the rig's neck, "@bend" through the mesh, degrees).
VARIANTS = {
    "giraffe-stand": dict(model="animal-giraffe", pose=("loopIdle01", 0.5)),
    "giraffe-browse": dict(model="animal-giraffe", pose=("loopEating", 0.5)),
    "giraffe-walk": dict(model="animal-giraffe", pose=("loopWalk", 0.5)),
    "giraffe-look": dict(model="animal-giraffe-reticulated"),
    "elephant-cow": dict(model="animal-elephant-cow"),
    "elephant-bull": dict(model="animal-elephant-bull"),
    "elephant-calf": dict(model="animal-elephant-calf"),
    "gazelle": dict(model="animal-gazelle"),
    # Head down to the grass, for the models with no rig: the mesh bent at the neck by _bend.
    "gazelle-graze": dict(model="animal-gazelle", pose=("@bend", 70.0)),
    "oryx": dict(model="animal-oryx"),
    "oryx-graze": dict(model="animal-oryx", pose=("@bend", 70.0)),
    "addax": dict(model="animal-addax"),
    "addax-graze": dict(model="animal-addax", pose=("@bend", 70.0)),
    "hartebeest": dict(model="animal-hartebeest"),
    "hartebeest-graze": dict(model="animal-hartebeest", pose=("@bend", 70.0)),
    "ostrich": dict(model="animal-ostrich"),
    "buffalo": dict(model="animal-buffalo", pose=("Animation", 0.0)),
    # Head down to the grass: the neck bent by _graze.
    "buffalo-graze": dict(model="animal-buffalo", pose=("@graze", 80.0)),
    "hippo": dict(model="animal-hippo"),
    "cattle-ankole": dict(model="animal-cattle-ankole", pose=("Animation", 0.0)),
    "cattle-ankole-graze": dict(model="animal-cattle-ankole", pose=("@graze", 80.0)),     # head down, as buffalo-graze
    "cattle-piebald": dict(model="animal-cattle-piebald"),
    "donkey-pack": dict(model="animal-donkey-pack"),
    "donkey-pack-2": dict(model="animal-donkey-pack-2"),
    "donkey": dict(model="animal-donkey"),
    "goat-white": dict(model="animal-goat-white"),
    "goat-white-graze": dict(model="animal-goat-white", pose=("@bend", 70.0)),
    "goat-brown": dict(model="animal-goat-brown"),
    "goat-brown-graze": dict(model="animal-goat-brown", pose=("@bend", 70.0)),
    "camel-saddled": dict(model="animal-camel-saddled"),
    "camel-blanket": dict(model="animal-camel-blanket", pose=("Armature|Idle_02", 0.5)),
    "camel-blanket-graze": dict(model="animal-camel-blanket", pose=("Armature|Idle_01", 0.5)),
    "camel-blanket-walk": dict(model="animal-camel-blanket", pose=("Armature|WalkCycle", 0.5)),
    # Couched, as the camels at Giza wait between rides: the rig folded by _kneel, the body lowered about a metre.
    "camel-blanket-kneeling": dict(model="animal-camel-blanket", pose=("@kneel", 1.0)),
    "camel": dict(model="animal-camel", pose=("Animation", 0.0)),
    "camel-kneeling": dict(model="animal-camel", pose=("@kneel", 2.3)),
    "horse-arabian": dict(model="animal-horse-arabian"),
    "horse-bay": dict(model="animal-horse-bay"),
    "horse-cart": dict(model="animal-horse-cart"),
}

# LOOK CHOICES: the kinds a herd is drawn from. `variants` with their `weights`; `spacing`, the
# least distance between two animals, metres; `slope`, the steepest ground one stands on,
# degrees; `young`, the share of a herd drawn young and the range of their scale (None where the
# young are a variant of their own, or where only grown animals belong: pack donkeys, saddled
# camels, horses); `water`, for a kind that stands in the era's water, the range of depths it
# stands in, metres (a hippopotamus in the shallows, the water to its back).
KINDS = {
    "giraffe": dict(variants=("giraffe-stand", "giraffe-browse", "giraffe-walk", "giraffe-look"), weights=(3, 3, 2, 2),
                    spacing=6.0, slope=16.0, young=(0.15, (0.55, 0.7))),
    "elephant": dict(variants=("elephant-cow", "elephant-bull", "elephant-calf"), weights=(6, 1, 3), spacing=5.0,
                     slope=14.0, young=None),
    "gazelle": dict(variants=("gazelle", "gazelle-graze"), weights=(1, 2), spacing=1.8, slope=24.0, young=(0.15, (0.65, 0.8))),
    "oryx": dict(variants=("oryx", "oryx-graze"), spacing=2.6, slope=20.0, young=(0.12, (0.6, 0.75))),
    "addax": dict(variants=("addax", "addax-graze"), spacing=2.4, slope=20.0, young=(0.12, (0.6, 0.75))),
    "hartebeest": dict(variants=("hartebeest", "hartebeest-graze"), weights=(1, 2), spacing=2.6, slope=20.0,
                       young=(0.12, (0.6, 0.75))),
    "ostrich": dict(variants=("ostrich",), spacing=2.4, slope=20.0, young=(0.1, (0.6, 0.75))),
    "buffalo": dict(variants=("buffalo", "buffalo-graze"), weights=(1, 2), spacing=3.2, slope=14.0, young=(0.12, (0.6, 0.75))),
    "hippo": dict(variants=("hippo",), spacing=4.0, slope=10.0, young=(0.2, (0.5, 0.7)), water=(0.75, 1.25)),
    "cattle": dict(variants=("cattle-ankole", "cattle-ankole-graze", "cattle-piebald"), weights=(2, 3, 2), spacing=3.0, slope=14.0,
                   young=(0.15, (0.55, 0.7))),
    "donkey": dict(variants=("donkey-pack", "donkey-pack-2", "donkey"), weights=(2, 2, 1), spacing=2.2, slope=18.0, young=None),
    "goat": dict(variants=("goat-white", "goat-white-graze", "goat-brown", "goat-brown-graze"), weights=(1, 2, 1, 2), spacing=1.3,
                 slope=32.0, young=(0.2, (0.55, 0.7))),
    "camel": dict(variants=("camel-saddled", "camel-blanket", "camel-blanket-graze", "camel-blanket-walk",
                            "camel-blanket-kneeling", "camel", "camel-kneeling"), weights=(4, 3, 2, 1, 4, 1, 2), spacing=3.4, slope=12.0, young=None),
    "camel-plain": dict(variants=("camel", "camel-kneeling"), weights=(2, 1), spacing=3.4, slope=12.0, young=(0.12, (0.6, 0.75))),
    "horse": dict(variants=("horse-arabian", "horse-bay"), spacing=3.0, slope=12.0, young=None),
    "cart": dict(variants=("horse-cart",), spacing=7.0, slope=8.0, young=None),
}

# Which variants each era's library holds, in Collection Info's order.
SAVANNA = ("giraffe-stand", "giraffe-browse", "giraffe-walk", "giraffe-look", "elephant-cow", "elephant-bull",
           "elephant-calf", "gazelle", "gazelle-graze", "oryx", "oryx-graze", "addax", "addax-graze", "hartebeest",
           "hartebeest-graze", "ostrich", "buffalo", "buffalo-graze", "hippo")
ERAS = {
    "first-time": SAVANNA,
    "lion": SAVANNA,
    "built": ("cattle-ankole", "cattle-ankole-graze", "cattle-piebald", "donkey-pack", "donkey-pack-2", "donkey", "goat-white",
              "goat-white-graze", "goat-brown", "goat-brown-graze"),
    "stripped": ("camel", "camel-kneeling", "donkey-pack", "donkey", "goat-white", "goat-white-graze", "goat-brown",
                 "goat-brown-graze"),
    "today": ("camel-saddled", "camel-blanket", "camel-blanket-graze", "camel-blanket-walk", "camel-blanket-kneeling", "camel",
              "camel-kneeling", "horse-arabian", "horse-bay", "horse-cart"),
}

Herd = collections.namedtuple("Herd", "x y half_w half_d count kinds")

# LOOK CHOICES: where the herds are, era by era: the centre (x, y), the half-width east-west and
# half-depth north-south, how many, and their kinds. Chosen off the terrain, the stations and the
# era's monuments and water (render/tests/test_fauna.py checks each against them): in the claim
# eras on the open plateau away from the pyramids and along the valley's edge at the flood; as
# built in the valley fields east of the temples, by the Wall of the Crow (the builders' town
# south of it ate cattle brought in from the estates) and on the donkey tracks between the
# harbour, the valley temples and the plateau; in 1800 by the village below the buried Sphinx;
# today at the panorama stand south-west of Menkaure and along the plateau's roads.
HERDS = {
    "first-time": [
        Herd(320.0, 85.0, 32.0, 22.0, 7, ("elephant",)),             # below the east station, where the plateau falls to the valley
        Herd(465.0, -655.0, 28.0, 45.0, 6, ("elephant",)),           # at the flood south of the megalithic temples
        Herd(545.0, -625.0, 22.0, 30.0, 4, ("hippo",)),              # in the flood beside them
        Herd(580.0, -490.0, 25.0, 22.0, 5, ("hippo",)),              # in the flood behind the harbour station
        Herd(400.0, 205.0, 32.0, 20.0, 8, ("buffalo",)),             # the valley's edge north-east of Khufu
        Herd(175.0, -335.0, 35.0, 25.0, 5, ("giraffe",)),            # the open plateau south-east of Khufu
        Herd(-280.0, 330.0, 35.0, 28.0, 4, ("giraffe",)),            # north-west of Khufu
        Herd(60.0, -415.0, 25.0, 15.0, 10, ("gazelle",)),            # behind the south station
        Herd(-70.0, -560.0, 50.0, 30.0, 14, ("gazelle", "ostrich")),  # the plateau south of the pyramids
        Herd(-300.0, -870.0, 25.0, 18.0, 6, ("oryx", "addax")),      # behind the Menkaure station
        Herd(-650.0, -930.0, 40.0, 28.0, 9, ("oryx", "addax")),      # south of Menkaure
        Herd(-10.0, 315.0, 30.0, 18.0, 8, ("hartebeest",)),          # behind the north station
        Herd(-905.0, -1760.0, 20.0, 12.0, 8, ("gazelle",)),          # in front of the panorama rise
        Herd(-860.0, -1700.0, 30.0, 20.0, 5, ("ostrich",)),          # below the panorama rise
        Herd(-1120.0, -1660.0, 35.0, 25.0, 7, ("addax", "gazelle")),  # west of the panorama rise
        Herd(-1150.0, -850.0, 60.0, 40.0, 12, ("gazelle",)),         # the western plateau, for the wide views
        Herd(-760.0, -260.0, 40.0, 30.0, 4, ("giraffe",)),           # west of Khafre, for the wide views
    ],
    "lion": [
        Herd(465.0, -655.0, 28.0, 45.0, 5, ("elephant",)),
        Herd(545.0, -625.0, 22.0, 30.0, 3, ("hippo",)),
        Herd(320.0, 85.0, 30.0, 20.0, 4, ("elephant",)),
        Herd(400.0, 205.0, 32.0, 20.0, 6, ("buffalo",)),
        Herd(175.0, -335.0, 35.0, 25.0, 4, ("giraffe",)),
        Herd(60.0, -415.0, 25.0, 15.0, 12, ("gazelle", "ostrich")),
        Herd(-70.0, -560.0, 55.0, 32.0, 16, ("gazelle", "ostrich")),
        Herd(-300.0, -870.0, 25.0, 18.0, 6, ("oryx",)),
        Herd(-650.0, -930.0, 45.0, 30.0, 10, ("oryx", "addax")),
        Herd(-10.0, 315.0, 32.0, 20.0, 10, ("hartebeest",)),
        Herd(-905.0, -1760.0, 20.0, 12.0, 10, ("gazelle",)),
        Herd(-860.0, -1700.0, 30.0, 20.0, 6, ("ostrich",)),
        Herd(-1120.0, -1660.0, 40.0, 28.0, 9, ("addax", "gazelle")),
        Herd(-1150.0, -850.0, 60.0, 40.0, 14, ("gazelle", "oryx")),
    ],
    "built": [
        Herd(650.0, -300.0, 55.0, 40.0, 14, ("cattle",)),            # the valley fields east of the temples
        Herd(470.0, -715.0, 40.0, 22.0, 10, ("cattle",)),            # north of the Wall of the Crow
        Herd(445.0, -605.0, 10.0, 18.0, 5, ("donkey",)),             # at the south end of the quay
        Herd(330.0, -655.0, 30.0, 10.0, 6, ("donkey",)),             # on the track to Menkaure's valley temple
        Herd(330.0, -290.0, 10.0, 16.0, 4, ("donkey",)),             # at the Eastern Cemetery's south edge
        Herd(100.0, -262.0, 15.0, 8.0, 4, ("donkey",)),              # with the builders south of Khufu
        Herd(-330.0, -760.0, 12.0, 10.0, 4, ("donkey",)),            # on the way up to Menkaure's temple
        Herd(545.0, -865.0, 12.0, 10.0, 3, ("donkey",)),             # in the builders' town south of the wall
        Herd(325.0, -800.0, 25.0, 18.0, 10, ("goat",)),              # by the west end of the Wall of the Crow
        Herd(650.0, 250.0, 50.0, 35.0, 10, ("cattle", "goat")),      # the fields north-east, for the wide views
    ],
    "stripped": [
        Herd(520.0, -330.0, 30.0, 20.0, 5, ("camel-plain", "donkey")),  # at the village's edge below the Sphinx
        Herd(470.0, -640.0, 30.0, 25.0, 9, ("goat",)),
        Herd(600.0, 150.0, 30.0, 20.0, 4, ("camel-plain",)),
    ],
    "today": [
        Herd(-930.0, -1845.0, 12.0, 8.0, 7, ("camel",)),              # at the panorama stand, east of it
        Herd(-1020.0, -1805.0, 10.0, 8.0, 5, ("camel",)),             # and west of it
        Herd(-1060.0, -1758.0, 25.0, 8.0, 3, ("cart", "horse")),      # on the road north-west of the stand
        Herd(-645.0, -1382.0, 25.0, 15.0, 10, ("camel", "horse")),    # the panorama centre on the plateau road
        Herd(95.0, -248.0, 32.0, 8.0, 7, ("camel", "horse")),         # along the road south of Khufu
        Herd(-42.0, 255.0, 8.0, 30.0, 6, ("camel",)),                 # along the road west of the north face
        Herd(460.0, -383.0, 25.0, 8.0, 4, ("horse", "cart")),         # on the road by the Sphinx
        Herd(225.0, -318.0, 25.0, 8.0, 4, ("camel", "cart")),         # on the road by the Eastern Cemetery
    ],
}


def herds(era):
    """The era's herds as Herd(x, y, half_w, half_d, count, kinds); an empty list for an era with none."""
    return list(HERDS.get(era, []))


def manifest_animals():
    """The manifest's animals by id."""
    with io.open(MANIFEST, encoding="utf-8") as f:
        return {m["id"]: m for m in json.load(f).get("animals", [])}


def _index():
    if not os.path.exists(INDEX):
        return {}
    with io.open(INDEX, encoding="utf-8") as f:
        index = json.load(f)
    return index.get("models", index)


def _triangles(me):
    return int(sum(len(p.vertices) - 2 for p in me.polygons))


def _coords(me):
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


# --- Reading a model ----------------------------------------------------------------------

def _import(path):
    """Import a GLB; returns (the new objects, the meshes to keep, the animated objects and the slot each plays)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    shapes = {pb.custom_shape for o in new if o.type == "ARMATURE" for pb in o.pose.bones if pb.custom_shape is not None}
    meshes = [o for o in new if o.type == "MESH" and o not in shapes]
    animated = [o for o in new if o.animation_data is not None]
    slots = {o.name: (o.animation_data.action_slot.identifier if o.animation_data.action_slot else None) for o in animated}
    # The pose each bone imports in, which a pose starts from: an action may key only some bones (the IK targets,
    # say), and a bone it leaves alone must keep the pose the file gives it, not fall back to the rest pose.
    slots["@imported"] = {(o.name, pb.name): pb.matrix_basis.copy() for o in new if o.type == "ARMATURE" for pb in o.pose.bones}
    return new, meshes, animated, slots


def _pose(new, animated, slots, pose, look):
    """
    Put the model in `pose`: an action name and the fraction of its frame range, played on every
    animated object; ("@kneel", drop) for the couched pose _kneel bakes from the model's rig
    (look["kneel"]); None keeps the imported pose. False when the model has no such action or rig.
    """
    if pose is None:
        return True
    name, at = pose
    arms = [o for o in new if o.type == "ARMATURE"]
    imported = slots.get("@imported", {})
    for arm in arms:
        for pb in arm.pose.bones:
            pb.matrix_basis = imported.get((arm.name, pb.name), Matrix.Identity(4))
    if name in ("@kneel", "@graze"):
        rig = look.get(name[1:])
        if not arms or rig is None:
            return False
        for o in animated:
            for track in o.animation_data.nla_tracks:
                track.mute = True
            o.animation_data.action = None
        if rig.get("start") == "rest":
            # Some rigs import in a pose the recipe cannot start from; they start from the rest pose instead.
            for pb in arms[0].pose.bones:
                pb.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        (_kneel if name == "@kneel" else _graze)(arms[0], rig, at)
        return True
    if not animated:
        return True
    act = bpy.data.actions.get(name)
    if act is None:
        return False
    for o in animated:
        ad = o.animation_data
        for track in ad.nla_tracks:
            track.mute = True
        ad.action = act
        slot = next((s for s in act.slots if s.identifier == slots.get(o.name)), None)
        if slot is not None:
            ad.action_slot = slot
    f0, f1 = act.frame_range
    bpy.context.scene.frame_set(int(round(f0 + (f1 - f0) * at)))
    return True


def _aim(arm, name, head, tail):
    """Pose bone `name` so its head is at `head` and it points at `tail` (world space), turned the least from its rest."""
    from mathutils import Vector
    Wi = arm.matrix_world.inverted()
    rest = arm.data.bones[name].matrix_local
    along = (rest.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()
    want = (Wi.to_3x3() @ (Vector(tail) - Vector(head))).normalized()
    M = (along.rotation_difference(want).to_matrix() @ rest.to_3x3()).to_4x4()
    M.translation = Wi @ Vector(head)
    arm.pose.bones[name].matrix = M
    bpy.context.view_layer.update()


def _kneel(arm, rig, drop):
    """
    A couched pose, as a camel rests: the body lowered by `drop` (the model's units) and each leg
    folded to the ground, the forearm (or thigh) reaching forward and down to a knee (or stifle) on
    the ground, the cannon folded back under it and the foot folded after. `rig` names the bones:
    `body`, `front` and `hind` chains of (upper, lower, foot), `forward` (the model's own facing,
    a unit vector) and `ground`, the height of a joint's centre resting on the ground above the
    lowest point of the feet' bones as they stand.
    """
    from mathutils import Vector
    W = arm.matrix_world
    unit = W.to_scale()[0]
    feet = [arm.data.bones[chain[2]] for chain in list(rig["front"]) + list(rig["hind"])]
    floor = min(min((W @ b.head_local).z, (W @ b.tail_local).z) for b in feet)
    body = arm.pose.bones[rig["body"]]
    M = body.matrix.copy()
    M.translation = M.translation + W.inverted().to_3x3() @ Vector((0.0, 0.0, -drop))
    body.matrix = M
    bpy.context.view_layer.update()
    f = Vector(rig["forward"])
    g = floor + rig.get("ground", 0.05)
    for chains, foot_back in ((rig["front"], True), (rig["hind"], False)):
        for upper, lower, foot in chains:
            top = W @ arm.pose.bones[upper].head
            up_len = arm.data.bones[upper].length * unit
            low_len = arm.data.bones[lower].length * unit
            foot_len = arm.data.bones[foot].length * unit
            reach = max(0.05, max(up_len ** 2 - (top.z - g) ** 2, 0.0) ** 0.5)
            knee = Vector((top.x, top.y, g)) + f * reach
            _aim(arm, upper, top, knee)
            fetlock = knee - f * low_len
            fetlock.z = floor + 0.8 * (g - floor)
            _aim(arm, lower, knee, fetlock)
            tip = fetlock + (-f if foot_back else f) * foot_len
            tip.z = floor + 0.6 * (g - floor)
            _aim(arm, foot, fetlock, tip)


def _graze(arm, rig, degrees):
    """
    A head-down pose, as cattle graze: the neck chain `rig["neck"]` (from its root to the head)
    bent down about the animal's own left-right axis by `degrees` in all, shared out by
    `rig["weights"]`; `forward` is the model's own facing, a unit vector.
    """
    from mathutils import Matrix as M4, Vector
    W = arm.matrix_world
    Wi3 = W.inverted().to_3x3()
    f = Vector(rig["forward"])
    axis = (Wi3 @ Vector((0.0, 0.0, 1.0)).cross(f)).normalized()     # nose down is a turn about up x forward
    for name, share in zip(rig["neck"], rig["weights"]):
        pb = arm.pose.bones[name]
        head = pb.matrix.translation.copy()
        turn = M4.Translation(head) @ M4.Rotation(math.radians(degrees * share), 4, axis) @ M4.Translation(-head)
        pb.matrix = turn @ pb.matrix
        bpy.context.view_layer.update()


def _bend(me, spec, degrees):
    """
    Head down to the grass for a model with no rig: the mesh, standing and facing +Y, bent down
    about a left-right axis through a pivot at the base of the neck, `at` of the way from its tail
    to its nose and `z` of its height up. The bend grows from nothing at the pivot to `degrees` a
    `reach` of the length ahead of it, and leaves alone everything below `floor` of the height,
    so the forelegs stand where they stood. Every figure is a share of the model's own size.
    """
    co = _coords(me)
    H = float(co[:, 2].max())
    y0, y1 = float(co[:, 1].min()), float(co[:, 1].max())
    L = y1 - y0
    py, pz = y0 + spec["at"] * L, spec["z"] * H
    t = np.clip((co[:, 1] - py) / (spec["reach"] * L), 0.0, 1.0)
    u = np.clip((co[:, 2] - spec["floor"] * H) / (0.1 * H), 0.0, 1.0)
    w = (t * t * (3 - 2 * t)) * (u * u * (3 - 2 * u))
    a = -np.radians(degrees) * w
    dy, dz = co[:, 1] - py, co[:, 2] - pz
    co[:, 1] = py + dy * np.cos(a) - dz * np.sin(a)
    co[:, 2] = pz + dy * np.sin(a) + dz * np.cos(a)
    me.vertices.foreach_set("co", co.ravel())
    me.update()


def _alpha_material(mat):
    if mat is None or mat.node_tree is None:
        return False
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    blended = getattr(mat, "surface_render_method", "") == "BLENDED" or getattr(mat, "blend_method", "") == "BLEND"
    return bool(bsdf is not None and (bsdf.inputs["Alpha"].is_linked or bsdf.inputs["Alpha"].default_value < 0.999) and blended)


def _bake(meshes, name, drop):
    """
    The kept meshes, evaluated in the current pose (armatures applied) and joined in world space
    into one object. Faces of a dropped material are removed: those named in `drop`, and alpha
    cards that are a small part of the model (ALPHA_CARDS).
    """
    dg = bpy.context.evaluated_depsgraph_get()
    parts = []
    for ob in meshes:
        if any(frag.lower() in ob.name.lower() for frag in drop):
            continue
        ev = ob.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        if len(me.polygons) == 0:
            bpy.data.meshes.remove(me)
            continue
        me.transform(ev.matrix_world)
        if me.uv_layers:
            me.uv_layers[0].name = "UVMap"
        part = bpy.data.objects.new(f"{name} part", me)
        bpy.context.scene.collection.objects.link(part)
        parts.append(part)
    if not parts:
        return None
    if len(parts) > 1:
        with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts, selected_objects=parts):
            bpy.ops.object.join()
    obj = parts[0]
    obj.name = name
    me = obj.data
    me.name = name
    # Which materials go: named, or alpha cards on a small share of the faces.
    counts = np.bincount(np.array([p.material_index for p in me.polygons], np.int64), minlength=len(me.materials))
    total = max(1, int(counts.sum()))
    gone = set()
    for i, mat in enumerate(me.materials):
        named = mat is not None and any(frag.lower() in mat.name.lower() for frag in drop)
        cards = _alpha_material(mat) and counts[i] < ALPHA_CARDS * total
        if named or cards:
            gone.add(i)
    if gone:
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in gone], context="FACES")
        bm.to_mesh(me)
        bm.free()
    return obj


def _plan_axis(co):
    """The unit vector along which the plan spreads most."""
    xy = co[:, :2] - co[:, :2].mean(0)
    w, v = np.linalg.eigh(np.cov(xy.T))
    return v[:, np.argmax(w)]


def _turn_angle(co, turn):
    """Degrees about Z that face the model +Y: a number, or "axis" and the axis its head points along ("axis-x")."""
    if not isinstance(turn, str):
        return float(turn)
    hint = {"+x": (1.0, 0.0), "-x": (-1.0, 0.0), "+y": (0.0, 1.0), "-y": (0.0, -1.0)}[turn[-2:]]
    ax = _plan_axis(co)
    if ax @ np.array(hint) < 0:
        ax = -ax
    return math.degrees(math.atan2(1.0, 0.0) - math.atan2(ax[1], ax[0]))


def _cut(me, frac):
    """Cut away a plinth: everything below `frac` of the height, and the loose pieces left standing on it."""
    import bmesh
    co = _coords(me)
    z0, z1 = float(co[:, 2].min()), float(co[:, 2].max())
    zc = z0 + frac * (z1 - z0)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0.0, 0.0, zc),
                           plane_no=(0.0, 0.0, 1.0), clear_inner=True)
    # Loose pieces whose top stays within a few centimetres of the cut were standing on the plinth (pebbles, a
    # label); a leg the scan left as its own piece reaches far higher, and so do the eyes.
    seen, drop = set(), []
    for start in bm.verts:
        if start in seen:
            continue
        seen.add(start)
        stack, part = [start], []
        while stack:
            v = stack.pop()
            part.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w not in seen:
                    seen.add(w)
                    stack.append(w)
        if max(v.co.z for v in part) < zc + 0.06 * (z1 - zc):
            drop.extend(part)
    if drop:
        bmesh.ops.delete(bm, geom=drop, context="VERTS")
    bm.to_mesh(me)
    bm.free()


def _decimate(obj, faces):
    count = len(obj.data.polygons)
    if count > faces:
        mod = obj.modifiers.new("reduce", "DECIMATE")
        mod.ratio = faces / count
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
            bpy.ops.object.modifier_apply(modifier=mod.name)


def _stand(me, turn_deg, scale):
    """Turn the mesh about Z, scale it and stand it on z = 0 with the middle of its feet at the origin."""
    me.transform(Matrix.Rotation(math.radians(turn_deg), 4, "Z"))
    co = _coords(me)
    z0, z1 = float(co[:, 2].min()), float(co[:, 2].max())
    feet = co[co[:, 2] < z0 + 0.04 * (z1 - z0)]
    cx = 0.5 * float(feet[:, 0].min() + feet[:, 0].max())
    cy = 0.5 * float(feet[:, 1].min() + feet[:, 1].max())
    me.transform(Matrix.Scale(scale, 4) @ Matrix.Translation((-cx, -cy, -z0)))
    me.update()


def _normals(me):
    """Smooth normals from the decimated surface, sharp only where faces meet at more than SHARP_DEG."""
    if "custom_normal" in me.attributes:
        me.attributes.remove(me.attributes["custom_normal"])
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(SHARP_DEG))


def _unlit_to_lit(tree):
    """A phone scan's unlit material (an image straight to the output): a Principled BSDF on the same image."""
    out = next((n for n in tree.nodes if n.type == "OUTPUT_MATERIAL"), None) or tree.nodes.new("ShaderNodeOutputMaterial")
    img = next((n for n in tree.nodes if n.type == "TEX_IMAGE" and n.image is not None), None)
    bsdf = tree.nodes.new("ShaderNodeBsdfPrincipled")
    if img is not None:
        tree.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return bsdf


def _coat(mat, texture_px):
    """
    Keep the model's maps, drop what would trouble Cycles (the alpha, emission, metal, textures
    larger than `texture_px`), keep hide and hair from shining, add a little sheen, and let the
    instance's tone move brightness and saturation.
    """
    tree = mat.node_tree if mat is not None else None
    if tree is None or mat.get("seked_animal_material"):
        return
    mat["seked_animal_material"] = True
    for nd in tree.nodes:
        if nd.type == "TEX_IMAGE" and nd.image is not None:
            img = nd.image
            # The alpha mode first: changing it reloads the image from its packed file, which would undo a scale.
            if img.colorspace_settings.name != "Non-Color" and img.alpha_mode != "NONE":
                img.alpha_mode = "NONE"
            if img.size[0] > texture_px or img.size[1] > texture_px:
                img.scale(min(img.size[0], texture_px), min(img.size[1], texture_px))
    bsdfs = [nd for nd in tree.nodes if nd.type == "BSDF_PRINCIPLED"] or [_unlit_to_lit(tree)]
    for bsdf in bsdfs:
        for key, value in (("Alpha", 1.0), ("Emission Strength", 0.0), ("Metallic", 0.0), ("Transmission Weight", 0.0),
                           ("Coat Weight", 0.0), ("Specular IOR Level", SPECULAR), ("Sheen Weight", SHEEN[0]),
                           ("Sheen Roughness", SHEEN[1])):
            if key not in bsdf.inputs:
                continue
            for link in list(bsdf.inputs[key].links):
                tree.links.remove(link)
            bsdf.inputs[key].default_value = value
        rough = bsdf.inputs["Roughness"]
        if rough.is_linked:
            mr = tree.nodes.new("ShaderNodeMapRange")
            mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = ROUGHNESS
            tree.links.new(rough.links[0].from_socket, mr.inputs["Value"])
            tree.links.new(mr.outputs["Result"], rough)
        else:
            rough.default_value = ROUGHNESS[0] + (ROUGHNESS[1] - ROUGHNESS[0]) * rough.default_value
        base = bsdf.inputs["Base Color"]
        if not base.is_linked:
            continue
        src = base.links[0].from_socket
        tone = tree.nodes.new("ShaderNodeAttribute")
        tone.attribute_type = "INSTANCER"
        tone.attribute_name = "tone"
        hsv = tree.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Hue"].default_value = 0.5
        for key, (lo, hi) in TONE.items():
            mr = tree.nodes.new("ShaderNodeMapRange")
            mr.inputs["To Min"].default_value = lo
            mr.inputs["To Max"].default_value = hi
            tree.links.new(tone.outputs["Fac"], mr.inputs["Value"])
            tree.links.new(mr.outputs["Result"], hsv.inputs[key.capitalize()])
        tree.links.new(src, hsv.inputs["Color"])
        tree.links.new(hsv.outputs["Color"], base)
    try:
        mat.blend_method = "OPAQUE"        # EEVEE's setting; Cycles reads the Alpha socket, set above
    except (AttributeError, TypeError):
        pass
    try:
        mat.surface_render_method = "DITHERED"
    except (AttributeError, TypeError):
        pass


def _head_forward(co):
    """How far the highest tenth of the animal sits ahead (+Y) of its middle, metres: positive when head or horns lead."""
    top = co[co[:, 2] > np.quantile(co[:, 2], 0.9)]
    return float(top[:, 1].mean() - 0.5 * (co[:, 1].min() + co[:, 1].max()))


def model_variants(model_id, path, variants, model, look, faces=None, texture_px=TEXTURE_PX, log=print):
    """
    Every variant of one model: the GLB imported once, each pose baked, cut, decimated, turned
    to +Y, scaled to its look height and stood on its feet; returns [(variant name, object, triangles)].
    """
    scene = bpy.context.scene
    frames = (scene.frame_current, scene.frame_start, scene.frame_end)
    new, meshes, animated, slots = _import(path)
    out = []
    try:
        # The scale comes from the reference pose, so every pose of the model is drawn at one size.
        ref = look.get("ref")
        if not _pose(new, animated, slots, ref, look):
            log(f"animals: {model_id} has no action {ref[0]!r}; its size is taken from the pose it imports in")
        probe = _bake(meshes, f"{model_id} probe", look.get("drop", ()))
        if probe is None:
            log(f"animals: {model_id} has no mesh to keep")
            return out
        if look.get("cut"):
            _cut(probe.data, look["cut"])
        co = _coords(probe.data)
        turn = _turn_angle(co, look["turn"])
        scale = look["height"] / float(co[:, 2].max() - co[:, 2].min())
        bpy.data.objects.remove(probe, do_unlink=True)
        for vname, vspec in variants:
            pose = vspec.get("pose")
            bend = pose[1] if pose is not None and pose[0] == "@bend" else None
            if not _pose(new, animated, slots, None if bend is not None else pose, look):
                log(f"animals: {vname}: {model_id} has no action {pose[0]!r}; skipped")
                continue
            obj = _bake(meshes, vname, look.get("drop", ()))
            if obj is None:
                continue
            me = obj.data
            before = _triangles(me)
            if look.get("cut"):
                _cut(me, look["cut"])
            _decimate(obj, faces or look.get("faces", FACES))
            _stand(me, turn, scale)
            if bend is not None:
                if "bend" not in look:
                    log(f"animals: {vname}: {model_id} has no `bend` to graze with; skipped")
                    bpy.data.objects.remove(obj, do_unlink=True)
                    continue
                _bend(me, look["bend"], bend)
            _normals(me)
            for mat in me.materials:
                _coat(mat, texture_px)
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            obj.location = PARKED
            obj.rotation_euler = (0.0, 0.0, 0.0)
            obj.scale = (1.0, 1.0, 1.0)
            co = _coords(me)
            height = float(co[:, 2].max())
            obj["seked_animal"] = (f"look choice: {model['name']}, a third-party model posed and drawn at a chosen size; "
                                   "nothing of its form is a measurement")
            obj["seked_license"] = model["license"]
            obj["seked_attribution"] = model["attribution"]
            obj["animal"] = model_id
            obj["variant"] = vname
            obj["height"] = round(height, 3)
            tris = _triangles(me)
            lead = _head_forward(co)
            log(f"animal {vname}: {before:,} -> {tris:,} triangles, {height:.2f} m high, "
                f"{float(co[:, 1].max() - co[:, 1].min()):.2f} m long, turned {turn:.0f} deg, top {lead:+.2f} m ahead of the middle")
            out.append((vname, obj, tris))
    finally:
        for o in new:
            if o.name in bpy.data.objects:
                data_block = o.data
                bpy.data.objects.remove(o, do_unlink=True)
                if isinstance(data_block, bpy.types.Mesh) and data_block.users == 0:
                    bpy.data.meshes.remove(data_block)
        scene.frame_start, scene.frame_end = frames[1], frames[2]
        scene.frame_set(frames[0])
    return out


def _kind_of(variant):
    return next((k for k, spec in KINDS.items() if variant in spec["variants"]), None)


def _cache_key(era, wanted, index, manifest, faces, texture_px):
    used = sorted({VARIANTS[v]["model"] for v in wanted})
    blob = json.dumps({"version": CACHE_VERSION, "era": era, "wanted": list(wanted),
                       "variants": {v: VARIANTS[v] for v in wanted}, "models": {m: MODELS[m] for m in used},
                       "manifest": {m: {k: manifest[m].get(k) for k in ("name", "license", "attribution")} for m in used},
                       "sha": {m: (index.get(m) or {}).get("sha256") for m in used},
                       "faces": faces, "texture_px": texture_px, "sharp": SHARP_DEG, "tone": TONE, "rough": ROUGHNESS,
                       "specular": SPECULAR, "sheen": SHEEN, "cards": ALPHA_CARDS,
                       "code": _code_digest()}, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _code_digest():
    """The functions that shape a variant, so a change to how a model is read makes a new cache."""
    import inspect
    parts = [inspect.getsource(f) for f in (_import, _pose, _aim, _kneel, _graze, _bend, _alpha_material, _bake, _turn_angle,
                                            _cut, _decimate, _stand, _normals, _unlit_to_lit, _coat, model_variants)]
    return hashlib.sha256("".join(parts).encode("utf-8")).hexdigest()


def _from_cache(parent, name, path, key, log):
    side = os.path.splitext(path)[0] + ".json"
    try:
        with io.open(side, encoding="utf-8") as f:
            if json.load(f).get("key") != key:
                return None
    except (OSError, ValueError):
        return None
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        if name not in src.collections:
            return None
        dst.collections = [name]
    coll = dst.collections[0] if dst.collections else None
    if coll is None:
        return None
    parent.children.link(coll)
    for ob in coll.objects:
        ob.location = PARKED
    log(f"animals: {name} from {os.path.relpath(path, data.REPO)} ({len(coll.objects)} variants)")
    return coll


def _to_cache(coll, path, key, log):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    blocks = {coll} | set(coll.objects)
    for ob in coll.objects:
        for mat in ob.data.materials:
            if mat is None or mat.node_tree is None:
                continue
            for nd in mat.node_tree.nodes:
                if nd.type == "TEX_IMAGE" and nd.image is not None and nd.image.packed_file is None:
                    try:
                        nd.image.pack()
                    except RuntimeError:
                        pass
    tmp = f"{path}.{os.getpid()}.tmp.blend"
    try:
        bpy.data.libraries.write(tmp, blocks, fake_user=True, compress=True)
        os.replace(tmp, path)
        with io.open(os.path.splitext(path)[0] + ".json", "w", encoding="utf-8") as f:
            json.dump({"key": key, "variants": [ob["variant"] for ob in coll.objects]}, f, indent=1)
    except (OSError, RuntimeError) as err:
        log(f"animals: could not keep the library in {path} ({err}); it will be made again next time")
        if os.path.exists(tmp):
            os.remove(tmp)


def library(parent, era, log=print, faces=None, texture_px=TEXTURE_PX, cache=True):
    """
    The era's animal variants as a collection linked under `parent`, in ERAS order, or None when
    the era has none or none of their GLBs is on disk (`python scripts/models.py` puts them there).
    Each object is "<collection> NN", parked at PARKED; see the module's docstring.
    """
    wanted = ERAS.get(era)
    if not wanted:
        return None
    t0 = time.time()
    models = manifest_animals()
    index = _index()
    name = f"v animals {era}"
    path = os.path.join(OUT, f"{era}.blend")
    present = [v for v in wanted if VARIANTS[v]["model"] in models and index.get(VARIANTS[v]["model"])
               and os.path.exists(os.path.join(data.REPO, "build", "models", index[VARIANTS[v]["model"]]["file"]))]
    for v in wanted:
        if v not in present:
            mid = VARIANTS[v]["model"]
            log(f"animals: {v} ({mid}) is not on disk (python scripts/models.py fetches it"
                + ("; python scripts/meshy.py generate " + mid + " makes it" if "meshy" in models.get(mid, {}) else "") + ")")
    if not present:
        log(f"animals: none of the {era} era's models is on disk; it has no animals")
        return None
    key = _cache_key(era, present, index, models, faces, texture_px)
    if cache and os.path.exists(path):
        coll = _from_cache(parent, name, path, key, log)
        if coll is not None:
            return coll
    # Import each model once, for all of its variants, then order the objects as ERAS does.
    by_model = collections.OrderedDict()
    for v in present:
        by_model.setdefault(VARIANTS[v]["model"], []).append((v, VARIANTS[v]))
    made = {}
    for mid, variants in by_model.items():
        glb = os.path.join(data.REPO, "build", "models", index[mid]["file"])
        for vname, obj, tris in model_variants(mid, glb, variants, models[mid], MODELS[mid], faces, texture_px, log):
            made[vname] = (obj, tris)
    if not made:
        return None
    coll = bpy.data.collections.new(name)
    parent.children.link(coll)
    k = 0
    for v in present:
        if v not in made:
            continue
        obj, _ = made[v]
        obj.name = f"{name} {k:02d}"
        obj["kind"] = _kind_of(v) or ""
        coll.objects.link(obj)
        k += 1
    log(f"animals {era}: {', '.join(v for v in present if v in made)} ({sum(t for _, t in made.values()):,} triangles) "
        f"in {time.time() - t0:.1f}s")
    if cache:
        _to_cache(coll, path, key, log)
    return coll


# --- Placing the herds ---------------------------------------------------------------------

def _stations():
    """Every outdoor station's (x, y), from render/stations.json."""
    try:
        stations, _ = data.views()
    except (OSError, ValueError, KeyError):
        return []
    items = stations.get("stations", stations) if isinstance(stations, dict) else stations
    return [(float(s["x"]), float(s["y"])) for s in items if isinstance(s, dict) and not s.get("inside") and "x" in s]


def _water(era):
    """The era's open water as [(level, (x0, x1, y0, y1))], water.py's own numbers."""
    kind = states.spec(era)["water"]
    if not kind:
        return []
    from . import water
    return [water.LEVELS[kind]]


def _monuments(era):
    """What an animal must not stand in, as boxes (x0, x1, y0, y1) with their margins added."""
    S = states.spec(era)
    boxes = [(P["cx"] - P["half"] - 15.0, P["cx"] + P["half"] + 15.0, P["cy"] - P["half"] - 15.0, P["cy"] + P["half"] + 15.0)
             for P in data.PYRAMIDS.values()]
    if S["queens"]:
        boxes += [(q["cx"] - q["half"] - 6.0, q["cx"] + q["half"] + 6.0, q["cy"] - q["half"] - 6.0, q["cy"] + q["half"] + 6.0)
                  for q in data.QUEENS]
    for f in data.FOOTPRINTS:
        g = f.get("group")
        keep = ((g == "temples" and f["id"] in S["temples"]) or g == "sphinx" or (g == "causeways" and S["causeway"])
                or (g == "walls" and S["mastabas"]) or (g in ("mastabas", "tombs", "pits") and S["mastabas"]))
        if not keep:
            continue
        ring = f["ring"] if isinstance(f["ring"][0][0], (int, float)) else f["ring"][0]
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        pad = 3.0 if g in ("mastabas", "tombs", "pits", "walls") else 6.0
        boxes.append((min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad))
    return boxes


def _buildings(era, near, reach=120.0):
    """
    The era's houses as (x, y, half-width, half-depth, yaw) arrays, as city.py draws them (today's
    city, or the thinned village of 1800), kept to those within `reach` of any point in `near`.
    """
    kind = states.spec(era)["city"]
    if not kind:
        return None
    x, y, w, d, yaw, _ = data.city_boxes().T
    if kind == "village":
        try:
            from .city import VILLAGE_BOX
        except ImportError:
            VILLAGE_BOX = (420.0, 1600.0, -1600.0, 900.0)
        x0, x1, y0, y1 = VILLAGE_BOX
        keep = (x > x0) & (x < x1) & (y > y0) & (y < y1) & ((np.arange(len(x)) % 4) == 0)
        w, d = np.clip(w, 3, 14), np.clip(d, 3, 14)
    else:
        keep = np.ones(len(x), bool)
        for P in (data.PYRAMIDS[k] for k in ("g1", "g2", "g3")):
            keep &= np.hypot(x - P["cx"], y - P["cy"]) > P["half"] * 3.2
        w, d = np.maximum(w, 2), np.maximum(d, 2)
    close = np.zeros(len(x), bool)
    for px, py in near:
        close |= np.hypot(x - px, y - py) < reach
    keep &= close
    return x[keep], y[keep], w[keep] / 2, d[keep] / 2, np.radians(yaw[keep])


def _in_building(x, y, houses, pad=1.5):
    if houses is None or len(houses[0]) == 0:
        return False
    hx, hy, hw, hd, yaw = houses
    c, s = np.cos(-yaw), np.sin(-yaw)
    lx = (x - hx) * c - (y - hy) * s
    ly = (x - hx) * s + (y - hy) * c
    return bool(np.any((np.abs(lx) < hw + pad) & (np.abs(ly) < hd + pad)))


_ROADS = None


def _roads():
    """Today's roads as segments ((ax, ay), (bx, by)) in the project frame, from the ways roads.py draws."""
    global _ROADS
    if _ROADS is None:
        try:
            from . import roads
            ways, _ = roads.ways()
            _ROADS = [(a, b) for _, pts in ways for a, b in zip(pts, pts[1:])]
        except Exception:        # noqa: BLE001 - no roads is no alignment, not an error
            _ROADS = []
    return _ROADS


def _road_heading(x, y, reach=20.0):
    """The direction of the nearest road within `reach` metres as an angle from +Y (radians), or None."""
    best, heading = reach, None
    for (ax, ay), (bx, by) in _roads():
        ex, ey = bx - ax, by - ay
        L2 = ex * ex + ey * ey
        if L2 <= 0:
            continue
        t = min(1.0, max(0.0, ((x - ax) * ex + (y - ay) * ey) / L2))
        d = math.hypot(x - ax - t * ex, y - ay - t * ey)
        if d < best:
            best, heading = d, math.atan2(-ex, ey)
    return heading


def plan(era, lib_variants, terrain=None, surface=None, avoid=(), seed=0):
    """
    The instances of the era's herds as arrays (pos, rot, scl, var, tone, herd), var indexing
    `lib_variants` (the library's variant names in Collection Info order) and herd indexing
    herds(era). The ground comes from `surface(x, y)` (defaults to terrain.surface). Plain
    numpy, so the tests can run it.
    """
    surface = surface or terrain.surface
    index = {v: i for i, v in enumerate(lib_variants)}
    rng = np.random.default_rng(1000 + seed)
    water = _water(era)
    boxes = _monuments(era)
    clear = [(x, y, STATION_CLEAR) for x, y in _stations()] + [tuple(a) for a in avoid]
    mastabas = data.mastabas() if states.spec(era)["mastabas"] else []
    houses = _buildings(era, [(h.x, h.y) for h in herds(era)])
    pos, rot, scl, var, tone, which = [], [], [], [], [], []
    for hi, h in enumerate(herds(era)):
        kinds = [k for k in h.kinds if any(v in index for v in KINDS[k]["variants"])]
        if not kinds:
            continue
        share = np.array([3.0] + [1.0] * (len(kinds) - 1))
        share /= share.sum()
        drift = rng.uniform(0.0, 2.0 * math.pi)          # the way the herd is loosely facing
        placed = []
        tries = 0
        while len(placed) < h.count and tries < h.count * 40:
            tries += 1
            kind = kinds[int(rng.choice(len(kinds), p=share))]
            spec = KINDS[kind]
            x = h.x + rng.uniform(-h.half_w, h.half_w)
            y = h.y + rng.uniform(-h.half_d, h.half_d)
            if any(math.hypot(x - px, y - py) < max(spec["spacing"], ps) for px, py, ps in placed):
                continue
            if any(math.hypot(x - cx, y - cy) < r for cx, cy, r in clear):
                continue
            if any(b[0] < x < b[1] and b[2] < y < b[3] for b in boxes):
                continue
            if mastabas and _inside_mastaba(x, y, mastabas):
                continue
            if _in_building(x, y, houses):
                continue
            names = [v for v in spec["variants"] if v in index]
            weights = np.array([spec.get("weights", [1] * len(spec["variants"]))[spec["variants"].index(v)] for v in names], float)
            vname = names[int(rng.choice(len(names), p=weights / weights.sum()))]
            # Facing: along today's road where there is one (either way), else the herd's drift with a spread.
            heading = _road_heading(x, y) if era == "today" else None
            if heading is not None:
                heading += math.pi * float(rng.integers(0, 2)) + rng.normal(0.0, 0.15)
            else:
                heading = drift + rng.normal(0.0, 0.7 if "walk" not in vname else 0.3)
            young = spec.get("young")
            s = rng.uniform(*young[1]) if (young and rng.random() < young[0]) else rng.uniform(0.93, 1.06)
            # The ground under its feet, ahead and behind and to either side, for its height and pitch.
            half = 0.45 * s * _LENGTH.get(vname, 2.0)
            side = 0.2 * s * _LENGTH.get(vname, 2.0)
            fx, fy = -math.sin(heading), math.cos(heading)
            px_, py_ = fy, -fx
            zs = surface(np.array([x + fx * half, x - fx * half, x + px_ * side, x - px_ * side, x], np.float32),
                         np.array([y + fy * half, y - fy * half, y + py_ * side, y - py_ * side, y], np.float32))
            zs = np.asarray(zs, float)
            wet = [level for level, (x0, x1, y0, y1) in water if x0 < x < x1 and y0 < y < y1]
            if spec.get("water"):
                # Only in the water, as deep as the kind stands.
                if not wet or not spec["water"][0] <= wet[0] - zs.mean() <= spec["water"][1]:
                    continue
            elif wet and zs.min() < wet[0] + 0.25:
                continue
            pitch = math.atan2(zs[0] - zs[1], 2.0 * half)
            roll = -math.atan2(zs[2] - zs[3], 2.0 * side)
            slope = math.degrees(math.hypot(pitch, roll))
            if slope > spec["slope"]:
                continue
            steep = math.radians(min(spec["slope"], 20.0))
            pitch = max(-steep, min(steep, pitch))
            roll = max(-0.07, min(0.07, roll))
            z = 0.5 * (zs[0] + zs[1]) - 0.03 - abs(roll) * side
            placed.append((x, y, spec["spacing"]))
            pos.append((x, y, z))
            rot.append((pitch, roll, heading))
            mirror = -1.0 if rng.random() < 0.5 else 1.0
            scl.append((s * mirror, s, s))
            var.append(index[vname])
            tone.append(rng.random())
            which.append(hi)
    if not pos:
        return None
    return (np.array(pos, np.float32), np.array(rot, np.float32), np.array(scl, np.float32), np.array(var, np.int32),
            np.array(tone, np.float32), np.array(which, np.int32))


# Each variant's length nose to tail, metres, for the pitch it takes on a slope: filled from the library's objects.
_LENGTH = {}


def _inside_mastaba(x, y, mastabas, pad=1.5):
    for m in mastabas:
        c, s = math.cos(-m["yaw"]), math.sin(-m["yaw"])
        lx = (x - m["cx"]) * c - (y - m["cy"]) * s
        ly = (x - m["cx"]) * s + (y - m["cy"]) * c
        if abs(lx) < m["length"] / 2 + pad and abs(ly) < m["width"] / 2 + pad:
            return True
    return False


def place(era, terrain, coll, lib, avoid=(), log=print, seed=0):
    """Scatter the era's herds onto the terrain as instances of `lib`; returns the point cloud, or None."""
    if lib is None or not herds(era):
        return None
    from .instancing import field
    variants = [ob.get("variant", "") for ob in lib.objects]
    for ob in lib.objects:
        co = _coords(ob.data)
        _LENGTH[ob.get("variant", "")] = float(co[:, 1].max() - co[:, 1].min())
    planned = plan(era, variants, terrain=terrain, avoid=avoid, seed=seed)
    if planned is None:
        log(f"animals: no herd of the {era} era found ground to stand on")
        return None
    pos, rot, scl, var, tone, _ = planned
    counts = collections.Counter(variants[i] for i in var)
    log(f"animals {era}: {len(pos)} in {len(herds(era))} herds ({', '.join(f'{n} {v}' for v, n in counts.most_common())})")
    return field("animals", lib, pos, rot, scl, var, tone, np.zeros(len(pos), np.float32), coll, log)


# --- Looking at them ----------------------------------------------------------------------

def _reset():
    from . import instancing, materials
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials._IMAGES.clear()
    instancing._GROUP = None


def _ground(state, coll, half=3000.0):
    """A flat square of the era's ground at z = 0."""
    from . import materials
    me = bpy.data.meshes.new("test ground")
    me.from_pydata([(-half, -half, 0.0), (half, -half, 0.0), (half, half, 0.0), (-half, half, 0.0)], [], [(0, 1, 2, 3)])
    me.materials.append(materials.ground(state))
    ob = bpy.data.objects.new("test ground", me)
    coll.objects.link(ob)
    return ob


def _scene(opts, era):
    """A reset scene with the era's ground, sky, late afternoon sun and animals; returns (scene, world, lib, log)."""
    from . import renderer, sun
    from .sky import Sky
    t0 = time.time()
    log = lambda *a: print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)
    _reset()
    scene = bpy.context.scene
    world = bpy.data.collections.new("world")
    scene.collection.children.link(world)
    lib_parent = bpy.data.collections.new("library")
    scene.collection.children.link(lib_parent)
    state = era if era in states.STATES else "today"
    _ground(state, world)
    lib = library(lib_parent, era, log, cache=opts.get("cache", "1") != "0")
    if lib is None:
        raise SystemExit(f"no animals for {era!r}")
    sky = Sky(scene, coll=world)
    alt, az, _ = sun.sun_at(10, 20, float(opts.get("solar", 16.2)), year=states.spec(state)["year"])
    sky.set_sun(alt, az)
    log(f"sun at {alt:.1f} deg altitude, {az:.1f} deg azimuth")
    renderer.gpu(scene, log)
    renderer.configure(scene)
    return scene, world, lib_parent, lib, log


def _reference(lib_parent, log):
    """A 1.75 m person for scale: the as-built labourer where figures.py can make him, else a plain capsule."""
    from . import figures, variants
    coll = figures.library(lib_parent, "built", log)
    if coll is not None:
        return coll, 0
    me = variants.person(1)
    s = 1.75 / max(v.co.z for v in me.vertices)
    me.transform(Matrix.Scale(s, 4))
    return variants.collection(lib_parent, "v reference", [me], bpy.data.materials.new("reference")), 0


def _sheet(opts):
    """The era's variants side by side in profile (heads to the left), a 1.75 m person among them, seen from a few metres."""
    from . import cameras, renderer
    from .instancing import field
    era = opts.get("era", "first-time")
    scene, world, lib_parent, lib, log = _scene(opts, era)
    objs = list(lib.objects)
    lengths = []
    for ob in objs:
        co = _coords(ob.data)
        lengths.append(float(co[:, 1].max() - co[:, 1].min()))
    gap = 0.6
    xs, x = [], 0.0
    for L in lengths:
        xs.append(x + L / 2)
        x += L + gap
    width = x - gap
    xs = np.array(xs) - width / 2
    n = len(objs)
    # Facing -X: the instance turned +90 degrees about Z, so a camera looking north sees each in profile.
    pos = np.stack([xs, np.zeros(n), np.zeros(n)], 1)
    rot = np.array([(0.0, 0.0, math.pi / 2)] * n)
    field("animals", lib, pos, rot, np.ones((n, 3)), np.arange(n), np.full(n, 0.5), np.zeros(n), world, log)
    ref, idx = _reference(lib_parent, log)
    field("reference", ref, np.array([(xs[0] - lengths[0] / 2 - 1.2, 0.0, 0.0)]), np.array([(0.0, 0.0, math.pi)]),
          np.ones((1, 3)), np.array([idx]), np.full(1, 0.5), np.zeros(1), world, log)
    tallest = max(float(_coords(ob.data)[:, 2].max()) for ob in objs)
    cam = cameras.make(scene)
    lens = float(opts.get("lens", 35.0))
    span = width + 3.0
    d = float(opts.get("distance", max(span, tallest * 1.9) * lens / 36.0 * 1.05 + 2.0))
    cameras.frame(cam, (-0.6, -d, tallest * 0.45), (-0.6, 0.0, tallest * 0.42), lens)
    w, h = (int(v) for v in opts.get("size", "1280x720").split("x"))
    out = os.path.abspath(opts.get("out", os.path.join(OUT, f"sheet-{era}.png")))
    t = time.time()
    renderer.render(scene, out, w, h, int(opts.get("samples", 64)))
    log(f"rendered {out} in {time.time() - t:.0f}s")


def _test(opts):
    """Every variant at 20 m, and small herds of them at 60 and 150 m, from a camera looking north in the late sun."""
    from . import cameras, renderer
    from .instancing import field
    era = opts.get("era", "first-time")
    scene, world, lib_parent, lib, log = _scene(opts, era)
    objs = list(lib.objects)
    n = len(objs)
    rng = np.random.default_rng(int(opts.get("seed", 3)))
    pos, rot, scl, var = [], [], [], []
    lengths = [float(_coords(ob.data)[:, 1].max() - _coords(ob.data)[:, 1].min()) for ob in objs]
    near = float(opts.get("near", 20.0))
    spread = sum(lengths) * 0.55 + n * 0.4
    for i in range(n):
        pos.append((-spread / 2 + spread * (i + 0.5) / n, near + rng.uniform(-1.0, 1.0), 0.0))
        rot.append((0.0, 0.0, rng.choice([math.pi / 2, -math.pi / 2]) + rng.uniform(-0.5, 0.5)))
        scl.append(1.0)
        var.append(i)
    for dist, count, width in ((60.0, max(12, n * 2), 50.0), (150.0, max(20, n * 3), 120.0)):
        for _ in range(count):
            pos.append((rng.uniform(-width / 2, width / 2), dist + rng.uniform(-8.0, 8.0), 0.0))
            rot.append((0.0, 0.0, rng.uniform(0.0, 2.0 * math.pi)))
            scl.append(rng.uniform(0.93, 1.06))
            var.append(int(rng.integers(0, n)))
    s = np.array(scl)
    field("animals", lib, np.array(pos), np.array(rot), np.stack([s, s, s], 1), np.array(var), rng.random(len(pos)),
          np.zeros(len(pos)), world, log)
    cam = cameras.make(scene)
    cameras.frame(cam, (0.0, 0.0, 1.7), (0.0, 60.0, 1.2), float(opts.get("lens", 50.0)))
    w, h = (int(v) for v in opts.get("size", "1280x720").split("x"))
    out = os.path.abspath(opts.get("out", os.path.join(OUT, f"test-{era}.png")))
    t = time.time()
    renderer.render(scene, out, w, h, int(opts.get("samples", 64)))
    log(f"rendered {out} in {time.time() - t:.0f}s")


# Framed shots of each era's herds from its stations, for checking them in the built plateau:
# (name, camera x, y, eye above the ground, target x, y, target above the ground, lens mm).
HERD_SHOTS = {
    "first-time": [
        ("south-gazelles", 20.0, -330.0, 1.7, 60.0, -415.0, 0.6, 85.0),
        ("east-elephants", 205.0, 8.0, 1.7, 320.0, 85.0, 1.2, 70.0),
        ("panorama", -980.0, -1830.0, 1.7, -600.0, -1000.0, 20.0, 40.0),
        ("north-hartebeest", 20.0, 205.0, 1.7, -10.0, 315.0, 0.8, 85.0),
        ("flood-elephants", 439.0, -445.0, 16.0, 465.0, -655.0, 1.0, 85.0),
        ("raft-hippos", 500.0, -468.0, 1.7, 580.0, -490.0, 0.3, 70.0),
        ("east-buffalo", 205.0, 8.0, 1.7, 400.0, 205.0, 0.8, 135.0),
    ],
    "lion": [
        ("south-gazelles", 20.0, -330.0, 1.7, 60.0, -415.0, 0.6, 85.0),
        ("menkaure-oryx", -400.0, -800.0, 1.7, -300.0, -870.0, 0.8, 85.0),
    ],
    "built": [
        ("town-cattle", 516.0, -841.5, 1.7, 470.0, -715.0, 1.0, 50.0),
        ("sphinx-cattle", 439.0, -445.0, 14.0, 650.0, -300.0, 1.0, 70.0),
        ("south-donkeys", 20.0, -330.0, 1.7, 100.0, -262.0, 0.8, 70.0),
        ("quay-donkeys", 500.0, -560.0, 1.7, 445.0, -605.0, 0.8, 50.0),
    ],
    "stripped": [
        ("village", 439.0, -445.0, 16.0, 520.0, -330.0, 1.0, 50.0),
    ],
    "today": [
        ("panorama-camels", -980.0, -1830.0, 1.7, -930.0, -1845.0, 1.0, 35.0),
        ("panorama-west", -980.0, -1830.0, 1.7, -1020.0, -1805.0, 1.0, 35.0),
        ("south-road", 20.0, -330.0, 1.7, 95.0, -248.0, 1.0, 50.0),
        ("sphinx-road", 439.0, -445.0, 16.0, 460.0, -383.0, 1.0, 50.0),
    ],
}


def _herds(opts):
    """The era built as the walkthrough builds it, its herds placed, and HERD_SHOTS rendered into build/fauna/."""
    from .scene import Plateau
    era = opts.get("era", "first-time")
    p = Plateau(era)
    lib = library(p.library, era, p.log)
    place(era, p.terrain, p.world, lib, log=p.log)
    w, h = (int(v) for v in opts.get("size", "1280x720").split("x"))
    for name, x, y, eye, tx, ty, th, lens in HERD_SHOTS.get(era, []):
        z = float(p.terrain.surface([x], [y])[0]) + eye
        tz = float(p.terrain.surface([tx], [ty])[0]) + th
        v = {"id": f"herds-{name}", "x": x, "y": y, "z": z, "target": (tx, ty, tz), "lens": lens}
        p.view(v, "shot")
        p.moment({"date": opts.get("date", "10-20"), "solar": float(opts.get("solar", 16.2))})
        if opts.get("dry"):
            continue            # --dry 1 sets every view up without rendering it
        p.render(os.path.join(OUT, f"herds-{era}-{name}.png"), w, h, int(opts.get("samples", 64)), view_id=v["id"], kind="shot")


def _base_image(mat):
    """The image a material's base colour is read from, through whatever tone nodes stand between, or None."""
    tree = mat.node_tree if mat is not None else None
    bsdf = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if tree else None
    sock = bsdf.inputs["Base Color"] if bsdf else None
    for _ in range(8):
        if sock is None or not sock.is_linked:
            return None
        node = sock.links[0].from_node
        if node.type == "TEX_IMAGE":
            return node.image
        sock = next((s for s in node.inputs if s.is_linked and s.type == "RGBA"), None)
    return None


def _measure(opts):
    """Each variant's size and triangles, and its mesh kept as numpy arrays under build/fauna/check/ for looking at."""
    era = opts.get("era", "first-time")
    t0 = time.time()
    log = lambda *a: print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)
    _reset()
    parent = bpy.data.collections.new("library")
    bpy.context.scene.collection.children.link(parent)
    lib = library(parent, era, log, cache=opts.get("cache", "1") != "0")
    if lib is None:
        raise SystemExit(f"no animals for {era!r}")
    check = os.path.join(OUT, "check")
    os.makedirs(check, exist_ok=True)
    pixels = {}
    for ob in lib.objects:
        me = ob.data
        co = _coords(me)
        me.calc_loop_triangles()
        n = len(me.loop_triangles)
        tri = np.empty(n * 3, np.int32)
        me.loop_triangles.foreach_get("vertices", tri)
        # Each triangle's colour, read from its material's base colour image at the middle of its UVs.
        loops = np.empty(n * 3, np.int32)
        me.loop_triangles.foreach_get("loops", loops)
        mats = np.empty(n, np.int32)
        me.loop_triangles.foreach_get("material_index", mats)
        colour = np.full((n, 3), 0.5, np.float32)
        if me.uv_layers:
            uv = np.empty(len(me.loops) * 2, np.float32)
            me.uv_layers.active.data.foreach_get("uv", uv)
            mid = uv.reshape(-1, 2)[loops.reshape(-1, 3)].mean(1)
            for i, mat in enumerate(me.materials):
                img = _base_image(mat)
                sel = mats == i
                if img is None or not sel.any() or img.size[0] == 0:
                    continue
                if img.name not in pixels:
                    px = np.empty(img.size[0] * img.size[1] * 4, np.float32)
                    img.pixels.foreach_get(px)
                    pixels[img.name] = px.reshape(img.size[1], img.size[0], 4)
                px = pixels[img.name]
                h, w = px.shape[:2]
                colour[sel] = px[np.clip((mid[sel, 1] % 1.0) * h, 0, h - 1).astype(int),
                                 np.clip((mid[sel, 0] % 1.0) * w, 0, w - 1).astype(int), :3]
        np.savez_compressed(os.path.join(check, f"{ob['variant']}.npz"), V=co, F=tri.reshape(-1, 3), C=colour)
        log(f"{ob['variant']:22} {ob.get('kind', ''):12} h {co[:, 2].max():5.2f} m  l {np.ptp(co[:, 1]):5.2f} m  "
            f"w {np.ptp(co[:, 0]):5.2f} m  {len(me.loop_triangles):6,} tris  feet at {co[:, 2].min():+.3f}")


def _opts(argv):
    o, it = {}, iter(argv)
    for k in it:
        o[k.lstrip("-")] = next(it, "1")
    return o


def _main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    cmd = argv[0] if argv else "sheet"
    opts = _opts(argv[1:])
    if cmd == "sheet":
        _sheet(opts)
    elif cmd == "test":
        _test(opts)
    elif cmd == "measure":
        _measure(opts)
    elif cmd == "herds":
        _herds(opts)
    else:
        raise SystemExit(f"unknown command {cmd!r}: sheet, test, herds or measure")


if __name__ == "__main__":
    _main()
