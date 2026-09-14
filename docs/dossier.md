# Seked claims dossier

Generated 2026-09-14 from `data/` with the **canonical** preset. Every number below is computed from the measurement database; nothing is typed in by hand. Residual is (value − target) / target. "Free choices" counts the decisions a claim needs before the numbers line up: a unit, a base line, an epoch, a scale factor.

## Summary

| ID | Claim | Best residual | Worst residual | Within tolerance | Free choices |
|---|---|---:|---:|:---:|:---:|
| A1 | π in the profile | +0.03 % | +0.03 % | yes | 0 |
| A2 | φ in the face | +0.04 % | −0.09 % | yes | 0 |
| A3 | Seked 5½ explains both | 5.9″ (+0.003 %) | 1.0′ (+0.033 %) | yes | 0 |
| A4 | King's Chamber 3-4-5 | −0.04 % | −0.17 % | yes | 1 |
| A5 | The cubit itself | +1 µm (+0.000 %) | −7 µm (−0.001 %) | yes | 1 |
| A7 | Khafre's 3-4-5 | 2.2′ (+0.069 %) | 2.2′ (+0.069 %) | yes | 0 |
| B1 | 1 : 43,200 | −24.1 km (−0.38 %) | −274.0 km (−0.68 %) | yes | 2 |
| B2 | Height × 10⁹ = Earth–Sun distance | −505,000.0 km (−0.34 %) | −3,007,870.7 km (−2.01 %) | yes | 2 |
| B3 | Latitude equals the speed of light | −0.3″ (−0.000 %) | −0.3″ (−0.000 %) | yes | 3 |
| B4 | Pyramid inch and the year | −0.16 % | −0.79 % | no | 3 |
| B5 | Half a minute of equatorial arc | −6.34 m (−0.68 %) | −6.34 m (−0.68 %) | yes | 2 |
| C1 | True north | −3.9′ | −3.9′ | yes | 0 |
| C2 | Shafts point at stars | −12.2′ (−0.450 %) | 39.5′ (+2.060 %) | no | 2 |
| C3 | Descending passage and the pole star | 4.9′ (+0.312 %) | 4.9′ (+0.312 %) | yes | 1 |
| C4 | Orion Correlation | +24.97 % | 13°00′33″ (+34.368 %) | no | 3 |
| C5 | Sphinx and Leo | 10°14′04″ (+11.372 %) | −12°33′53″ | no | 3 |
| C6 | Solstice akhet | 2°38′15″ (+0.891 %) | 2°38′15″ (+0.891 %) | yes | 0 |
| C7 | Cygnus alternative | −42.45 % | −22°33′24″ (−59.591 %) | no | 3 |
| D1 | Giza diagonal to Heliopolis | −1°38′52″ (−3.662 %) | −1°38′55″ (−3.664 %) | no | 2 |
| D2 | Legon's rectangle | −0.09 % | +0.11 % | yes | 1 |
| D3 | Prime meridian and the Delta | 3.1″ (+0.003 %) | −6°31′41″ (−14.507 %) | no | 2 |
| D4 | Sphinx axis and the temples | −1.2′ | 5.0′ | yes | 1 |

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
| face area ÷ height² against 1 | −0.09 % | −0.20 % | −0.19 % | −0.07 % |

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
| end-wall diagonal in cubits against 15 | `sqrt((kc.width / cubit.royal)^2 + (kc.height / cubit.royal)^2)` vs `15` | 14.9854 | 15 | −0.10 % | yes (±0.5 %) |
| space diagonal in cubits against 25 | `sqrt((kc.length / cubit.royal)^2 + (kc.width / cubit.royal)^2 + (kc.height / cubit.royal)^2)` vs `25` | 24.9896 | 25 | −0.04 % | yes (±0.5 %) |
| height in cubits against 5√5 | `kc.height / cubit.royal` vs `5 * sqrt(5)` | 11.1618 | 11.1803 | −0.17 % | yes (±0.5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| end-wall diagonal in cubits against 15 | −0.10 % | −0.13 % | −0.13 % | −0.10 % |
| space diagonal in cubits against 25 | −0.04 % | −0.07 % | −0.07 % | −0.04 % |
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
| perimeter × 43,200 against the equatorial circumference | −274.0 km (−0.68 %) | −271.0 km (−0.68 %) | −268.1 km (−0.67 %) | −268.3 km (−0.67 %) |

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
| height × 10⁹ against the astronomical unit | −3,007,870.7 km (−2.01 %) | −2,887,470.7 km (−1.93 %) | −2,887,470.7 km (−1.93 %) | −3,007,870.7 km (−2.01 %) |
| height × 10⁹ against the perihelion distance | −505,000.0 km (−0.34 %) | −384,600.0 km (−0.26 %) | −384,600.0 km (−0.26 %) | −505,000.0 km (−0.34 %) |

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
| casing base side in pyramid inches against 365.242 × 25 | −0.79 % | −0.78 % | −0.77 % | −0.77 % |
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
| Half a minute of equatorial arc | −6.34 m (−0.68 %) | −6.27 m (−0.68 %) | −6.21 m (−0.67 %) | −6.21 m (−0.67 %) |

**Free choices (2)**:
- the arc-minute as the unit
- half of it

**Overlay:** `panel`

**Proponents:** Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini.

**Context:** NIMA TR8350.2 (2000). Department of Defense World Geodetic System 1984. a = 6 378 137 m, 1/f = 298.257 223 563.

Identical to the second half of B1: 43,200 is 2 × 21,600, so "perimeter × 43,200 = circumference" and "perimeter = half a minute of arc" are one claim in two costumes.

## C · Sky

### C1 · True north

The Great Pyramid's sides run within a few arcminutes of true north. The question is not whether but how: Dash argues for an equinox shadow, Spence for a simultaneous transit of Mizar and Kochab, which would also date the layout to about 2467 BCE.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| mean casing azimuth against true north | `g1.orientation` vs `0` | −0°03′54″ | 0°00′00″ | −3.9′ | yes (±0°05′00″) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| mean casing azimuth against true north | −3.9′ | −3.7′ | −3.1′ | −3.9′ |

**Free choices (0)**: none.

**Overlay:** `compass-rose` {"structure":"g1","methods":["equinox-shadow","simultaneous-transit"],"stars":["Mizar","Kochab"],"radius_m":190,"exaggeration":120}

**Proponents:** Dash, G. (2015). The Great Pyramid's Footprint: Results from Our 2015 Survey. AERAgram 16(2), 8–14. · Spence, K. (2000). Ancient Egyptian chronology and the astronomical orientation of pyramids. Nature 408, 320–324.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Cole, J. H. (1925). Determination of the Exact Size and Orientation of the Great Pyramid of Giza. Survey of Egypt Paper 39. Cairo: Government Press. · Nell, E. & Ruggles, C. (2014). The Orientations of the Giza Pyramids and Associated Structures. Journal for the History of Astronomy 45(3), 304–360.

The residual is the orientation itself, so a percentage is undefined and the fit uses an absolute tolerance of 5 arcminutes (0.0833 degrees). Petrie's casing mean is −3′43″ ± 6″ (§93), Cole's about −3′06″, Dash's −3′54″ ± 44″ (Table 3): all west of north, and the canonical preset resolves to Dash. Which method set it out is an overlay for the app; it does not change this number.

### C2 · Shafts point at stars

Around 2450 BCE the King's Chamber south shaft pointed at Alnitak and its north shaft at Thuban; the Queen's Chamber south shaft pointed at Sirius and its north shaft at Kochab, each at meridian transit.

*Evaluated at epoch −2449 (2450 BCE).*

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| King's Chamber south shaft against Alnitak | `kc.shaft.south.angle` vs `star.alnitak.transit.altitude` | 45°00′00″ | 45°12′12″ | −12.2′ (−0.450 %) | yes (±1 %) |
| King's Chamber north shaft against Thuban | `kc.shaft.north.angle` vs `star.thuban.transit.altitude` | 32°36′00″ | 31°56′31″ | 39.5′ (+2.060 %) | no (±1 %) |
| Queen's Chamber south shaft against Sirius | `qc.shaft.south.angle` vs `star.sirius.transit.altitude` | 39°36′28″ | 39°21′32″ | 14.9′ (+0.632 %) | yes (±1 %) |
| Queen's Chamber north shaft against Kochab | `qc.shaft.north.angle` vs `star.kochab.transit.altitude` | 39°07′00″ | 39°21′19″ | −14.3′ (−0.606 %) | yes (±1 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| King's Chamber south shaft against Alnitak | −12.2′ (−0.450 %) | −12.2′ (−0.450 %) | −12.2′ (−0.450 %) | −12.2′ (−0.450 %) |
| King's Chamber north shaft against Thuban | 39.5′ (+2.060 %) | 39.5′ (+2.060 %) | 39.5′ (+2.060 %) | 39.5′ (+2.060 %) |
| Queen's Chamber south shaft against Sirius | 14.9′ (+0.632 %) | 14.9′ (+0.632 %) | 14.9′ (+0.632 %) | 14.9′ (+0.632 %) |
| Queen's Chamber north shaft against Kochab | −14.3′ (−0.606 %) | −14.3′ (−0.606 %) | −14.3′ (−0.606 %) | −14.3′ (−0.606 %) |

**Free choices (2)**:
- the epoch
- which star is assigned to each shaft

**Overlay:** `shaft-rays` {"shafts":["kc.shaft.south","kc.shaft.north","qc.shaft.south","qc.shaft.north"],"stars":["Alnitak","Thuban","Sirius","Kochab"]}

**Proponents:** Bauval, R. & Gilbert, A. (1994). The Orion Mystery. London: Heinemann.

**Context:** Gantenbrink, R. (1993 onward). The Upuaut Project: survey of the shafts of the Great Pyramid. · Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22.

Tolerance is 1 %, which on a 40° shaft is about 24′. The shaft angles are unverified Gantenbrink values, the bores are not straight, and the assignment of a star to a shaft is itself a free choice, so a tighter band would be false precision. The epoch is fixed here at Bauval and Gilbert's 2450 BCE for all four shafts, which is the claim as made; each shaft on its own prefers a different date. packages/sky solves that inverse problem numerically: `pnpm shafts` writes docs/shafts.md with, for each shaft, the epoch at which the named star crossed the meridian at the shaft's altitude and how many years the date moves per arcminute of shaft angle.

### C3 · Descending passage and the pole star

The descending passage was bored at 26°31′ so that an observer looking up it, north and below the pole, saw Thuban at its lower culmination around 2170 BCE.

*Evaluated at epoch −2169 (2170 BCE).*

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| descending passage angle against Thuban's lower culmination | `passage.descending.angle` vs `star.thuban.lower.altitude` | 26°31′23″ | 26°26′26″ | 4.9′ (+0.312 %) | yes (±1 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| descending passage angle against Thuban's lower culmination | 4.9′ (+0.312 %) | 4.9′ (+0.312 %) | 4.9′ (+0.312 %) | 4.9′ (+0.312 %) |

**Free choices (1)**:
- the epoch

**Overlay:** `passage-ray` {"passage":"passage.descending.angle","star":"Thuban","culmination":"lower"}

**Proponents:** Smyth, C. P. (1864). Our Inheritance in the Great Pyramid. London: Strahan.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Spence, K. (2000). Ancient Egyptian chronology and the astronomical orientation of pyramids. Nature 408, 320–324. · Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22.

Thuban's lower culmination climbs to about 29°53′ near 2800 BCE and falls away on either side, so the passage angle is reached twice: near 3409 BCE on the way up and near 2185 BCE on the way down. Choosing which crossing to call the alignment is this claim's one free choice, and it is not a small one, since the two dates are twelve centuries apart. Tolerance is 1 %, about 16′ at this angle, the same band as C2. There is a mundane reading as well: the measured 26°31′ is within 3′ of atan(1/2), a rise of one on a run of two, which is a seked of 14 palms per cubit and needs no star at all, and the ascending passage sits within 32′ of the same slope. See A3.

### C4 · Orion Correlation

The three pyramids are laid out as Orion's Belt (Alnitak, Alnilam, Mintaka), including Menkaure's offset from the diagonal, and the belt's angle to the meridian matched the pyramids' diagonal in 10,450 BCE.

*Evaluated at epoch −10449 (10450 BCE).*

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| belt angle from the meridian against the G1 to G3 diagonal | `atan(abs((atan2(sin(star.mintaka.ra - star.alnitak.ra), cos(star.mintaka.ra - star.alnitak.ra))) * cos(star.alnilam.dec)) / abs(star.mintaka.dec - star.alnitak.dec))` vs `atan(g3.centre.offset.west / g3.centre.offset.south)` | 50°51′40″ | 37°51′07″ | 13°00′33″ (+34.368 %) | no (±5 %) |
| Menkaure off the G1 to G2 line against Mintaka off the Alnitak to Alnilam line | `abs(g2.centre.offset.west * g3.centre.offset.south - g2.centre.offset.south * g3.centre.offset.west) / (g2.centre.offset.west^2 + g2.centre.offset.south^2)` vs `abs((star.alnitak.dec - star.alnilam.dec) * (atan2(sin(star.mintaka.ra - star.alnilam.ra), cos(star.mintaka.ra - star.alnilam.ra))) * cos(star.alnilam.dec) - (atan2(sin(star.alnitak.ra - star.alnilam.ra), cos(star.alnitak.ra - star.alnilam.ra))) * cos(star.alnilam.dec) * (star.mintaka.dec - star.alnilam.dec)) / (((atan2(sin(star.alnitak.ra - star.alnilam.ra), cos(star.alnitak.ra - star.alnilam.ra))) * cos(star.alnilam.dec))^2 + (star.alnitak.dec - star.alnilam.dec)^2)` | 0.18527 | 0.148248 | +24.97 % | no (±5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| belt angle from the meridian against the G1 to G3 diagonal | 13°00′33″ (+34.368 %) | 13°00′33″ (+34.368 %) | 13°00′33″ (+34.368 %) | 13°00′33″ (+34.368 %) |
| Menkaure off the G1 to G2 line against Mintaka off the Alnitak to Alnilam line | +24.97 % | +24.97 % | +24.97 % | +24.97 % |

**Free choices (3)**:
- the epoch
- the orientation of the sky map relative to the ground (north–south inversion)
- the matching rule (angle, spacing or both)

**Overlay:** `sky-projection` {"stars":["Alnitak","Alnilam","Mintaka"],"ground":["g1","g2","g3"]}

**Proponents:** Bauval, R. & Gilbert, A. (1994). The Orion Mystery. London: Heinemann. · Hancock, G. (1995). Fingerprints of the Gods. London: Heinemann. · Hancock, G. & Bauval, R. (1996). Keeper of Genesis (US title: The Message of the Sphinx). London: Heinemann.

**Context:** Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22.

**Critiques:** Krupp, E. C. (1997). Pyramid Marketing Schemes. Sky & Telescope, February 1997, 64–65. · Fairall, A. (1999). Precession and the layout of the ancient Egyptian pyramids. Astronomy & Geophysics 40(4), 4.4.

Right-ascension differences are folded into the range from -180 to 180 degrees with atan2(sin, cos), so the belt reads correctly in the centuries when it straddles zero right ascension (about 5060 to 4820 BCE). Both comparisons are unsigned, because the claim is about shape rather than handedness. The sky is taken as seen looking south, with the belt laid on a tangent plane about Alnilam (x = Δra × cos dec, y = Δdec, both in degrees), which is accurate to a few arcminutes over the belt's 2.7°. On the ground the diagonal is Petrie's G1 to G3 centre offsets, measured from the meridian, and Menkaure's offset is his perpendicular distance from the G1 to G2 line divided by the length of that line, so both offsets are scale free. Krupp's objection, that laying the sky on the plateau requires swapping north for south, is recorded here as a free choice and is not modelled: nothing below tests it. Tolerance is 5 %, nearly 2° on a 38° diagonal, a band far looser than any surveyor would accept, chosen so the claim is judged as the visual match it is asserted to be rather than as a survey. Long-term precession (Vondrák 2011) is what makes the epoch meaningful at all; the IAU 2006 model is wrong by degrees at −10449, and the belt's angle sweeps roughly a degree a century, so a claim tied to an epoch is a claim tied to that free choice.

### C5 · Sphinx and Leo

The Sphinx is a lion and it looks due east. Hancock and Bauval read it as a marker of the vernal equinox of 10,500 BCE, when Leo rose in the east immediately before the sun and the monument would have faced its own image in the sky.

*Evaluated at epoch −10499 (10500 BCE).*

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| Regulus's rising azimuth against due east | `star.regulus.rise.azimuth` vs `90` | 100°14′04″ | 90°00′00″ | 10°14′04″ (+11.372 %) | no (±5°00′00″) |
| Regulus's rising against the equinox sun's, in degrees of sidereal time | `atan2(sin(star.regulus.rise.lst - sun.equinox.rise.lst), cos(star.regulus.rise.lst - sun.equinox.rise.lst))` vs `0` | −12°33′53″ | 0°00′00″ | −12°33′53″ | yes (±30°00′00″) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| Regulus's rising azimuth against due east | 10°14′04″ (+11.372 %) | 10°14′04″ (+11.372 %) | 10°14′04″ (+11.372 %) | 10°14′04″ (+11.372 %) |
| Regulus's rising against the equinox sun's, in degrees of sidereal time | −12°33′53″ | −12°33′53″ | −12°33′53″ | −12°33′53″ |

**Free choices (3)**:
- the epoch, which is chosen for the sky and not read off the monument
- Regulus standing for the whole of Leo
- due east as the Sphinx's gaze, no surveyed axis for it being in the database

**Overlay:** `sun-ribbon` {"from":"sphinx","length_m":1400,"bearings":[{"label":"due east","azimuth":"90"},{"label":"equinox sunrise","azimuth":"sun.equinox.rise.azimuth"},{"label":"Regulus rising","azimuth":"star.regulus.rise.azimuth"}]}

**Proponents:** Hancock, G. & Bauval, R. (1996). Keeper of Genesis (US title: The Message of the Sphinx). London: Heinemann.

**Context:** Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22. · Lehner, M. (1991). Archaeology of an Image: The Great Sphinx of Giza. PhD dissertation, Yale University. ARCE Sphinx Project 1979–83. · Commonly cited WGS84 coordinates of the Great Sphinx of Giza: 29°58′31″ N, 31°08′16″ E.

**Critiques:** Krupp, E. C. (1997). Pyramid Marketing Schemes. Sky & Telescope, February 1997, 64–65.

Two things are being asked. The first is whether Leo rose due east, and the answer is that at this epoch Regulus rose about ten degrees south of it: its declination had precessed to about −8.9°, and at Giza's latitude that puts its rising point ten degrees round the horizon. The tolerance is 5°, which is a deliberately generous band, about four degrees of declination at this latitude, and it is a choice rather than a measurement: the Sphinx's own east–west axis is not in the database, because none of the cited sources states an azimuth for it, so "due east" comes from the plan's wording and has no error bar to inherit. The residual is twice the band. The second is whether Leo rose before the sun. Sidereal time is the hour angle of the equinox, so a body's rising sidereal time is its right ascension less its rising hour angle, and two of them subtract directly; the difference is folded into ±180° with atan2(sin, cos) the way C4 folds a right-ascension difference. Negative means Regulus reached the horizon first, which is what the claim needs, and it comes out at about −12.6°, some fifty minutes of sidereal time ahead of the sun. The target is zero, the two rising together, and the tolerance of 30° is two hours: further ahead than that and Leo is a constellation of the night rather than of the dawn. The two risings are not on quite the same convention. A star's rising here is the geometric horizon, altitude zero, and the sun's is its upper limb at −0.833°, refraction plus semidiameter; putting Regulus on the same convention would move it about one degree of sidereal time earlier, four minutes, which changes nothing that matters. No local skyline is modelled at all, and the plateau's own horizon is worth more than that. Regulus's proper motion is a quarter of a degree over 12,500 years, applied linearly, which is the last quarter degree of the rising azimuth and not more. Vondrák 2011 is what makes the epoch mean anything: the IAU 2006 polynomials are wrong by degrees this far back. Krupp is cited against as the standard astronomical objection to the 10,500 BCE Giza thesis that this claim shares with C4; the particular argument his article makes, that laying the sky on the plateau needs north and south swapped, is C4's and is not what either comparison here tests.

### C6 · Solstice akhet

Seen from the Sphinx, the summer solstice sun sets in the gap between the Great Pyramid and Khafre's. The two pyramids as the hills and the disc between them draw akhet, the horizon hieroglyph, which is Lehner's reading of the whole plateau as a single image.

*Evaluated at epoch −2499 (2500 BCE).*

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| summer solstice sunset azimuth against the middle of the gap, from the Sphinx | `sun.solstice.summer.set.azimuth` vs `atan2((g1.centre.offset.east - g1.base.half + g2.base.half - g2.centre.offset.west) / 2 - sphinx.centre.offset.east, (g1.centre.offset.north - g1.base.half + g2.base.half - g2.centre.offset.south) / 2 - sphinx.centre.offset.north) + 360` | 298°31′21″ | 295°53′06″ | 2°38′15″ (+0.891 %) | yes (±8°00′00″) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| summer solstice sunset azimuth against the middle of the gap, from the Sphinx | 2°38′15″ (+0.891 %) | 2°38′16″ (+0.891 %) | 2°38′18″ (+0.892 %) | 2°38′19″ (+0.892 %) |

**Free choices (0)**: none.

**Overlay:** `akhet` {"from":"sphinx","length_m":1400,"corners":["g1.sw","g2.ne"],"bearings":[{"label":"summer solstice sunset","azimuth":"sun.solstice.summer.set.azimuth"}]}

**Proponents:** Lehner, M. (1997). The Complete Pyramids. London: Thames & Hudson. · Lehner, M. & Hawass, Z. (2017). Giza and the Pyramids. Chicago: University of Chicago Press.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Lehner, M. (1991). Archaeology of an Image: The Great Sphinx of Giza. PhD dissertation, Yale University. ARCE Sphinx Project 1979–83. · Commonly cited WGS84 coordinates of the Great Sphinx of Giza: 29°58′31″ N, 31°08′16″ E. · Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22.

The gap is between the Great Pyramid's south-west corner and Khafre's north-east corner, and the target is the bearing to the point halfway between those two corners. Both come out of the environment: G1 sits at the origin of the frame, Khafre is Petrie's centre offsets south and west, and the corners are those centres and the half-bases. The Sphinx's own position is a commonly cited latitude and longitude turned into east and north by the same flat conversion D1 uses for Heliopolis. atan2 is written the way D1 writes it, east over north, and 360 is added because the gap lies north of west from the Sphinx and the arctangent comes back negative there while an azimuth does not. The tolerance is 8°, which is not a precision but the claim's own width: the two corners subtend about 16.5° from the Sphinx, so the sun setting anywhere inside the gap is within half of that of its middle. Judged that way the claim holds, and the residual of about +2.6° says the sun sets in the northern half of the gap, nearer the Great Pyramid's flank than Khafre's. A tighter band would be testing something Lehner does not assert: what he describes is a picture, and a picture is as wide as the gap. Nothing here is a free choice, but three things are approximations. The sunset azimuth is the upper limb at −0.833°, refraction plus semidiameter, on a flat sea-level horizon; the plateau rises westward towards the pyramids, which makes the real sun set earlier and further south than this, and no local skyline is modelled. The Sphinx's coordinates are worth about 55 m, which is a degree or so of bearing at this range and the largest uncertainty in the target. And the two pyramids stand on different ground: Khafre's base is some 10 m above Khufu's, so the corner that bounds the gap on that side is higher than this plan view knows. The epoch barely enters, the obliquity moving the solstice azimuth about a fifth of a degree per thousand years, so unlike C5 this claim is not a claim about a date.

### C7 · Cygnus alternative

Collins (2006), with Rodney Hale's overlay, matches the three pyramids to the three wing stars of Cygnus, δ Cygni (Fawaris) on the Great Pyramid, Sadr (γ Cygni) on Khafre's and Gienah (ε Cygni, Aljanah in HYG) on Menkaure's, and holds the fit better than Orion's. Deneb, the brightest star, has no pyramid.

*Evaluated at epoch −2499 (2500 BCE).*

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| wing angle from the meridian against the G1 to G3 diagonal | `atan(abs((atan2(sin(star.aljanah.ra - star.fawaris.ra), cos(star.aljanah.ra - star.fawaris.ra))) * cos(star.sadr.dec)) / abs(star.aljanah.dec - star.fawaris.dec))` vs `atan(g3.centre.offset.west / g3.centre.offset.south)` | 15°17′44″ | 37°51′07″ | −22°33′24″ (−59.591 %) | no (±5 %) |
| Menkaure off the G1 to G2 line against Gienah off the Fawaris to Sadr line | `abs(g2.centre.offset.west * g3.centre.offset.south - g2.centre.offset.south * g3.centre.offset.west) / (g2.centre.offset.west^2 + g2.centre.offset.south^2)` vs `abs((star.fawaris.dec - star.sadr.dec) * (atan2(sin(star.aljanah.ra - star.sadr.ra), cos(star.aljanah.ra - star.sadr.ra))) * cos(star.sadr.dec) - (atan2(sin(star.fawaris.ra - star.sadr.ra), cos(star.fawaris.ra - star.sadr.ra))) * cos(star.sadr.dec) * (star.aljanah.dec - star.sadr.dec)) / (((atan2(sin(star.fawaris.ra - star.sadr.ra), cos(star.fawaris.ra - star.sadr.ra))) * cos(star.sadr.dec))^2 + (star.fawaris.dec - star.sadr.dec)^2)` | 0.18527 | 0.321921 | −42.45 % | no (±5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| wing angle from the meridian against the G1 to G3 diagonal | −22°33′24″ (−59.591 %) | −22°33′24″ (−59.591 %) | −22°33′24″ (−59.591 %) | −22°33′24″ (−59.591 %) |
| Menkaure off the G1 to G2 line against Gienah off the Fawaris to Sadr line | −42.45 % | −42.45 % | −42.45 % | −42.45 % |

**Free choices (3)**:
- the epoch
- the orientation of the sky map relative to the ground
- the constellation, and which three of its stars (Deneb, the brightest, is left unmarked)

**Overlay:** `sky-projection` {"stars":["Fawaris","Sadr","Aljanah"],"ground":["g1","g2","g3"]}

**Proponents:** Collins, A. (2006). The Cygnus Mystery. London: Watkins.

**Context:** Bauval, R. & Gilbert, A. (1994). The Orion Mystery. London: Heinemann. · Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22.

This is C4's engine with another constellation in it: the same two shape comparisons, the same folding of right-ascension differences into ±180° with atan2(sin, cos), the same unsigned ground offsets from Petrie's §92, and the same 5 % band. What it is not is Collins' own thesis. That thesis is a view, not a plan: the three wing stars setting into their three pyramids as seen from Gebel Gibli, the knoll south-east of the Sphinx, and Deneb rising over Heliopolis. Testing it needs Gebel Gibli's position and the plateau's local horizon, and the database has neither, so only the ground plan is tested here. The wing is a far wider figure than the belt, and the flat sky map pays for it. Fawaris to Aljanah spans 16.2° at this epoch against the belt's 2.7°, so the map C4 uses, x = Δra × cos dec of the middle star and y = Δdec, is stretched where C4's is not: about Sadr it puts the wing's angle to the meridian at 15.30°, where a true tangent plane about the same star puts it at 14.27°. That is a full degree of projection error, against the arcminute or two the same approximation costs over Orion's belt. It changes no verdict below, but nothing here should be read to better than a degree. Neither comparison holds, and neither holds as well as Orion's. The wing's angle to the meridian comes out at 15°18′ against the pyramids' diagonal of 37°51′, wrong by 22°33′ (−59.6 %), where C4's belt at its own chosen epoch is wrong by 13°01′ (+34.4 %). Menkaure stands off the G1 to G2 line by 0.185 of that line's length and Aljanah stands off the Fawaris to Sadr line by 0.322 of it, so the wing is nearly twice as bent as the ground: −42.5 %, against Orion's +25.0 %. The angle is the half of this that an epoch can move. It sweeps about 0.7° a century here, and over the fifteen thousand years from 13,000 BCE to now it passes the pyramids' 37°51′ exactly twice, around 11,300 BCE and again around 700 CE, neither of them anywhere near the completion of the pyramids that Collins dates the correlation to. The offset ratio barely moves with the epoch at all, so no date rescues the shape. Long-term precession (Vondrák 2011) is what makes any of these dates mean anything; Bauval and Gilbert are cited for context because the method being applied is theirs.

## D · Site plan and geodesy

### D1 · Giza diagonal to Heliopolis

A line through the south-east corners of the three pyramids runs at 45 degrees and points at the obelisk of Senusret I at Heliopolis, 17 km to the north-east.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| bearing of the G3 to G1 south-east corner line against the bearing to the obelisk | `atan2(g1.base.half + g3.centre.offset.west - g3.base.half, g3.centre.offset.south + g3.base.half - g1.base.half)` vs `atan2((heliopolis.obelisk.longitude - g1.center.longitude) * cos(g1.center.latitude), heliopolis.obelisk.latitude - g1.center.latitude)` | 43°21′05″ | 44°59′57″ | −1°38′52″ (−3.662 %) | no (±2 %) |
| bearing of the corner line against 45 degrees | `atan2(g1.base.half + g3.centre.offset.west - g3.base.half, g3.centre.offset.south + g3.base.half - g1.base.half)` vs `45` | 43°21′05″ | 45°00′00″ | −1°38′55″ (−3.664 %) | no (±2 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| bearing of the G3 to G1 south-east corner line against the bearing to the obelisk | −1°38′52″ (−3.662 %) | −1°44′19″ (−3.864 %) | −1°44′17″ (−3.862 %) | −1°38′47″ (−3.659 %) |
| bearing of the corner line against 45 degrees | −1°38′55″ (−3.664 %) | −1°44′22″ (−3.866 %) | −1°44′20″ (−3.864 %) | −1°38′50″ (−3.661 %) |

**Free choices (2)**:
- which corners define the diagonal (the south-east corners here)
- the obelisk as the target rather than the temple's axis or its centre

**Overlay:** `ground-line` {"from":"g3.corner.se","through":"g1.corner.se","to":"heliopolis.obelisk"}

**Proponents:** Hancock, G. & Bauval, R. (1996). Keeper of Genesis (US title: The Message of the Sphinx). London: Heinemann.

**Context:** Legon, J. A. R. (1979). The Plan of the Giza Pyramids. Archaeological Reports of the Archaeology Society of Staten Island 10(1). · Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer.

The corner line is built from Petrie's G1 to G3 centre offsets (section 92) and the mean half-bases, so Menkaure's slightly rectangular base enters as its mean side. The bearing to the obelisk is taken in the local east-north frame with the longitude difference scaled by the cosine of the latitude; at 17 km that approximation is good to about 0.1 degrees, which is far inside the 2 percent (0.9 degree) tolerance. The obelisk's position is a commonly cited value, unverified, and its sigma of 50 m moves the bearing by 0.2 degrees at most. Petrie found no exact relation between the corners of the three pyramids (section 92).

### D2 · Legon's rectangle

The three pyramids sit inside a rectangle bounded by the east and north faces of the Great Pyramid and the west and south faces of Menkaure's, measuring 1000 root 2 by 1000 root 3 royal cubits (1414.2 by 1732.1).

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| east-west extent in cubits against 1000 root 2 | `(g1.base.half + g3.centre.offset.west + g3.base.half) / cubit.royal` vs `1000 * sqrt(2)` | 1415.8 | 1414.21 | +0.11 % | yes (±0.5 %) |
| north-south extent in cubits against 1000 root 3 | `(g1.base.half + g3.centre.offset.south + g3.base.half) / cubit.royal` vs `1000 * sqrt(3)` | 1730.43 | 1732.05 | −0.09 % | yes (±0.5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| east-west extent in cubits against 1000 root 2 | +0.11 % | +0.23 % | +0.23 % | +0.11 % |
| north-south extent in cubits against 1000 root 3 | −0.09 % | −0.005 % | −0.004 % | −0.09 % |

**Free choices (1)**:
- the cubit length used to convert the metric extents

**Overlay:** `ground-rectangle` {"corners":["g1.corner.ne","g3.corner.sw"],"structures":["g1","g2","g3"]}

**Proponents:** Legon, J. A. R. (1979). The Plan of the Giza Pyramids. Archaeological Reports of the Archaeology Society of Staten Island 10(1).

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Lehner, M. (1997). The Complete Pyramids. London: Thames & Hudson.

Legon quotes 1417.5 by 1732 cubits from Petrie's survey. Here the extents are built from Petrie's centre-to-centre offsets (section 92) and the mean half-bases of G1 and G3, so Menkaure's slightly rectangular base (102.2 by 104.6 m in Lehner) enters as its mean side; that is worth about 1.2 m, or 0.16 percent, on the shorter extent. Petrie found no exact relation between the centres and no evidence the layout was planned as a whole.

### D3 · Prime meridian and the Delta

Stecchini's claim, as Tompkins gives it in his appendix: the Great Pyramid was sited as the geodetic centre of Egypt. Its meridian bisects the Nile Delta, and the pyramid stands at the apex of a quadrant whose sides, its own base diagonals extended north-east and north-west, enclose the Delta.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| the meridian against the Delta's apex | `g1.center.longitude` vs `delta.apex.center.longitude` | 31°08′03″ | 31°08′00″ | 3.1″ (+0.003 %) | yes (±0°03′00″) |
| the meridian against the middle of the coast, Alexandria to Port Said | `g1.center.longitude` vs `(delta.west.center.longitude + delta.east.center.longitude) / 2` | 31°08′03″ | 31°06′30″ | 1.5′ (+0.083 %) | yes (±0°03′00″) |
| bearing to the north-east corner against the base diagonal, 45° | `atan2(delta.east.centre.offset.east, delta.east.centre.offset.north)` vs `45` | 38°28′19″ | 45°00′00″ | −6°31′41″ (−14.507 %) | no (±5 %) |
| bearing to the north-west corner against the base diagonal, 45° west | `abs(atan2(delta.west.centre.offset.east, delta.west.centre.offset.north))` vs `45` | 40°49′16″ | 45°00′00″ | −4°10′44″ (−9.287 %) | no (±5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| the meridian against the Delta's apex | 3.1″ (+0.003 %) | 3.1″ (+0.003 %) | 3.1″ (+0.003 %) | 3.1″ (+0.003 %) |
| the meridian against the middle of the coast, Alexandria to Port Said | 1.5′ (+0.083 %) | 1.5′ (+0.083 %) | 1.5′ (+0.083 %) | 1.5′ (+0.083 %) |
| bearing to the north-east corner against the base diagonal, 45° | −6°31′41″ (−14.507 %) | −6°31′41″ (−14.507 %) | −6°31′41″ (−14.507 %) | −6°31′41″ (−14.507 %) |
| bearing to the north-west corner against the base diagonal, 45° west | −4°10′44″ (−9.287 %) | −4°10′44″ (−9.287 %) | −4°10′44″ (−9.287 %) | −4°10′44″ (−9.287 %) |

**Free choices (2)**:
- which places stand for the Delta's corners (Alexandria and Port Said here)
- reading the base diagonals as bearings from the base centre

**Overlay:** `ground-bearings` {"from":"g1","length_m":4000,"bearings":[{"label":"meridian","azimuth":"0"},{"label":"north-east diagonal","azimuth":"45"},{"label":"north-west diagonal","azimuth":"-45"},{"label":"to the Delta apex","azimuth":"atan2(delta.apex.centre.offset.east, delta.apex.centre.offset.north)"},{"label":"to Port Said","azimuth":"atan2(delta.east.centre.offset.east, delta.east.centre.offset.north)"},{"label":"to Alexandria","azimuth":"atan2(delta.west.centre.offset.east, delta.west.centre.offset.north)"}]}

**Proponents:** Tompkins, P. (1971). Secrets of the Great Pyramid. New York: Harper & Row. Appendix by L. C. Stecchini.

**Context:** Commonly cited WGS84 coordinates of three points on the Nile Delta: the Delta Barrage at El-Qanater el-Khayreya, where the river divides (30°11′ N, 31°08′ E); Alexandria (31°12′ N, 29°55′ E); and Port Said (31°15′ N, 32°18′ E). · Commonly cited WGS84 coordinates of the Great Pyramid's base centre (29°58′45″ N, 31°08′03″ E).

What is entered here is not Stecchini. His own figures, an axis of Egypt at 31°14′ E and a Delta apex at 30°06′ N, reach this project only through Tompkins' appendix and the accounts that repeat it, and a number from a secondary account of a number is not a measurement. What is entered instead is three commonly cited positions, the same kind of placeholder as the Heliopolis obelisk that D1 points at: the modern barrage at El-Qanater el-Khayreya for the head of the Delta, and Alexandria and Port Said for its western and eastern corners. Each is a town or a dam standing for an ancient mouth or a river fork, each is quoted only to the arcminute, and each carries a sigma of 0.02°, about 2 km. The bearings are taken in the flat east-north frame that buildEnvironment derives from those coordinates, the same frame D1 uses for Heliopolis: north from the difference in latitude, east from the difference in longitude times the cosine of the origin's latitude. Over the 180 km to the coast it is worth about half a degree of bearing. Measured against the initial azimuth of the great circle, the flat bearing to Port Said is 0.48° further from the meridian than the true one, and Alexandria's is 0.48° further on the other side. Two effects of about that size make it up: half the convergence of the meridians, Δλ sin φ / 2, is 0.30°, and holding the cosine of the latitude at the origin's value, when it has shrunk by 1.3 % by the time it reaches the coast, supplies most of the rest. The error flatters the claim, the true azimuths lying further from 45° still, and at half a degree it decides nothing below either way. The meridian half of the claim holds twice over. The Great Pyramid's cited longitude is 3.1″ east of the barrage, 84 m on the ground, where the arcminute the barrage's own position is quoted to is 1.6 km here: the apex sits on the meridian to a twentieth of the precision of the citation, and could not be shown to miss it if it did. Against the middle of the coast the meridian runs 1.5′ east, about 2.5 km, which is not quite twice the uncertainty the two towns carry between them and well inside the 3′ band. The quadrant does not. Port Said lies at 38°28′ from the pyramid and Alexandria at 40°49′ on the other side, so the two arms open 79°18′ where the base diagonals open 90°, and the corners fall short of their diagonals by 6°32′ and 4°11′. The diagonals are taken as exactly 45°, which the Great Pyramid's own orientation justifies to the 3′ its sides are off cardinal. What does survive of the figure is that the two corners come out at almost the same range, 180.5 km and 179.4 km, a kilometre apart in a hundred and eighty: the pyramid is very nearly equidistant from the two ends of the Delta's coast, which is a weaker and quite different statement from standing at the apex of a right angle that encloses it. Which towns stand for those corners is a free choice, and the tolerance is generous rather than the choice being tight: moving a corner by the 2 km its position is worth turns its bearing by two-thirds of a degree, but moving it to a different mouth of the ancient river would turn it by several.

### D4 · Sphinx axis and the temples

The Sphinx looks due east, and the Sphinx Temple in front of its paws and Khafre's valley temple beside it are laid out on the cardinal directions with it.

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| Sphinx Temple north-south axis (east wall) against the meridian | `sphinx_temple.wall.east.dfc` vs `0` | −0°01′12″ | 0°00′00″ | −1.2′ | yes (±0°15′00″) |
| Sphinx Temple east-west axis (north wall) against due east | `sphinx_temple.wall.north.dfc` vs `0` | 0°22′00″ | 0°00′00″ | 22.0′ | yes (±0°30′00″) |
| Khafre's valley temple mean north-south axis against the meridian | `(khafre_valley_temple.wall.east.dfc + khafre_valley_temple.wall.west.dfc) / 2` vs `0` | 0°05′00″ | 0°00′00″ | 5.0′ | yes (±0°15′00″) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| Sphinx Temple north-south axis (east wall) against the meridian | −1.2′ | −1.2′ | −1.2′ | −1.2′ |
| Sphinx Temple east-west axis (north wall) against due east | 22.0′ | 22.0′ | 22.0′ | 22.0′ |
| Khafre's valley temple mean north-south axis against the meridian | 5.0′ | 5.0′ | 5.0′ | 5.0′ |

**Free choices (1)**:
- the Sphinx's own axis is not surveyed in the database, so the Sphinx Temple's east-west axis stands for it (C5 records the same gap as a free choice)

**Overlay:** `ground-bearings` {"from":"sphinx","length_m":500,"bearings":[{"label":"Sphinx Temple axis","azimuth":"sphinx_temple.wall.east.dfc"},{"label":"Sphinx Temple east-west","azimuth":"90 + sphinx_temple.wall.north.dfc"},{"label":"valley temple axis","azimuth":"(khafre_valley_temple.wall.east.dfc + khafre_valley_temple.wall.west.dfc) / 2"},{"label":"due east","azimuth":"90"},{"label":"Khafre's causeway","azimuth":"khafre_causeway.edge.north.azimuth + 180"}]}

**Proponents:** Lehner, M. (1997). The Complete Pyramids. London: Thames & Hudson.

**Context:** Nell, E. & Ruggles, C. (2014). The Orientations of the Giza Pyramids and Associated Structures. Journal for the History of Astronomy 45(3), 304–360. · Lehner, M. (1991). Archaeology of an Image: The Great Sphinx of Giza. PhD dissertation, Yale University. ARCE Sphinx Project 1979–83. · Commonly cited WGS84 coordinates of the Great Sphinx of Giza: 29°58′31″ N, 31°08′16″ E.

Every number here is a deviation from cardinality in Nell and Ruggles' sense: the angle between a wall and the cardinal direction it was meant to hold, positive clockwise, so a positive north wall runs south of east at its far end and a positive east wall runs east of north. The targets are all zero, which is why these comparisons carry an absolute tolerance rather than a percentage: a residual against zero has no percentage at all. All three hold. The Sphinx Temple's east wall, the nine-point line the surveyors themselves take for the temple's axis because no reading could be got from the west wall, is −0°01′12″ off the meridian, which is about the accuracy they claim for a line of that length. Its north wall is +0°22′ off due east. Khafre's valley temple leans anticlockwise on its east side and clockwise on its west, −0°23′ against +0°33′, so the building is a little narrower at its northern end; the mean of the two, which is the nearest thing the survey offers to an axis for it, is +0°05′. The bands are 15′ on the two meridian comparisons and 30′ on the east-west one, the looser band going to the one line here that is standing in for something else. Neither temple has a position in the database. The Sphinx alone carries a latitude and a longitude, and that is the cited placeholder worth about 55 m that C5 and C6 also use, so the overlay draws all five bearings from the Sphinx's centre. They are directions and not walls, and the buildings they belong to are not where the lines begin. The causeway is drawn as its reverse azimuth, 283°26′, because it runs west-north-west from the valley temple up to Khafre's pyramid and so leaves the Sphinx that way. Two lines in the same few hundred metres are nowhere near cardinal, and this claim does not count either of them against the temples. The passage between the two buildings, measured along the Sphinx Temple's south wall, is +4°33′, and Khafre's causeway is +13°26′. Nell and Ruggles remark that the passage is skewed in the same sense as the causeway, which reads as topography rather than as a failed alignment: both run with the slope up to the plateau. What this claim tests is the walls that were meant to be cardinal, and those are cardinal to a few arcminutes.

## Inputs

Values resolved under the **canonical** preset (Canonical (Lehner)). Unverified records were entered from memory or secondary sources and still need checking against the cited page.

| Key | Value | Unit | Source | Method | Verified |
|---|---:|---|---|---|:---:|
| au | 149597870700 | m | iau-2012 | defined | yes |
| c | 299792458 | m/s | si-2019 | defined | yes |
| cubit.royal | 0.5236 | m | lehner-1997 | tabulated | no |
| delta.apex.center.longitude | 31.1333 | deg | coords-delta-cited | cited | no |
| delta.east.center.longitude | 32.3 | deg | coords-delta-cited | cited | no |
| delta.west.center.longitude | 29.9167 | deg | coords-delta-cited | cited | no |
| earth.circumference.equatorial | 40075016.686 | m | wgs84 | derived | yes |
| earth.perihelion | 147095000000 | m | nasa-earth-fact-sheet | tabulated | yes |
| earth.radius.polar | 6356752.314 | m | wgs84 | defined | yes |
| g1.base.side.mean | 230.33 | m | lehner-1997 | tabulated | no |
| g1.base.socket.mean | 231.798 | m | petrie-1883 | socket-corner | yes |
| g1.center.latitude | 29.979167 | deg | coords-wgs84-cited |  | no |
| g1.center.longitude | 31.134167 | deg | coords-wgs84-cited |  | no |
| g1.face.angle | 51.8444 | deg | lehner-1997 | tabulated | no |
| g1.height.original | 146.59 | m | lehner-1997 | tabulated | no |
| g1.orientation | -0.065 | deg | dash-2015 | casing-mean | yes |
| g2.centre.offset.south | 353.86 | m | petrie-1883 | triangulation | yes |
| g2.centre.offset.west | 334.41 | m | petrie-1883 | triangulation | yes |
| g2.face.angle | 53.1667 | deg | lehner-1997 | tabulated | no |
| g3.centre.offset.south | 739.19 | m | petrie-1883 | triangulation | yes |
| g3.centre.offset.west | 574.45 | m | petrie-1883 | triangulation | yes |
| heliopolis.obelisk.latitude | 30.1294 | deg | coords-heliopolis-cited | cited | no |
| heliopolis.obelisk.longitude | 31.3076 | deg | coords-heliopolis-cited | cited | no |
| kc.height | 5.8443 | m | petrie-1883 | interior | yes |
| kc.length | 10.4709 | m | petrie-1883 | interior | yes |
| kc.shaft.north.angle | 32.6 | deg | gantenbrink-1993 | robot-survey | no |
| kc.shaft.south.angle | 45 | deg | gantenbrink-1993 | robot-survey | no |
| kc.width | 5.2354 | m | petrie-1883 | interior | yes |
| khafre_valley_temple.wall.east.dfc | -0.383333 | deg | nell-ruggles-2014 | total-station | yes |
| khafre_valley_temple.wall.west.dfc | 0.55 | deg | nell-ruggles-2014 | total-station | yes |
| passage.descending.angle | 26.5231 | deg | petrie-1883 | interior | yes |
| qc.shaft.north.angle | 39.1167 | deg | gantenbrink-1993 | robot-survey | no |
| qc.shaft.south.angle | 39.6078 | deg | gantenbrink-1993 | robot-survey | no |
| sphinx_temple.wall.east.dfc | -0.02 | deg | nell-ruggles-2014 | total-station | yes |
| sphinx_temple.wall.north.dfc | 0.366667 | deg | nell-ruggles-2014 | total-station | yes |
| unit.pyramid_inch | 0.0254254 | m | smyth-1864 | defined | no |
| year.tropical | 365.24219 | day | astronomical-almanac | tabulated | yes |
