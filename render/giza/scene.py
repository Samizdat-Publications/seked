"""
One era of the plateau, built once, and the views rendered from it.

What stands in an era is render/giza/states.py's to say. Building an era takes 15
to 60 seconds (the Sphinx stand-in is most of it); a view only rebuilds what
depends on the camera (the displaced patch of ground, the stones and the people
round it) and moves the sun.
"""
import random
import time

import bpy
from mathutils import Vector

from . import (causeway, cameras, city, data, instancing, mastabas, materials, pyramids, renderer, scatter, sphinx,
               states, sun, temples, variants, water)
from .sky import Sky
from .terrain import Terrain

# The vegetation layer is wired in only once it has been reviewed; until then a
# half-written module must not be able to break a build.
VEGETATION = False
vegetation = None
if VEGETATION:
    from . import vegetation


class Plateau:
    def __init__(self, state, aerosol=1.1, haze=1.0, stones=True, log=None):
        t0 = time.time()
        self.log = log or (lambda *a: print(f"[{time.time() - t0:6.1f}s]", *a, flush=True))
        self.state = state
        self.spec = S = states.spec(state)
        self.want_stones = stones and S["stones"]
        bpy.ops.wm.read_factory_settings(use_empty=True)
        # A reset frees every datablock, so no cache may outlive it.
        materials._IMAGES.clear()
        instancing._GROUP = None
        self.scene = bpy.context.scene
        self.library = self._coll("library")
        self.world = self._coll("world")
        self.per_view = self._coll("this view")
        rng = random.Random(7)
        self.mats = {
            "core": materials.stone("core", "core"),
            "core fresh": materials.stone("core fresh", "core", rough=0.8, tex_amt=0.45, sand_tops=0.0, bump=0.25),
            "core behind": materials.stone("core behind", "core", instanced=False),
            "casing": materials.stone("casing", "casing_today", rough=0.8, tex_role="casing", tex_amt=0.5, sand_tops=0.5, bump=0.35),
            "granite": materials.stone("granite", "granite", rough=0.7, tex_role="granite", tex_amt=0.6, sand_tops=0.3),
            "rock": materials.stone("rock", "core", sand_tops=0.6),
            "mastaba core": materials.stone("mastaba core", "mastaba", instanced=False, sand_tops=0.9),
            "city": materials.flat("city", "city", 0.85),
            "people": materials.flat("people", "people", 0.7),
            "dressed": materials.dressed("dressed casing"),
            # The claim's casing, polished further than any reconstruction would draw it.
            "pristine casing": materials.dressed("pristine casing", colours=("f3efe7", "faf8f3"), rough=0.16),
            "weathered casing": materials.weathered_casing(),
            "gold": materials.metal("gold", "f2c35a", 0.2),
            "electrum": materials.metal("electrum", "efe0a8", 0.14),
            "dressed granite": materials.dressed_granite(),
            "dark": materials.dark(),
            "water": materials.water(),
            "ground": materials.ground(state),
            "ground displaced": materials.ground(state, displace=True),
            "mudbrick": materials.dressed("mudbrick", colours=("6c533f", "7d6149"), rough=0.95, grain_scale=0.3),
            # Aswan granite: red-brown to grey, a tone per block.
            "granite blocks": materials.dressed_blocks("granite blocks", [(0.0, "5e3a31"), (0.3, "74463a"), (0.55, "6a4a42"),
                                                                          (0.8, "7e5244"), (1.0, "5a403b")], rough=0.42),
            # Tura and Mokattam limestone, dressed: white with a faint drift from block to block.
            "limestone blocks": materials.dressed_blocks("limestone blocks", [(0.0, "e6dfd1"), (0.5, "efe9dd"), (1.0, "ddd4c3")],
                                                         rough=0.45, speckle=False),
            "bedrock": sphinx.bedrock_material(),
        }
        self.lib = variants.library(self.library, self.mats, state, rng)
        footprints = pyramids.build(state, rng, self.world, self.mats, self.lib, self.log)
        self.terrain = Terrain(state, footprints, flats=temples.flats(state), cuts=[sphinx.enclosure(state)],
                               calm=causeway.centreline() if S["causeway"] else None,
                               sand=states.SPHINX_SAND if S["sphinx"] == "buried" else None)
        self.terrain.build(self.world, self.mats["ground"])
        self.log("terrain")
        sphinx.statue(state, self.world, self.log)
        if S["sphinx"] != "buried":
            sphinx.walls(self.terrain, self.world, self.mats["bedrock"], state)
        temples.build(state, rng, self.terrain, self.world, self.mats, self.lib, self.log)
        causeway.build(state, rng, self.terrain, self.world, self.mats, self.lib, self.log)
        mastabas.build(state, rng, self.terrain, self.world, self.mats, self.lib, self.log)
        water.build(state, self.world, self.mats, self.log)
        if S["rubble"]:
            scatter.rubble(rng, self.terrain, self.world, self.lib, self.log)
        if S["city"] == "city":
            city.build(self.terrain, self.world, self.lib, self.log)
        elif S["city"] == "village":
            city.village(self.terrain, self.world, self.lib, self.log)
        if vegetation is not None:
            vegetation.build(state, self.terrain, self.world, rng, self.log)
        self.sky = Sky(self.scene, aerosol=aerosol, haze=haze, coll=self.world)
        self.camera = cameras.make(self.scene)
        renderer.gpu(self.scene, self.log)
        renderer.configure(self.scene)
        self.log(f"built {state} ({S['label']}, {S['honesty']})")

    def _coll(self, name):
        c = bpy.data.collections.new(name)
        self.scene.collection.children.link(c)
        return c

    def _clear_view(self):
        for ob in list(self.per_view.objects):
            me = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            if me is not None and me.users == 0:
                bpy.data.meshes.remove(me)

    def view(self, v, kind):
        """Point the camera at a shot or stand it at a station; rebuild the ground at its feet."""
        self._clear_view()
        x, y = v["x"], v["y"]
        z = float(self.terrain.surface([x], [y])[0]) + v.get("eye", 1.7)
        if kind == "shot":
            cameras.frame(self.camera, (x, y, z), v["target"], v["lens"])
            d = Vector((v["target"][0] - x, v["target"][1] - y, 0.0)).normalized()
            centre = (x + d.x * 145.0, y + d.y * 145.0)
        else:
            cameras.station(self.camera, (x, y, z))
            centre = (x, y)
        self.terrain.patch(centre, self.per_view, self.mats["ground displaced"])
        if self.want_stones:
            scatter.stones((x, y), self.terrain, self.per_view, self.lib, self.log)
        if self.spec["people"]:
            scatter.people((x, y), self.terrain, self.per_view, self.lib, self.log)
        if vegetation is not None and hasattr(vegetation, "near_camera"):
            vegetation.near_camera(self.state, self.terrain, self.per_view, (x, y), self.log)
        self.log(f"{kind} {v['id']} at ({x:.0f}, {y:.0f}, {z:.1f})")

    def moment(self, m):
        alt, az, dec = sun.parse_moment(m, self.spec["year"])
        colour, energy = self.sky.set_sun(alt, az)
        self.log(f"sun at {alt:.1f} deg altitude, {az:.1f} deg azimuth (declination {dec:.1f}), beam {energy:.0f}")

    def render(self, out, width, height, samples):
        t = time.time()
        renderer.render(self.scene, out, width, height, samples)
        self.log(f"rendered {out} in {time.time() - t:.0f}s")
