"""
The sky, the sun and the air.

Blender 5.1's multiple-scattering sky, drawn twice: camera rays see it with its sun
disc, every other ray without, so the lamp alone delivers the direct light and the sun
is not counted twice. The lamp's colour and strength come from Beer's law along the
air mass (Kasten and Young), with a Rayleigh term and a grey term for the dust, in the
sky texture's own units (BEAM_AT_ZENITH, carried over from blender/render_sky.py).

The haze is three homogeneous slabs, dense near the ground and thin above, so the
horizon whitens while the zenith stays blue. They do not shadow the sun, whose beam
has already been dimmed by the formula.
"""
import math

import bmesh
import bpy
from mathutils import Vector

from . import data
from .nodes import Tree, hexlin

BEAM_AT_ZENITH = 190.0
AEROSOL_OPTICAL_DEPTH = 0.08
# (bottom, top, density per metre, colour): look choices.
HAZE = ((-120.0, 160.0, 4.2e-5, "f4dfc2"), (160.0, 520.0, 1.5e-5, "f3e7d4"), (520.0, 1600.0, 4e-6, "f4efe6"))


def beam(altitude_deg, aerosol):
    h = max(altitude_deg, 0.0)
    air_mass = 1.0 / (math.sin(math.radians(h)) + 0.50572 * (h + 6.07995) ** -1.6364)
    tr = [math.exp(-(0.008735 * um ** -4.08 + AEROSOL_OPTICAL_DEPTH * aerosol) * air_mass) for um in (0.610, 0.550, 0.470)]
    b = max(tr)
    return tuple(c / b for c in tr), BEAM_AT_ZENITH * b


class Sky:
    def __init__(self, scene, aerosol=1.1, haze=1.0, coll=None):
        self.scene = scene
        self.aerosol = aerosol
        world = bpy.data.worlds.new("sky")
        scene.world = world
        t = Tree(world)
        out = t.node("ShaderNodeOutputWorld")
        self.textures = []
        for disc in (True, False):
            s = t.node("ShaderNodeTexSky", sky_type="MULTIPLE_SCATTERING")
            s.sun_disc = disc
            s.altitude = data.ORIGIN_ELEVATION + 10
            s.air_density = 1.0
            s.aerosol_density = aerosol
            s.ozone_density = 1.0
            self.textures.append(s)
        lp = t.node("ShaderNodeLightPath")
        mix = t.node("ShaderNodeMixRGB")
        t.link(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
        t.link(self.textures[1].outputs[0], mix.inputs["Color1"])
        t.link(self.textures[0].outputs[0], mix.inputs["Color2"])
        bg = t.node("ShaderNodeBackground")
        t.link(mix.outputs["Color"], bg.inputs["Color"])
        t.link(bg.outputs[0], out.inputs["Surface"])
        lamp = bpy.data.lights.new("sun", "SUN")
        lamp.angle = math.radians(0.53)
        self.sun = bpy.data.objects.new("sun", lamp)
        scene.collection.objects.link(self.sun)
        self.sun.visible_camera = False
        if haze > 0 and coll is not None:
            for z0, z1, dens, col in HAZE:
                self._slab(coll, z0, z1, dens * haze, col)

    def set_sun(self, altitude_deg, azimuth_deg):
        for s in self.textures:
            s.sun_elevation = math.radians(altitude_deg)
            s.sun_rotation = math.radians(azimuth_deg)
        colour, energy = beam(altitude_deg, self.aerosol)
        self.sun.data.energy = energy
        self.sun.data.color = colour
        e, a = math.radians(altitude_deg), math.radians(azimuth_deg)
        to_sun = Vector((math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), math.sin(e)))
        self.sun.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
        return colour, energy

    def _slab(self, coll, z0, z1, density, colour):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        me = bpy.data.meshes.new("air")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new("air", me)
        coll.objects.link(ob)
        ob.scale = (30000, 30000, z1 - z0)
        ob.location = (0, 0, (z0 + z1) / 2)
        mat = bpy.data.materials.new("air")
        t = Tree(mat)
        out = t.node("ShaderNodeOutputMaterial")
        pv = t.node("ShaderNodeVolumePrincipled")
        pv.inputs["Color"].default_value = hexlin(colour)
        pv.inputs["Density"].default_value = density
        pv.inputs["Anisotropy"].default_value = 0.6
        t.link(pv.outputs[0], out.inputs["Volume"])
        try:
            mat.cycles.homogeneous_volume = True
        except Exception:
            pass
        me.materials.append(mat)
        ob.visible_shadow = False
