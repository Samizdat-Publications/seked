"""
The sky, the sun and the air.

Blender 5.1's multiple-scattering sky, drawn twice: camera rays see it with its sun
disc, every other ray without, so the lamp alone delivers the direct light and the sun
is not counted twice. The lamp's colour and strength come from Beer's law along the
air mass (Kasten and Young), with a Rayleigh term and a grey term for the dust, in the
sky texture's own units (BEAM_AT_ZENITH, carried over from blender/render_sky.py). In an
era with photographed clouds (CLOUDS), the photograph takes the physical sky's place for
every ray while the sun is up.

The haze is one volume whose density falls off with height (a sum of exponentials, GRADED),
so the horizon whitens while the zenith stays blue, and from the air it grades into the
sky with no seam. It does not shadow the sun, whose beam has already been dimmed by the
formula.
"""
import io
import json
import math
import os
import tempfile

import bmesh
import bpy
from mathutils import Vector

from . import data
from .nodes import Tree, hexlin

BEAM_AT_ZENITH = 190.0
AEROSOL_OPTICAL_DEPTH = 0.08
# The air's haze, as (extinction per metre at z = 0, scale height in metres, colour, capped): look
# choices. The first is the ground haze, which takes the era's whole haze multiplier: 150 m deep, so it
# puts a pyramid a kilometre or two off behind haze while a ray climbing to the clouds leaves it within
# a few degrees of the horizon. The second is the mixed layer above, which takes at most 1.5 times it:
# carried whole into the air aloft, an era's thick haze washed the photographed skies to a grey card
# (critic rounds 6 to 12). With the era's multiplier of 4.5 they give what the three stacked slabs gave
# over the plateau (4.2e-5, 1.5e-5 and 4e-6 per metre to 160, 520 and 1600 m); stacked, their steps
# drew a hard grey band across the horizon from the air (critic round 16), which a smooth fall-off does not.
GRADED = ((4.66e-5, 150.0, "f4dfc2", False), (1.2e-5, 1000.0, "f3e7d4", True))
# Its cylinder: bottom, top and radius. The radius stays inside the camera's 60 km clip (cameras.py):
# a camera ray clipped inside the volume lost its haze, which drew a hard line across the sky where the
# ray's way out of the top ran past 60 km.
GRADED_SPAN = (-120.0, 4000.0, 55000.0)
# The eras' clouds are photographs (blender/skies.json, fetched by scripts/skies.py into build/skies/):
# a pure-sky HDRI with its own sun capped, turned so its sun stands where the moment's sun does, which
# the camera sees and which lights the scene beside the lamp. Each era has one for a high sun and one for
# a low sun, split at `split` degrees of altitude. Look choices, and never evidence of any past weather.
# (Volumetric cumulus were tried first, 2026-09-25: grey smoke at 200 s for a 960 x 540 frame on the laptop.)
#
# Its brightness: where the photograph's sun shows as a disc, the photograph stands to the lamp as its sky
# stood to its own sun, a measurement. Matched instead to the median of Blender's clear physical sky, as
# it was until 2026-09-27, it was shown at a third to a fifth of that: its sky measures 15 to 35 times
# darker than its sun, Blender's clear sky 40 to 70 times at the same altitude, so the sky read flat grey
# behind lit stone brighter than it (critic round 16). The measured scale is held between the median
# match and SKY_GAIN_MAX times it, since a sun veiled by thin cloud reads dim and would make the sky
# too bright under a lamp that is not veiled. Where no disc shows, the median match stands. A disc is a
# brightest pixel SUN_SEEN times the sky's median.
SKIES = os.path.join(data.REPO, "build", "skies")
SUN_SEEN = 1000.0
SKY_GAIN_MAX = 2.0
CLOUDS = {
    "tropical": dict(high="kloofendal_48d_partly_cloudy_puresky", low="citrus_orchard_puresky", split=0.0),
    # The long rains: a dark, broken deck with its structure down to the horizon, the land lit under its
    # edge. farm_field_puresky before it (to 2026-09-27) showed a smooth charcoal rain mass wherever the
    # dawn views looked west (critic round 16: "a dead charcoal slab with no cloud structure").
    "showers": dict(high="overcast_soil_puresky", low="overcast_soil_puresky", split=0.0),
    "dry": dict(high="kloofendal_43d_clear_puresky", low="qwantani_late_afternoon_puresky", split=24.0),
}


def beam(altitude_deg, aerosol):
    h = max(altitude_deg, 0.0)
    air_mass = 1.0 / (math.sin(math.radians(h)) + 0.50572 * (h + 6.07995) ** -1.6364)
    tr = [math.exp(-(0.008735 * um ** -4.08 + AEROSOL_OPTICAL_DEPTH * aerosol) * air_mass) for um in (0.610, 0.550, 0.470)]
    b = max(tr)
    return tuple(c / b for c in tr), BEAM_AT_ZENITH * b


class Sky:
    def __init__(self, scene, aerosol=1.1, haze=1.0, coll=None, colours=None, mist=None):
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
            self._graded(coll, haze, colours)
        if mist and coll is not None:
            self._slab(coll, *mist)

    def clouds(self, kind, log=print):
        """Hang the era's photographed skies (CLOUDS[kind]) behind the scene; set_sun picks and turns one."""
        import numpy as np
        C = CLOUDS[kind]
        with io.open(os.path.join(SKIES, "index.json"), encoding="utf-8") as f:
            index = json.load(f)["skies"]
        backdrops = {}
        for role in ("high", "low"):
            sky_id = C[role]
            path = os.path.join(SKIES, index[sky_id]["file"])
            if not os.path.exists(path):
                log(f"sky: {path} is missing (python scripts/skies.py); the clear sky stands")
                return
            img = bpy.data.images.load(path, check_existing=True)
            w, h = img.size
            px = np.empty(w * h * 4, np.float32)
            img.pixels.foreach_get(px)
            lum = px.reshape(h, w, 4)[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            # The sun: the brightest pixel. Blender's rows run bottom to top.
            j, i = np.unravel_index(np.argmax(lum), lum.shape)
            u, v = (i + 0.5) / w, (j + 0.5) / h
            phi = (0.5 - u) * 2.0 * math.pi                      # Cycles' equirect: u = 0.5 - atan2(y, x) / 2 pi
            az_img = math.degrees(math.atan2(math.cos(phi), math.sin(phi))) % 360.0
            el_img = (v - 0.5) * 180.0
            # The sky's level: the median over elevations 25 to 65 degrees, clouds and all.
            band = lum[int(h * (0.5 + 25 / 180)):int(h * (0.5 + 65 / 180))]
            level = float(np.median(band))
            # The photograph's own sun, as irradiance: its disc summed over a window 3 degrees round the
            # brightest pixel, each pixel by its solid angle. None when no disc stands out of the cloud.
            sun = None
            if lum[j, i] > SUN_SEEN * level:
                rows = np.arange(max(j - int(h * 3 / 180), 0), min(j + int(h * 3 / 180) + 1, h))
                el = ((rows + 0.5) / h - 0.5) * math.pi
                half = int(w * 3 / 360 / max(math.cos(math.radians(el_img)), 0.2))
                cols = np.arange(i - half, i + half + 1) % w
                win = lum[np.ix_(rows, cols)]
                dom = (2 * math.pi / w) * (math.pi / h) * np.cos(el)[:, None]
                sun = float((win * dom * (win > 50 * level)).sum())
            backdrops[role] = dict(id=sky_id, image=img, az=az_img, el=el_img, level=level, sun=sun,
                                   cap=float(np.percentile(band, 99.5)) * 4.0)
            log(f"sky: {sky_id} for a {role} sun, its own sun at {el_img:.0f} deg altitude, {az_img:.0f} deg azimuth, "
                + (f"its sky {level / sun:.3g} of its sun" if sun else "its sun hidden"))
        self.backdrops = backdrops
        self.split = C["split"]
        self._backdrop_nodes()

    def _backdrop_nodes(self):
        """
        Put the photograph in the physical sky's place for every ray while the sun is up. It lights the
        scene too: shown brighter than the clear sky that lit the scene, it left the shadows lit by a
        sky darker than the one in the frame. The physical sky stays for the night and for the probe.
        """
        t = self.scene.world.node_tree
        bg = next(n for n in t.nodes if n.type == "BACKGROUND")
        physical = bg.inputs["Color"].links[0].from_socket
        coords = t.nodes.new("ShaderNodeTexCoord")
        turn = t.nodes.new("ShaderNodeMapping")
        turn.vector_type = "POINT"
        t.links.new(coords.outputs["Generated"], turn.inputs["Vector"])
        env = t.nodes.new("ShaderNodeTexEnvironment")
        env.projection = "EQUIRECTANGULAR"
        t.links.new(turn.outputs["Vector"], env.inputs["Vector"])
        # The photograph's own sun is capped, so it does not add a second highlight to the lamp's.
        cap = t.nodes.new("ShaderNodeMix")
        cap.data_type = "RGBA"
        cap.blend_type = "DARKEN"
        cap.inputs["Factor"].default_value = 1.0
        t.links.new(env.outputs["Color"], cap.inputs["A"])
        scale = t.nodes.new("ShaderNodeMix")
        scale.data_type = "RGBA"
        scale.blend_type = "MULTIPLY"
        scale.inputs["Factor"].default_value = 1.0
        t.links.new(cap.outputs["Result"], scale.inputs["A"])
        on = t.nodes.new("ShaderNodeMath")
        on.operation = "MULTIPLY"
        on.inputs[0].default_value = 1.0
        on.inputs[1].default_value = 0.0
        mix = t.nodes.new("ShaderNodeMixRGB")
        t.links.new(on.outputs[0], mix.inputs["Fac"])
        t.links.new(physical, mix.inputs["Color1"])
        t.links.new(scale.outputs["Result"], mix.inputs["Color2"])
        t.links.new(mix.outputs["Color"], bg.inputs["Color"])
        self.bd = dict(turn=turn, env=env, cap=cap, scale=scale, on=on)

    def _probe_level(self):
        """
        The physical sky's median brightness over elevations 25 to 65 degrees at the current sun: a
        64 x 32 panorama of the world alone, rendered in its own scene with the photograph switched off.
        """
        import numpy as np
        sc = getattr(self, "probe_scene", None)
        if sc is None:
            sc = bpy.data.scenes.new("sky probe")
            sc.world = self.scene.world
            cam_data = bpy.data.cameras.new("probe")
            cam_data.type = "PANO"
            cam_data.panorama_type = "EQUIRECTANGULAR"
            cam = bpy.data.objects.new("probe", cam_data)
            sc.collection.objects.link(cam)
            cam.rotation_euler = (math.radians(90.0), 0.0, 0.0)
            sc.camera = cam
            sc.render.engine = "CYCLES"
            sc.cycles.device = self.scene.cycles.device
            sc.cycles.samples = 16
            sc.cycles.use_denoising = False
            sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 64, 32, 100
            sc.view_settings.view_transform = "Standard"
            sc.view_settings.exposure = 0.0
            sc.render.image_settings.file_format = "OPEN_EXR"
            sc.render.filepath = os.path.join(tempfile.gettempdir(), "seked-sky-probe.exr")
            self.probe_scene = sc
        was = self.bd["on"].inputs[1].default_value
        self.bd["on"].inputs[1].default_value = 0.0
        bpy.ops.render.render(write_still=True, scene=sc.name)
        self.bd["on"].inputs[1].default_value = was
        img = bpy.data.images.load(sc.render.filepath)
        px = np.empty(64 * 32 * 4, np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        lum = px.reshape(32, 64, 4)[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        return float(np.median(lum[int(32 * (0.5 + 25 / 180)):int(32 * (0.5 + 65 / 180))]))

    def _show_backdrop(self, altitude_deg, azimuth_deg, energy, log=print):
        if not getattr(self, "backdrops", None):
            return
        if altitude_deg < -2.0:
            self.bd["on"].inputs[1].default_value = 0.0
            return
        B = self.backdrops["high" if altitude_deg >= self.split else "low"]
        self.bd["env"].image = B["image"]
        # Turn the photograph about the vertical so its sun stands at the moment's azimuth.
        self.bd["turn"].inputs["Rotation"].default_value = (0.0, 0.0, math.radians(azimuth_deg - B["az"]))
        level = self._probe_level()
        k = level / max(B["level"], 1e-6)
        if B["sun"]:
            k = min(max(energy / B["sun"], k), SKY_GAIN_MAX * k)
        self.bd["scale"].inputs["B"].default_value = (k, k, k, 1.0)
        self.bd["cap"].inputs["B"].default_value = (B["cap"], B["cap"], B["cap"], 1.0)
        self.bd["on"].inputs[1].default_value = 1.0
        log(f"sky: {B['id']} behind, turned {azimuth_deg - B['az']:.0f} deg, scaled {k:.3g} "
            f"({k * B['level'] / level:.2g} times the physical sky's {level:.3g})")

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
        self._show_backdrop(altitude_deg, azimuth_deg, energy)
        return colour, energy

    def _graded(self, coll, haze, colours):
        """The air as one volume whose density falls off with height, a sum of GRADED's exponentials."""
        z0, z1, radius = GRADED_SPAN
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=256, radius1=0.5, radius2=0.5, depth=1.0)
        me = bpy.data.meshes.new("air")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new("air", me)
        coll.objects.link(ob)
        ob.scale = (2 * radius, 2 * radius, z1 - z0)
        ob.location = (0, 0, (z0 + z1) / 2)
        mat = bpy.data.materials.new("air")
        t = Tree(mat)
        out = t.node("ShaderNodeOutputMaterial")
        geo = t.node("ShaderNodeNewGeometry")
        sep = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Position"], sep.inputs[0])
        total = None
        for k, (dens, scale_height, col, capped) in enumerate(GRADED):
            d = dens * (min(haze, 1.5) if capped else haze)
            # density * exp(-z / H), from the cylinder's floor up
            e = t.math("EXPONENT", t.math("MULTIPLY", t.math("MAXIMUM", sep.outputs["Z"], -120.0), -1.0 / scale_height))
            pv = t.node("ShaderNodeVolumePrincipled")
            pv.inputs["Color"].default_value = hexlin(colours[min(k, len(colours) - 1)] if colours else col)
            pv.inputs["Anisotropy"].default_value = 0.6
            t.link(t.math("MULTIPLY", e, d), pv.inputs["Density"])
            if total is None:
                total = pv.outputs[0]
            else:
                add = t.node("ShaderNodeAddShader")
                t.link(total, add.inputs[0])
                t.link(pv.outputs[0], add.inputs[1])
                total = add.outputs[0]
        t.link(total, out.inputs["Volume"])
        me.materials.append(mat)
        ob.visible_shadow = False

    def _slab(self, coll, z0, z1, density, colour):
        # A cylinder 30 km in radius, not a box: a box's corners show from the air as a straight seam
        # where the haze along one side runs longer than along the other.
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=128, radius1=0.5, radius2=0.5, depth=1.0)
        me = bpy.data.meshes.new("air")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new("air", me)
        coll.objects.link(ob)
        # Stacked slabs would share a cap: two coincident surfaces, which confuse Cycles' volume stack,
        # and from the air a streaked, hard-edged patch showed where rays crossed them. A metre apart,
        # they never touch.
        z0, z1 = z0 + 0.5, z1 - 0.5
        ob.scale = (60000, 60000, z1 - z0)
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
