"""
Cycles on the GPU. OptiX first, then CUDA; the CPU only when there is no GPU.

Adaptive subdivision (the displaced ground patch) is capped: at most 2^7 subdivisions
per edge of a 1 m quad and coarse dicing off screen. Uncapped, a 1080p frame ran the
laptop's 12 GB out of memory building the acceleration structure.
"""
import os

import bpy


def gpu(scene, log=print):
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except KeyError:
        return "CPU"
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.refresh_devices()
        gpus = [d for d in prefs.devices if d.type == backend]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == backend
            scene.cycles.device = "GPU"
            log("device", backend, ", ".join(d.name for d in gpus))
            return backend
    scene.cycles.device = "CPU"
    return "CPU"


def configure(scene, exposure=-3.8):
    c = scene.cycles
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.015
    c.use_denoising = True
    try:
        c.denoiser = "OPENIMAGEDENOISE"
        c.denoising_use_gpu = True
    except Exception:
        pass
    c.max_bounces = 6
    c.diffuse_bounces = 3
    c.glossy_bounces = 2
    c.volume_bounces = 1
    c.transmission_bounces = 2
    c.transparent_max_bounces = 4
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.blur_glossy = 1.0
    for k, v in (("max_subdivisions", 7), ("offscreen_dicing_scale", 8.0), ("dicing_rate", 1.0)):
        try:
            setattr(c, k, v)
        except Exception:
            pass
    scene.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            pass
    scene.view_settings.exposure = exposure
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_percentage = 100


def post(scene, grade):
    """
    The camera's own response after the render (look choices, per era, from states.py `grade`):
    a bloom round what is brighter than white, so a sunlit gold cap flares as it would in a lens,
    then the era's tint and saturation, cool and wet for the claim's green eras, warm and dry as
    built. Blender 5.1's compositor: a CompositorNodeTree set as the scene's compositing group.
    """
    g = bpy.data.node_groups.new("grade", "CompositorNodeTree")
    g.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = g.nodes.new("CompositorNodeRLayers")
    img = rl.outputs["Image"]
    if grade.get("bloom"):
        gl = g.nodes.new("CompositorNodeGlare")
        gl.inputs["Type"].default_value = "Bloom"
        # the render's radiance before the view's exposure (-3.8 stops outdoors): only what shows
        # brighter than white, a glint or the sun, blooms
        gl.inputs["Threshold"].default_value = 20.0
        gl.inputs["Strength"].default_value = grade["bloom"]
        g.links.new(img, gl.inputs["Image"])
        img = gl.outputs["Image"]
    if grade.get("tint"):
        mix = g.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs[7].default_value = tuple(grade["tint"]) + (1.0,)
        g.links.new(img, mix.inputs[6])
        img = mix.outputs[2]
    if grade.get("saturation", 1.0) != 1.0:
        hs = g.nodes.new("CompositorNodeHueSat")
        hs.inputs["Saturation"].default_value = grade["saturation"]
        g.links.new(img, hs.inputs["Image"])
        img = hs.outputs["Image"]
    out = g.nodes.new("NodeGroupOutput")
    g.links.new(img, out.inputs[0])
    scene.compositing_node_group = g
    scene.render.use_compositing = True


def render(scene, out, width, height, samples):
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.cycles.samples = samples
    os.makedirs(os.path.dirname(out), exist_ok=True)
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
