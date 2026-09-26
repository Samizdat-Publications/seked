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


def polished_casing(name="pristine casing"):
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
    # slabs of one size in perfect courses, the joints a ruled line: from afar a faint grid, the mark
    # of an engineered surface rather than a laid one
    joint, stone = _face_bricks(t, geo, 1.4, 2.8, 0.022)
    shade = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", stone, 0.5), 0.05), 1.0)
    col = t.mix(1.0, col, t.grey(shade), "MULTIPLY")
    col = t.mix(t.math("MULTIPLY", joint, 0.55), col, hexlin("7d7568"))
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
    col, normal = _broad(t, pos, col, bmp.outputs["Normal"], amount=0.05, undulation=0.3, foot=_mesh_attr(t, "hb"),
                         foot_hex="6f6a4e")
    t.link(col, bsdf.inputs["Base Color"])
    t.link(normal, bsdf.inputs["Normal"])
    t.link(normal, bsdf.inputs["Coat Normal"])
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


def dressed_blocks(name, stops_hex, rough=0.4, speckle=True):
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
    col = _contact(t, col, bsdf, reach=1.5, amount=0.8)
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    return mat


def weathered_casing(name="weathered casing"):
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
    joint, stone = _face_bricks(t, geo, 1.4, 2.8, 0.03)
    shade = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", stone, 0.5), 0.1), 1.0)
    col = t.mix(1.0, col, t.grey(shade), "MULTIPLY")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    nsep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nsep.inputs[0])
    ew = t.math("GREATER_THAN", t.math("ABSOLUTE", nsep.outputs["X"]), t.math("ABSOLUTE", nsep.outputs["Y"]))
    run = t.math("ADD", t.math("MULTIPLY", ew, sep.outputs["Y"]), t.math("MULTIPLY", t.math("SUBTRACT", 1.0, ew), sep.outputs["X"]))
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

    wash = t.math("MULTIPLY", stripes(run, 0.035, 0.48, 0.72, 3.0), begins(0.01, 11.0, 30.0, 110.0, 40.0))
    col = t.mix(t.math("MULTIPLY", wash, 0.55), col, hexlin("8a887a"))
    runs = t.math("MULTIPLY", stripes(waver, 0.3, 0.56, 0.78, 17.0), begins(0.06, 23.0, 10.0, 130.0, 25.0))
    col = t.mix(t.math("MULTIPLY", runs, 0.65), col, hexlin("686b5d"))
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
    col, normal = _broad(t, pos, col, bmp.outputs["Normal"], amount=0.07, undulation=0.3, foot=hb, foot_hex="5a5443")
    t.link(col, bsdf.inputs["Base Color"])
    t.link(normal, bsdf.inputs["Normal"])
    return mat


def metal(name, rgb_hex, rough, metallic=0.8, dent=0.2):
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
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = dent
    bmp.inputs["Distance"].default_value = 0.05
    height = t.math("ADD", dents.outputs["Distance"], t.math("MULTIPLY", leaf, 0.3))
    t.link(height, bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def water(name="water"):
    """
    Open water: the inundation carried silt, so a muddy brown seen from above, glossy, the
    sky in it towards the horizon, rippled by a slow wind.
    """
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = hexlin("5a5236")
    bsdf.inputs["Roughness"].default_value = 0.03
    bsdf.inputs["IOR"].default_value = 1.33
    geo = t.node("ShaderNodeNewGeometry")
    ripple_space = t.node("ShaderNodeMapping")
    ripple_space.inputs["Scale"].default_value = (1.0, 2.2, 1.0)
    t.link(geo.outputs["Position"], ripple_space.inputs["Vector"])
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.06
    bmp.inputs["Distance"].default_value = 0.05
    t.link(t.noise(ripple_space.outputs[0], 0.35, 5.0, 0.6), bmp.inputs["Height"])
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


def dark(name="dark mouth"):
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (0.01, 0.008, 0.006, 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    return mat


# The valley's fields as seen from the plateau and the air (look choices): basins about FIELD_M
# metres long and FIELD_W wide in rows along the canals, turned FIELD_ANGLE degrees off north like the
# palm rows, warped so no dyke runs dead straight for long; each sown, ripening, fallow or freshly
# turned, with the dykes and ditches between them drawn a darker green.
FIELD_M, FIELD_W, FIELD_ANGLE = 95.0, 38.0, -8.0
CROPS = [(0.0, "3f5b23"), (0.16, "567630"), (0.3, "6f8436"), (0.42, "8c9446"), (0.52, "a89c5e"), (0.6, "7a6848"),
         (0.68, "5e4d36"), (0.78, "4a6a29"), (0.9, "65803a"), (1.0, "93994f")]


def _field_patchwork(t, pos, under):
    """Mix a patchwork of fields over the valley's colour `under`, which still shows through a little."""
    warp = t.node("ShaderNodeTexNoise")
    warp.inputs["Scale"].default_value = 0.004
    warp.inputs["Detail"].default_value = 2.0
    t.link(pos, warp.inputs["Vector"])
    off = t.node("ShaderNodeVectorMath", operation="MULTIPLY_ADD")
    t.link(warp.outputs["Color"], off.inputs[0])
    off.inputs[1].default_value = (22.0, 22.0, 0.0)
    t.link(pos, off.inputs[2])
    turn = t.node("ShaderNodeMapping")
    turn.inputs["Rotation"].default_value = (0.0, 0.0, math.radians(FIELD_ANGLE))
    t.link(off.outputs[0], turn.inputs["Vector"])
    cells = t.node("ShaderNodeTexBrick")
    cells.offset = 0.37
    cells.offset_frequency = 1
    cells.squash = 0.6
    cells.squash_frequency = 3
    cells.inputs["Scale"].default_value = 1.0
    cells.inputs["Mortar Size"].default_value = 2.2
    cells.inputs["Mortar Smooth"].default_value = 0.4
    cells.inputs["Bias"].default_value = 0.0
    cells.inputs["Brick Width"].default_value = FIELD_M
    cells.inputs["Row Height"].default_value = FIELD_W
    cells.inputs["Color1"].default_value = (0.0, 0.0, 0.0, 1.0)
    cells.inputs["Color2"].default_value = (1.0, 1.0, 1.0, 1.0)
    cells.inputs["Mortar"].default_value = (0.0, 0.0, 0.0, 1.0)
    t.link(turn.outputs[0], cells.inputs["Vector"])
    pick = t.node("ShaderNodeRGBToBW")
    t.link(cells.outputs["Color"], pick.inputs[0])
    crop = t.ramp(pick.outputs[0], [(p, hexlin(c)) for p, c in CROPS], "CONSTANT")
    # within a field, the sowing's rows and the soil's unevenness
    rows = t.node("ShaderNodeMapping")
    rows.inputs["Scale"].default_value = (0.9, 0.05, 1.0)
    t.link(pos, rows.inputs["Vector"])
    grain = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", t.noise(rows.outputs[0], 1.0, 2.0), 0.5), 0.18), 1.0)
    crop = t.mix(1.0, crop, t.grey(grain), "MULTIPLY")
    col = t.mix(0.8, under, crop)
    # the dykes a softer, narrower line than a map's outline (critic round 7: "flat green tiles with hard dark outlines")
    return t.mix(t.math("MULTIPLY", cells.outputs["Fac"], 0.45), col, hexlin("4a5634"))


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
    col = t.mix(1.0, col, t.ramp(t.noise(pos, 0.0025, 3.0), [(0.3, hexlin("e3d2b8")), (0.5, hexlin("ffffff")), (0.72, hexlin("f4eadb"))]), "MULTIPLY")
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
    col = t.mix(t.math("MULTIPLY", sheet, 0.28), col, hexlin(grav_hex))
    col = t.mix(1.0, col, t.grey(grain), "MULTIPLY")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    # The valley floor: low ground east of the valley temples (x > 430 m), not the Sphinx's ditch.
    # the edge of the cultivation wanders and frays over a few metres of height and tens along it,
    # rather than following one contour like a knife cut
    fray = t.math("MULTIPLY", t.math("SUBTRACT", t.noise(pos, 0.02, 4.0, 0.6), 0.5), 5.0)
    valley = t.math("MULTIPLY", t.band(t.math("ADD", t.math("MULTIPLY", sep.outputs["Z"], -1.0), fray), 25.0, 32.0),
                    t.band(sep.outputs["X"], 430.0, 520.0))
    # Where the builders' town stands (as built), its streets are packed earth, not the valley's fields.
    from . import town
    for x0, x1, y0, y1 in town.extents(state):
        inside = t.math("MULTIPLY", t.math("MULTIPLY", t.band(sep.outputs["X"], x0 - 12.0, x0), t.math("SUBTRACT", 1.0, t.band(sep.outputs["X"], x1, x1 + 12.0))),
                        t.math("MULTIPLY", t.band(sep.outputs["Y"], y0 - 12.0, y0), t.math("SUBTRACT", 1.0, t.band(sep.outputs["Y"], y1, y1 + 12.0))))
        valley = t.math("MULTIPLY", valley, t.math("SUBTRACT", 1.0, inside))
    fields = t.noise(pos, 0.006, 3.0)
    vcol = t.ramp(fields, [(p, hexlin(c)) for p, c in VALLEY[S["valley"]]])
    if S["valley"] == "fields":
        vcol = _field_patchwork(t, pos, vcol)
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
