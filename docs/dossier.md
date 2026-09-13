# Seked claims dossier

Generated 2026-09-13 from `data/` with the **canonical** preset. Every number below is computed from the measurement database; nothing is typed in by hand. Residual is (value − target) / target. "Free choices" counts the decisions a claim needs before the numbers line up: a unit, a base line, an epoch, a scale factor.

## Summary

| ID | Claim | Best residual | Worst residual | Within tolerance | Free choices |
|---|---|---:|---:|:---:|:---:|
| A1 | π in the profile | +0.03 % | +0.03 % | yes | 0 |
| A2 | φ in the face | +0.04 % | −0.09 % | yes | 0 |
| A3 | Seked 5½ explains both | 5.9″ (+0.003 %) | 1.0′ (+0.033 %) | yes | 0 |
| A4 | King's Chamber 3-4-5 | −0.003 % | −0.17 % | yes | 1 |
| A5 | The cubit itself | +1 µm (+0.000 %) | −7 µm (−0.001 %) | yes | 1 |
| A7 | Khafre's 3-4-5 | 2.2′ (+0.069 %) | 2.2′ (+0.069 %) | yes | 0 |
| B1 | 1 : 43,200 | −24.1 km (−0.38 %) | −274.0 km (−0.68 %) | yes | 2 |
| B2 | Height × 10⁹ = Earth–Sun distance | −505,000.0 km (−0.34 %) | −3,007,870.7 km (−2.01 %) | yes | 2 |
| B3 | Latitude equals the speed of light | −0.3″ (−0.000 %) | −0.3″ (−0.000 %) | yes | 3 |
| B4 | Pyramid inch and the year | −0.16 % | −0.79 % | no | 3 |
| B5 | Half a minute of equatorial arc | −6.34 m (−0.68 %) | −6.34 m (−0.68 %) | yes | 2 |
| C2 | Shafts point at stars | — | — | pending (needs-sky) | 2 |
| C4 | Orion Correlation | — | — | pending (needs-sky) | 3 |
| D1 | Giza diagonal to Heliopolis | — | — | pending (needs-site) | 1 |

## A · Proportion and geometry of the Great Pyramid

### A1 · π in the profile

The perimeter of the base divided by the original height equals 2π.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| π in the profile | `g1.base.perimeter / g1.height.original` vs `2 * pi` | 6.28501 | 6.28319 | +0.03 % | yes (±0.5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| π in the profile | +0.03 % | −0.05 % | −0.04 % | +0.04 % |

**Free choices (0)**: none.

**Overlay:** `ghost-profile` {"slope":"atan(4 / pi)"}

**Proponents:** Smyth, C. P. (1864). Our Inheritance in the Great Pyramid. London: Strahan. · Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini. · Hancock, G. (1995). Fingerprints of the Gods. London: Heinemann.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Rossi, C. (2004). Architecture and Mathematics in Ancient Egypt. Cambridge: Cambridge University Press.

A ratio is the same in any unit, so this costs no free choice. It also falls out of a seked of 5½ palms per cubit: the slope carries a 22/7 ratio, and 4 × 11 / 7 = 44/7 ≈ 2π. See A3.

### A2 · φ in the face

The apothem (slant height at the centre of a face) divided by half the base equals φ, making the cross-section a Kepler triangle. Equivalently, the area of each face equals the square of the height, which is how Herodotus is read.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| apothem ÷ half-base against φ | `g1.apothem / g1.base.half` vs `phi` | 1.6187 | 1.61803 | +0.04 % | yes (±0.5 %) |
| face area ÷ height² against 1 | `g1.face.area / g1.height.squared` vs `1` | 0.999078 | 1 | −0.09 % | yes (±0.5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| apothem ÷ half-base against φ | +0.04 % | +0.09 % | +0.08 % | +0.03 % |
| face area ÷ height² against 1 | −0.09 % | −0.19 % | −0.18 % | −0.07 % |

**Free choices (0)**: none.

**Overlay:** `ghost-profile` {"slope":"atan(sqrt(phi))","face_square":true}

**Proponents:** Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini. · Hancock, G. (1995). Fingerprints of the Gods. London: Heinemann.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Rossi, C. (2004). Architecture and Mathematics in Ancient Egypt. Cambridge: Cambridge University Press.

A pyramid cannot be exactly both a π pyramid and a φ pyramid, but the two slopes differ by 1′36″, which is inside the survey error. See A3.

### A3 · Seked 5½ explains both

The measured face angle is compared with the angle of a seked of 5½ palms per cubit, with the π pyramid and with the φ pyramid. All three lie inside the survey's error band, so the monument cannot discriminate between them, and the seked is the only one attested in Egyptian mathematics.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| measured angle against seked 5½ | `g1.face.angle` vs `atan(7 / 5.5)` | 51°50′40″ | 51°50′34″ | 5.9″ (+0.003 %) | yes (±0.1 %) |
| measured angle against the π pyramid | `g1.face.angle` vs `atan(4 / pi)` | 51°50′40″ | 51°51′14″ | −34.5″ (−0.018 %) | yes (±0.1 %) |
| measured angle against the φ pyramid | `g1.face.angle` vs `atan(sqrt(phi))` | 51°50′40″ | 51°49′38″ | 1.0′ (+0.033 %) | yes (±0.1 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| measured angle against seked 5½ | 5.9″ (+0.003 %) | 1.4′ (+0.046 %) | 1.4′ (+0.046 %) | 5.9″ (+0.003 %) |
| measured angle against the π pyramid | −34.5″ (−0.018 %) | 45.8″ (+0.025 %) | 45.8″ (+0.025 %) | −34.5″ (−0.018 %) |
| measured angle against the φ pyramid | 1.0′ (+0.033 %) | 2.4′ (+0.076 %) | 2.4′ (+0.076 %) | 1.0′ (+0.033 %) |

**Free choices (0)**: none.

**Overlay:** `ghost-profiles` {"slopes":["atan(7 / 5.5)","atan(4 / pi)","atan(sqrt(phi))"],"error_band_arcmin":2}

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Rossi, C. (2004). Architecture and Mathematics in Ancient Egypt. Cambridge: Cambridge University Press.

Petrie's casing angle is 51°52′ ± 2′; Lehner tabulates 51°50′40″. The seked angle is 51°50′34″, the π angle 51°51′14″, the φ angle 51°49′38″. The Rhind papyrus problems 56–60 compute sekeds; nothing in Egyptian mathematics computes π to this precision or knows φ.

### A4 · King's Chamber 3-4-5

The King's Chamber measures 20 × 10 cubits with a height of 5√5 cubits, so the end-wall diagonal is 15 cubits and the space diagonal is 25: a 15-20-25 triangle, the 3-4-5 scaled by five.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| end-wall diagonal in cubits against 15 | `sqrt((kc.width / cubit.royal)^2 + (kc.height / cubit.royal)^2)` vs `15` | 14.991 | 15 | −0.06 % | yes (±0.5 %) |
| space diagonal in cubits against 25 | `sqrt((kc.length / cubit.royal)^2 + (kc.width / cubit.royal)^2 + (kc.height / cubit.royal)^2)` vs `25` | 24.9992 | 25 | −0.003 % | yes (±0.5 %) |
| height in cubits against 5√5 | `kc.height / cubit.royal` vs `5 * sqrt(5)` | 11.1618 | 11.1803 | −0.17 % | yes (±0.5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| end-wall diagonal in cubits against 15 | −0.06 % | −0.09 % | −0.09 % | −0.06 % |
| space diagonal in cubits against 25 | −0.003 % | −0.03 % | −0.03 % | −0.003 % |
| height in cubits against 5√5 | −0.17 % | −0.19 % | −0.19 % | −0.17 % |

**Free choices (1)**:
- the cubit length used to convert the metric measurements

**Overlay:** `chamber-wireframe` {"chamber":"kc","diagonals":["end-wall","floor","space"]}

**Proponents:** Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Rossi, C. (2004). Architecture and Mathematics in Ancient Egypt. Cambridge: Cambridge University Press.

Petrie derived his cubit from this very chamber, so the 20 × 10 part is circular by construction; the height relation is the independent claim.

### A5 · The cubit itself

The royal cubit in metres equals π/6 and also φ²/5.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| royal cubit against π/6 metres | `cubit.royal` vs `pi / 6` | 0.524 m | 0.524 m | +1 µm (+0.000 %) | yes (±0.1 %) |
| royal cubit against φ²/5 metres | `cubit.royal` vs `phi^2 / 5` | 0.524 m | 0.524 m | −7 µm (−0.001 %) | yes (±0.1 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| royal cubit against π/6 metres | +1 µm (+0.000 %) | +149 µm (+0.03 %) | +149 µm (+0.03 %) | +1 µm (+0.000 %) |
| royal cubit against φ²/5 metres | −7 µm (−0.001 %) | +141 µm (+0.03 %) | +141 µm (+0.03 %) | −7 µm (−0.001 %) |

**Free choices (1)**:
- the metre, defined in 1793, as the unit of comparison

**Overlay:** `panel`

**Proponents:** Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer.

π/6 = 0.523599 and φ²/5 = 0.523607 agree with each other to 0.002 % with no help from Egypt, so any length near 0.5236 m "encodes" both. The cubit varied between 0.523 and 0.529 m across Egypt and across dynasties.

### A7 · Khafre's 3-4-5

Khafre's face angle of 53°10′ is the 3-4-5 triangle, which is exactly a seked of 5¼.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| Khafre's 3-4-5 | `g2.face.angle` vs `atan(4 / 3)` | 53°10′00″ | 53°07′48″ | 2.2′ (+0.069 %) | yes (±0.2 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| Khafre's 3-4-5 | 2.2′ (+0.069 %) | 2.2′ (+0.069 %) | 2.2′ (+0.069 %) | 2.2′ (+0.069 %) |

**Free choices (0)**: none.

**Overlay:** `ghost-profile` {"structure":"g2","slope":"atan(4 / 3)"}

**Context:** Lehner, M. (1997). The Complete Pyramids. London: Thames & Hudson. · Rossi, C. (2004). Architecture and Mathematics in Ancient Egypt. Cambridge: Cambridge University Press.

## B · Earth and cosmos scale

### B1 · 1 : 43,200

The Great Pyramid is a scale model of the northern hemisphere at 1:43,200: height × 43,200 is the polar radius and perimeter × 43,200 is the equatorial circumference. 43,200 = 600 × 72, and 72 years is one degree of precession.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| height × 43,200 against the polar radius | `g1.height.original * 43200` vs `earth.radius.polar` | 6,332.7 km | 6,356.8 km | −24.1 km (−0.38 %) | yes (±1 %) |
| perimeter × 43,200 against the equatorial circumference | `g1.base.perimeter * 43200` vs `earth.circumference.equatorial` | 39,801 km | 40,075 km | −274.0 km (−0.68 %) | yes (±1 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| height × 43,200 against the polar radius | −24.1 km (−0.38 %) | −18.9 km (−0.30 %) | −18.9 km (−0.30 %) | −24.1 km (−0.38 %) |
| perimeter × 43,200 against the equatorial circumference | −274.0 km (−0.68 %) | −271.0 km (−0.68 %) | −268.1 km (−0.67 %) | −268.8 km (−0.67 %) |

**Free choices (2)**:
- the scale factor 43,200
- the polar radius (not the mean or equatorial) and the equatorial circumference (not the meridional)

**Overlay:** `ghost-earth` {"scale":43200}

**Proponents:** Hancock, G. (1995). Fingerprints of the Gods. London: Heinemann. · Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini.

**Context:** NIMA TR8350.2 (2000). Department of Defense World Geodetic System 1984. a = 6 378 137 m, 1/f = 298.257 223 563.

Both halves are the π relation of A1 restated at a scale: if perimeter = 2π × height, then perimeter × k is the circumference of a circle whose radius is height × k, for any k. The only content beyond A1 is the choice of k, and 43,200 fits the Earth to within 0.4–0.7 %.

### B2 · Height × 10⁹ = Earth–Sun distance

The original height multiplied by a thousand million is the distance from the Earth to the Sun.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| height × 10⁹ against the astronomical unit | `g1.height.original * 1e9` vs `au` | 146,590,000 km | 149,597,870.7 km | −3,007,870.7 km (−2.01 %) | yes (±2.5 %) |
| height × 10⁹ against the perihelion distance | `g1.height.original * 1e9` vs `earth.perihelion` | 146,590,000 km | 147,095,000 km | −505,000.0 km (−0.34 %) | yes (±2.5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| height × 10⁹ against the astronomical unit | −3,007,870.7 km (−2.01 %) | −2,887,870.7 km (−1.93 %) | −2,887,870.7 km (−1.93 %) | −3,007,870.7 km (−2.01 %) |
| height × 10⁹ against the perihelion distance | −505,000.0 km (−0.34 %) | −385,000.0 km (−0.26 %) | −385,000.0 km (−0.26 %) | −505,000.0 km (−0.34 %) |

**Free choices (2)**:
- the factor 10⁹
- the mean distance or the perihelion distance, whichever fits

**Overlay:** `panel`

**Proponents:** Smyth, C. P. (1864). Our Inheritance in the Great Pyramid. London: Strahan. · Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini.

**Context:** IAU 2012 Resolution B2: the astronomical unit is 149 597 870 700 m exactly. · NASA NSSDCA Earth Fact Sheet. Perihelion 147.095 × 10⁶ km.

### B3 · Latitude equals the speed of light

The Great Pyramid sits at 29.9792458° N, and the speed of light is 299,792,458 m/s.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| Latitude equals the speed of light | `g1.center.latitude` vs `c / 1e7` | 29°58′45″ | 29°58′45″ | −0.3″ (−0.000 %) | yes (±0.001 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| Latitude equals the speed of light | −0.3″ (−0.000 %) | −0.3″ (−0.000 %) | −0.3″ (−0.000 %) | −0.3″ (−0.000 %) |

**Free choices (3)**:
- reading degrees of latitude as metres per second, two unrelated units
- the geodetic datum, which moves the centre by more than the residual
- which point of the 5.3-hectare footprint carries the coordinate

**Overlay:** `map-inset` {"datums":["WGS84","Old Egyptian 1907"]}

**Context:** Commonly cited WGS84 coordinates of the Great Pyramid's base centre (29°58′45″ N, 31°08′03″ E). · BIPM (2019). The International System of Units, 9th edition. c = 299 792 458 m/s exactly.

The commonly cited base centre, 29°58′45″ N, is about 9 m south of the meme's coordinate, well inside a base 230 m on a side. The seventh decimal place of a latitude is a centimetre; no survey of the base centre is that precise, and the answer changes by tens of metres with the datum.

### B4 · Pyramid inch and the year

Measured in pyramid inches, each base side is 9,131 inches, which is 25 times the days in the year, so the perimeter is 36,524 inches.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| casing base side in pyramid inches against 365.242 × 25 | `g1.base.side.mean / unit.pyramid_inch` vs `year.tropical * 25` | 9059.05 | 9131.05 | −0.79 % | no (±0.5 %) |
| socket base side in pyramid inches against 365.242 × 25 | `g1.base.socket.mean / unit.pyramid_inch` vs `year.tropical * 25` | 9116.79 | 9131.05 | −0.16 % | yes (±0.5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| casing base side in pyramid inches against 365.242 × 25 | −0.79 % | −0.78 % | −0.77 % | −0.78 % |
| socket base side in pyramid inches against 365.242 × 25 | −0.16 % | −0.16 % | −0.16 % | −0.16 % |

**Free choices (3)**:
- the pyramid inch, a unit invented for the purpose (1.001 British inches)
- the socket-corner base line rather than the casing base line
- the factor 25

**Overlay:** `ground-outlines` {"outlines":["casing","socket"]}

**Proponents:** Smyth, C. P. (1864). Our Inheritance in the Great Pyramid. London: Strahan.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer.

**Critiques:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer.

Petrie went to Giza to test Smyth and found the casing base 9,069 British inches, not 9,131. The socket base is a different line, about 1.4 m longer per side, and it is the one Smyth's number needs.

### B5 · Half a minute of equatorial arc

The base perimeter is half a minute of arc of the Earth's equator.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| Half a minute of equatorial arc | `g1.base.perimeter` vs `earth.circumference.equatorial / 21600 / 2` | 921.32 m | 927.662 m | −6.34 m (−0.68 %) | yes (±1 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| Half a minute of equatorial arc | −6.34 m (−0.68 %) | −6.27 m (−0.68 %) | −6.21 m (−0.67 %) | −6.22 m (−0.67 %) |

**Free choices (2)**:
- the arc-minute as the unit
- half of it

**Overlay:** `panel`

**Proponents:** Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini.

**Context:** NIMA TR8350.2 (2000). Department of Defense World Geodetic System 1984. a = 6 378 137 m, 1/f = 298.257 223 563.

Identical to the second half of B1: 43,200 is 2 × 21,600, so "perimeter × 43,200 = circumference" and "perimeter = half a minute of arc" are one claim in two costumes.

## C · Sky

### C2 · Shafts point at stars

Around 2450 BCE the King's Chamber south shaft pointed at Alnitak and its north shaft at Thuban; the Queen's Chamber south shaft pointed at Sirius and its north shaft at Kochab, each at meridian transit.

*Not yet computable: waits on the sky engine.*

**Free choices (2)**:
- the epoch
- which star is assigned to each shaft

**Overlay:** `shaft-rays` {"shafts":["kc.shaft.south","kc.shaft.north","qc.shaft.south","qc.shaft.north"],"stars":["Alnitak","Thuban","Sirius","Kochab"]}

**Proponents:** Bauval, R. & Gilbert, A. (1994). The Orion Mystery. London: Heinemann.

**Context:** Gantenbrink, R. (1993 onward). The Upuaut Project: survey of the shafts of the Great Pyramid. · Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22.

packages/sky solves this numerically; `pnpm shafts` writes docs/shafts.md with, for each shaft, the epoch at which the named star crossed the meridian at the shaft's altitude and how many years the date moves per arcminute of shaft angle. The dossier will carry it once claims can call the sky engine.

### C4 · Orion Correlation

The three pyramids are laid out as Orion's Belt (Alnitak, Alnilam, Mintaka), including Menkaure's offset from the diagonal, and the belt's angle to the meridian matched the pyramids' diagonal in 10,450 BCE.

*Not yet computable: waits on the sky engine.*

**Free choices (3)**:
- the epoch
- the orientation of the sky map relative to the ground (north–south inversion)
- the matching rule (angle, spacing or both)

**Overlay:** `sky-projection` {"stars":["Alnitak","Alnilam","Mintaka"]}

**Proponents:** Bauval, R. & Gilbert, A. (1994). The Orion Mystery. London: Heinemann. · Hancock, G. (1995). Fingerprints of the Gods. London: Heinemann. · Hancock, G. & Bauval, R. (1996). Keeper of Genesis (US title: The Message of the Sphinx). London: Heinemann.

**Context:** Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22.

**Critiques:** Krupp, E. C. (1997). Pyramid Marketing Schemes. Sky & Telescope, February 1997, 64–65.

Needs long-term precession (Vondrák 2011); the IAU 2006 model is wrong by degrees at −10450.

## D · Site plan and geodesy

### D1 · Giza diagonal to Heliopolis

A line through the south-east corners of the three pyramids points to the obelisk of Senusret I at Heliopolis.

*Not yet computable: waits on the site-plan positions.*

**Free choices (1)**:
- which corners define the diagonal

**Overlay:** `ground-line` {"to":"heliopolis.obelisk"}

**Proponents:** Hancock, G. & Bauval, R. (1996). Keeper of Genesis (US title: The Message of the Sphinx). London: Heinemann.

**Context:** Legon, J. A. R. (1979). The Plan of the Giza Pyramids. Archaeological Reports of the Archaeology Society of Staten Island 10(1).

Needs the relative positions of the three pyramids and the georeferenced frame.

## Inputs

Values resolved under the **canonical** preset (Canonical (Lehner)). Unverified records were entered from memory or secondary sources and still need checking against the cited page.

| Key | Value | Unit | Source | Method | Verified |
|---|---:|---|---|---|:---:|
| au | 149597870700 | m | iau-2012 | defined | yes |
| c | 299792458 | m/s | si-2019 | defined | yes |
| cubit.royal | 0.5236 | m | lehner-1997 | tabulated | no |
| earth.circumference.equatorial | 40075016.686 | m | wgs84 | derived | yes |
| earth.perihelion | 147095000000 | m | nasa-earth-fact-sheet | tabulated | yes |
| earth.radius.polar | 6356752.314 | m | wgs84 | defined | yes |
| g1.base.side.mean | 230.33 | m | lehner-1997 | tabulated | no |
| g1.base.socket.mean | 231.798 | m | petrie-1883 | socket-corner | no |
| g1.center.latitude | 29.979167 | deg | coords-wgs84-cited |  | no |
| g1.face.angle | 51.8444 | deg | lehner-1997 | tabulated | no |
| g1.height.original | 146.59 | m | lehner-1997 | tabulated | no |
| g2.face.angle | 53.1667 | deg | lehner-1997 | tabulated | no |
| kc.height | 5.8443 | m | petrie-1883 | interior | no |
| kc.length | 10.475 | m | petrie-1883 | interior | no |
| kc.width | 5.2398 | m | petrie-1883 | interior | no |
| unit.pyramid_inch | 0.0254254 | m | smyth-1864 | defined | no |
| year.tropical | 365.24219 | day | astronomical-almanac | tabulated | yes |
