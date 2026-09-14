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
| C2 | Shafts point at stars | −12.2′ (−0.452 %) | 39.5′ (+2.061 %) | no | 2 |
| C3 | Descending passage and the pole star | 4.9′ (+0.311 %) | 4.9′ (+0.311 %) | yes | 1 |
| C4 | Orion Correlation | +19.14 % | 12°57′28″ (+34.233 %) | no | 3 |
| D1 | Giza diagonal to Heliopolis | - | - | pending (needs-site) | 1 |

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

**Overlay:** `compass-rose` {"structure":"g1","methods":["equinox-shadow","simultaneous-transit"],"stars":["Mizar","Kochab"]}

**Proponents:** Dash, G. (2015). The Great Pyramid's Footprint: Results from Our 2015 Survey. AERAgram 16(2), 8–14. · Spence, K. (2000). Ancient Egyptian chronology and the astronomical orientation of pyramids. Nature 408, 320–324.

**Context:** Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer. · Cole, J. H. (1925). Determination of the Exact Size and Orientation of the Great Pyramid of Giza. Survey of Egypt Paper 39. Cairo: Government Press. · Nell, E. & Ruggles, C. (2014). The Orientations of the Giza Pyramids and Associated Structures. Journal for the History of Astronomy 45(3), 304–360.

The residual is the orientation itself, so a percentage is undefined and the fit uses an absolute tolerance of 5 arcminutes (0.0833 degrees). Petrie's casing mean is -3'43" plus or minus 6" (section 93), Cole's about -3'06", Dash's -3'54" plus or minus 44" (Table 3): all west of north, and the canonical preset resolves to Dash. Which method set it out is an overlay for the app; it does not change this number.

### C2 · Shafts point at stars

Around 2450 BCE the King's Chamber south shaft pointed at Alnitak and its north shaft at Thuban; the Queen's Chamber south shaft pointed at Sirius and its north shaft at Kochab, each at meridian transit.

*Evaluated at epoch −2449 (2450 BCE).*

| Comparison | Formula | Value | Target | Residual | Within |
|---|---|---:|---:|---:|:---:|
| King's Chamber south shaft against Alnitak | `kc.shaft.south.angle` vs `star.alnitak.transit.altitude` | 45°00′00″ | 45°12′15″ | −12.2′ (−0.452 %) | yes (±1 %) |
| King's Chamber north shaft against Thuban | `kc.shaft.north.angle` vs `star.thuban.transit.altitude` | 32°36′00″ | 31°56′30″ | 39.5′ (+2.061 %) | no (±1 %) |
| Queen's Chamber south shaft against Sirius | `qc.shaft.south.angle` vs `star.sirius.transit.altitude` | 39°36′28″ | 39°21′32″ | 14.9′ (+0.633 %) | yes (±1 %) |
| Queen's Chamber north shaft against Kochab | `qc.shaft.north.angle` vs `star.kochab.transit.altitude` | 39°07′00″ | 39°21′21″ | −14.3′ (−0.608 %) | yes (±1 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| King's Chamber south shaft against Alnitak | −12.2′ (−0.452 %) | −12.2′ (−0.452 %) | −12.2′ (−0.452 %) | −12.2′ (−0.452 %) |
| King's Chamber north shaft against Thuban | 39.5′ (+2.061 %) | 39.5′ (+2.061 %) | 39.5′ (+2.061 %) | 39.5′ (+2.061 %) |
| Queen's Chamber south shaft against Sirius | 14.9′ (+0.633 %) | 14.9′ (+0.633 %) | 14.9′ (+0.633 %) | 14.9′ (+0.633 %) |
| Queen's Chamber north shaft against Kochab | −14.3′ (−0.608 %) | −14.3′ (−0.608 %) | −14.3′ (−0.608 %) | −14.3′ (−0.608 %) |

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
| descending passage angle against Thuban's lower culmination | `passage.descending.angle` vs `star.thuban.lower.altitude` | 26°31′23″ | 26°26′27″ | 4.9′ (+0.311 %) | yes (±1 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| descending passage angle against Thuban's lower culmination | 4.9′ (+0.311 %) | 4.9′ (+0.311 %) | 4.9′ (+0.311 %) | 4.9′ (+0.311 %) |

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
| belt angle from the meridian against the G1 to G3 diagonal | `atan(abs((star.mintaka.ra - star.alnitak.ra) * cos(star.alnilam.dec)) / abs(star.mintaka.dec - star.alnitak.dec))` vs `atan(g3.centre.offset.west / g3.centre.offset.south)` | 50°48′35″ | 37°51′07″ | 12°57′28″ (+34.233 %) | no (±5 %) |
| Menkaure off the G1 to G2 line against Mintaka off the Alnitak to Alnilam line | `abs(g2.centre.offset.west * g3.centre.offset.south - g2.centre.offset.south * g3.centre.offset.west) / (g2.centre.offset.west^2 + g2.centre.offset.south^2)` vs `abs((star.alnitak.dec - star.alnilam.dec) * (star.mintaka.ra - star.alnilam.ra) * cos(star.alnilam.dec) - (star.alnitak.ra - star.alnilam.ra) * cos(star.alnilam.dec) * (star.mintaka.dec - star.alnilam.dec)) / (((star.alnitak.ra - star.alnilam.ra) * cos(star.alnilam.dec))^2 + (star.alnitak.dec - star.alnilam.dec)^2)` | 0.18527 | 0.155505 | +19.14 % | no (±5 %) |

Residual by survey preset:

| Comparison | canonical | petrie-1883 | cole-1925 | dash-2015 |
|---|---:|---:|---:|---:|
| belt angle from the meridian against the G1 to G3 diagonal | 12°57′28″ (+34.233 %) | 12°57′28″ (+34.233 %) | 12°57′28″ (+34.233 %) | 12°57′28″ (+34.233 %) |
| Menkaure off the G1 to G2 line against Mintaka off the Alnitak to Alnilam line | +19.14 % | +19.14 % | +19.14 % | +19.14 % |

**Free choices (3)**:
- the epoch
- the orientation of the sky map relative to the ground (north–south inversion)
- the matching rule (angle, spacing or both)

**Overlay:** `sky-projection` {"stars":["Alnitak","Alnilam","Mintaka"],"ground":["g1","g2","g3"]}

**Proponents:** Bauval, R. & Gilbert, A. (1994). The Orion Mystery. London: Heinemann. · Hancock, G. (1995). Fingerprints of the Gods. London: Heinemann. · Hancock, G. & Bauval, R. (1996). Keeper of Genesis (US title: The Message of the Sphinx). London: Heinemann.

**Context:** Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions, valid for long time intervals. Astronomy & Astrophysics 534, A22.

**Critiques:** Krupp, E. C. (1997). Pyramid Marketing Schemes. Sky & Telescope, February 1997, 64–65. · Fairall, A. (1999). Precession and the layout of the ancient Egyptian pyramids. Astronomy & Geophysics 40(4), 4.4.

Both comparisons are unsigned, because the claim is about shape rather than handedness. The sky is taken as seen looking south, with the belt laid on a tangent plane about Alnilam (x = Δra × cos dec, y = Δdec, both in degrees), which is accurate to a few arcminutes over the belt's 2.7°. On the ground the diagonal is Petrie's G1 to G3 centre offsets, measured from the meridian, and Menkaure's offset is his perpendicular distance from the G1 to G2 line divided by the length of that line, so both offsets are scale free. Krupp's objection, that laying the sky on the plateau requires swapping north for south, is recorded here as a free choice and is not modelled: nothing below tests it. Tolerance is 5 %, nearly 2° on a 38° diagonal, a band far looser than any surveyor would accept, chosen so the claim is judged as the visual match it is asserted to be rather than as a survey. Long-term precession (Vondrák 2011) is what makes the epoch meaningful at all; the IAU 2006 model is wrong by degrees at −10449, and the belt's angle sweeps roughly a degree a century, so a claim tied to an epoch is a claim tied to that free choice.

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
| g1.base.socket.mean | 231.798 | m | petrie-1883 | socket-corner | yes |
| g1.center.latitude | 29.979167 | deg | coords-wgs84-cited |  | no |
| g1.face.angle | 51.8444 | deg | lehner-1997 | tabulated | no |
| g1.height.original | 146.59 | m | lehner-1997 | tabulated | no |
| g1.orientation | -0.065 | deg | dash-2015 | casing-mean | yes |
| g2.centre.offset.south | 353.86 | m | petrie-1883 | triangulation | yes |
| g2.centre.offset.west | 334.41 | m | petrie-1883 | triangulation | yes |
| g2.face.angle | 53.1667 | deg | lehner-1997 | tabulated | no |
| g3.centre.offset.south | 739.19 | m | petrie-1883 | triangulation | yes |
| g3.centre.offset.west | 574.45 | m | petrie-1883 | triangulation | yes |
| kc.height | 5.8443 | m | petrie-1883 | interior | yes |
| kc.length | 10.4709 | m | petrie-1883 | interior | yes |
| kc.shaft.north.angle | 32.6 | deg | gantenbrink-1993 | robot-survey | no |
| kc.shaft.south.angle | 45 | deg | gantenbrink-1993 | robot-survey | no |
| kc.width | 5.2354 | m | petrie-1883 | interior | yes |
| passage.descending.angle | 26.5231 | deg | petrie-1883 | interior | yes |
| qc.shaft.north.angle | 39.1167 | deg | gantenbrink-1993 | robot-survey | no |
| qc.shaft.south.angle | 39.6078 | deg | gantenbrink-1993 | robot-survey | no |
| unit.pyramid_inch | 0.0254254 | m | smyth-1864 | defined | no |
| year.tropical | 365.24219 | day | astronomical-almanac | tabulated | yes |
