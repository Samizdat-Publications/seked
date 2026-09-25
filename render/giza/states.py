"""
The eras the walkthrough crosses, oldest first, and what stands in each.

The first two are a claim: the lost-civilisation reading (Hancock, Bauval, Schoch,
Temple) drawn as its strongest case, as the project agreed ("rebuild the plateau
faithfully, then illustrate his claims", labelled a claim). In it the Sphinx and
the two megalithic temples in front of it are older than Khafre, the pyramids stand
cased with metal caps, and the Sahara is green: the African Humid Period, which is
real climate science, ended about 5,500 years ago. The Sphinx's sequence there
(a jackal, then a lion, then Khafre's re-carving) follows Temple's Anubis and the
lion hypothesis, one after the other, which is a narrative choice and says so.

Everything a key names here is looked up by the modules; nothing else decides what
exists in an era.
"""

ALL_TEMPLES = ("khafre.valley_temple", "sphinx.temple", "khafre.mortuary_temple", "menkaure.mortuary_temple",
               "menkaure.valley_temple")
MEGALITHIC = ("khafre.valley_temple", "sphinx.temple")

STATES = {
    "first-time": dict(
        label="c. 10,500 BCE", title="The First Time", honesty="claim", year=-10499,
        pyramids="pristine", caps="electrum", queens=None, mastabas=None, causeway=None,
        temples=MEGALITHIC, temple_mode="megalithic", sphinx="anubis",
        ground="savanna", valley="lush", water="flood", city=None,
        rubble=False, people=False, stones=False),
    "lion": dict(
        label="c. 7000 BCE", title="The lion", honesty="claim", year=-6999,
        pyramids="weathered", caps="electrum", queens=None, mastabas=None, causeway=None,
        temples=MEGALITHIC, temple_mode="megalithic-weathered", sphinx="lion",
        ground="dry-savanna", valley="lush", water="flood", city=None,
        rubble=False, people=False, stones=True),
    "built": dict(
        label="c. 2560 BCE", title="As built", honesty="reconstruction", year=-2559,
        pyramids="dressed", caps="gold", queens="dressed", mastabas="dressed", causeway="corridor",
        temples=ALL_TEMPLES, temple_mode="built", sphinx="carved",
        ground="desert", valley="fields", water="harbour", city=None,
        rubble=False, people=True, stones=False),
    "stripped": dict(
        label="c. 1800 CE", title="Stripped and buried", honesty="reconstruction", year=1800,
        pyramids="stripped", caps=None, queens="ruin", mastabas="buried", causeway="ruin",
        temples=("khafre.mortuary_temple", "menkaure.mortuary_temple"), temple_mode="buried", sphinx="buried",
        ground="sand", valley="fields", water=None, city="village",
        rubble=True, people=False, stones=True),
    "today": dict(
        label="2026", title="Today", honesty="survey", year=2026,
        pyramids="today", caps=None, queens="ruin", mastabas="ruin", causeway="ruin",
        temples=ALL_TEMPLES, temple_mode="ruin", sphinx="excavated",
        ground="desert", valley="town", water=None, city="city",
        rubble=True, people=True, stones=True),
}
ORDER = ["first-time", "lion", "built", "stripped", "today"]

# The drift that buried the Sphinx to its chest and the temples before it, as a surface
# the ground is raised to (look choice, after the nineteenth-century photographs): level
# at the chest across the ditch, falling east to the valley floor.
SPHINX_SAND = dict(x_west=270.0, x_top=362.0, x_bottom=490.0, y0=-535.0, y1=-395.0, z_top=-29.0, z_bottom=-43.0,
                   margin=30.0)


def spec(state):
    if state not in STATES:
        raise KeyError(f"unknown state {state!r}; the states are {', '.join(ORDER)}")
    return STATES[state]
