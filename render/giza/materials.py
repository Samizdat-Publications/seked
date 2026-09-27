"""
The materials. Every colour here is a look choice, not a measurement, and the palettes
are named so they can be tuned in one place.

Stone on instanced blocks reads three instance attributes written by the layers:
`tone` (0..1, picks the block's colour off its palette), `wear` (0..1, darkens) and
`scl` (the block's size in metres, so the photograph keeps its real scale on a block
of any shape).
"""
import math
import os

import bpy

from . import states
from .data import REPO, load_json
from .nodes import Tree, hexlin

# The plateau's ground by era: (sand, gravel, chips) colours, and how much gravel shows.
GROUND = {
    "desert": ("e3c596", "c4a883", "e6dccb", (0.5, 0.68)),
    "sand": ("e8c99a", "d2b58c", "eadfcc", (0.62, 0.72)),
    "savanna": ("9d9a52", "7f8a44", "b3a868", (0.40, 0.62)),
    "dry-savanna": ("bba56a", "9a9150", "cdb98a", (0.45, 0.62)),
}
VALLEY = {
    "town": [(0.35, "8a7a64"), (0.55, "6f6a52"), (0.7, "98876c")],
    "fields": [(0.3, "4c6a2c"), (0.5, "627d36"), (0.62, "768744"), (0.75, "455e28")],
    "lush": [(0.3, "3f5f25"), (0.5, "4f7430"), (0.65, "5f8236"), (0.8, "3a5622")],
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
    # The local limestone of the mastabas' stepped cores, a few decades quarried: tan, buff and grey-tan,
    # a shade greyer and paler than the pyramids' core as it stands today.
    "mastaba_core": [(0.0, "a89a86"), (0.2, "b8a88e"), (0.4, "a29685"), (0.6, "b39f84"), (0.8, "c2b49c"),
                     (1.0, "978a78")],
    # The cased mastabas' fine limestone, dusted and weathered to a tan a shade off the stepped cores round them.
    "mastaba_cased": [(0.0, "bcad91"), (0.3, "c8b99b"), (0.55, "b3a286"), (0.8, "cdc0a4"), (1.0, "ae9c7f")],
    # Menkaure's temples, finished in mud brick and plastered with mud: grey-brown to tan, paler where dry.
    "mud_plaster": [(0.0, "9a8367"), (0.35, "a88f70"), (0.7, "8e7a62"), (1.0, "b09a7c")],
    # Dressed Tura and Mokattam limestone in the temples' and causeway's walls: cream to warm grey, not white.
    "tura_dressed": [(0.0, "c9bb9e"), (0.3, "d3c6a9"), (0.55, "c2b193"), (0.8, "d8ccb2"), (1.0, "bcaa8c")],
    "city": [(0.0, "a8987f"), (0.2, "9a8269"), (0.4, "8e8a82"), (0.6, "a88c74"), (0.75, "86604c"),
             (0.9, "bdb4a5"), (1.0, "7a766e")],
    "people": [(0.0, "f2f0ea"), (0.2, "202020"), (0.35, "2f4f8f"), (0.5, "a3312a"), (0.65, "d8c7a0"),
               (0.8, "3f6b3a"), (1.0, "e0a33a")],
}


def stops(name):
    return [(p, hexlin(c)) for p, c in PALETTES[name]]


def stone(name, palette, rough=0.88, tex_role="core", tex_amt=0.75, sand_tops=0.8, bump=0.5, instanced=True, contact=None,
          wear_amt=0.35, stain=None):
    """
    Weathered stone: a tone per block off its palette, the photograph for grain in the
    block's own metres, a little darkening for wear, and sand settled on upward faces.
    Non-instanced meshes (the core behind the blocks, mastaba fills) take their tone
    from noise in world space instead. `contact` (keyword arguments for _contact) adds
    the dust gathered where a block meets its neighbours and the ground, and worn arrises.
    `stain` is (height, colour, amount): stone below that world height, its edge ragged,
    darkened towards the colour, as a quay is by the water it stands in.
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
    col = t.mix(t.math("MULTIPLY", wear, wear_amt), col, hexlin("5a4632"))

    if sand_tops > 0:
        sep = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Normal"], sep.inputs[0])
        up = t.band(sep.outputs["Z"], 0.72, 0.95)
        patchy = t.math("ADD", t.math("MULTIPLY", t.noise(geo.outputs["Position"], 0.9), 1.2), -0.1)
        m = t.math("MULTIPLY", up, patchy, clamp=True)
        col = t.mix(t.math("MULTIPLY", m, sand_tops), col, hexlin("c7a47a"))

    if stain:
        zs = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Position"], zs.inputs[0])
        edge = t.math("ADD", stain[0], t.math("MULTIPLY", t.math("SUBTRACT", t.noise(geo.outputs["Position"], 1.3, 3.0), 0.5), 0.5))
        wet = t.math("SUBTRACT", 1.0, t.band(t.math("SUBTRACT", zs.outputs["Z"], edge), -0.1, 0.25))
        col = t.mix(t.math("MULTIPLY", wet, stain[2]), col, hexlin(stain[1]))
    if contact:
        col = _contact(t, col, bsdf, **contact)
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    pit = t.noise(mp.outputs[0], 9.0, 6.0)
    h = t.math("ADD", disp.outputs["Color"], t.math("MULTIPLY", pit, 0.35))
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = bump
    bmp.inputs["Distance"].default_value = 0.03
    t.link(h, bmp.inputs["Height"])
    if contact:
        t.link(bsdf.inputs["Normal"].links[0].from_socket, bmp.inputs["Normal"])
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


def coursed_casing(name, colours=("ece5d8", "f3eee5"), rough=0.55, course=0.85, width=1.5, mortar=0.008, tone=0.07, line=0.12,
                   mottle=0.0):
    """
    Dressed casing laid in courses: each stone a shade off its neighbours, the joints a
    hairline. From the stations a course is three or four pixels high, so the face reads
    as masonry rather than a colour, and still as the satin white the reference shows.
    `mottle` is a slow patchiness over tens of metres, stone from different beds and
    quarry seasons, so a whole sunlit face is not one flat tone.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    drift = t.noise(geo.outputs["Position"], 0.05, 3.0)
    col = t.ramp(drift, [(0.35, hexlin(colours[0])), (0.65, hexlin(colours[1]))])
    if mottle:
        patch = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", t.noise(geo.outputs["Position"], 0.035, 2.0, 0.5), 0.5),
                                     2.0 * mottle), 1.0)
        col = t.mix(1.0, col, t.grey(patch), "MULTIPLY")
    joint, stone_tone = _face_bricks(t, geo, course, width, mortar)
    shade = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", stone_tone, 0.5), tone * 2.0), 1.0)
    col = t.mix(1.0, col, t.grey(shade), "MULTIPLY")
    col = t.mix(t.math("MULTIPLY", joint, line), col, hexlin("8a8272"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    return mat


def _broad(t, pos, col, bsdf_normal_in, amount=0.07, undulation=0.25, foot=None, foot_hex="7d6a4f"):
    """
    What a pyramid face shows at the scale a camera sees it (critic rounds 4 to 6: every face read as
    one flat value, its stone detail finer than a pixel): tone varying over thirty metres and over
    eight, by `amount` either way; the face undulating by a degree or so over tens of metres
    (`undulation`, metres of height), so a sheen or the sky in it varies across the face as it does
    on any real cladding; and with `foot` (the mesh's `hb`) soil splashed and grimed onto the lowest
    few metres, so the monument stands on the ground rather than on it. Returns (colour, normal).
    """
    big = t.math("SUBTRACT", t.noise(pos, 0.033, 3.0, 0.55), 0.5)
    mid = t.math("SUBTRACT", t.noise(pos, 0.12, 3.0, 0.55), 0.5)
    k = t.math("ADD", 1.0, t.math("ADD", t.math("MULTIPLY", big, 2.0 * amount), t.math("MULTIPLY", mid, amount)))
    col = t.mix(1.0, col, t.grey(k), "MULTIPLY")
    if foot is not None:
        splash = t.math("SUBTRACT", 1.0, t.band(foot, 0.0, 3.5))
        splash = t.math("MULTIPLY", splash, t.math("ADD", 0.55, t.math("MULTIPLY", t.noise(pos, 0.8, 3.0), 0.45)))
        col = t.mix(t.math("MULTIPLY", splash, 0.7), col, hexlin(foot_hex))
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 1.0
    bmp.inputs["Distance"].default_value = undulation
    t.link(t.noise(pos, 0.025, 2.0, 0.5), bmp.inputs["Height"])
    if bsdf_normal_in is not None:
        t.link(bsdf_normal_in, bmp.inputs["Normal"])
    return col, bmp.outputs["Normal"]


def _mesh_attr(t, name):
    """A float attribute stored on the mesh's vertices (not the instancer's)."""
    a = t.node("ShaderNodeAttribute", attribute_type="GEOMETRY", attribute_name=name)
    return a.outputs["Fac"]


def restored_casing(name="restored casing", rough=0.46, course=0.74, width=1.35, foot=True, contact=False):
    """
    The casing as the Egyptians of c. 2560 BCE kept it, in Stewart's reading (2026-09-25): stone
    that had stood for ages before them, restored. Cream Tura limestone laid in courses, every
    stone a shade off its neighbours, a scatter of bright new stones set in the repairs and a few
    honey-stained old ones; faint streaks where dust and the rare rain ran down the faces; a warm
    grime and blown sand on the lowest courses; the joints recessed a hair, so a raking sun draws
    the courses. With `foot`, reads `hb` (metres above the pyramid's base) off the mesh. The
    stone is held a shade under white, ivory rather than paper, so a sunlit face never clips and
    the shaded one falls away from it. All look choices.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    joint, stone = _face_bricks(t, geo, course, width, 0.016)
    # the stone's own colour: mostly ivory, each stone close to its neighbours (from the stations a
    # stone is a pixel or two, and a strong stone-to-stone spread reads as a tiled mosaic), a few
    # renewed whiter, a few old and honey-stained
    col = t.ramp(stone, [(0.0, hexlin("e0d9c9")), (0.04, hexlin("d8cfbc")), (0.5, hexlin("d4c9b1")),
                         (0.96, hexlin("cfc2a7")), (1.0, hexlin("c3af8e"))])
    # course by course: each course a shade off the next, the way a laid face bands from afar
    zsep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, zsep.inputs[0])
    row = t.node("ShaderNodeCombineXYZ")
    t.link(t.math("MULTIPLY", t.math("FLOOR", t.math("DIVIDE", zsep.outputs["Z"], course)), 3.17), row.inputs[0])
    band = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", t.noise(row.outputs[0], 1.0, 0.0), 0.5), 0.14), 1.0)
    col = t.mix(1.0, col, t.grey(band), "MULTIPLY")
    # slow patchiness: stone from different beds and quarry seasons over tens of metres, and whole
    # stretches of the face relaid in the restoration over a hundred or more
    patch = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.03, 2.0, 0.5), 0.5), 0.12), 1.0)
    col = t.mix(1.0, col, t.grey(patch), "MULTIPLY")
    relaid = t.band(t.noise(pos, 0.009, 2.0, 0.5), 0.55, 0.62)
    col = t.mix(t.math("MULTIPLY", relaid, 0.45), col, hexlin("e6e1d5"))
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    nsep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nsep.inputs[0])
    ew = t.math("GREATER_THAN", t.math("ABSOLUTE", nsep.outputs["X"]), t.math("ABSOLUTE", nsep.outputs["Y"]))
    run = t.math("ADD", t.math("MULTIPLY", ew, sep.outputs["Y"]), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, ew), sep.outputs["X"]))
    # the repairs: whole patches a few courses high and a dozen stones wide, laid in one campaign,
    # snapped to the courses, so from afar the face reads as masonry mended in places: some patches
    # newer and whiter, some the oldest stone left, greyed and honeyed
    # Each band of courses has its own offset, and the patch edges step stone by stone, so the
    # patches neither line up into a grid nor run ruler-straight.
    band_row = t.math("FLOOR", t.math("DIVIDE", sep.outputs["Z"], 5.0 * course))
    rn = t.node("ShaderNodeTexWhiteNoise")
    rn.noise_dimensions = "1D"
    t.link(band_row, rn.inputs["W"])
    ragged = t.math("ADD", t.math("ADD", run, t.math("MULTIPLY", rn.outputs["Value"], 97.0)), t.math("MULTIPLY", stone, 2.5 * width))
    cell = t.node("ShaderNodeCombineXYZ")
    t.link(t.math("FLOOR", t.math("DIVIDE", ragged, 9.0 * width)), cell.inputs[0])
    t.link(band_row, cell.inputs[1])
    t.link(t.math("ADD", t.math("MULTIPLY", nsep.outputs["X"], 7.0), t.math("MULTIPLY", nsep.outputs["Y"], 13.0)), cell.inputs[2])
    wn = t.node("ShaderNodeTexWhiteNoise")
    wn.noise_dimensions = "3D"
    t.link(cell.outputs[0], wn.inputs["Vector"])
    campaign = wn.outputs["Value"]
    newer = t.math("GREATER_THAN", campaign, 0.93)
    older = t.math("LESS_THAN", campaign, 0.05)
    col = t.mix(t.math("MULTIPLY", newer, 0.3), col, hexlin("e9e5da"))
    col = t.mix(t.math("MULTIPLY", older, 0.28), col, hexlin("b8a98e"))
    # streaks run down the faces: noise stretched vertically along whichever way the face runs
    sv = t.node("ShaderNodeCombineXYZ")
    t.link(t.math("MULTIPLY", run, 0.9), sv.inputs[0])
    t.link(t.math("MULTIPLY", sep.outputs["Z"], 0.03), sv.inputs[1])
    streak = t.band(t.noise(sv.outputs[0], 1.0, 5.0, 0.6), 0.5, 0.8)
    col = t.mix(t.math("MULTIPLY", streak, 0.22), col, hexlin("a08e70"))
    wide = t.node("ShaderNodeCombineXYZ")
    t.link(t.math("MULTIPLY", run, 0.12), wide.inputs[0])
    t.link(t.math("MULTIPLY", sep.outputs["Z"], 0.01), wide.inputs[1])
    stain = t.band(t.noise(wide.outputs[0], 1.0, 3.0, 0.55), 0.55, 0.75)
    col = t.mix(t.math("MULTIPLY", stain, 0.3), col, hexlin("b3a07e"))
    grime = 0.0
    if foot:
        # the lowest courses: scoured and grimed by blown sand to about twelve metres, sand on the first
        hb = _mesh_attr(t, "hb")
        grime = t.math("SUBTRACT", 1.0, t.band(hb, 0.0, 12.0))
        grime = t.math("MULTIPLY", grime, t.math("ADD", t.math("MULTIPLY", t.noise(pos, 0.25, 3.0), 0.6), 0.4))
        col = t.mix(t.math("MULTIPLY", grime, 0.55), col, hexlin("ad936c"))
        sand = t.math("SUBTRACT", 1.0, t.band(hb, 0.3, 1.6))
        col = t.mix(t.math("MULTIPLY", sand, 0.55), col, hexlin("c9ad82"))
    # pitting: small dark flecks where the surface has weathered
    pit = t.band(t.noise(pos, 7.0, 3.0, 0.7), 0.64, 0.72)
    col = t.mix(t.math("MULTIPLY", pit, 0.12), col, hexlin("8c7b62"))
    col = t.mix(t.math("MULTIPLY", joint, 0.5), col, hexlin("8f8168"))
    if contact:
        # small buildings: grime where the walls meet the sand, and worn arrises (with `contact`), and
        # sand lying on every flat roof (from the air they read as white cubes without it)
        nz = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["Normal"], nz.inputs[0])
        roof = t.math("MULTIPLY", t.band(nz.outputs["Z"], 0.8, 0.95), t.band(t.noise(pos, 0.3, 4.0, 0.6), 0.3, 0.6))
        col = t.mix(t.math("MULTIPLY", roof, 0.75), col, hexlin("cdb38c"))
        col = _contact(t, col, bsdf, reach=1.2, amount=0.6)
    t.link(col, bsdf.inputs["Base Color"])
    t.link(t.math("ADD", rough, t.math("MULTIPLY", t.math("ADD", grime, pit), 0.2)), bsdf.inputs["Roughness"])
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    # relief: the joints sunk, each stone's face a little pillowed and uneven
    pillow = t.noise(pos, 1.3, 2.0)
    h = t.math("ADD", t.math("MULTIPLY", joint, -1.0), t.math("MULTIPLY", pillow, 0.35))
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.35
    bmp.inputs["Distance"].default_value = 0.02
    t.link(h, bmp.inputs["Height"])
    if contact:
        t.link(bsdf.inputs["Normal"].links[0].from_socket, bmp.inputs["Normal"])
    normal = bmp.outputs["Normal"]
    if foot:
        # weathering at the scale a camera reads (critic round 7: the faces still one value): broad
        # tone of 16 per cent either way, and stains of dust and old water in organic drifts
        stain = t.band(t.noise(pos, 0.05, 5.0, 0.62), 0.52, 0.72)
        col = t.mix(t.math("MULTIPLY", stain, 0.35), col, hexlin("a8977a"))
        col, normal = _broad(t, pos, col, normal, amount=0.16, undulation=0.2)
        t.link(col, bsdf.inputs["Base Color"])
    t.link(normal, bsdf.inputs["Normal"])
    return mat


def polished_casing(name="pristine casing", instanced=False):
    """
    The claim's first casing (Stewart, 2026-09-25: "super pristine, almost high tech"): stone
    dressed and polished past anything known from the Old Kingdom, the joints finer than the
    eye resolves, a clear lacquer-like sheen that carries the sky and the green land in it.
    A look choice for an illustration, not a reconstruction of anything found.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    # a shade under white, so the sun and the mirrored sky have room to show on it
    col = t.ramp(t.noise(pos, 0.02, 2.0, 0.4), [(0.3, hexlin("cbc6ba")), (0.7, hexlin("d4d0c5"))])
    if instanced:
        # laid as blocks (pyramids.BLOCK_CASING): the joints are the blocks' own, each stone's tone its own
        joint, stone = 0.0, t.attr("tone")
    else:
        # slabs of one size in perfect courses, the joints a ruled line: from afar a faint grid, the mark
        # of an engineered surface rather than a laid one
        joint, stone = _face_bricks(t, geo, 1.4, 2.8, 0.022)
    shade = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", stone, 0.5), 0.05), 1.0)
    col = t.mix(1.0, col, t.grey(shade), "MULTIPLY")
    # The ruled joint fades out with distance (critic rounds 12 to 15: "horizontal pinstripes" from afar,
    # where a 2 cm line is a fraction of a pixel and only its aliasing shows): drawn full within 60 m,
    # gone by 300 m, where polished stone reads as one plane.
    cam = t.node("ShaderNodeCameraData")
    near = t.node("ShaderNodeMapRange")
    near.inputs["From Min"].default_value, near.inputs["From Max"].default_value = 60.0, 300.0
    near.inputs["To Min"].default_value, near.inputs["To Max"].default_value = 1.0, 0.0
    t.link(cam.outputs["View Distance"], near.inputs["Value"])
    col = t.mix(t.math("MULTIPLY", t.math("MULTIPLY", joint, 0.4), near.outputs[0]), col, hexlin("7d7568"))
    bsdf.inputs["Roughness"].default_value = 0.3
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    # the polish: a clear coat that mirrors the clouds, strongest where the face is seen at a slant
    bsdf.inputs["Coat Weight"].default_value = 1.0
    bsdf.inputs["Coat Roughness"].default_value = 0.08
    bsdf.inputs["Coat IOR"].default_value = 1.7
    # No two slabs lie in quite the same plane: each is tilted a fraction of a degree its own way,
    # so each mirrors its own patch of sky, as polished stone cladding does on any building.
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    nsep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nsep.inputs[0])
    ew = t.math("GREATER_THAN", t.math("ABSOLUTE", nsep.outputs["X"]), t.math("ABSOLUTE", nsep.outputs["Y"]))
    run = t.math("ADD", t.math("MULTIPLY", ew, sep.outputs["Y"]), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, ew), sep.outputs["X"]))
    course, width = 1.4, 2.8
    row = t.math("FLOOR", t.math("DIVIDE", sep.outputs["Z"], course))
    shift = t.math("MULTIPLY", t.math("FLOORED_MODULO", row, 2.0), 0.5 * width)
    u = t.math("SUBTRACT", t.math("FRACT", t.math("DIVIDE", t.math("ADD", run, shift), width)), 0.5)
    v = t.math("SUBTRACT", t.math("FRACT", t.math("DIVIDE", sep.outputs["Z"], course)), 0.5)
    other = t.node("ShaderNodeCombineXYZ")
    t.link(t.math("MULTIPLY", stone, 37.3), other.inputs[0])
    r2 = t.noise(other.outputs[0], 1.0, 0.0)
    tilt = 0.012
    h = t.math("ADD", t.math("MULTIPLY", t.math("MULTIPLY", t.math("SUBTRACT", stone, 0.5), 2.0 * tilt * width), u),
               t.math("MULTIPLY", t.math("MULTIPLY", t.math("SUBTRACT", r2, 0.5), 4.0 * tilt * course), v))
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 1.0
    bmp.inputs["Distance"].default_value = 1.0
    t.link(h, bmp.inputs["Height"])
    if instanced:
        # hairline joints, faintly shadowed, the arrises barely eased: near seamless
        col = _contact(t, col, bsdf, reach=0.1, amount=0.0, dirt="b5afa2", arris=0.0005)   # no drawn joint at all (round 14: "cobblestones")
        t.link(bsdf.inputs["Normal"].links[0].from_socket, bmp.inputs["Normal"])
        wsep = t.node("ShaderNodeSeparateXYZ")
        t.link(pos, wsep.inputs[0])
        foot = t.math("SUBTRACT", wsep.outputs["Z"], t.math("MULTIPLY", t.math("LESS_THAN", wsep.outputs["X"], -160.0), 10.5))
    else:
        foot = _mesh_attr(t, "hb")
    col, normal = _broad(t, pos, col, bmp.outputs["Normal"], amount=0.05, undulation=0.3, foot=foot, foot_hex="6f6a4e")
    t.link(col, bsdf.inputs["Base Color"])
    t.link(normal, bsdf.inputs["Normal"])
    t.link(normal, bsdf.inputs["Coat Normal"])
    return mat


def pavement(name="pavement", dusty=False):
    """
    A court paved in white limestone slabs. `dusty` is the court as the built era's stations see it
    (look choices): cream-tan rather than white, a stone a shade off the next, the joints packed with
    sand, and blown sand lying across it in drifts and banked against whatever stands on it.
    """
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
    if dusty:
        pos = geo.outputs["Position"]
        col = t.mix(1.0, col, t.ramp(bw.outputs[0], [(0.0, hexlin("c9bc9f")), (0.5, hexlin("d8ccb0")), (1.0, hexlin("cdbd9c"))]),
                    "MULTIPLY")
        col = t.mix(1.0, col, (1.25, 1.25, 1.25, 1.0), "MULTIPLY")
        col = t.mix(t.math("MULTIPLY", br.outputs["Fac"], 0.7), col, hexlin("b89f78"))
        film = t.band(t.noise(pos, 0.3, 3.0, 0.55), 0.35, 0.8)
        col = t.mix(t.math("ADD", 0.1, t.math("MULTIPLY", film, 0.25)), col, hexlin("c2a982"))
        drift = t.band(t.noise(pos, 0.05, 5.0, 0.62), 0.55, 0.72)
        col = t.mix(t.math("MULTIPLY", drift, 0.85), col, hexlin("d0b286"))
        ao = t.node("ShaderNodeAmbientOcclusion")
        ao.samples = 8
        ao.inputs["Distance"].default_value = 2.0
        banked = t.math("POWER", t.math("SUBTRACT", 1.0, ao.outputs["AO"]), 0.6)
        col = t.mix(t.math("MULTIPLY", banked, 0.7), col, hexlin("c6a97d"))
        bmp = t.node("ShaderNodeBump")
        bmp.inputs["Strength"].default_value = 0.4
        bmp.inputs["Distance"].default_value = 0.01
        t.link(t.math("ADD", t.math("MULTIPLY", br.outputs["Fac"], -1.0), t.noise(pos, 1.2, 3.0)), bmp.inputs["Height"])
        t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.8 if dusty else 0.6
    return mat


def _contact(t, col, bsdf, reach=0.8, dirt="8a7658", amount=0.55, arris=0.015):
    """
    What makes a laid stone read as laid rather than as a box: dust and grime gathered where it meets
    the sand or its neighbour (ambient occlusion within `reach` metres, darkened towards `dirt`), and
    arrises worn round, so an edge catches the light (a bevel of `arris` metres in the shading).
    """
    ao = t.node("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = reach
    grime = t.math("POWER", t.math("SUBTRACT", 1.0, ao.outputs["AO"]), 0.7)
    col = t.mix(t.math("MULTIPLY", grime, amount), col, hexlin(dirt))
    bev = t.node("ShaderNodeBevel")
    bev.samples = 4
    bev.inputs["Radius"].default_value = arris
    t.link(bev.outputs["Normal"], bsdf.inputs["Normal"])
    return col


def dressed_blocks(name, stops_hex, rough=0.4, speckle=True, broad=0.0, arris=0.015):
    """
    Dressed stone on instanced blocks: each block its own tone off the palette, grime where it meets
    its neighbours and the ground, worn arrises, and for granite its coarse grain: pink feldspar in
    crystals a thumb across, black mica between, the grey of quartz.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    col = t.ramp(t.attr("tone"), [(p, hexlin(c)) for p, c in stops_hex])
    geo = t.node("ShaderNodeNewGeometry")
    if speckle:
        v = t.node("ShaderNodeTexVoronoi")
        v.inputs["Scale"].default_value = 30.0
        t.link(geo.outputs["Position"], v.inputs["Vector"])
        crystals = t.ramp(v.outputs["Color"], [(0.0, hexlin("2a2422")), (0.18, hexlin("3a3230")), (0.2, hexlin("b9aca4")),
                                              (0.45, hexlin("b8968a")), (0.8, hexlin("c49e8e")), (1.0, hexlin("bdb2ab"))], "CONSTANT")
        # the grain shows within the block's own tone, which still carries the stone's red-to-grey drift
        col = t.mix(0.8, col, t.mix(1.0, crystals, col, "MULTIPLY"))
        col = t.mix(1.0, col, (1.1, 1.08, 1.08, 1.0), "MULTIPLY")
    # a slow dust over each face, heavier low down
    # dust over each face, each block its own (a world-space field ran across the joints as one blotch)
    shifted = t.node("ShaderNodeVectorMath", operation="ADD")
    t.link(geo.outputs["Position"], shifted.inputs[0])
    t.link(t.grey(t.math("MULTIPLY", t.attr("tone"), 173.0)), shifted.inputs[1])
    dust = t.band(t.noise(shifted.outputs[0], 0.6, 3.0, 0.6), 0.45, 0.8)
    col = t.mix(t.math("MULTIPLY", dust, 0.14), col, hexlin("c2ab86"))
    # sand lying on every upward face, the tops of courses and of walls
    nz = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nz.inputs[0])
    lying = t.math("MULTIPLY", t.band(nz.outputs["Z"], 0.8, 0.95), t.band(t.noise(geo.outputs["Position"], 0.5, 4.0, 0.6), 0.35, 0.65))
    col = t.mix(t.math("MULTIPLY", lying, 0.6), col, hexlin("cdb38c"))
    col = _contact(t, col, bsdf, reach=1.5, amount=0.8, arris=arris)
    if broad:
        # laid as a pyramid's casing: the face's weathering at the scale a camera reads (see _broad)
        stain = t.band(t.noise(geo.outputs["Position"], 0.05, 5.0, 0.62), 0.5, 0.72)
        col = t.mix(t.math("MULTIPLY", stain, 0.45), col, hexlin("a8977a"))
        # whole stretches relaid in the restoration, brighter stone over tens of metres
        relaid = t.band(t.noise(geo.outputs["Position"], 0.012, 2.0, 0.5), 0.6, 0.7)
        col = t.mix(t.math("MULTIPLY", relaid, 0.35), col, hexlin("e8e3d8"))
        col, normal = _broad(t, geo.outputs["Position"], col, bsdf.inputs["Normal"].links[0].from_socket, amount=broad, undulation=0.0001)
        t.link(normal, bsdf.inputs["Normal"])
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    return mat


def weathered_casing(name="weathered casing", instanced=False):
    """
    The First Time's casing after three thousand years of rain (the long rains, Schoch's reading):
    the same ruled slabs, the polish gone to a matte skin, the joints opened a little, and the faces
    streaked grey-green where water and the film that grows in it ran down them, as limestone streaks
    under any wet sky; darker towards the foot where the runs gather. Look choices throughout.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    # a greyer, darker skin than the First Time's, so the long rains read from any distance
    col = t.ramp(t.noise(pos, 0.03, 3.0), [(0.3, hexlin("bdb6a6")), (0.7, hexlin("b1a996"))])
    if instanced:
        # laid as blocks (pyramids.BLOCK_CASING): the joints are real, each stone's tone its own
        joint, stone = 0.0, t.attr("tone")
    else:
        joint, stone = _face_bricks(t, geo, 1.4, 2.8, 0.03)
    shade = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", stone, 0.5), 0.1), 1.0)
    col = t.mix(1.0, col, t.grey(shade), "MULTIPLY")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    nsep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nsep.inputs[0])
    ew = t.math("GREATER_THAN", t.math("ABSOLUTE", nsep.outputs["X"]), t.math("ABSOLUTE", nsep.outputs["Y"]))
    run = t.math("ADD", t.math("MULTIPLY", ew, sep.outputs["Y"]), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, ew), sep.outputs["X"]))
    if instanced:
        # instances carry no `hb`: the height over the pyramid's base from world height, Khafre's and
        # Menkaure's bases standing 10 and 12 m over Khufu's (to about a metre and a half)
        wsep = t.node("ShaderNodeSeparateXYZ")
        t.link(pos, wsep.inputs[0])
        hb = t.math("SUBTRACT", wsep.outputs["Z"], t.math("MULTIPLY", t.math("LESS_THAN", wsep.outputs["X"], -160.0), 10.5))
    else:
        hb = _mesh_attr(t, "hb")
    # The runs of rain (critic round 5: one scale of streak, full height, read as pencil hatching). Each
    # streak is a stripe across the face at its own width, found by a one-dimensional noise along the
    # face; it wavers a little as it runs down, begins at its own height (under a course where water
    # sheeting off the face above gathered) and darkens as it runs down from there. Three widths: broad
    # washes of tens of metres, runs of a few metres, threads under a metre.
    waver = t.math("ADD", run, t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.06, 2.0), 0.5), 3.0))

    def stripes(along, scale, lo, hi, key):
        n = t.node("ShaderNodeTexNoise")
        n.noise_dimensions = "1D"
        n.inputs["Scale"].default_value = 1.0
        n.inputs["Detail"].default_value = 3.0
        n.inputs["Roughness"].default_value = 0.6
        t.link(t.math("ADD", t.math("MULTIPLY", along, scale), key), n.inputs["W"])
        return t.band(n.outputs["Fac"], lo, hi)

    def begins(scale, key, top, span, fall):
        """How far down its run a stripe is: 0 above where it begins, 1 once `fall` metres below it."""
        n = t.node("ShaderNodeTexNoise")
        n.noise_dimensions = "1D"
        n.inputs["Scale"].default_value = 1.0
        n.inputs["Detail"].default_value = 1.0
        t.link(t.math("ADD", t.math("MULTIPLY", run, scale), key), n.inputs["W"])
        start = t.math("ADD", t.math("MULTIPLY", n.outputs["Fac"], span), top)
        return t.band(t.math("SUBTRACT", start, hb), 0.0, fall)

    # laid as blocks the stone's own texture competes with the stains (critic round 13: "so faint the
    # casing reads as clean"), so the runs are stronger there
    k = 1.35 if instanced else 1.0
    # Laid as blocks (critic round 15: "the streaks read as drawn cracks, not rain wash"): the washes
    # broader and stronger, the runs softer-edged, and no threads, which at a station's distance are lines.
    if instanced:
        wash = t.math("MULTIPLY", stripes(run, 0.035, 0.46, 0.56, 3.0), begins(0.01, 11.0, 60.0, 80.0, 50.0))
        col = t.mix(t.math("MULTIPLY", wash, 0.9), col, hexlin("7a786a"))
        runs = t.math("MULTIPLY", stripes(waver, 0.2, 0.5, 0.6, 17.0), begins(0.06, 23.0, 20.0, 120.0, 30.0))
        col = t.mix(t.math("MULTIPLY", runs, 0.75), col, hexlin("626556"))
    else:
        wash = t.math("MULTIPLY", stripes(run, 0.035, 0.48, 0.72, 3.0), begins(0.01, 11.0, 30.0, 110.0, 40.0))
        col = t.mix(t.math("MULTIPLY", wash, 0.55 * k), col, hexlin("8a887a"))
        runs = t.math("MULTIPLY", stripes(waver, 0.3, 0.56, 0.78, 17.0), begins(0.06, 23.0, 10.0, 130.0, 25.0))
        col = t.mix(t.math("MULTIPLY", runs, min(0.65 * k, 0.9)), col, hexlin("686b5d"))
        threads = t.math("MULTIPLY", stripes(waver, 1.7, 0.6, 0.8, 41.0), begins(0.4, 37.0, 5.0, 140.0, 12.0))
        col = t.mix(t.math("MULTIPLY", threads, 0.3), col, hexlin("5d6155"))
    foot = t.math("SUBTRACT", 1.0, t.band(hb, 0.0, 30.0))
    col = t.mix(t.math("MULTIPLY", foot, 0.45), col, hexlin("6f6c5c"))
    # black-green growth where the runs gather: in the streaks, thickest low down
    growth = t.band(t.noise(pos, 0.12, 4.0, 0.6), 0.5, 0.7)
    growth = t.math("MULTIPLY", growth, t.math("ADD", t.math("MULTIPLY", foot, 0.7), 0.2))
    col = t.mix(t.math("MULTIPLY", growth, 0.7), col, hexlin("3b4034"))
    col = t.mix(t.math("MULTIPLY", joint, 0.6), col, hexlin("5f5b50"))
    t.link(col, bsdf.inputs["Base Color"])
    # a satin wetness, the polish long gone
    bsdf.inputs["Roughness"].default_value = 0.6
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.3
    bmp.inputs["Distance"].default_value = 0.02
    t.link(t.math("ADD", t.math("MULTIPLY", joint, -1.0), t.math("MULTIPLY", t.noise(pos, 2.0, 4.0), 0.4)), bmp.inputs["Height"])
    if instanced:
        # grime only just into the joints (round 15: every block outlined read as "small bricks")
        col = _contact(t, col, bsdf, reach=0.35, amount=0.35, dirt="4f4a3c", arris=0.025)
        t.link(bsdf.inputs["Normal"].links[0].from_socket, bmp.inputs["Normal"])
    col, normal = _broad(t, pos, col, bmp.outputs["Normal"], amount=0.07, undulation=0.3 if not instanced else 0.0001,
                         foot=hb, foot_hex="5a5443")
    t.link(col, bsdf.inputs["Base Color"])
    t.link(normal, bsdf.inputs["Normal"])
    return mat


def metal(name, rgb_hex, rough, metallic=0.8, dent=0.2, facet=0.9, tilt=0.2):
    """
    Gold or electrum for the pyramidions. A polished face seen from the ground shows only the
    deep sky above it and reads dark (the sun's reflection reaches the ground only when the sun
    stands high on the far side), so the metal is a look choice: sheet hammered in dents a hand's
    breadth across, that throw the sun back from most directions, and burnished unevenly, part of
    it matte like unburnished leaf (1 - `metallic`), which scatters the sun's colour to any eye.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Metallic"].default_value = metallic
    geo = t.node("ShaderNodeNewGeometry")
    # Laid in leaves a hand's breadth square, each burnished to its own degree and a shade off the next.
    leaf, leaf_tone = _face_bricks(t, geo, 0.11, 0.11, 0.004)
    tone = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", leaf_tone, 0.5), 0.14), 1.0)
    t.link(t.mix(1.0, hexlin(rgb_hex), t.grey(tone), "MULTIPLY"), bsdf.inputs["Base Color"])
    t.link(t.math("ADD", rough, t.math("MULTIPLY", t.math("SUBTRACT", leaf_tone, 0.5), 0.3)), bsdf.inputs["Roughness"])
    dents = t.node("ShaderNodeTexVoronoi")
    dents.feature = "SMOOTH_F1"
    dents.inputs["Scale"].default_value = 3.0
    t.link(geo.outputs["Position"], dents.inputs["Vector"])
    # Critic rounds 12 to 15: "matte cream or ochre paint", "no metallic glint". Averaged over a pixel the
    # dents above are one broad lobe, which is paint. So the sheet is also laid in plates a pace across,
    # each set a few degrees off the face (tilt, radians): from any eye some of them stand square to the sun
    # and throw it back whole, a hot point among dark ones, as beaten metal on a roof does.
    plates = t.node("ShaderNodeTexVoronoi")
    plates.inputs["Scale"].default_value = 1.0 / facet
    t.link(geo.outputs["Position"], plates.inputs["Vector"])
    off = t.node("ShaderNodeVectorMath")
    off.operation = "MULTIPLY_ADD"
    t.link(plates.outputs["Color"], off.inputs[0])
    off.inputs[1].default_value = (2 * tilt, 2 * tilt, 2 * tilt)
    off.inputs[2].default_value = (-tilt, -tilt, -tilt)
    tilted = t.node("ShaderNodeVectorMath")
    tilted.operation = "ADD"
    t.link(geo.outputs["Normal"], tilted.inputs[0])
    t.link(off.outputs[0], tilted.inputs[1])
    unit = t.node("ShaderNodeVectorMath")
    unit.operation = "NORMALIZE"
    t.link(tilted.outputs[0], unit.inputs[0])
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = dent
    bmp.inputs["Distance"].default_value = 0.05
    height = t.math("ADD", dents.outputs["Distance"], t.math("MULTIPLY", leaf, 0.3))
    t.link(height, bmp.inputs["Height"])
    t.link(unit.outputs[0], bmp.inputs["Normal"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def water(name="water"):
    """
    Open water: the inundation carried silt, so a dark turbid olive-brown seen from above (clouded
    paler where the silt drifts), glossy, the sky and the buildings on its banks in it, rippled by a
    slow wind in catspaws with calm between.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.03
    bsdf.inputs["IOR"].default_value = 1.33
    geo = t.node("ShaderNodeNewGeometry")
    # Critic round 15 read the harbour as "opaque brown with no reflections": water's own colour is dark,
    # so what it mirrors carries it; the silt only clouds it a little.
    silt = t.band(t.noise(geo.outputs["Position"], 0.008, 3.0, 0.55), 0.4, 0.7)
    t.link(t.mix(silt, hexlin("33322a"), hexlin("5a4e34")), bsdf.inputs["Base Color"])
    ripple_space = t.node("ShaderNodeMapping")
    ripple_space.inputs["Scale"].default_value = (1.0, 2.2, 1.0)
    t.link(geo.outputs["Position"], ripple_space.inputs["Vector"])
    # Wind on the water (critic rounds 6 to 11: "a flat olive mirror"): ripples a hand's breadth to a
    # couple of metres, stronger in the catspaws the gusts draw across it and gone in the calm between,
    # so the sky and the far bank break up in it the way they do on any real sheet of water.
    gust = t.band(t.noise(geo.outputs["Position"], 0.012, 3.0, 0.55), 0.35, 0.75)
    fine = t.noise(ripple_space.outputs[0], 2.2, 3.0, 0.6)
    broad = t.noise(ripple_space.outputs[0], 0.35, 4.0, 0.6)
    h = t.math("ADD", t.math("MULTIPLY", fine, t.math("ADD", 0.05, t.math("MULTIPLY", gust, 0.95))), t.math("MULTIPLY", broad, 0.6))
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.2
    bmp.inputs["Distance"].default_value = 0.06
    t.link(h, bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def dressed_granite(name="dressed granite"):
    """Single granite members (architraves, beams): the dressed blocks' grain, grime and worn arrises in one tone."""
    return dressed_blocks(name, [(0.0, "6a4238"), (1.0, "74463a")], rough=0.38)


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


# Red Aswan granite as Khafre's masons dressed it, a century or less in the desert air: a dark
# rose-grey rather than brick red, each block a shade off the next (look choices, after photographs of
# the valley temple's hall and of the casing blocks at Menkaure's foot).
GRANITE_MASONRY = [(0.0, "4f3a36"), (0.18, "5d4540"), (0.36, "664c45"), (0.52, "564340"), (0.7, "6a4e45"), (0.85, "5a4440"),
                   (1.0, "634741")]


def _block_local(t, geo, instanced, tone=None):
    """Metres in the block's own frame when instanced (object coordinates times its size), each block's
    offset by its tone so no two share a pattern; world metres otherwise."""
    local = t.node("ShaderNodeVectorMath", operation="MULTIPLY")
    if instanced:
        tc = t.node("ShaderNodeTexCoord")
        t.link(tc.outputs["Object"], local.inputs[0])
        t.link(t.attr("scl", "Vector"), local.inputs[1])
        off = t.node("ShaderNodeVectorMath", operation="MULTIPLY")
        t.link(tone, off.inputs[0])
        off.inputs[1].default_value = (173.1, 91.7, 57.3)
        offv = t.node("ShaderNodeVectorMath", operation="ADD")
        t.link(local.outputs[0], offv.inputs[0])
        t.link(off.outputs[0], offv.inputs[1])
        return offv.outputs[0]
    t.link(geo.outputs["Position"], local.inputs[0])
    local.inputs[1].default_value = (1.0, 1.0, 1.0)
    return local.outputs[0]


def granite_masonry(name="granite masonry", instanced=True, stops_hex=GRANITE_MASONRY, rough=0.4):
    """
    Dressed granite that reads as granite at the distances the cameras see it (critic: "pink bricks
    with blurry mottling", "granite pillars flat brown"). Each block its own tone off a rose-grey
    palette; in it the crystals, pink feldspar a few centimetres across with grey quartz and black
    mica between, gathered in clots and streaks a hand to a forearm across, which is what survives as
    salt and pepper once a crystal is smaller than a pixel; paler pink scars where the weathered skin
    has flaked; desert dust on the ledges and in the joints; a satin face whose sheen breaks up crystal
    by crystal. All look choices. Non-instanced members (architraves) take their tone from world noise.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    tone = t.attr("tone") if instanced else t.noise(pos, 0.35, 2.0)
    base = t.ramp(tone, [(p, hexlin(c)) for p, c in stops_hex])
    local = _block_local(t, geo, instanced, tone)
    # the clots: where the dark minerals gather and where the feldspar does, at a hand to a forearm
    # (a crystal much under a pixel averages away: from the stations a pixel is 2 to 5 cm, so the clots
    # of dark mineral a few centimetres across, and the feldspar, are what must carry the speckle)
    clot = t.math("SUBTRACT", t.noise(local, 7.0, 2.0, 0.6), 0.5)
    drift = t.math("SUBTRACT", t.noise(local, 1.8, 3.0, 0.55), 0.5)
    vor = t.node("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 20.0
    vor.inputs["Randomness"].default_value = 0.9
    t.link(local, vor.inputs["Vector"])
    pick = t.node("ShaderNodeRGBToBW")
    t.link(vor.outputs["Color"], pick.inputs[0])
    which = t.math("ADD", pick.outputs[0], t.math("MULTIPLY", clot, 0.55))
    # the crystals as multipliers on the block's tone: mica and hornblende, quartz, feldspar
    crystals = t.ramp(which, [(0.0, (0.42, 0.4, 0.4, 1.0)), (0.2, (0.42, 0.4, 0.4, 1.0)),
                              (0.21, (0.95, 1.0, 1.05, 1.0)), (0.42, (1.0, 1.02, 1.06, 1.0)),
                              (0.43, (1.12, 0.98, 0.93, 1.0)), (1.0, (1.22, 1.02, 0.95, 1.0))], "CONSTANT")
    col = t.mix(0.85, base, t.mix(1.0, base, crystals, "MULTIPLY"))
    # the clots again at the scale a pixel covers from the stations, so the face is mottled, not flat
    mott = t.math("ADD", 1.0, t.math("ADD", t.math("MULTIPLY", clot, 0.9), t.math("MULTIPLY", drift, 0.5)))
    col = t.mix(1.0, col, t.grey(mott), "MULTIPLY")
    # the desert varnish: darker runs down the faces from the joints and the top, and paler dust above them
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    sv = t.node("ShaderNodeCombineXYZ")
    t.link(t.math("MULTIPLY", t.math("ADD", sep.outputs["X"], sep.outputs["Y"]), 2.2), sv.inputs[0])
    t.link(t.math("MULTIPLY", sep.outputs["Z"], 0.12), sv.inputs[1])
    t.link(tone, sv.inputs[2])
    runs = t.band(t.noise(sv.outputs[0], 1.0, 4.0, 0.6), 0.55, 0.8)
    col = t.mix(t.math("MULTIPLY", runs, 0.45), col, t.mix(1.0, col, (0.62, 0.58, 0.58, 1.0), "MULTIPLY"))
    # scars where the patina has flaked, paler and pinker
    scar = t.band(t.noise(local, 0.8, 4.0, 0.65), 0.64, 0.7)
    col = t.mix(t.math("MULTIPLY", scar, 0.25), col, t.mix(1.0, col, (1.35, 1.18, 1.1, 1.0), "MULTIPLY"))
    # a film of dust, thicker in patches
    film = t.band(t.noise(pos, 0.25, 3.0, 0.55), 0.45, 0.8)
    col = t.mix(t.math("MULTIPLY", film, 0.08), col, hexlin("a8927a"))
    nz = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nz.inputs[0])
    lying = t.math("MULTIPLY", t.band(nz.outputs["Z"], 0.75, 0.95), t.band(t.noise(pos, 0.6, 4.0, 0.6), 0.3, 0.6))
    col = t.mix(t.math("MULTIPLY", lying, 0.7), col, hexlin("c4a883"))
    col = _contact(t, col, bsdf, reach=1.0, dirt="94806a", amount=0.45, arris=0.012)
    t.link(col, bsdf.inputs["Base Color"])
    # the sheen breaks up crystal by crystal: feldspar cleavages glint, the mica is dull
    t.link(t.math("ADD", rough, t.math("MULTIPLY", t.math("SUBTRACT", 0.5, pick.outputs[0]), 0.25)), bsdf.inputs["Roughness"])
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.25
    bmp.inputs["Distance"].default_value = 0.004
    t.link(t.math("ADD", vor.outputs["Distance"], t.math("MULTIPLY", t.noise(local, 1.4, 2.0), 1.5)), bmp.inputs["Height"])
    t.link(bsdf.inputs["Normal"].links[0].from_socket, bmp.inputs["Normal"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def masonry_set(mats):
    """
    The built era's masonry materials, made once and kept in the scene's material dict: granite laid
    as blocks and as single members, dressed limestone laid as blocks, and the sanded roofs over it.
    """
    if "granite masonry" in mats:
        return mats
    mats["granite masonry"] = granite_masonry()
    mats["granite member"] = granite_masonry("granite member", instanced=False)
    mats["limestone masonry"] = stone("limestone masonry", "tura_dressed", rough=0.72, tex_role="casing", tex_amt=0.55,
                                      sand_tops=0.75, bump=0.3, wear_amt=0.18,
                                      contact=dict(reach=1.2, dirt="8f7a5a", amount=0.5, arris=0.012))
    mats["limestone roof blocks"] = stone("limestone roof blocks", "tura_dressed", rough=0.8, tex_role="casing", tex_amt=0.5,
                                          sand_tops=1.0, bump=0.3, wear_amt=0.15,
                                          contact=dict(reach=1.0, dirt="8f7a5a", amount=0.45, arris=0.012))
    mats["limestone roof"] = stone("limestone roof", "tura_dressed", rough=0.8, tex_role="casing", tex_amt=0.5, sand_tops=1.0,
                                   bump=0.3, instanced=False, wear_amt=0.15)
    mats["mastaba stone"] = stone("mastaba stone", "mastaba_core", rough=0.9, tex_role="core", tex_amt=0.7, sand_tops=0.95,
                                  bump=0.5, wear_amt=0.25, contact=dict(reach=0.9, dirt="8a7454", amount=0.55, arris=0.02))
    mats["mastaba casing"] = mastaba_casing()
    mats["mud plaster"] = stone("mud plaster", "mud_plaster", rough=0.95, tex_role="sand", tex_amt=0.5, sand_tops=1.0, bump=0.4,
                                instanced=False, wear_amt=0.3)
    # the cased tombs laid as blocks: fine limestone, but a dusty tan a few decades on, pitted, sanded on every ledge
    mats["mastaba cased"] = stone("mastaba cased", "mastaba_cased", rough=0.8, tex_role="core", tex_amt=0.45, sand_tops=0.9,
                                  bump=0.3, wear_amt=0.3, contact=dict(reach=1.0, dirt="86704f", amount=0.6, arris=0.015))
    return mats


def mastaba_casing(name="mastaba casing"):
    """
    A mastaba's dressed casing as it stood in the Old Kingdom cemeteries: fine limestone laid in
    courses, but a dusty cream-tan rather than white, streaked where dust and rain ran down it, sand
    blown up against the lowest courses and grimed where it meets the ground. Reads `hb`, height over
    the tomb's foot, off the mesh. Look choices throughout.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    joint, stone_tone = _face_bricks(t, geo, 0.52, 1.25, 0.018)
    col = t.ramp(stone_tone, [(0.0, hexlin("c4b495")), (0.3, hexlin("cdbfa2")), (0.6, hexlin("bfae8f")),
                              (1.0, hexlin("d2c6ab"))])
    col = t.mix(1.0, col, t.ramp(t.noise(pos, 0.15, 3.0), [(0.3, hexlin("d9cfbd")), (0.7, hexlin("ffffff"))]), "MULTIPLY")
    # photograph grain in world metres, faint
    size = TEX["core"]["tile_m"][0]
    mp = t.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / size, 1 / size, 1 / size)
    t.link(pos, mp.inputs["Vector"])
    diff = t.node("ShaderNodeTexImage", image=image("core", "Diffuse"), projection="BOX", projection_blend=0.3)
    t.link(mp.outputs[0], diff.inputs["Vector"])
    bw = t.node("ShaderNodeRGBToBW")
    t.link(diff.outputs["Color"], bw.inputs[0])
    col = t.mix(1.0, col, t.grey(t.math("ADD", t.math("MULTIPLY", bw.outputs[0], 0.9), 0.65)), "MULTIPLY")
    # streaks down the faces
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    sv = t.node("ShaderNodeCombineXYZ")
    t.link(t.math("MULTIPLY", t.math("ADD", sep.outputs["X"], sep.outputs["Y"]), 1.3), sv.inputs[0])
    t.link(t.math("MULTIPLY", sep.outputs["Z"], 0.08), sv.inputs[1])
    streak = t.band(t.noise(sv.outputs[0], 1.0, 4.0, 0.6), 0.52, 0.78)
    col = t.mix(t.math("MULTIPLY", streak, 0.3), col, hexlin("9c8a6c"))
    hb = _mesh_attr(t, "hb")
    foot = t.math("SUBTRACT", 1.0, t.band(hb, 0.0, 1.6))
    col = t.mix(t.math("MULTIPLY", foot, 0.55), col, hexlin("b79d74"))
    col = t.mix(t.math("MULTIPLY", joint, 0.35), col, hexlin("8a7a60"))
    col = _contact(t, col, bsdf, reach=1.2, dirt="8a7658", amount=0.5, arris=0.02)
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.78
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.4
    bmp.inputs["Distance"].default_value = 0.02
    t.link(t.math("ADD", t.math("MULTIPLY", joint, -1.0), t.math("MULTIPLY", t.noise(pos, 1.5, 3.0), 0.4)), bmp.inputs["Height"])
    t.link(bsdf.inputs["Normal"].links[0].from_socket, bmp.inputs["Normal"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
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


# The valley's fields (as built and in 1800) are laid out by render/giza/fields.py: the canals, the dykes
# and the holdings, read here from its map. Each holding is sown in strips along its length, each strip
# a crop at its own stage (look choices): green, ripening, cut to stubble, fallow, freshly turned, or
# still dark from its watering; about a holding in four is one crop from dyke to dyke.
CROPS = [(0.0, "4a5f30"), (0.09, "5d7236"), (0.18, "6e7f3e"), (0.26, "53682e"), (0.33, "86884a"), (0.41, "a19a5e"),
         (0.49, "bba977"), (0.56, "a89373"), (0.63, "8e7a5c"), (0.7, "6c5a44"), (0.77, "59553f"), (0.83, "637436"),
         (0.91, "c2b38a")]
# how rough each stage is, on the same key: the watered strips hold a film of water that takes the sky
CROP_ROUGH = [(0.0, 0.85), (0.63, 0.95), (0.77, 0.35), (0.83, 0.85), (0.91, 0.95)]
FIELD_COLOURS = dict(dyke="a8946f", dyke_grass="7f7f4a", bund="927f5c", bank="8c8360", bank_grass="66713d", canal="2b3124")


def _field_patchwork(t, pos):
    """The fields at `pos`: (colour, roughness, height in metres over the valley floor)."""
    from . import fields
    img = bpy.data.images.load(fields.map_path(REPO), check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    img.alpha_mode = "NONE"
    u0, v0, nu, nv = fields.frame()
    P = fields.PIXEL
    turn = t.node("ShaderNodeMapping")
    turn.inputs["Rotation"].default_value = (0.0, 0.0, -math.radians(fields.ANGLE))
    t.link(pos, turn.inputs["Vector"])
    uv = turn.outputs[0]
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(uv, sep.inputs[0])
    U, V = sep.outputs["X"], sep.outputs["Y"]
    # the map read through fields.warp, so the canals bend a little
    warped = []
    for terms, w in ((fields.WARP_U, U), (fields.WARP_V, V)):
        for amp, wl, a, b, ph in terms:
            arg = t.math("ADD", t.math("MULTIPLY", t.math("ADD", t.math("MULTIPLY", U, a), t.math("MULTIPLY", V, b)), 2 * math.pi / wl), ph)
            w = t.math("ADD", w, t.math("MULTIPLY", t.math("SINE", arg), amp))
        warped.append(w)
    Uw, Vw = warped
    wv = t.node("ShaderNodeCombineXYZ")
    t.link(Uw, wv.inputs[0])
    t.link(Vw, wv.inputs[1])
    uv = wv.outputs[0]
    U, V = Uw, Vw

    def lookup(shift, interp):
        # shift 0: a cell of the map per texel; shift 0.5: the map's lattice points at the texels' centres
        mp = t.node("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1.0 / (P * nu), 1.0 / (P * nv), 1.0)
        mp.inputs["Location"].default_value = ((shift - u0 / P) / nu, (shift - v0 / P) / nv, 0.0)
        t.link(uv, mp.inputs["Vector"])
        im = t.node("ShaderNodeTexImage", image=img, interpolation=interp, extension="REPEAT")
        t.link(mp.outputs[0], im.inputs["Vector"])
        sc = t.node("ShaderNodeSeparateColor")
        t.link(im.outputs["Color"], sc.inputs[0])
        return sc.outputs

    def white(a, b, c, out="Value"):
        v = t.node("ShaderNodeCombineXYZ")
        for i, s in enumerate((a, b, c)):
            t._feed(v.inputs[i], s)
        wn = t.node("ShaderNodeTexWhiteNoise")
        t.link(v.outputs[0], wn.inputs["Vector"])
        return wn.outputs[out]

    cell, lattice = lookup(0.0, "Closest"), lookup(0.5, "Linear")
    k = t.math("ROUND", t.math("MULTIPLY", cell[0], 255.0))
    d_hold = t.math("MULTIPLY", lattice[1], 255.0 * fields.G_STEP)
    d_canal = t.math("MULTIPLY", lattice[2], 255.0 * fields.B_STEP)
    down = t.math("MODULO", k, 2.0)
    s = t.math("ADD", V, t.math("MULTIPLY", down, t.math("SUBTRACT", U, V)))       # across the strips
    r = t.node("ShaderNodeSeparateColor")
    t.link(white(k, 0.37, 0.0, "Color"), r.inputs[0])
    width = t.math("ADD", 8.0, t.math("MULTIPLY", r.outputs[0], 24.0))
    sw = t.math("ADD", t.math("DIVIDE", s, width), r.outputs[1])
    n = t.math("FLOOR", sw)
    f = t.math("SUBTRACT", sw, n)
    q = white(n, k, 3.1)
    one = t.math("LESS_THAN", r.outputs[2], 0.27)
    q = t.math("ADD", q, t.math("MULTIPLY", one, t.math("SUBTRACT", white(k, 5.3, 1.7), q)))
    col = t.ramp(q, [(p, hexlin(c)) for p, c in CROPS], "CONSTANT")
    rough = t.ramp(q, [(p, (g, g, g, 1.0)) for p, g in CROP_ROUGH], "CONSTANT")
    # within a strip: uneven growth over a few metres, a strip a shade off the next, the sown rows
    growth = t.ramp(t.noise(pos, 0.07, 3.0, 0.6), [(0.3, (0.8, 0.8, 0.8, 1.0)), (0.7, (1.08, 1.08, 1.08, 1.0))])
    col = t.mix(1.0, col, growth, "MULTIPLY")
    col = t.mix(1.0, col, t.grey(t.math("ADD", 0.9, t.math("MULTIPLY", white(n, k, 9.0), 0.2))), "MULTIPLY")
    rows = t.math("ADD", 0.95, t.math("MULTIPLY", t.math("SINE", t.math("MULTIPLY", s, 2 * math.pi / 0.8)), 0.06))
    col = t.mix(1.0, col, t.grey(rows), "MULTIPLY")
    # the low bunds between strips, the dykes between holdings, the canals round the basins with their banks
    bund = t.band(t.math("MULTIPLY", t.math("MINIMUM", f, t.math("SUBTRACT", 1.0, f)), width), 0.4, 0.15)
    col = t.mix(t.math("MULTIPLY", bund, 0.65), col, hexlin(FIELD_COLOURS["bund"]))
    dyke = t.band(d_hold, 1.25, 0.75)
    grassy = t.band(t.noise(pos, 0.25, 3.0), 0.4, 0.6)
    col = t.mix(dyke, col, t.mix(grassy, hexlin(FIELD_COLOURS["dyke"]), hexlin(FIELD_COLOURS["dyke_grass"])))
    wet = t.band(d_canal, fields.CANAL + 0.2, fields.CANAL - 0.2)
    bank = t.math("MULTIPLY", t.band(d_canal, fields.CANAL + 4.5, fields.CANAL + 3.5), t.math("SUBTRACT", 1.0, wet))
    col = t.mix(bank, col, t.mix(grassy, hexlin(FIELD_COLOURS["bank"]), hexlin(FIELD_COLOURS["bank_grass"])))
    col = t.mix(wet, col, hexlin(FIELD_COLOURS["canal"]))
    rough = t.math("ADD", t.math("MULTIPLY", rough, t.math("SUBTRACT", 1.0, t.math("MAXIMUM", dyke, bank))),
                   t.math("MULTIPLY", t.math("MAXIMUM", dyke, bank), 0.95))
    rough = t.math("ADD", t.math("MULTIPLY", rough, t.math("SUBTRACT", 1.0, wet)), t.math("MULTIPLY", wet, 0.06))
    height = t.math("ADD", t.math("MULTIPLY", t.band(d_hold, 1.8, 0.3), 0.35), t.math("MULTIPLY", bund, 0.08))
    height = t.math("ADD", height, t.math("MULTIPLY", t.band(d_canal, fields.CANAL + 5.0, fields.CANAL + 2.0), 0.5))
    height = t.math("SUBTRACT", height, t.math("MULTIPLY", t.band(d_canal, fields.CANAL + 1.2, fields.CANAL - 0.8), 1.3))
    return col, rough, height


# The desert's surface at the scales the cameras see it (look choices, after the plateau from the air and on
# foot): bedrock pavement with its joints open, stones strewn everywhere and thickest on the gravel, wind
# ripples in the sand sheets, and a relief of hummocks and swales for a low sun to model.
DESERT = dict(rock="d3c7ae", crack="9a8a6f", stones=[(0.0, "7f6d57"), (0.35, "9a886c"), (0.65, "b5a585"), (0.88, "cbbfa4")],
              pebbles=[(0.0, "8f7e64"), (0.45, "a89679"), (0.8, "c4b597")],
              boulders=[(0.0, "6f604d"), (0.4, "8d7a60"), (0.75, "b3a283")], patch="b89f7c", stony="a8927a", clean="f0e6d3",
              trodden="e0cba8", verge="ae987a", lip="e9dfcb", scree="a48f70")
STRATA = 1.7                # metres of height a bed (look choice)
# Past this far from the camera (metres), the land towards the horizon takes more and more of the sky's own
# light in a mirror, as a desert does in the heat, until at the horizon it is the sky: the plain's hard edge
# against the haze read as a painted wall from the air (critic round 15). The haze's slabs end at 30 km,
# so beyond that this is the only air there is.
MIRAGE = (3000.0, 40000.0, 0.6)


def _tracks(t, pos, state):
    """The era's tracks at `pos`: (on a strand, 0..1; just beside one, 0..1), or (None, None) where it has none."""
    from . import tracks
    path = tracks.map_path(REPO, state)
    if path is None:
        return None, None
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    img.alpha_mode = "NONE"
    x0, x1, y0, y1 = tracks.BOX
    mp = t.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0 / (x1 - x0), 1.0 / (y1 - y0), 1.0)
    mp.inputs["Location"].default_value = (-x0 / (x1 - x0), -y0 / (y1 - y0), 0.0)
    t.link(pos, mp.inputs["Vector"])
    im = t.node("ShaderNodeTexImage", image=img, interpolation="Linear", extension="CLIP")
    t.link(mp.outputs[0], im.inputs["Vector"])
    sc = t.node("ShaderNodeSeparateColor")
    t.link(im.outputs["Color"], sc.inputs[0])
    d = t.math("MULTIPLY", t.math("SUBTRACT", 1.0, sc.outputs[0]), 255.0 * tracks.STEP)
    # a ragged edge: the distance nudged by a noise
    d = t.math("ADD", d, t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.6, 3.0), 0.5), 1.2))
    trod = t.band(d, 0.6, 0.0)
    verge = t.math("MULTIPLY", t.band(d, 2.2, 0.9), t.math("SUBTRACT", 1.0, trod))
    return trod, verge


def _town(t, pos, state, margin):
    """1 inside the builders' town (as built), falling to 0 over `margin` metres outside it."""
    from . import town
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    X, Y = sep.outputs["X"], sep.outputs["Y"]
    inside = 0.0
    for x0, x1, y0, y1 in town.extents(state):
        box = t.math("MULTIPLY", t.math("MULTIPLY", t.band(X, x0 - margin, x0), t.math("SUBTRACT", 1.0, t.band(X, x1, x1 + margin))),
                     t.math("MULTIPLY", t.band(Y, y0 - margin, y0), t.math("SUBTRACT", 1.0, t.band(Y, y1, y1 + margin))))
        inside = t.math("MAXIMUM", inside, box)
    return inside


def ground(state, displace=False):
    """
    The plateau's ground: packed beige sand, gravel patches and white limestone chips,
    varied at three scales. Below the plateau's foot the valley floor is cultivation in
    the ancient states and the town's dust today. With `displace`, the height maps move
    the surface for real (outward only, so a lifted patch always covers the grid under it).
    """
    S = states.spec(state)
    sand_hex, grav_hex, chip_hex, grav_band = GROUND[S["ground"]]
    arid = S["ground"] in ("desert", "sand")
    mat = bpy.data.materials.new("ground" + (" displaced" if displace else ""))
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    # The photographs twice over, the second turned and scaled, blended by a noise, so no tile repeats in view.
    blend = t.band(t.noise(pos, 0.11, 3.0), 0.42, 0.58)

    def sampled(role, kind, noncolor=False):
        sz = TEX[role]["tile_m"][0]
        got = []
        for turn, k, off in ((0.0, 1.0, 0.0), (0.64, 1.37, 0.31)):
            mp = t.node("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (1 / (sz * k), 1 / (sz * k), 1 / (sz * k))
            mp.inputs["Rotation"].default_value = (0.0, 0.0, turn)
            mp.inputs["Location"].default_value = (off, off * 0.55, 0.0)
            t.link(pos, mp.inputs["Vector"])
            im = t.node("ShaderNodeTexImage", image=image(role, kind, noncolor))
            t.link(mp.outputs[0], im.inputs["Vector"])
            got.append(im.outputs["Color"])
        return t.mix(blend, got[0], got[1])

    def lum(sock):
        bw = t.node("ShaderNodeRGBToBW")
        t.link(sock, bw.inputs[0])
        return bw.outputs[0]

    sand_l, grav_l = lum(sampled("sand", "Diffuse")), lum(sampled("gravel", "Diffuse"))
    sand_h, grav_h = sampled("sand", "Displacement", True), sampled("gravel", "Displacement", True)
    if arid:
        # the gravel sheets' edges ragged and fairly sharp, not a soft blotch
        gn = t.math("ADD", t.noise(pos, 0.018, 6.0, 0.62), t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.2, 3.0, 0.6), 0.5), 0.1))
        mid = 0.5 * (grav_band[0] + grav_band[1])
        m_grav = t.band(gn, mid - 0.05, mid + 0.05)
        m_chip = t.band(t.noise(pos, 0.05, 5.0, 0.6), 0.59, 0.65)
    else:
        m_grav = t.band(t.noise(pos, 0.018, 6.0, 0.62), *grav_band)
        m_chip = t.band(t.noise(pos, 0.05, 5.0, 0.6), 0.56, 0.68)
    grain = t.math("ADD", t.math("MULTIPLY", sand_l, t.math("SUBTRACT", 1.0, m_grav)), t.math("MULTIPLY", grav_l, m_grav))
    grain = t.math("ADD", t.math("MULTIPLY", grain, 1.35), 0.42)
    # (arid: the gravel's own colour at a little over half, its photograph and stones carrying the rest, since
    # from the air its full colour read as blotches, critic round 15)
    col = t.mix(t.math("MULTIPLY", m_grav, 0.45) if arid else m_grav, hexlin(sand_hex), hexlin(grav_hex))
    col = t.mix(t.math("MULTIPLY", m_chip, 0.55), col, hexlin(chip_hex))
    col = t.mix(0.5 if arid else 1.0, col, t.ramp(t.noise(pos, 0.0025, 3.0), [(0.3, hexlin("e3d2b8")), (0.5, hexlin("ffffff")), (0.72, hexlin("f4eadb"))]), "MULTIPLY")
    if arid:
        # a mottle with detail from tens of metres down to the metre, where a soft blotch read as smeared sand
        # (critic round 15): the stonier ground a shade darker, in patches with ragged edges
        col = t.mix(1.0, col, t.ramp(t.noise(pos, 0.055, 7.0, 0.7), [(0.36, hexlin("ddd0bb")), (0.6, hexlin("ffffff"))]), "MULTIPLY")
        # and a grain of stonier and cleaner spots a couple of metres across, which is what the desert is from the air
        for k, amt in ((0.18, 0.4), (0.45, 0.35)):
            spots = t.noise(pos, k, 6.0, 0.7)
            col = t.mix(t.math("MULTIPLY", t.band(spots, 0.6, 0.66), amt), col, hexlin(DESERT["stony"]))
            col = t.mix(t.math("MULTIPLY", t.band(spots, 0.38, 0.33), amt * 0.85), col, hexlin(DESERT["clean"]))
    else:
        col = t.mix(1.0, col, t.ramp(t.noise(pos, 0.09, 4.0), [(0.35, hexlin("d8ccba")), (0.65, hexlin("ffffff"))]), "MULTIPLY")
    # From the air the desert is streaked along the wind, which comes from the north-north-west, and
    # patched with darker gravel sheets; both are look choices, made so a flight over it is not a blur.
    wind = t.node("ShaderNodeMapping")
    wind.inputs["Rotation"].default_value = (0.0, 0.0, 0.35)          # about 20 degrees west of north
    wind.inputs["Scale"].default_value = (0.016, 0.0016, 1.0)         # 60 m across a streak, 600 m along it
    t.link(pos, wind.inputs["Vector"])
    streak = t.node("ShaderNodeTexNoise")
    streak.inputs["Scale"].default_value = 1.0
    streak.inputs["Detail"].default_value = 3.0
    streak.inputs["Roughness"].default_value = 0.55
    t.link(wind.outputs[0], streak.inputs["Vector"])
    col = t.mix(1.0, col, t.ramp(streak.outputs["Fac"], [(0.3, hexlin("ebdfcb")), (0.55, hexlin("ffffff")), (0.75, hexlin("fffaf0"))]), "MULTIPLY")
    sheet = t.band(t.noise(pos, 0.0012, 4.0, 0.6), 0.56, 0.66)
    # (softened after critic round 4, 2026-09-26: at 0.45 the sheets read as muddy blotches from the air)
    col = t.mix(t.math("MULTIPLY", sheet, 0.14 if arid else 0.28), col, hexlin(grav_hex))
    col = t.mix(1.0, col, t.grey(grain), "MULTIPLY")
    tex_h = t.mix(m_grav, sand_h, grav_h)
    if arid:
        flat = t.node("ShaderNodeMapping")
        flat.inputs["Scale"].default_value = (1.0, 1.0, 0.0)
        t.link(pos, flat.inputs["Vector"])
        # bedrock pavement where the sand is thin, its joints a few metres apart
        rockn = t.math("ADD", t.noise(pos, 0.0075, 5.0, 0.62), t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.12, 4.0, 0.6), 0.5), 0.12))
        m_rock = t.math("MULTIPLY", t.band(rockn, 0.64, 0.67), t.math("SUBTRACT", 1.0, t.math("MULTIPLY", m_grav, 0.6)))
        joints = t.node("ShaderNodeTexVoronoi", voronoi_dimensions="2D", feature="DISTANCE_TO_EDGE")
        joints.inputs["Scale"].default_value = 0.33
        t.link(flat.outputs[0], joints.inputs["Vector"])
        crack = t.band(joints.outputs["Distance"], 0.04, 0.012)
        col = t.mix(t.math("MULTIPLY", m_rock, 0.5), col, t.mix(t.math("MULTIPLY", crack, 0.6), hexlin(DESERT["rock"]), hexlin(DESERT["crack"])))

        def strewn(scale, share, size, palette):
            # a stone in some cells of a 1/scale-metre lattice, each its own size and colour, its outline
            # knocked out of round by a noise and the stones gathered in drifts rather than spread evenly
            knock = t.node("ShaderNodeTexNoise")
            knock.inputs["Scale"].default_value = scale * 2.5
            knock.inputs["Detail"].default_value = 2.0
            t.link(flat.outputs[0], knock.inputs["Vector"])
            jag = t.node("ShaderNodeVectorMath", operation="MULTIPLY_ADD")
            t.link(knock.outputs["Color"], jag.inputs[0])
            jag.inputs[1].default_value = (0.3 / scale, 0.3 / scale, 0.0)
            t.link(flat.outputs[0], jag.inputs[2])
            vor = t.node("ShaderNodeTexVoronoi", voronoi_dimensions="2D")
            vor.inputs["Scale"].default_value = scale
            t.link(jag.outputs[0], vor.inputs["Vector"])
            vr = t.node("ShaderNodeSeparateColor")
            t.link(vor.outputs["Color"], vr.inputs[0])
            drifts = t.math("ADD", 0.2, t.math("MULTIPLY", t.band(t.noise(pos, scale * 0.07, 3.0), 0.35, 0.65), 1.6))
            has = t.math("LESS_THAN", vr.outputs[0], t.math("MULTIPLY", share, drifts))
            r = t.math("MULTIPLY", t.math("ADD", 0.35, vr.outputs[2]), size)
            stone = t.math("MULTIPLY", has, t.math("SUBTRACT", 1.0, t.math("DIVIDE", vor.outputs["Distance"], r), clamp=True))
            return stone, t.ramp(vr.outputs[1], [(p, hexlin(c)) for p, c in palette], "CONSTANT")

        # stones in one metre-and-a-bit cell in eight, more on the gravel; pebbles in a third of 20 cm cells
        stone, stone_col = strewn(0.9, t.math("ADD", 0.08, t.math("MULTIPLY", m_grav, 0.22)), 0.22, DESERT["stones"])
        pebble, pebble_col = strewn(5.0, t.math("ADD", 0.14, t.math("MULTIPLY", m_grav, 0.4)), 0.3, DESERT["pebbles"])
        # The limestone's beds: wherever the ground slopes, a ledge every STRATA metres of height, its lip
        # pale and the scree under it darker, wandering off the contour a little. From the air they are
        # what makes the plateau worn rock rather than a painted sheet.
        zsep = t.node("ShaderNodeSeparateXYZ")
        t.link(pos, zsep.inputs[0])
        nsep = t.node("ShaderNodeSeparateXYZ")
        t.link(geo.outputs["True Normal"], nsep.inputs[0])
        sloped = t.band(t.math("SUBTRACT", 1.0, nsep.outputs["Z"]), 0.004, 0.03)
        wander = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.02, 3.0), 0.5), STRATA * 0.9),
                        t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.004, 2.0), 0.5), STRATA * 2.5))
        zb = t.math("DIVIDE", t.math("ADD", zsep.outputs["Z"], wander), STRATA)
        fz = t.math("FRACT", zb)
        lip = t.math("MULTIPLY", t.band(fz, 0.72, 0.95), t.band(fz, 1.0, 0.95))
        scree = t.band(fz, 0.35, 0.03)
        broken = t.band(t.noise(pos, 0.035, 4.0), 0.5, 0.62)
        lip = t.math("MULTIPLY", t.math("MULTIPLY", lip, sloped), broken)
        scree = t.math("MULTIPLY", t.math("MULTIPLY", scree, sloped), broken)
        col = t.mix(t.math("MULTIPLY", scree, 0.2), col, hexlin(DESERT["scree"]))
        col = t.mix(t.math("MULTIPLY", lip, 0.3), col, hexlin(DESERT["lip"]))
        # the tracks (render/giza/tracks.py): trodden paler and cleared of stones, the stones kicked to their sides
        trod, verge = _tracks(t, pos, state)
        if trod is not None:
            clear = t.math("SUBTRACT", 1.0, trod)
            stone, pebble = t.math("MULTIPLY", stone, clear), t.math("MULTIPLY", pebble, clear)
            col = t.mix(t.math("MULTIPLY", verge, 0.2), col, hexlin(DESERT["verge"]))
            col = t.mix(t.math("MULTIPLY", trod, 0.4), col, hexlin(DESERT["trodden"]))
        # and boulders a metre or so across, one in eight of 8 m cells: from the air the desert's grain
        boulder, boulder_col = strewn(0.12, t.math("ADD", 0.1, t.math("MULTIPLY", m_rock, 0.3)), 0.11, DESERT["boulders"])
        # (painted, they read as flat discs close to: gone within a few tens of metres of the camera, where the
        # stones are instanced rocks, scatter.stones)
        eye = t.node("ShaderNodeCameraData")
        boulder = t.math("MULTIPLY", boulder, t.band(eye.outputs["View Distance"], 40.0, 90.0))
        stone = t.math("MULTIPLY", stone, t.band(eye.outputs["View Distance"], 10.0, 25.0))
        # patches of darker, stonier ground with crisp edges, ten to forty metres across
        crisp = t.band(t.math("ADD", t.noise(pos, 0.09, 6.0, 0.62), t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.5, 3.0), 0.5), 0.06)), 0.6, 0.615)
        col = t.mix(t.math("MULTIPLY", crisp, 0.2), col, hexlin(DESERT["patch"]))
        col = t.mix(t.band(pebble, 0.0, 0.15), col, pebble_col)
        col = t.mix(t.band(stone, 0.0, 0.1), col, stone_col)
        col = t.mix(t.band(boulder, 0.0, 0.08), col, boulder_col)
        # wind ripples a hand's breadth apart in the sand sheets, crests across the wind
        rip = t.node("ShaderNodeMapping")
        rip.inputs["Rotation"].default_value = (0.0, 0.0, 0.35)
        t.link(pos, rip.inputs["Vector"])
        wave = t.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="Y")
        wave.inputs["Scale"].default_value = 2.6
        wave.inputs["Distortion"].default_value = 6.0
        wave.inputs["Detail"].default_value = 3.0
        wave.inputs["Detail Scale"].default_value = 0.35
        t.link(rip.outputs[0], wave.inputs["Vector"])
        # (the crests fade in and out along their length, as real ones break and join)
        # (none on the tracks nor in the town's streets, which are trodden flat)
        busy = _town(t, pos, state, 2.0)
        if trod is not None:
            busy = t.math("MAXIMUM", busy, t.band(t.math("ADD", trod, verge), 0.0, 0.5))
        sandy = t.math("MULTIPLY", t.math("MULTIPLY", t.math("SUBTRACT", 1.0, m_grav), t.math("SUBTRACT", 1.0, t.math("MAXIMUM", m_rock, busy))),
                       t.math("MULTIPLY", t.band(t.noise(pos, 0.03, 3.0), 0.45, 0.58), t.band(t.noise(pos, 0.9, 2.0), 0.3, 0.6)))
        h_near = t.math("ADD", t.math("MULTIPLY", tex_h, 0.03), t.math("MULTIPLY", t.math("MULTIPLY", wave.outputs["Fac"], sandy), 0.012))
        h_near = t.math("ADD", h_near, t.math("MULTIPLY", t.math("SQRT", pebble), 0.015))
        h_near = t.math("ADD", h_near, t.math("MULTIPLY", t.math("SQRT", stone), 0.06))
        h = t.math("ADD", h_near, t.math("SUBTRACT", t.math("MULTIPLY", lip, 0.25), t.math("MULTIPLY", scree, 0.1)))
        h = t.math("ADD", h, t.math("MULTIPLY", t.math("SQRT", boulder), 0.5))
        h = t.math("ADD", h, t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.45, 4.0, 0.55), 0.5), 0.09))
        h = t.math("ADD", h, t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.18, 4.0, 0.55), 0.5), 0.3))
        h = t.math("ADD", h, t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.035, 4.0, 0.5), 0.5), 0.7))
        h = t.math("ADD", h, t.math("MULTIPLY", m_rock, t.math("SUBTRACT", 0.12, t.math("MULTIPLY", crack, 0.06))))
    else:
        h_near = t.math("MULTIPLY", tex_h, 0.12)
        h = tex_h
    rough = 0.95
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    # The valley floor: low ground east of the valley temples (x > 430 m), not the Sphinx's ditch.
    if S["valley"] == "fields":
        # the fields stop where the ground starts to rise, abruptly, the edge wandering a metre of height
        # (tens of metres along it) and fraying at a few metres
        fray = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.03, 4.0, 0.6), 0.5), 2.8),
                      t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.3, 2.0), 0.5), 0.7))
        from . import fields
        valley = t.math("MULTIPLY", t.band(t.math("ADD", sep.outputs["Z"], fray), fields.EDGE + 0.3, fields.EDGE - 0.3),
                        t.band(sep.outputs["X"], 430.0, 520.0))
    else:
        # the edge of the cultivation wanders and frays over a few metres of height and tens along it,
        # rather than following one contour like a knife cut
        fray = t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.02, 4.0, 0.6), 0.5), 5.0)
        valley = t.math("MULTIPLY", t.band(t.math("ADD", t.math("MULTIPLY", sep.outputs["Z"], -1.0), fray), 25.0, 32.0),
                        t.band(sep.outputs["X"], 430.0, 520.0))
    # Where the builders' town stands (as built), its streets are packed earth, not the valley's fields.
    valley = t.math("MULTIPLY", valley, t.math("SUBTRACT", 1.0, _town(t, pos, state, 12.0)))
    fields_ = t.noise(pos, 0.006, 3.0)
    vcol = t.ramp(fields_, [(p, hexlin(c)) for p, c in VALLEY[S["valley"]]])
    if S["valley"] == "fields":
        vcol, vrough, vh = _field_patchwork(t, pos)
        rough = t.math("ADD", t.math("MULTIPLY", valley, vrough), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, valley), 0.95))
        h = t.math("ADD", h, t.math("MULTIPLY", valley, vh))
    col = t.mix(valley, col, vcol)
    from . import water as water_
    level = water_.LEVELS.get(S["water"] or "", (None,))[0]
    if level is not None and arid:
        # the ground a hand's breadth over the water darkened and glossed by it, so a shore reads as one
        wet = t.band(sep.outputs["Z"], level + 0.45, level + 0.05)
        col = t.mix(t.math("MULTIPLY", wet, 0.6), col, hexlin("4a4632"))
        rough = t.math("SUBTRACT", rough, t.math("MULTIPLY", wet, 0.45)) if not isinstance(rough, float) else \
            t.math("SUBTRACT", rough, t.math("MULTIPLY", wet, 0.45))
    t.link(col, bsdf.inputs["Base Color"])
    t._feed(bsdf.inputs["Roughness"], rough)
    bmp = t.node("ShaderNodeBump")
    if arid:
        bmp.inputs["Strength"].default_value = 1.0
        bmp.inputs["Distance"].default_value = 1.0
    else:
        bmp.inputs["Strength"].default_value = 0.45
        bmp.inputs["Distance"].default_value = 0.06
    t.link(h, bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    # towards the horizon, the plain mirrors the sky (MIRAGE)
    cam = t.node("ShaderNodeCameraData")
    far = t.math("POWER", t.band(cam.outputs["View Distance"], MIRAGE[0], MIRAGE[1]), MIRAGE[2])
    try:
        mirror = t.node("ShaderNodeBsdfGlossy")
    except RuntimeError:
        mirror = t.node("ShaderNodeBsdfAnisotropic")
    mirror.inputs["Roughness"].default_value = 0.0
    mirror.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    both = t.node("ShaderNodeMixShader")
    t.link(far, both.inputs["Fac"])
    t.link(bsdf.outputs[0], both.inputs[1])
    t.link(mirror.outputs[0], both.inputs[2])
    t.link(both.outputs[0], out.inputs["Surface"])
    if displace:
        dn = t.node("ShaderNodeDisplacement")
        dn.inputs["Midlevel"].default_value = 0.0
        dn.inputs["Scale"].default_value = 1.0
        t.link(h_near, dn.inputs["Height"])
        t.link(dn.outputs["Displacement"], out.inputs["Displacement"])
        mat.displacement_method = "BOTH"
    return mat

