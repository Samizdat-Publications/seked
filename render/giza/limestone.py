"""
The Sphinx's rock as a material: limestone coloured bed by bed from the "strata" colour attribute that
scripts/sphinx_lab/rock.py cuts into the statue (R: hard 1 to soft 0; G: how deep the point is worn, of the
deepest; B: the member, I 0, II 0.5, III 1), so the colour and the relief are the same beds.

It replaces the old way, the enclosure's quarry-wall photograph and a band noise multiplied into the generated
texture (sphinx._in_bedrock): that photograph's tool marks run diagonally, and the modeller critic read them,
wrapped round the statue, as wood grain. Here the surface is three photographed rock scans (CC0, Poly Haven,
blender/textures.json), box-projected at their own size: an eroded sedimentary cliff for the soft beds, a
cracked rock face for the hard beds and the head, a pale worn rock for Member I at the foot. Over them, in
the beds' own terms: the coves darker, dust on what faces the sky, rain stains run down from the lips, and
darkening in the hollows. Every colour, blend and scale is a look choice; nothing of it is a measurement.
"""
import bpy

from .materials import TEX, image

# Linear RGB multipliers (look choices) that take each scan towards the plateau's limestone.
SOFT_TINT = (1.0, 0.9, 0.8, 1.0)
HARD_TINT = (1.55, 1.42, 1.22, 1.0)
FOOT_TINT = (0.95, 0.92, 0.86, 1.0)
HEAD_TINT = (1.08, 1.02, 0.94, 1.0)
# The scans laid at this many times their own size, so the grain reads at a colossus's scale; the soft beds'
# cliff at its own, so its laminae stay thin beside the beds the geometry cuts.
SCALE = {"sphinx-ledge": 2.2, "core": 2.2, "sphinx-cove": 1.0}
DUST = (0.62, 0.50, 0.35, 1.0)
STAIN = (0.22, 0.20, 0.17, 1.0)
FRESH = (1.12, 1.1, 1.06, 1.0)
FRESH_BLEND = 0.75      # newly dressed stone, paler than weathered (a look choice)


def has_strata(mesh):
    return any(a.name in ("strata", "Color", "Col") for a in mesh.color_attributes)


def material(mesh, name="sphinx limestone", fresh=False):
    """`fresh`: the First Time's newly dressed stone, paler and cleaner, with no rain stains and little dust."""
    layer = next(a.name for a in mesh.color_attributes if a.name in ("strata", "Color", "Col"))
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    N, L = nt.nodes, nt.links
    N.clear()
    out = N.new("ShaderNodeOutputMaterial")
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    L.new(bsdf.outputs[0], out.inputs["Surface"])

    def feed(sock, v):
        if isinstance(v, (int, float, tuple)):
            sock.default_value = v
        else:
            L.new(v, sock)

    def math(op, a, b=None):
        n = N.new("ShaderNodeMath")
        n.operation = op
        feed(n.inputs[0], a)
        if b is not None:
            feed(n.inputs[1], b)
        return n.outputs[0]

    def mix(fac, a, b, blend="MIX"):
        n = N.new("ShaderNodeMix")
        n.data_type, n.blend_type = "RGBA", blend
        feed(n.inputs[0], fac)
        feed(n.inputs[6], a)
        feed(n.inputs[7], b)
        return n.outputs[2]

    def ramp(v, a, b):
        n = N.new("ShaderNodeMapRange")
        n.inputs["From Min"].default_value, n.inputs["From Max"].default_value = a, b
        L.new(v, n.inputs["Value"])
        return n.outputs[0]

    co = N.new("ShaderNodeTexCoord").outputs["Object"]

    def scan(role):
        """A scan's colour, height and roughness, box-projected at its own tile size."""
        mp = N.new("ShaderNodeMapping")
        s = TEX[role]["tile_m"][0] * SCALE.get(role, 1.0)
        mp.inputs["Scale"].default_value = (1 / s, 1 / s, 1 / s)
        L.new(co, mp.inputs["Vector"])
        maps = []
        for kind, nc in (("Diffuse", False), ("Displacement", True), ("Rough", True)):
            im = N.new("ShaderNodeTexImage")
            im.image, im.projection, im.projection_blend = image(role, kind, nc), "BOX", 0.25
            L.new(mp.outputs[0], im.inputs["Vector"])
            maps.append(im.outputs["Color"])
        return maps

    attr = N.new("ShaderNodeVertexColor")
    attr.layer_name = layer
    sep = N.new("ShaderNodeSeparateColor")
    L.new(attr.outputs["Color"], sep.inputs[0])
    hard, depth, member = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    geo = N.new("ShaderNodeNewGeometry")
    nz = N.new("ShaderNodeSeparateXYZ")
    L.new(geo.outputs["Normal"], nz.inputs[0])

    soft_c, soft_h, soft_r = scan("sphinx-cove")
    hard_c, hard_h, hard_r = scan("sphinx-ledge")
    foot_c, foot_h, foot_r = scan("core")
    # which scan: hard against soft by the bed, broken by a noise so the change is not a ruled line
    brk = N.new("ShaderNodeTexNoise")
    L.new(co, brk.inputs["Vector"])
    brk.inputs["Scale"].default_value = 0.9
    brk.inputs["Detail"].default_value = 4.0
    w_hard = ramp(math("ADD", hard, math("MULTIPLY", math("SUBTRACT", brk.outputs["Fac"], 0.5), 0.35)), 0.45, 0.6)
    # Member I's own grey only once weathered: on the day it was cut the foot is the same dressed stone as the body
    w_foot = math("MULTIPLY", ramp(member, 0.2, 0.05), 0.0 if fresh else 1.0)
    hard_col = mix(1.0, hard_c, HARD_TINT, "MULTIPLY")
    soft_col = mix(1.0, soft_c, SOFT_TINT, "MULTIPLY")
    if fresh:
        # newly dressed, the beds differ by a shade, not a stripe: the soft beds' colour most of the way to the hard
        soft_col = mix(FRESH_BLEND, soft_col, mix(1.0, hard_col, (0.93, 0.9, 0.86, 1.0), "MULTIPLY"))
    col = mix(w_hard, soft_col, hard_col)
    col = mix(w_foot, col, mix(1.0, foot_c, FOOT_TINT, "MULTIPLY"))
    # the head's hard bed: the smooth pale scan, not the cracked one
    w_head = ramp(member, 0.8, 0.95)
    col = mix(w_head, col, mix(1.0, foot_c, HEAD_TINT, "MULTIPLY"))
    # the scans' orange taken down towards the plateau's buff (a look choice)
    hsv = N.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.72
    hsv.inputs["Hue"].default_value = 0.505
    L.new(col, hsv.inputs["Color"])
    col = hsv.outputs["Color"]
    hgt = N.new("ShaderNodeMix")
    hgt.data_type = "FLOAT"
    L.new(w_hard, hgt.inputs[0])
    L.new(soft_h, hgt.inputs[2])
    L.new(hard_h, hgt.inputs[3])
    rough = math("ADD", math("MULTIPLY", math("ADD", soft_r, hard_r), 0.1), 0.78)
    # large mottling, metres across
    mott = N.new("ShaderNodeTexNoise")
    L.new(co, mott.inputs["Vector"])
    mott.inputs["Scale"].default_value = 0.12
    mott.inputs["Detail"].default_value = 3.0
    col = mix(math("MULTIPLY", ramp(mott.outputs["Fac"], 0.35, 0.65), 0.3), col, (0.62, 0.55, 0.46, 1.0))
    # the coves darker and browner, the deeper the more
    col = mix(math("MULTIPLY", depth, 0.4), col, (0.42, 0.32, 0.22, 1.0), "MULTIPLY")
    # rain stains run down from the lips on steep faces: a noise drawn out in height
    stretch = N.new("ShaderNodeMapping")
    stretch.inputs["Scale"].default_value = (1.6, 1.6, 0.12)
    L.new(co, stretch.inputs["Vector"])
    rn = N.new("ShaderNodeTexNoise")
    L.new(stretch.outputs[0], rn.inputs["Vector"])
    rn.inputs["Scale"].default_value = 2.2
    rn.inputs["Detail"].default_value = 4.0
    steep = ramp(nz.outputs["Z"], 0.6, 0.1)
    if not fresh:
        col = mix(math("MULTIPLY", math("MULTIPLY", ramp(rn.outputs["Fac"], 0.55, 0.72), steep), 0.3), col, STAIN)
    else:
        col = mix(1.0, col, FRESH, "MULTIPLY")
    # dust on what faces the sky
    col = mix(math("MULTIPLY", ramp(nz.outputs["Z"], 0.5, 0.88), 0.2 if fresh else 0.5), col, DUST)
    ao = N.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 1.2
    col = mix(math("MULTIPLY", ramp(ao.outputs["AO"], 0.9, 0.3), 0.45), col, (0.35, 0.3, 0.25, 1.0), "MULTIPLY")
    L.new(col, bsdf.inputs["Base Color"])
    L.new(rough, bsdf.inputs["Roughness"])
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.7
    bump.inputs["Distance"].default_value = 0.08
    flat = math("MULTIPLY", hgt.outputs[0], math("SUBTRACT", 1.0, math("MULTIPLY", w_head, 0.4)))
    L.new(flat, bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat
