"""
Render the sky-rollback cinematic, headless:

    pnpm sky-rollback
    blender -b build/seked.blend -P blender/rollback.py -- --out build/rollback [--mp4 build/rollback.mp4] [--frames 0-479] [--width 1280 --height 720 --samples 64]

The plan's cinematic: the sky rolled back from the catalogue's own epoch,
past Bauval and Gilbert's 2450 BCE to Hancock and Bauval's 10,500 BCE, with
Alnitak held on the meridian and the King's Chamber's south shaft drawn out
of the Great Pyramid at its measured angle, so claim C2 can be watched: the
star slides down the meridian and, at the epoch the claim names, stands in
the shaft's line of sight.

Not one star position is computed here, and none is typed here. Every frame
comes from `build/sky-rollback.json` and the binary beside it, which
`pnpm sky-rollback` writes out of `@seked/sky`; this script puts each frame's
azimuths and altitudes on a dome, moves the label and presses the shutter.
There is no sun in the film. The frames are the sidereal sky at the sidereal
time Alnitak transits, which at any one epoch is a different night of the
year, so the sky texture is given a sun deep below the horizon, which is
what a moonless night is to it, and the stars are the light.

Frames are rendered one at a time to PNGs in `--out`, so a run can be
stopped and resumed (a frame already on disk is skipped), and `--mp4` encodes
the whole run with Blender's own sequencer at the end.
"""
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402  (only available inside Blender)

from render import NIGHT_FILL, NIGHT_EXPOSURE, configure_render, look_at, make_camera, parse_args, show_ground_only  # noqa: E402
from render_materials import assign_materials, node_tree_of  # noqa: E402
from render_sky import REPO_ROOT, build_world, load_rollback, make_star_cloud, place_stars, dome_point  # noqa: E402
from seked_data import load_database, resolve  # noqa: E402

SKY_ROLLBACK = os.path.join(REPO_ROOT, "build", "sky-rollback.json")

# The King's Chamber solid, by the name seked_data.interior_solids gives it.
KINGS_CHAMBER = "kc"

# Where the sky texture's sun is put for a film that has none: far enough
# below the horizon that no twilight reaches the frame. Not a position of the
# sun on any date, and it does not pretend to be one; see the module note.
NO_SUN_ALTITUDE_DEG = -40.0

# The dome the stars sit on, in metres from the camera. Forty times the still
# views', because the film also draws a line from inside the pyramid to the
# sky, and a line from a point seven hundred metres off the camera meets a
# sphere this wide within a fifth of a degree of where the camera sees that
# direction. The star radii and radiance scale with it, so nothing looks
# different.
ROLLBACK_DOME_RADIUS_M = 200000.0

# The camera: north of the Great Pyramid on the meridian, looking south and
# up at a wide lens, so the meridian from the horizon to sixty degrees is in
# frame. Far enough back that the apex stands below nine degrees, which is
# where Alnitak transits at the film's last epoch, so the star is never hidden
# by the pyramid. A slow drift forward over the film, which is composition.
CAMERA_FROM = (0.0, 760.0, 40.0)
CAMERA_TO = (0.0, 700.0, 44.0)
CAMERA_PITCH_DEG = 30.0
CAMERA_LENS_MM = 16.0

# How the shaft's line and the two marks on the dome are drawn: a tapered
# prism a metre wide at the chamber and this wide at the dome; a ring of this
# angular radius around the point on the meridian the shaft aims at, in the
# viewer's first ray colour; and a smaller ring that follows Alnitak, so the
# eye can watch the one slide into the other.
RAY_WIDTH_AT_DOME_M = 360.0
RING_RADIUS_DEG = 1.6
RING_WIDTH_DEG = 0.18
STAR_RING_RADIUS_DEG = 0.75
STAR_RING_WIDTH_DEG = 0.12
STAR_RING_COLOUR = (0.55, 0.75, 1.0)
RAY_COLOUR = (1.0, 0.62, 0.18)
# Emission under the night exposure of six and a half stops, which is a factor
# of ninety: this much reads as the colour above rather than clipping white.
RAY_STRENGTH = 0.01
LABEL_STRENGTH = 0.02

# The label in the top left corner of the frame: its place in the camera's
# own frame, a metre and a bit in front of the lens, and its size there. The
# top, because the film ends with Alnitak low in the south and the bottom of
# the frame is where it and the pyramid are.
LABEL_OFFSET = (-1.30, 0.64, -1.25)
LABEL_SIZE = 0.052


def frame_range(spec, total):
    """"all", "a-b" inclusive, or a comma list of either, so a proof can be three frames from across the film."""
    if spec in ("", "all"):
        return list(range(total))
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-", 1)
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def emissive_material(name, colour, strength):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    tree = node_tree_of(mat)
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    emission = tree.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*colour, 1.0)
    emission.inputs["Strength"].default_value = strength
    tree.links.new(emission.outputs[0], out.inputs["Surface"])
    return mat


def camera_only(obj):
    """
    Seen by the camera and by nothing else. A drawn line or a label is an
    annotation, not a lamp: an emissive prism two hundred kilometres long
    would otherwise light the plateau like a second sun.
    """
    obj.visible_shadow = False
    obj.visible_diffuse = False
    obj.visible_glossy = False
    obj.visible_transmission = False
    obj.visible_volume_scatter = False
    return obj


def mesh_object(scene, name, verts, faces, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return camera_only(obj)


def kings_chamber_centre():
    """The King's Chamber's centre in the scene frame, off the solid generate.py built for it."""
    from mathutils import Vector

    obj = bpy.data.objects.get(KINGS_CHAMBER)
    if obj is None:
        raise SystemExit(f"no {KINGS_CHAMBER!r} object in the scene; generate the .blend first")
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(corners, Vector()) / len(corners)


def build_shaft_ray(scene, chamber, angle_deg, camera_location, material):
    """
    The King's Chamber's south shaft as a line of sight: from the chamber's
    centre, south and up at the measured angle in the meridian plane, out to
    the dome. A tapered prism so it stays a visible width at two hundred
    kilometres.
    The shafts are not in the database as geometry, only as angles, so a ray
    is drawn rather than a bore, as the viewer's overlay does.
    """
    from mathutils import Vector

    direction = Vector((0.0, -math.cos(math.radians(angle_deg)), math.sin(math.radians(angle_deg))))
    # Where the ray meets the dome centred on the camera: |chamber + t d - camera| = R.
    offset = chamber - camera_location
    b = offset.dot(direction)
    c = offset.dot(offset) - ROLLBACK_DOME_RADIUS_M ** 2
    length = -b + math.sqrt(b * b - c)
    end = chamber + direction * length

    # A square section whose two axes are east and the in-plane normal.
    east = Vector((1.0, 0.0, 0.0))
    normal = direction.cross(east)
    verts = []
    for point, half in ((chamber, 0.5), (end, RAY_WIDTH_AT_DOME_M / 2.0)):
        for sx, sn in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(tuple(point + east * (sx * half) + normal * (sn * half)))
    faces = [(0, 1, 2, 3), (4, 7, 6, 5)] + [(i, (i + 1) % 4, (i + 1) % 4 + 4, i + 4) for i in range(4)]
    obj = mesh_object(scene, "C2 south shaft ray", verts, faces, material)
    obj["seked_note"] = f"kc.shaft.south at {angle_deg} deg, from the King's Chamber's centre to the star dome; a line of sight, not the bore"
    print(f"  shaft ray: {angle_deg} deg from ({chamber.x:.1f}, {chamber.y:.1f}, {chamber.z:.1f}) m, {length / 1000:.1f} km to the dome")
    return obj


def build_ring(scene, name, material, radius_deg, width_deg):
    """
    A ring on the dome around the point due south on the horizon, of a stated
    angular radius. Built about the origin; each frame it is placed on the
    camera and turned about east to the altitude it marks, by `aim_ring`.
    """
    from mathutils import Vector

    centre = Vector(dome_point(180.0, 0.0, ROLLBACK_DOME_RADIUS_M))
    u = Vector((1.0, 0.0, 0.0))
    v = Vector((0.0, 0.0, 1.0))
    outer = ROLLBACK_DOME_RADIUS_M * math.tan(math.radians(radius_deg))
    inner = ROLLBACK_DOME_RADIUS_M * math.tan(math.radians(radius_deg - width_deg))
    segments = 96
    verts, faces = [], []
    for i in range(segments):
        a = 2.0 * math.pi * i / segments
        radial = u * math.cos(a) + v * math.sin(a)
        verts.append(tuple(centre + radial * inner))
        verts.append(tuple(centre + radial * outer))
    for i in range(segments):
        j = (i + 1) % segments
        faces.append((2 * i, 2 * i + 1, 2 * j + 1, 2 * j))
    return mesh_object(scene, name, verts, faces, material)


def aim_ring(ring, at, altitude_deg):
    """Put a ring's centre due south of `at` at that altitude: a turn about east lifts a point on the southern horizon."""
    ring.location = at
    ring.rotation_euler = (-math.radians(altitude_deg), 0.0, 0.0)


def build_label(scene, camera):
    """A text object parented to the camera, so it sits in the corner of every frame."""
    curve = bpy.data.curves.new("Epoch label", "FONT")
    curve.size = LABEL_SIZE
    curve.align_x = "LEFT"
    curve.materials.append(emissive_material("Label", (0.92, 0.92, 0.88), LABEL_STRENGTH))
    label = bpy.data.objects.new("Epoch label", curve)
    scene.collection.objects.link(label)
    camera_only(label)
    label.parent = camera
    label.location = LABEL_OFFSET
    label.rotation_euler = (0.0, 0.0, 0.0)
    return label


def epoch_text(epoch):
    """Astronomical year numbering to the calendar's: year 0 is 1 BCE, -2449 is 2450 BCE."""
    year = int(round(epoch))
    return f"{year} CE" if year > 0 else f"{1 - year} BCE"


def encode(frames_dir, names, mp4, fps, width, height):
    """The frames as one H.264 file, through Blender's own sequencer, so no other tool is needed."""
    scene = bpy.data.scenes.new("Encode")
    scene.render.fps = fps
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.frame_start, scene.frame_end = 1, len(names)
    # Blender 5 chooses between image and video output before it offers the
    # video formats; asked for FFMPEG without that it lists the still formats
    # and refuses. An older Blender has no media type and takes the format.
    settings = scene.render.image_settings
    if hasattr(settings, "media_type"):
        settings.media_type = "VIDEO"
    settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "HIGH"
    scene.render.ffmpeg.gopsize = fps
    scene.render.filepath = mp4
    editor = scene.sequence_editor_create()
    # Blender 4.4 renamed the collection; an empty one is false, so ask by name.
    strips = editor.strips if hasattr(editor, "strips") else editor.sequences
    strip = strips.new_image("frames", filepath=os.path.join(frames_dir, names[0]), channel=1, frame_start=1)
    for name in names[1:]:
        strip.elements.append(name)
    with bpy.context.temp_override(scene=scene):
        bpy.ops.render.render(animation=True, scene=scene.name)
    print(f"encoded {len(names)} frames at {fps} fps into {mp4}")


def hide_voids():
    """
    Take the muon voids out of the film. It is a night view of the pyramids as
    silhouettes, and the only interior solid that can show at all is the North
    Face Corridor, whose top edge is four centimetres inside the as-built face
    and whose faint glow came through it as a bright point at the Pyramid's
    foot on the first hero test frame. Nothing in the film is about the voids.
    """
    hidden = 0
    for obj in bpy.data.objects:
        if obj.name.startswith("void."):
            obj.hide_render = True
            hidden += 1
    print(f"rollback: {hidden} void solids taken out of the film")


def main():
    from mathutils import Vector

    opts = parse_args({"out": "build/rollback", "mp4": "", "frames": "all", "width": "1280", "height": "720",
                       "samples": "64", "engine": "", "bake": SKY_ROLLBACK, "device": "auto"})
    scene = bpy.context.scene
    header, positions = load_rollback(opts["bake"])
    frames = header["frames"]
    count = header["catalogue"]["count"]
    wanted = [f for f in frame_range(opts["frames"], len(frames)) if 0 <= f < len(frames)]
    if not wanted:
        raise SystemExit(f"no frames in {opts['frames']!r} out of {len(frames)}")

    # The shaft angle is in the header for the label; the database is asked
    # for it too, so a stale bake cannot quietly draw an angle the records no
    # longer hold.
    preset = header["preset"]
    values = resolve(load_database(), preset)["values"]
    shaft_key = header["shaft"]["key"]
    angle_deg = values.get(f"{shaft_key}.angle")
    if angle_deg is None or abs(angle_deg - header["shaft"]["angleDeg"]) > 1e-9:
        raise SystemExit(f"the bake says {shaft_key}.angle is {header['shaft']['angleDeg']} but preset {preset} resolves {angle_deg}; run pnpm sky-rollback")

    assign_materials()
    show_ground_only()
    hide_voids()
    start, end = Vector(CAMERA_FROM), Vector(CAMERA_TO)
    target_of = lambda at: at + Vector((0.0, -math.cos(math.radians(CAMERA_PITCH_DEG)), math.sin(math.radians(CAMERA_PITCH_DEG)))) * 1000.0
    camera = make_camera(scene, start, target_of(start), CAMERA_LENS_MM, clip_end=4.0 * ROLLBACK_DOME_RADIUS_M)
    build_world(scene, NO_SUN_ALTITUDE_DEG, 0.0, NIGHT_FILL)
    scene.view_settings.exposure = NIGHT_EXPOSURE

    dome, radii = make_star_cloud(
        "Sky (rollback)", header["catalogue"]["mag"], header["catalogue"]["ci"], ROLLBACK_DOME_RADIUS_M,
        {
            "seked_sky_meridian": f"{header['meridian']['name']} ({header['meridian']['from']})",
            "seked_sources": header["catalogue"]["source"],
            "seked_attribution": header["catalogue"]["attribution"],
        },
    )
    scene.collection.objects.link(dome)
    # The dome and the ring ride with the camera, frame by frame, but do not
    # turn with it: a star is at an altitude and an azimuth, not in front of
    # the lens.
    dome.location = start

    chamber = kings_chamber_centre()
    ray_material = emissive_material("Shaft ray", RAY_COLOUR, RAY_STRENGTH)
    build_shaft_ray(scene, chamber, angle_deg, start, ray_material)
    aim = build_ring(scene, "C2 shaft aim", ray_material, RING_RADIUS_DEG, RING_WIDTH_DEG)
    star_ring = build_ring(scene, f"{header['meridian']['name']} mark", emissive_material("Star mark", STAR_RING_COLOUR, RAY_STRENGTH),
                           STAR_RING_RADIUS_DEG, STAR_RING_WIDTH_DEG)
    label = build_label(scene, camera)

    engine, samples = configure_render(scene, opts)
    # Keep the scene between frames. Every frame is rendered in this one
    # process and only the camera, the star cloud, the two rings and the
    # caption move, but without this Cycles rebuilds everything for each of
    # them, and with the plateau's six hundred masses and the terrain in the
    # scene that rebuild was a minute a frame whatever the sample count.
    scene.render.use_persistent_data = True
    out_dir = os.path.abspath(opts["out"])
    os.makedirs(out_dir, exist_ok=True)
    print(f"rollback: {len(wanted)} of {len(frames)} frames, {header['meridian']['name']} on the meridian, "
          f"{shaft_key} at {angle_deg} deg, {engine} at {samples} samples, {opts['width']} x {opts['height']}")

    total_started = time.time()
    for f in wanted:
        name = f"frame_{f:04d}.png"
        path = os.path.join(out_dir, name)
        info = frames[f]
        t = f / max(len(frames) - 1, 1)
        at = start.lerp(end, t)
        camera.location = at
        look_at(camera, target_of(at))
        dome.location = at
        aim_ring(aim, at, angle_deg)
        aim_ring(star_ring, at, info["meridianAltDeg"])
        base = f * count * 2
        up = place_stars(dome, radii, positions[base:base + 2 * count:2], positions[base + 1:base + 2 * count:2], ROLLBACK_DOME_RADIUS_M)
        label.data.body = (f"{epoch_text(info['epoch'])}\n{header['meridian']['name']} crosses the meridian at "
                           f"{info['meridianAltDeg']:.1f}°; the King's Chamber's south shaft points at {angle_deg:.1f}°")
        if os.path.exists(path):
            print(f"  frame {f:4d}: {name} exists, skipped")
            continue
        scene.render.filepath = path
        started = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"  frame {f:4d}: epoch {info['epoch']:>9}, {header['meridian']['name']} at {info['meridianAltDeg']:.3f} deg, "
              f"{up} stars up, {time.time() - started:.1f} s")
    print(f"rendered {len(wanted)} frames to {out_dir} in {(time.time() - total_started) / 60:.1f} min")

    if opts["mp4"]:
        names = [f"frame_{f:04d}.png" for f in range(len(frames)) if os.path.exists(os.path.join(out_dir, f"frame_{f:04d}.png"))]
        encode(out_dir, names, os.path.abspath(opts["mp4"]), int(header["fps"]), int(opts["width"]), int(opts["height"]))


if __name__ == "__main__":
    main()
