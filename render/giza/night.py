"""
The night sky, from the sky bake (build/sky-bake.json, written by `pnpm run sky-bake`).

A night of the bake's `nights` carries every star of the bright catalogue at its altitude
and azimuth for one epoch and the sidereal time its meridian star transits, the rotation
that carries ICRS onto the horizon at that moment, and the sun that keeps it dark. Blender
computes none of it: the stars go on a dome round the camera through blender/render_sky.py's
star cloud (the same sizes, colours and radiance the old night view was tuned with), and
the Milky Way is NASA SVS 4851's map turned by the same rotation. A missing bake is said,
not papered over.
"""
import io
import json
import os
import sys

import bpy

from . import data

BAKE = os.path.join(data.REPO, "build", "sky-bake.json")
MILKY_WAY = os.path.join(data.REPO, "build", "sky", "milkyway_2020_8k.exr")
MILKY_WAY_STRENGTH = 0.012     # look choices, carried over from blender/render_sky.py
AIRGLOW = (0.09, 0.13, 0.26, 1.0)
AIRGLOW_STRENGTH = 0.002
EXPOSURE = 6.5


def _render_sky():
    blender_dir = os.path.join(data.REPO, "blender")
    if blender_dir not in sys.path:
        sys.path.insert(0, blender_dir)
    import render_sky
    return render_sky


def night(night_id):
    """The baked night, or None with a warning when the bake is missing or lacks it."""
    if not os.path.exists(BAKE):
        print(f"WARNING: {BAKE} is missing; run pnpm run sky-bake. The night has no stars.")
        return None
    with io.open(BAKE, encoding="utf-8") as f:
        bake = json.load(f)
    n = bake.get("nights", {}).get(night_id)
    if n is None:
        print(f"WARNING: the sky bake has no night {night_id!r}; run pnpm run sky-bake.")
    return n


class Night:
    """The dome, the Milky Way and the airglow, built once and switched on and off per view."""

    def __init__(self, scene, world_tree, log=print):
        self.scene = scene
        self.tree = world_tree
        self.log = log
        self.dome = None
        self.glow = None
        self.turn = None
        self.air = None
        self.night_id = None

    def _world_terms(self):
        """Airglow and the Milky Way, added under whatever the world already draws."""
        t = self.tree
        out = next(n for n in t.nodes if n.type == "OUTPUT_WORLD")
        existing = out.inputs["Surface"].links[0].from_socket
        air = t.nodes.new("ShaderNodeBackground")
        air.inputs["Color"].default_value = AIRGLOW
        air.inputs["Strength"].default_value = 0.0
        add = t.nodes.new("ShaderNodeAddShader")
        t.links.new(existing, add.inputs[0])
        t.links.new(air.outputs[0], add.inputs[1])
        surface = add.outputs[0]
        if os.path.exists(MILKY_WAY):
            coords = t.nodes.new("ShaderNodeTexCoord")
            turn = t.nodes.new("ShaderNodeMapping")
            turn.vector_type = "VECTOR"
            t.links.new(coords.outputs["Generated"], turn.inputs["Vector"])
            image = t.nodes.new("ShaderNodeTexEnvironment")
            image.image = bpy.data.images.load(MILKY_WAY, check_existing=True)
            image.projection = "EQUIRECTANGULAR"
            t.links.new(turn.outputs["Vector"], image.inputs["Vector"])
            glow = t.nodes.new("ShaderNodeBackground")
            glow.inputs["Strength"].default_value = 0.0
            t.links.new(image.outputs["Color"], glow.inputs["Color"])
            add2 = t.nodes.new("ShaderNodeAddShader")
            t.links.new(surface, add2.inputs[0])
            t.links.new(glow.outputs[0], add2.inputs[1])
            surface = add2.outputs[0]
            self.glow, self.turn = glow, turn
        else:
            self.log(f"no Milky Way: {MILKY_WAY} is missing (NASA SVS 4851, data/sources.json nasa-svs-4851)")
        t.links.new(surface, out.inputs["Surface"])
        self.air = air

    def show(self, night_id, centre):
        """Stars for this night round `centre` (the eye); returns the baked night, or None."""
        from mathutils import Matrix
        rs = _render_sky()
        n = night(night_id)
        if self.air is None:
            self._world_terms()
        if n is None:
            return None
        if self.night_id != night_id:
            if self.dome is not None:
                bpy.data.objects.remove(self.dome, do_unlink=True)
            self.dome = rs.build_star_dome(self.scene, {"stars": n}, centre)
            self.night_id = night_id
        self.dome.location = centre
        self.dome.hide_render = False
        self.air.inputs["Strength"].default_value = AIRGLOW_STRENGTH
        if self.glow is not None:
            self.turn.inputs["Rotation"].default_value = Matrix(n["icrsToEnu"]).transposed().to_euler("XYZ")
            self.glow.inputs["Strength"].default_value = MILKY_WAY_STRENGTH
        up = sum(1 for row in n["stars"] if row[1] > 0)
        self.log(f"night {night_id}: epoch {n['epoch']}, {n['meridian']['name']} on the meridian at sidereal time "
                 f"{n['lstDeg']:.2f} deg, {up} stars up, the {n['season']} sun at {n['sun']['altitudeDeg']:.1f} deg")
        return n

    def hide(self):
        if self.dome is not None:
            self.dome.hide_render = True
        if self.air is not None:
            self.air.inputs["Strength"].default_value = 0.0
        if self.glow is not None:
            self.glow.inputs["Strength"].default_value = 0.0
