"""
The Labyrinth at Hawara, laid on the Giza plateau for scale (night decision 26). bpy-free.

Petrie's figures come from data/measurements/hawara.json. The finished base and the height are
computed as he computed them (petrie-1890, p. 13), never stored, and @seked/geometry derives the
same keys for the page. Where the group is laid is a stated look choice, in LAYOUT: Hawara's
pyramid beside Khufu's south side, with the chip bed south of it as it lies at Hawara, so the
pair keep their own arrangement and Khufu stands beside them. Which way the chip bed's long side
runs is not on Petrie's page; it is drawn east-west until his Pl. XXV is read two ways.
"""
import math

from . import data

LAYOUT = dict(
    gap=20.0,              # metres between Khufu's south side and the Hawara pyramid's north side
    long_side="east-west",  # the chip bed's 1000 ft, until Pl. XXV says otherwise
    bed_gap=0.0,           # between the Hawara pyramid's south side and the chip bed's north edge
)


def figures():
    """Petrie's records, and what follows from them: sides and heights in metres."""
    rec = {r["key"]: float(r["value"]) for r in data.records("hawara.json")}
    side = rec["hawara.pyramid.base.side.brick"] + 2 * rec["hawara.pyramid.casing.thickness"]
    return dict(
        brick=rec["hawara.pyramid.base.side.brick"], side=side,
        height=side / 2 * math.tan(math.radians(rec["hawara.pyramid.casing.angle"])),
        angle=rec["hawara.pyramid.casing.angle"],
        bed_length=rec["hawara.labyrinth.chipbed.length"], bed_width=rec["hawara.labyrinth.chipbed.width"],
    )


def laid_on_giza(f=None, layout=LAYOUT):
    """Where the group stands in the Giza frame: the pyramid's centre and half side, and the chip bed's box."""
    f = f or figures()
    g1 = data.PYRAMIDS["g1"]
    half = f["side"] / 2
    cy = g1["cy"] - g1["half"] - layout["gap"] - half
    ex, ny = (f["bed_length"], f["bed_width"]) if layout["long_side"] == "east-west" else (f["bed_width"], f["bed_length"])
    top = cy - half - layout["bed_gap"]
    return dict(pyramid=dict(cx=g1["cx"], cy=cy, half=half, H=f["height"]),
                bed=(g1["cx"] - ex / 2, g1["cx"] + ex / 2, top - ny, top))


def at_hawara(f=None, layout=LAYOUT):
    """The group where it stands, in a frame of its own: the pyramid's centre at the origin, the chip bed south of it
    in the same arrangement as `laid_on_giza`, so the two pictures agree."""
    f = f or figures()
    half = f["side"] / 2
    ex, ny = (f["bed_length"], f["bed_width"]) if layout["long_side"] == "east-west" else (f["bed_width"], f["bed_length"])
    top = -half - layout["bed_gap"]
    return dict(pyramid=dict(cx=0.0, cy=0.0, half=half, H=f["height"]), bed=(-ex / 2, ex / 2, top - ny, top))


def ratios(f=None):
    """The receipts: the chip bed against Khufu's base, and the pyramid against Khufu's and Menkaure's sides."""
    f = f or figures()
    g1, g3 = data.PYRAMIDS["g1"], data.PYRAMIDS["g3"]
    return dict(bed_over_khufu_base=f["bed_length"] * f["bed_width"] / (2 * g1["half"]) ** 2,
                side_over_khufu=f["side"] / (2 * g1["half"]), side_over_menkaure=f["side"] / (2 * g3["half"]))
