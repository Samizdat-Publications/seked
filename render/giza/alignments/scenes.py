"""
The Blender side of render/alignments.py: one era built once (render/giza/scene.py's Plateau), and
each of its alignment views rendered from it with the camera written beside the PNG, so the
overlay can project onto the picture exactly as the render did.

A view stands either under a sky of the bake (a night, a dawn, a shaft star's culmination: the
star dome of render/giza/night.py, centred on the camera) or under a day moment. Two views change
the scene and put it back afterwards: the X-ray, which makes Khufu's casing translucent and lights
his passages, chambers and shafts from within, and the portholes, which look out along a shaft.
"""
import io
import json
import math
import os

import bpy
from mathutils import Vector

from .. import cameras, data, night
from . import project

OUT = os.path.join(data.REPO, "build", "alignments", "render")

# The X-ray's look choices: how much of the casing is left to catch the light, and the glow of the
# rooms and passages (a warm lamp colour, an emission strength in the scene's night units).
XRAY_CASING = 0.14
XRAY_SHELL_GLOW = ((0.62, 0.74, 1.0, 1.0), 0.006)
XRAY_GLOW = ((1.0, 0.62, 0.26, 1.0), 0.010)
XRAY_SHAFT_GLOW = ((1.0, 0.78, 0.40, 1.0), 0.028)
# The ScanPyramids voids are an instrumented tier, and not what these pictures are about.
XRAY_SKIP = ("void.",)


def size_of(s):
    w, h = (int(n) for n in str(s).split("x"))
    return w, h


def aim(at, az_deg, pitch_deg, reach=1000.0):
    """A target `reach` metres from `at` along an azimuth and a pitch."""
    d = project.direction(az_deg, pitch_deg)
    return [at[0] + reach * d[0], at[1] + reach * d[1], at[2] + reach * d[2]]


def porthole_views(spec, bake):
    """
    One porthole per shaft and epoch, generated from the bake's C2 section: a camera out along the
    shaft's line, under the sky of the star that crossed it (or its claimed star's culmination).
    """
    p = spec["portholes"]
    values = project.resolved()
    out = {}
    for shaft in bake["alignments"]["c2"]["shafts"]:
        route = project.shaft_route(values, shaft["key"])
        d = project.direction(route["bearing"], route["angle"])
        start = route["points"][-1]
        at = [start[i] + p["out_m"] * d[i] for i in range(3)]
        for tag, a in shaft["at"].items():
            out[f"port-{a['sky']}"] = {
                "era": p["era"][tag], "kind": "porthole", "sky": a["sky"], "shaft": shaft["key"], "epoch_tag": tag,
                "size": p["size"], "final_size": p["final_size"], "samples": p["samples"], "exposure": p["exposure"],
                "camera": {"at": at, "az": route["bearing"], "pitch": route["angle"], "lens": p["lens"], "clip": 1.0},
            }
    return out


def load_bake():
    with io.open(night.BAKE, encoding="utf-8") as f:
        return json.load(f)


def render(spec, opts):
    from ..scene import Plateau
    era = opts["era"]
    want = opts["views"].split(",") if isinstance(opts.get("views"), str) else None
    all_views = dict(spec["views"])
    all_views.update(porthole_views(spec, load_bake()))
    todo = [(vid, v) for vid, v in all_views.items() if v["era"] == era and (want is None or vid in want)]
    if not todo:
        raise SystemExit(f"no alignment view is set in the {era} era" + (f" among {want}" if want else ""))
    plateau = Plateau(era, aerosol=float(opts.get("aerosol", 1.1)), haze=float(opts.get("haze", 1.0)))
    if opts.get("cpu"):
        # The GPU is shared with the walkthrough's renders; a check of the pipeline can stay off it.
        plateau.scene.cycles.device = "CPU"
    os.makedirs(OUT, exist_ok=True)
    failed = []
    for vid, v in todo:
        try:
            view(plateau, vid, v, opts)
        except Exception as e:           # one view's failure is reported, and the era's other views still render
            import traceback
            traceback.print_exc()
            failed.append(f"{vid}: {e!r}")
    if failed:
        raise SystemExit("views that failed: " + "; ".join(failed))


def view(plateau, vid, v, opts):
    """One view, the scene put back as it was afterwards however the render went."""
    undo = []
    try:
        _view(plateau, vid, v, opts, undo)
    finally:
        for u in reversed(undo):
            u()


def _view(plateau, vid, v, opts, undo):
    cam = v["camera"]
    kind = v.get("kind", "shot")
    if kind == "plan":
        cx, cy = cam["centre"]
        plateau.view({"id": vid, "x": cx, "y": cy, "z": cam["z"], "target": [cx, cy - 1.0, 0.0], "lens": 50.0}, "shot")
        c = plateau.camera
        c.data.type = "ORTHO"
        c.data.ortho_scale = cam["width"]
        c.location = (cx, cy, cam["z"])
        c.rotation_euler = (0.0, 0.0, 0.0)          # straight down, north up, east to the right
    else:
        at = cam["at"]
        target = aim(at, cam["az"], cam["pitch"])
        plateau.view({"id": vid, "x": at[0], "y": at[1], "z": at[2], "target": target, "lens": cam["lens"]}, "shot")
    c = plateau.camera
    c.data.shift_x, c.data.shift_y = cam.get("shift", (0.0, 0.0))
    c.data.clip_start = cam.get("clip", 0.1)
    if v.get("xray"):
        undo.extend(xray(plateau))
    if kind == "porthole":
        undo.extend(bare(plateau))
    if "sky" in v:
        plateau.moment({"night": v["sky"], "exposure": v.get("exposure", night.EXPOSURE)})
        if v.get("star_gain"):
            undo.extend(star_gain(v["star_gain"]))
    else:
        plateau.moment(v["moment"])
        if "exposure" in v:
            plateau.scene.view_settings.exposure = v["exposure"]
    # Drafts at 960 x 540 (a porthole at its `size`), finals with --final; --size and --samples set the main views,
    # --port-samples the portholes.
    final = bool(opts.get("final"))
    if kind == "porthole":
        w, h = size_of(v["final_size"] if final else v["size"])
        samples = int(opts.get("port-samples", v.get("samples", 16)))
    else:
        w, h = size_of(opts.get("size") or ("1920x1080" if final else "960x540"))
        samples = int(opts.get("samples", 96 if final else 24))
    out = os.path.join(OUT, f"{vid}.png")
    bpy.context.view_layer.update()
    if opts.get("bracket") and kind != "porthole":
        # Look development: the same frame at several exposures, into build/alignments/render/bracket/.
        base = plateau.scene.view_settings.exposure
        for step in str(opts["bracket"]).split(","):
            plateau.scene.view_settings.exposure = base + float(step)
            trial = os.path.join(OUT, "bracket", f"{vid}{float(step):+.1f}.png")
            plateau.render(trial, w, h, samples, view_id=vid, kind=kind, moment=v.get("sky") or v.get("moment"))
        plateau.scene.view_settings.exposure = base
    plateau.render(out, w, h, samples, view_id=vid, kind=kind, moment=v.get("sky") or v.get("moment"))
    side_path = os.path.splitext(out)[0] + ".json"
    with io.open(side_path, encoding="utf-8") as f:
        side = json.load(f)
    side["projection"] = {
        "type": c.data.type, "location": list(c.location), "matrix": [list(r) for r in c.matrix_world.to_3x3().normalized()],
        "lens": c.data.lens, "sensor_width": c.data.sensor_width, "shift_x": c.data.shift_x, "shift_y": c.data.shift_y,
        "ortho_scale": c.data.ortho_scale, "size": [w, h],
    }
    side["sky"] = v.get("sky")
    side["era"] = plateau.state
    if v.get("claim") == "C5":
        head = sphinx_head()
        if head is not None:
            side["sphinx_head"] = head
    with io.open(side_path, "w", encoding="utf-8") as f:
        json.dump(side, f, indent=1)


def sphinx_head():
    """
    The top of the Sphinx stand-in's head, as the era's model was fitted (render/giza/sphinx.py): the
    highest vertex over the OSM outline of the head, so the overlay's line of gaze starts on the model.
    """
    import numpy as np
    ob = next((o for o in bpy.data.objects if str(o.get("seked", "")).startswith("stand-in") and "phinx" in o.name), None)
    part = next((f for f in data.FOOTPRINTS if f["id"] == "sphinx.head"), None)
    if ob is None or part is None:
        return None
    me = ob.data
    co = np.empty(len(me.vertices) * 3, np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    m = np.array(ob.matrix_world)
    world = co @ m[:3, :3].T + m[:3, 3]
    ring = np.array(part["ring"])
    (x0, y0), (x1, y1) = ring.min(0), ring.max(0)
    over = world[(world[:, 0] >= x0) & (world[:, 0] <= x1) & (world[:, 1] >= y0) & (world[:, 1] <= y1)]
    if not len(over):
        return None
    top = over[np.argmax(over[:, 2])]
    return [round(float(top[0]), 2), round(float(top[1]), 2), round(float(top[2]), 2)]



def _emission(name, colour, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    t = mat.node_tree
    t.nodes.clear()
    out = t.nodes.new("ShaderNodeOutputMaterial")
    em = t.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = colour
    em.inputs["Strength"].default_value = strength
    t.links.new(em.outputs[0], out.inputs["Surface"])
    return mat


def _see_through(base, alpha):
    """The casing's own material, left at `alpha` and transparent for the rest: the X-ray's shell."""
    mat = base.copy()
    mat.name = base.name + " x-ray"
    t = mat.node_tree
    out = next(n for n in t.nodes if n.type == "OUTPUT_MATERIAL")
    surface = out.inputs["Surface"].links[0].from_socket
    # A faint cool glow of its own, so the shell reads against a night sky and dark ground alike.
    glow = t.nodes.new("ShaderNodeEmission")
    glow.inputs["Color"].default_value, glow.inputs["Strength"].default_value = XRAY_SHELL_GLOW
    add = t.nodes.new("ShaderNodeAddShader")
    t.links.new(surface, add.inputs[0])
    t.links.new(glow.outputs[0], add.inputs[1])
    clear = t.nodes.new("ShaderNodeBsdfTransparent")
    mix = t.nodes.new("ShaderNodeMixShader")
    mix.inputs["Fac"].default_value = alpha
    t.links.new(clear.outputs[0], mix.inputs[1])
    t.links.new(add.outputs[0], mix.inputs[2])
    t.links.new(mix.outputs[0], out.inputs["Surface"])
    return mat


def xray(plateau):
    """Khufu's casing made translucent and his interior lit from within; returns the undo steps."""
    undo = []
    shell = bpy.data.objects.get("Khufu dressed")
    if shell is not None:
        old = [s.material for s in shell.material_slots]
        for s in shell.material_slots:
            s.material = _see_through(s.material, XRAY_CASING)
        shell.visible_shadow = False

        def restore(shell=shell, old=old):
            for s, m in zip(shell.material_slots, old):
                s.material = m
            shell.visible_shadow = True
        undo.append(restore)
    else:
        plateau.log("WARNING: no 'Khufu dressed' in this era; the X-ray has no shell to see through")
    glow = _emission("x-ray glow", *XRAY_GLOW)
    shaft_glow = _emission("x-ray shaft glow", *XRAY_SHAFT_GLOW)
    coll = bpy.data.collections.new("x-ray interior")
    plateau.scene.collection.children.link(coll)
    sd = project.seked_data()
    n = 0
    for solid in sd.interior_solids(project.resolved(), "g1"):
        if solid["name"].startswith(XRAY_SKIP):
            continue
        me = bpy.data.meshes.new(solid["name"])
        me.from_pydata(solid["verts"], [], solid["faces"])
        me.materials.append(shaft_glow if ".shaft." in solid["name"] else glow)
        ob = bpy.data.objects.new(solid["name"], me)
        # Seen by the camera only: a glow drawn inside the stone, not a lamp lighting it.
        for ray in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter", "visible_shadow"):
            setattr(ob, ray, False)
        coll.objects.link(ob)
        n += 1
    plateau.log(f"x-ray: Khufu's casing at {XRAY_CASING:.2f}, {n} interior solids lit from blender/seked_data.py")

    def remove(coll=coll):
        for ob in list(coll.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(coll)
    undo.append(remove)
    return undo


def star_gain(gain):
    """
    Every star's radiance times `gain`, for a sky in twilight: the dome is tuned for a dark night
    (blender/render_sky.py), and against a dawn sky its stars would vanish where the eye still sees
    them. A look choice, said in the view that asks for it; returns the undo step.
    """
    mat = bpy.data.materials.get("Starlight")
    if mat is None:
        return []
    t = mat.node_tree
    em = next(n for n in t.nodes if n.type == "EMISSION")
    link = em.inputs["Strength"].links[0]
    src = link.from_socket
    mul = t.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = gain
    t.links.new(src, mul.inputs[0])
    t.links.new(mul.outputs[0], em.inputs["Strength"])

    def restore(t=t, src=src, em=em, mul=mul):
        t.links.new(src, em.inputs["Strength"])
        t.nodes.remove(mul)
    return [restore]


def bare(plateau):
    """Everything but the sky hidden, for a porthole looking out along a shaft; returns the undo step."""
    hidden = []
    for ob in plateau.scene.objects:
        if ob.type in ("MESH", "CURVES", "POINTCLOUD", "EMPTY", "VOLUME") and not ob.hide_render and ob is not getattr(plateau.night, "dome", None):
            if "air" in ob.name:
                continue
            ob.hide_render = True
            hidden.append(ob)

    def show(hidden=hidden):
        for ob in hidden:
            ob.hide_render = False
    return [show]
