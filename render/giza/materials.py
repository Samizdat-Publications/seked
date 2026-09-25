"""
The materials. Every colour here is a look choice, not a measurement, and the palettes
are named so they can be tuned in one place.

Stone on instanced blocks reads three instance attributes written by the layers:
`tone` (0..1, picks the block's colour off its palette), `wear` (0..1, darkens) and
`scl` (the block's size in metres, so the photograph keeps its real scale on a block
of any shape).
"""
import os

import bpy

from . import states
from .data import REPO, load_json
from .nodes import Tree, hexlin

# The plateau's ground by era: (sand, gravel, chips) colours, and how much gravel shows.
GROUND = {
    "desert": ("e3c596", "c4a883", "e6dccb", (0.52, 0.64)),
    "sand": ("e8c99a", "d2b58c", "eadfcc", (0.62, 0.72)),
    "savanna": ("9d9a52", "7f8a44", "b3a868", (0.40, 0.62)),
    "dry-savanna": ("bba56a", "9a9150", "cdb98a", (0.45, 0.62)),
}
VALLEY = {
    "town": [(0.35, "8a7a64"), (0.55, "6f6a52"), (0.7, "98876c")],
    "fields": [(0.3, "3f5a26"), (0.5, "56702f"), (0.62, "6d7a3a"), (0.75, "3a4f22")],
    "lush": [(0.3, "2d4a1c"), (0.5, "3d5e22"), (0.65, "4b6a2a"), (0.8, "2a4219")],
}

TEXTURES = os.path.join(REPO, "build", "textures")
TEX = load_json(TEXTURES, "index.json")["sets"]
_IMAGES = {}


def image(role, kind, noncolor=False):
    key = (role, kind)
    if key not in _IMAGES:
        img = bpy.data.images.load(os.path.join(TEXTURES, TEX[role]["files"][kind]), check_existing=True)
        if noncolor:
            img.colorspace_settings.name = "Non-Color"
        _IMAGES[key] = img
    return _IMAGES[key]


PALETTES = {
    # The nummulitic limestone of the core as it stands: honey, buff, grey-tan, brown.
    "core": [(0.00, "a9885f"), (0.18, "c3a57c"), (0.36, "9c8a78"), (0.52, "b89366"), (0.68, "cdb893"),
             (0.84, "8f7152"), (1.00, "b7996f")],
    # Khafre's cap and the few casing stones left at Khufu's foot, weathered.
    "casing_today": [(0.0, "c2b294"), (0.5, "cfc1a3"), (1.0, "b5a482")],
    # Red Aswan granite, weathered.
    "granite": [(0.0, "6e4a40"), (0.35, "7f5446"), (0.7, "5d4038"), (1.0, "86604f")],
    "mastaba": [(0.0, "b39673"), (0.5, "c7ab85"), (1.0, "a28565")],
    "city": [(0.0, "a8987f"), (0.2, "9a8269"), (0.4, "8e8a82"), (0.6, "a88c74"), (0.75, "86604c"),
             (0.9, "bdb4a5"), (1.0, "7a766e")],
    "people": [(0.0, "f2f0ea"), (0.2, "202020"), (0.35, "2f4f8f"), (0.5, "a3312a"), (0.65, "d8c7a0"),
               (0.8, "3f6b3a"), (1.0, "e0a33a")],
}


def stops(name):
    return [(p, hexlin(c)) for p, c in PALETTES[name]]


def stone(name, palette, rough=0.88, tex_role="core", tex_amt=0.75, sand_tops=0.8, bump=0.5, instanced=True):
    """
    Weathered stone: a tone per block off its palette, the photograph for grain in the
    block's own metres, a little darkening for wear, and sand settled on upward faces.
    Non-instanced meshes (the core behind the blocks, mastaba fills) take their tone
    from noise in world space instead.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    if instanced:
        tone, wear = t.attr("tone"), t.attr("wear")
    else:
        tone = t.noise(geo.outputs["Position"], 0.6, 2.0)
        wear = t.math("MULTIPLY", tone, 0.8)
    base = t.ramp(tone, stops(palette))

    local = t.node("ShaderNodeVectorMath", operation="MULTIPLY")
    if instanced:
        tc = t.node("ShaderNodeTexCoord")
        t.link(tc.outputs["Object"], local.inputs[0])
        t.link(t.attr("scl", "Vector"), local.inputs[1])
    else:
        t.link(geo.outputs["Position"], local.inputs[0])
        local.inputs[1].default_value = (1.0, 1.0, 1.0)
    off = t.node("ShaderNodeVectorMath", operation="MULTIPLY")
    t.link(tone, off.inputs[0])
    off.inputs[1].default_value = (173.1, 91.7, 57.3)
    offv = t.node("ShaderNodeVectorMath", operation="ADD")
    t.link(local.outputs[0], offv.inputs[0])
    t.link(off.outputs[0], offv.inputs[1])
    size = TEX[tex_role]["tile_m"][0]
    mp = t.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / size, 1 / size, 1 / size)
    t.link(offv.outputs[0], mp.inputs["Vector"])
    diff = t.node("ShaderNodeTexImage", image=image(tex_role, "Diffuse"), projection="BOX", projection_blend=0.3)
    disp = t.node("ShaderNodeTexImage", image=image(tex_role, "Displacement", True), projection="BOX", projection_blend=0.3)
    t.link(mp.outputs[0], diff.inputs["Vector"])
    t.link(mp.outputs[0], disp.inputs["Vector"])
    bw = t.node("ShaderNodeRGBToBW")
    t.link(diff.outputs["Color"], bw.inputs[0])
    grain = t.math("ADD", t.math("MULTIPLY", t.math("MULTIPLY", bw.outputs[0], 2.6), tex_amt), 1.0 - tex_amt)
    col = t.mix(1.0, base, t.grey(grain), "MULTIPLY")
    col = t.mix(t.math("MULTIPLY", wear, 0.35), col, hexlin("5a4632"))

    if sand_tops > 0:
        sep = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Normal"], sep.inputs[0])
        up = t.band(sep.outputs["Z"], 0.72, 0.95)
        patchy = t.math("ADD", t.math("MULTIPLY", t.noise(geo.outputs["Position"], 0.9), 1.2), -0.1)
        m = t.math("MULTIPLY", up, patchy, clamp=True)
        col = t.mix(t.math("MULTIPLY", m, sand_tops), col, hexlin("c7a47a"))

    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    pit = t.noise(mp.outputs[0], 9.0, 6.0)
    h = t.math("ADD", disp.outputs["Color"], t.math("MULTIPLY", pit, 0.35))
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = bump
    bmp.inputs["Distance"].default_value = 0.03
    t.link(h, bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def dressed(name, colours=("e9e2d4", "f3eee5"), rough=0.38, grain_scale=0.05):
    """
    Dressed casing as the eye takes it from any distance: satin, not mirror, with only
    a slow drift of tone. The joints are finer than a pixel from every station.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    drift = t.noise(geo.outputs["Position"], grain_scale, 3.0)
    t.link(t.ramp(drift, [(0.35, hexlin(colours[0])), (0.65, hexlin(colours[1]))]), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    return mat


def _face_bricks(t, geo, course, width, mortar):
    """
    A brick pattern laid on a surface in world metres: rows follow the height, and the
    run follows whichever horizontal axis the face lies along. Returns (mortar, tone).
    """
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Position"], sep.inputs[0])
    nsep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nsep.inputs[0])
    east_west = t.math("GREATER_THAN", t.math("ABSOLUTE", nsep.outputs["X"]), t.math("ABSOLUTE", nsep.outputs["Y"]))
    run = t.math("ADD", t.math("MULTIPLY", east_west, sep.outputs["Y"]), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, east_west), sep.outputs["X"]))
    uv = t.node("ShaderNodeCombineXYZ")
    t.link(run, uv.inputs[0])
    t.link(sep.outputs["Z"], uv.inputs[1])
    br = t.node("ShaderNodeTexBrick")
    br.offset = 0.5
    br.offset_frequency = 2
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = mortar
    br.inputs["Mortar Smooth"].default_value = 0.3
    br.inputs["Bias"].default_value = 0.0
    br.inputs["Brick Width"].default_value = width
    br.inputs["Row Height"].default_value = course
    br.inputs["Color1"].default_value = (0.0, 0.0, 0.0, 1.0)
    br.inputs["Color2"].default_value = (1.0, 1.0, 1.0, 1.0)
    t.link(uv.outputs[0], br.inputs["Vector"])
    bw = t.node("ShaderNodeRGBToBW")
    t.link(br.outputs["Color"], bw.inputs[0])
    return br.outputs["Fac"], bw.outputs[0]


def coursed_casing(name, colours=("ece5d8", "f3eee5"), rough=0.55, course=0.85, width=1.5, mortar=0.008, tone=0.07, line=0.12):
    """
    Dressed casing laid in courses: each stone a shade off its neighbours, the joints a
    hairline. From the stations a course is three or four pixels high, so the face reads
    as masonry rather than a colour, and still as the satin white the reference shows.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    drift = t.noise(geo.outputs["Position"], 0.05, 3.0)
    col = t.ramp(drift, [(0.35, hexlin(colours[0])), (0.65, hexlin(colours[1]))])
    joint, stone_tone = _face_bricks(t, geo, course, width, mortar)
    shade = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", stone_tone, 0.5), tone * 2.0), 1.0)
    col = t.mix(1.0, col, t.grey(shade), "MULTIPLY")
    col = t.mix(t.math("MULTIPLY", joint, line), col, hexlin("8a8272"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    return mat


def pavement(name="pavement"):
    """A court paved in white limestone slabs."""
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Position"], sep.inputs[0])
    uv = t.node("ShaderNodeCombineXYZ")
    t.link(sep.outputs["X"], uv.inputs[0])
    t.link(sep.outputs["Y"], uv.inputs[1])
    br = t.node("ShaderNodeTexBrick")
    br.offset = 0.5
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.01
    br.inputs["Brick Width"].default_value = 1.6
    br.inputs["Row Height"].default_value = 1.1
    br.inputs["Color1"].default_value = (0.0, 0.0, 0.0, 1.0)
    br.inputs["Color2"].default_value = (1.0, 1.0, 1.0, 1.0)
    t.link(uv.outputs[0], br.inputs["Vector"])
    bw = t.node("ShaderNodeRGBToBW")
    t.link(br.outputs["Color"], bw.inputs[0])
    base = t.ramp(t.noise(geo.outputs["Position"], 0.08, 3.0), [(0.3, hexlin("e2d9c6")), (0.7, hexlin("ece5d6"))])
    col = t.mix(1.0, base, t.grey(t.math("ADD", t.math("MULTIPLY", bw.outputs[0], 0.12), 0.94)), "MULTIPLY")
    col = t.mix(t.math("MULTIPLY", br.outputs["Fac"], 0.35), col, hexlin("9c907a"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    return mat


def dressed_blocks(name, stops_hex, rough=0.4, speckle=True):
    """Dressed stone on instanced blocks: each block its own tone off the palette, a fine speckle for granite."""
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    col = t.ramp(t.attr("tone"), [(p, hexlin(c)) for p, c in stops_hex])
    if speckle:
        geo = t.node("ShaderNodeNewGeometry")
        v = t.node("ShaderNodeTexVoronoi")
        v.inputs["Scale"].default_value = 45.0
        t.link(geo.outputs["Position"], v.inputs["Vector"])
        grain = t.math("ADD", t.math("MULTIPLY", v.outputs["Distance"], 0.9), 0.6)
        col = t.mix(1.0, col, t.grey(grain), "MULTIPLY")
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    return mat


def weathered_casing(name="weathered casing"):
    """Casing that has stood through wet millennia (the lion's claim): buff, with rain streaks down the faces."""
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    streak_space = t.node("ShaderNodeMapping")
    streak_space.inputs["Scale"].default_value = (0.9, 0.9, 0.05)
    t.link(geo.outputs["Position"], streak_space.inputs["Vector"])
    streaks = t.band(t.noise(streak_space.outputs[0], 1.2, 4.0), 0.45, 0.75)
    base = t.ramp(t.noise(geo.outputs["Position"], 0.03, 3.0), [(0.3, hexlin("d8cab0")), (0.7, hexlin("c8b593"))])
    col = t.mix(t.math("MULTIPLY", streaks, 0.45), base, hexlin("8e7b5e"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.72
    return mat


def metal(name, rgb_hex, rough):
    """Gold or electrum for the pyramidions."""
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = hexlin(rgb_hex)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = rough
    return mat


def water(name="water"):
    """Open water: dark, glossy, rippled by a slow wind."""
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = hexlin("1d3a3a")
    bsdf.inputs["Roughness"].default_value = 0.05
    bsdf.inputs["IOR"].default_value = 1.33
    geo = t.node("ShaderNodeNewGeometry")
    ripple_space = t.node("ShaderNodeMapping")
    ripple_space.inputs["Scale"].default_value = (1.0, 2.2, 1.0)
    t.link(geo.outputs["Position"], ripple_space.inputs["Vector"])
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.12
    bmp.inputs["Distance"].default_value = 0.05
    t.link(t.noise(ripple_space.outputs[0], 0.35, 5.0, 0.6), bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def dressed_granite(name="dressed granite"):
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    v = t.node("ShaderNodeTexVoronoi")
    v.inputs["Scale"].default_value = 60.0
    t.link(geo.outputs["Position"], v.inputs["Vector"])
    t.link(t.ramp(v.outputs["Distance"], [(0.0, hexlin("4a302a")), (0.3, hexlin("7a4d42")), (0.8, hexlin("8c5d4f"))]),
           bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.35
    return mat


def flat(name, palette, rough=0.8):
    """One colour per instance off a palette, for the city's boxes and the people."""
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    t.link(t.ramp(t.attr("tone"), stops(palette), "CONSTANT"), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    return mat


def dark(name="dark mouth"):
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (0.01, 0.008, 0.006, 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    return mat


def ground(state, displace=False):
    """
    The plateau's ground: packed beige sand, gravel patches and white limestone chips,
    varied at three scales. Below the plateau's foot the valley floor is cultivation in
    the ancient states and the town's dust today. With `displace`, the height maps move
    the surface for real (outward only, so a lifted patch always covers the grid under it).
    """
    S = states.spec(state)
    sand_hex, grav_hex, chip_hex, grav_band = GROUND[S["ground"]]
    mat = bpy.data.materials.new("ground" + (" displaced" if displace else ""))
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]

    def sampled(role, kind, noncolor=False):
        sz = TEX[role]["tile_m"][0]
        mp = t.node("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1 / sz, 1 / sz, 1 / sz)
        t.link(pos, mp.inputs["Vector"])
        im = t.node("ShaderNodeTexImage", image=image(role, kind, noncolor))
        t.link(mp.outputs[0], im.inputs["Vector"])
        return im.outputs["Color"]

    def lum(sock):
        bw = t.node("ShaderNodeRGBToBW")
        t.link(sock, bw.inputs[0])
        return bw.outputs[0]

    sand_l, grav_l = lum(sampled("sand", "Diffuse")), lum(sampled("gravel", "Diffuse"))
    sand_h, grav_h = sampled("sand", "Displacement", True), sampled("gravel", "Displacement", True)
    m_grav = t.band(t.noise(pos, 0.018, 6.0, 0.62), *grav_band)
    m_chip = t.band(t.noise(pos, 0.05, 5.0, 0.6), 0.56, 0.68)
    grain = t.math("ADD", t.math("MULTIPLY", sand_l, t.math("SUBTRACT", 1.0, m_grav)), t.math("MULTIPLY", grav_l, m_grav))
    grain = t.math("ADD", t.math("MULTIPLY", grain, 1.35), 0.42)
    col = t.mix(m_grav, hexlin(sand_hex), hexlin(grav_hex))
    col = t.mix(t.math("MULTIPLY", m_chip, 0.55), col, hexlin(chip_hex))
    col = t.mix(1.0, col, t.ramp(t.noise(pos, 0.0025, 3.0), [(0.3, hexlin("dcc39f")), (0.5, hexlin("ffffff")), (0.72, hexlin("f1e4cc"))]), "MULTIPLY")
    col = t.mix(1.0, col, t.ramp(t.noise(pos, 0.09, 4.0), [(0.35, hexlin("d8ccba")), (0.65, hexlin("ffffff"))]), "MULTIPLY")
    col = t.mix(1.0, col, t.grey(grain), "MULTIPLY")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    # The valley floor: low ground east of the valley temples (x > 430 m), not the Sphinx's ditch.
    valley = t.math("MULTIPLY", t.band(t.math("MULTIPLY", sep.outputs["Z"], -1.0), 26.0, 31.0), t.band(sep.outputs["X"], 430.0, 520.0))
    fields = t.noise(pos, 0.006, 3.0)
    vcol = t.ramp(fields, [(p, hexlin(c)) for p, c in VALLEY[S["valley"]]])
    col = t.mix(valley, col, vcol)
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95
    h = t.mix(m_grav, sand_h, grav_h)
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.45
    bmp.inputs["Distance"].default_value = 0.06
    t.link(h, bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    if displace:
        dn = t.node("ShaderNodeDisplacement")
        dn.inputs["Midlevel"].default_value = 0.0
        dn.inputs["Scale"].default_value = 0.12
        t.link(h, dn.inputs["Height"])
        t.link(dn.outputs["Displacement"], out.inputs["Displacement"])
        mat.displacement_method = "BOTH"
    return mat
