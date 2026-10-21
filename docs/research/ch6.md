# Chapter 6 research: Numbers in the stone

A headless draft from `python scripts/research.py start 6`: claude-haiku-5-5, claude-opus-5-5 at high effort, 60 turns, $2.02 on the API key, ended 2026-10-20T02:26:02+00:00. Citations marked [unchecked] are still to be checked against the work itself, and nothing here is data until it is entered in `data/`.

---

# Chapter 6 brief: Numbers in the stone

## 1. The claim at full strength

The Great Pyramid's shape carries three things its builders are not supposed to have known.

- **π.** The base perimeter divided by the original height is 2π to within 0.03 per cent. That is better than the value of π the scribes actually used (256/81, 0.6 per cent off).
- **φ.** The slant height divided by half the base is the golden ratio to within 0.04 per cent. Read with Taylor, Herodotus says the same in words: each face has the area of a square on the height.
- **The Earth.** Multiply the height and the perimeter by 43,200 and you get the Earth's polar radius and equatorial circumference to under 1 per cent. 43,200 is not a random number. It is 600 × 72, and 72 years is one degree of precession. Its multiples (4,320, 432,000) recur in Babylonian, Hindu and Norse world-ages.

The pyramid also stands within about 2 km of the 30th parallel, and its sides run within four arcminutes of true north. That is roughly 26 cm of sideways error over a 230 m side, with no compass.

None of these alone proves anything. Together they suggest a design brief written by people who knew the size of the Earth, the slow turn of the sky and the transcendental ratios. A Fourth-Dynasty court with no geometry beyond rules of thumb could hardly have written it. One answer is that the knowledge was inherited from an older, lost tradition, which the Egyptians honoured without fully understanding. A fair proponent would add: the archaeologists' explanations account for each number one at a time; the question is whether they account for all of them together.

## 2. The proponents' evidence

1. **Perimeter ÷ height = 2π.**
   - **Who:** first argued by John Taylor (1859) and Charles Piazzi Smyth (1864, `smyth-1864`). Carried into the modern literature by Tompkins (1971, `tompkins-1971`) and Hancock (1995, `hancock-1995`).
   - **Citations:**
     - Taylor, J. (1859). *The Great Pyramid: Why Was It Built? & Who Built It?* London. **[checked]** bibliographically against a library catalogue and the 2014 Cambridge Library Collection reissue; publisher Longman **[unchecked]**; page not found.
     - Hancock 1995: page not found **[unchecked]**.
   - **Steelman detail:** secondary accounts say Petrie himself thought the circle relation was deliberate **[unchecked; Wikipedia "Meidum", citing Petrie]**. No section in `petrie-1883` was found for it.
   - **Strength:** strong as a coincidence (Seked's A1 gives +0.03 %). It would be wrong if a simpler cause produced the same ratio, and one does (reply 1).
   - **Weak point:** the original height is not measured. The apex is gone, so the height is computed from the base and the face angle. A1 therefore tests one number, the angle.
   - **Peer review:** none of these works is peer-reviewed.

2. **Apothem ÷ half-base = φ, and face area = height².**
   - **Who:** Taylor 1859 read Herodotus *Histories* 2.124 as the face-area statement. Schwaller de Lubicz's φ readings reached English through J. A. West, *Serpent in the Sky* (1979) **[unchecked]**. Tompkins 1971 and Hancock 1995 repeat it.
   - **Herodotus:** the passage says the base is square, each side eight plethra, and the height the same **[unchecked; memory of the Godley translation]**.
   - **Strength:** the numbers fit (A2: +0.04 % and −0.09 %). Two things would make it wrong:
     - the Egyptians not knowing φ at all (no text has it; Euclid's "extreme and mean ratio" is c. 300 BCE);
     - the Herodotus reading being a misreading (reply 7).
   - **Peer review:** not peer-reviewed.

3. **1 : 43,200: height × 43,200 = polar radius; perimeter × 43,200 = equatorial circumference.**
   - **Who:** Stecchini's appendix to Tompkins 1971, "Notes on the Relation of Ancient Measures to the Great Pyramid". Wikipedia cites p. 346 for the geodetic-unit claim **[unchecked]**. Hancock 1995 ties it to precession at 72 years per degree; page not found **[unchecked]**. Secondary accounts: Seattle Times review of 29 August 1995 and a 2020s Substack post **[checked as secondary]**.
   - **Behind it:** the mythic-numbers case comes from de Santillana & von Dechend, *Hamlet's Mill* (1969) **[unchecked]**: Berossus' 432,000 years, the Kali Yuga of 432,000 years, and Valhalla's 540 doors × 800 warriors. That cross-cultural echo is the strongest form of the argument.
   - **Strength:** weak to moderate. Three things would make it wrong:
     - 43,200 being a choice rather than a finding;
     - the two halves not being independent of the π relation;
     - the Egyptians having no way to know the Earth's size (reply 4).
   - **Peer review:** not peer-reviewed.

4. **Latitude 30° N.**
   - **Who:** Smyth 1864 (the "land centre"). Tompkins 1971 repeats it, with the argument that the base sits a little south of 30° to allow for refraction of the pole **[unchecked; page not found]**. Hancock 1995 also uses it **[unchecked]**.
   - **Strength:** weak. The site misses 30° by 1′15″, about 2.3 km. The idea would be wrong if the degree were not an Egyptian unit (it is Mesopotamian and later), or if the site were set by geology and the capital (reply 6).
   - **Related:** B3, the "speed of light" latitude, is the reductio of this family.

5. **True north to a few arcminutes.**
   - **The measurements:**
     - Cole 1925 (`cole-1925`), p. 6: mean −3′06″.
     - Petrie 1883 §93: −3′43″ ± 6″.
     - Dash 2015 (`dash-2015`), Table 3, p. 11: −3′54″ ± 44″.
     - All three are verified records in `data/measurements/g1.json`.
   - **The proponents' use:** they read the precision itself as a sign of advanced surveying (Hancock 1995) **[unchecked; page not found]**.
   - **Strength:** the measurement is solid. The inference fails if simple methods can reach 3 to 4′, and field tests show they can (reply 5).

6. **Several numbers in one shape.** This is the proponents' best structural argument: one slope gives π, φ and 43,200 at once.
   - **Strength:** this is exactly where the reply is strongest, because 4/π ≈ √φ is a mathematical accident and 43,200 rides on π (reply 1 and reply 4).

**Up to 2026.** I found no new peer-reviewed proponent work on the π, φ or 43,200 readings. Hancock's later books and *Ancient Apocalypse* (Netflix, 2022 and 2024) may repeat the claims, but I did not confirm where.

The nearest live peer-reviewed dissent on dating is Puchkov (2023), "Multi-star target model for astronomical orientation of the Old Kingdom Egyptian pyramids", *The Oriental Studies* 91. From the orientations it argues that the Old Kingdom is about two centuries *older* than the textual chronology **[unchecked: abstract seen only as summarised in search results]**. Even that is c. 2700 BCE, not 10,500 BCE.

## 3. Receipts

Residuals are from `docs/dossier.md` (generated 2026-10-02, canonical preset). They should be regenerated before use.

| Claim | Comparison | Value vs target | Residual | Free choices |
|---|---|---|---|---|
| A1 | `g1.base.perimeter / g1.height.original` vs 2π | 6.28501 vs 6.28319 | +0.03 % (petrie −0.05 %, dash +0.04 %) | 0 |
| A2 | `g1.apothem / g1.base.half` vs φ | 1.6187 vs 1.61803 | +0.04 % | 0 |
| A2 | `g1.face.area / g1.height.squared` vs 1 | 0.99908 | −0.09 % | 0 |
| A3 | `g1.face.angle` vs seked 5½, `atan(7/5.5)` | 51°50′40″ vs 51°50′34″ | +5.9″ | 0 |
| A3 | vs π slope, `atan(4/π)` | vs 51°51′14″ | −34.5″ | 0 |
| A3 | vs φ slope, `atan(√φ)` | vs 51°49′38″ | +1.0′ | 0 |
| B1 | height × 43,200 vs polar radius | 6,332.7 vs 6,356.8 km | −0.38 % | 2 |
| B1 | perimeter × 43,200 vs equatorial circumference | 39,801 vs 40,075 km | −0.68 % | 2 |
| B5 | perimeter vs half an arc-minute of the equator | 921.32 vs 927.66 m | −0.68 % | 2 |
| C1 | `g1.orientation` vs 0 | −3′54″ (Dash) | within ±5′ | 0 |
| A7 | Khafre `g2.face.angle` vs 3-4-5 (seked 5¼) | 53°10′ vs 53°07′48″ | +2.2′ | 0 |
| B3 | latitude vs c/10⁷ | 29°58′45″ | −0.3″ | 3 |

What the receipts show:

- **The angle cannot pick a winner.** The π and φ slopes are 1′36″ apart. Petrie's adopted angle is 51°52′ ± 2′, and his own three readings span 51°46′45″ to 51°52′ (§24, §25).
- **The ranking depends on the survey.** Under the canonical (Lehner, unverified) angle the seked fits best. Under Petrie's verified adopted angle the π slope fits best: +45.8″ against the seked's +1.4′. The film should say the data cannot discriminate, not that the seked "wins".
- **B1 and B5 add nothing beyond A1 except the choice of k.** The best-fit factors from the canonical numbers are 6,356,752 / 146.59 ≈ **43,364** for the radius and 40,075,017 / 921.32 ≈ **43,497** for the circumference. 43,200 is the nearest number with a pedigree, not the best fit. The mean radius (6,371.0 km) would give −0.60 %, and the meridional circumference −0.52 %.
- **C1 in ground terms:** 3′54″ over a 230.36 m side is a sideways offset of about 0.26 m.

**Computable now with no new data** (proposed claims; these are not existing claim ids):

- **Latitude 30°:** formula `g1.center.latitude`, target `30`, residual −1′15″, about 2.3 km. It rests on the placeholder `coords-wgs84-cited`.
- **The Egyptian-π pyramid:** A1's value against `2 * 256/81` gives −0.57 %. The pyramid is a worse fit to the scribes' π than to the seked.
- **A1 against `44/7`** (the seked 5½ ratio): 6.28501 vs 6.28571, −0.011 %.

**Data that would have to be added:**

- **The Fourth-Dynasty orientation sequence.** Orientation keys for Meidum, the Bent and the Red pyramids. Sources, as footnoted in Dash 2017, p. 7: Petrie 1892, *Medum*, p. 6; Dorner 1986, *MDAIK* 42, p. 51; Dorner 1998, p. 23. `g2.orientation` and `g3.orientation` already exist.
- **The star-pair epochs.** Phecda, Megrez, Alioth and ζ UMi (Belmonte, Tupikova) and 10 Draconis (Rawlins & Pickering) are not in `data/stars/named.json`. They would be cut from HYG by `pnpm run stars`, never typed.
  - Then `packages/sky` (Vondrák) could give the epoch at which each pair's line passes through the pole, and the epoch at which it sits 3′54″ off.
  - C1's summary says Spence's date is "about 2467 BCE". Spence's own Table 1 (p. 320) gives a recalibrated start for Khufu of **2480 BC ± 5**. Check which figure C1 should quote.
- **The Meidum slope** (51°50′35″, Petrie 1892), as a `meidum.face.angle` record.

## 4. The archaeologists' reply

1. **A seked of 5½ palms per cubit gives both π and φ.**
   - **The argument:** Egyptian builders specified a slope as the run in palms for a rise of one cubit (7 palms). A seked of 5½ means a base of 440 cubits and a height of 280. Then perimeter ÷ height = 44/7 = 6.2857, which matches 2π to 0.04 %. Apothem ÷ half-base = 1.6186, which matches φ to 0.035 %. Both "codes" are side effects of one whole-number rule.
   - **Citations:**
     - Rossi, C. (2004). *Architecture and Mathematics in Ancient Egypt*. CUP (`rossi-2004`). The seked definition is on p. 185 **[unchecked; cited by Rossi & Imhausen 2009, p. 441]**.
     - Rossi, C. & Imhausen, A. (2009). "Architecture and mathematics in the time of Senusret I: Sections G, H and I of Papyrus Reisner I." In S. Ikram & A. Dodson (eds), *Beyond the Horizon: Studies in Egyptian Art, Archaeology and History in Honour of Barry J. Kemp*, Cairo, pp. 440 ff. **[checked pp. 440–441]**. On p. 440 they set the π and φ theories against "a simple geometrical model: a right-angled triangle called *seked*". On p. 441 they list the six architectural problems (RMP 56–60, Moscow 14) and state that the *sqd* "was always indicated in palms and fingers".
   - **Peer review:** Rossi 2004 is an academic monograph; Rossi & Imhausen is an edited academic volume.
   - **Strength:** strongest. It would be wrong if the seked could not produce the precision, but it does (A3).

2. **The same slope was already used at Meidum, and slopes varied.**
   - **The argument:** Khufu reused the slope Sneferu adopted to finish Meidum. Over the Old Kingdom the main pyramids show a slow tendency to grow steeper, and later secondary pyramids moved to sekeds of ⅔ and then ½ cubit (Rossi 2004, "Conclusion to Part III: Interpreting the slope of pyramids", pp. 236–238) **[checked: the Cambridge chapter page]**.
   - **Meidum's angle:** 51°50′35″ (Petrie 1892) **[unchecked; Wikipedia]**.
   - **Khafre:** seked 5¼, the 3-4-5 triangle (A7, +2.2′).
   - **Strength:** a design code would not change from king to king; a builders' tradition would. Weakened only if Meidum's casing angle proved different.

3. **There is no Egyptian π to this precision and no Egyptian φ at all.**
   - **The evidence:** the papyri compute the circle with (8/9 d)², an implicit π of 3.1605 (RMP 50) **[unchecked; standard]**. A pyramid built on that π would miss 2π by 0.6 %, twenty times the observed residual. The RMP pyramid problems work in sekeds (a web summary of the Rhind problems, sites.math.washington.edu/~greenber/Rhind.html) **[checked against that page only]**:
     - No. 56: 5 1/25 palms.
     - No. 57: 5 palms 1 finger (5¼).
     - No. 58: 5¼.
     - No. 59: 5 palms 2 fingers and 5 palms 1 finger (that is, 5½ and 5¼).
     - No. 60: a pillar, 4 palms.
   - **The standard edition:** Imhausen, A. (2016). *Mathematics in Ancient Egypt: A Contextual History*. Princeton UP **[unchecked]**.
   - **Peer review:** academic monograph.

4. **43,200 is chosen, not found.**
   - **Given A1, the scale model follows for any factor.** If perimeter = 2π × height, then multiplying both by any k makes "a hemisphere".
   - **43,200 is not the best fit.** The best factors are about 43,364 and 43,497, and the claim needs the polar radius in one half and the equatorial circumference in the other (B1's two free choices).
   - **The precession figure is rounded.** Precession is about 71.6 years per degree, not 72. It was first measured by Hipparchus (2nd century BCE). The size of the Earth was first estimated by Eratosthenes (3rd century BCE).
   - **Status of the argument:** this is analysis rather than a single citation. Herz-Fischler 2000 treats the scale-model family among his eleven theories **[unchecked which chapter]**. Seked's own B1 note makes the redundancy argument.
   - **Strength:** strong. It would only fail if some independent Egyptian record of the Earth's size were found.

5. **True north is reachable with simple methods, and the Fourth Dynasty shows a learning curve.**
   - **Spence's star method:**
     - Spence, K. (2000). "Ancient Egyptian chronology and the astronomical orientation of pyramids." *Nature* 408, 320–324 (`spence-2000`), **peer-reviewed** **[checked p. 320]**.
     - Method: the simultaneous transit of Kochab and Mizar. Result: a start date for Khufu accurate to "±5 yr", Table 1: 2480 BC ± 5.
     - Her Table 1 is the key evidence: Meidum −18.1′/−20.6′, Bent −11.8′/−17.3′, Red −8.7′, Khufu −2.8′/−3.4′, Khafre −6.0′, Menkaure +14.1′.
   - **Criticism of Spence:**
     - Rawlins & Pickering (2001), *Nature* 412, 699, with Spence's reply on 699–700 **[unchecked: pages from the Nature listing; the argument from an excerpt of the letter]**.
     - They argue her drift rate must be divided by cos 30°, and that the corrected numbers favour Thuban and 10 Draconis around 2627 BC.
     - Belmonte, J. A. (2001). "On the orientation of Old Kingdom Egyptian pyramids." *Journal for the History of Astronomy* 32, *Archaeoastronomy* supplement 26, p. S1 ff., **peer-reviewed** **[checked: IAC record and press release; end page not found]**. Proposes Phecda and Megrez at meridian transit. A Khufu date of 2571–2565 BC is quoted secondarily **[unchecked]**.
     - Tupikova, I. (2022). *Astronomical Orientation of the Pyramids and Stellar Alignments*. MPIWG Preprint 511, **not peer-reviewed** **[checked]**. Proposes Alioth–Mizar or Kochab–ζ UMi, consistent with standard chronologies. Criticises earlier work for shifting the chronologies to make the trends match.
   - **Dash's sun method:**
     - Dash, G. (2015). "On the field testing of methods the Egyptians may have used to find cardinal directions." *JHA* 46(3), 351–364, **peer-reviewed** **[unchecked; from Dash 2017's bibliography]**.
     - Dash, G. (2017). "Occam's Egyptian razor: the equinox and the alignment of the pyramids." *Journal of Ancient Egyptian Architecture* 2, 1–8, peer-reviewed open-access journal, CC BY-NC **[checked pp. 1, 6, 7]**.
     - His equinox gnomon test in Connecticut gave −7.3′, against a predicted −5.9′ (p. 6). The mean error of Khufu, Khafre and the Red Pyramid is −6.2′, the same direction (p. 6). Table 3, p. 7, repeats the sequence.
     - He concedes the Egyptians "left us few clues" (p. 7).
   - **Context:** Magli, G. (2013). *Architecture, Astronomy and Sacred Landscape in Ancient Egypt*. CUP **[unchecked]**.
   - **Strength:** strong. Several workable methods exist; every star solution lands in c. 2630–2450 BCE; and the sequence shows the skill improving, peaking at Khufu and lapsing. A survival of lost knowledge would not leave that pattern.

6. **The latitude is neither exact nor Egyptian.**
   - **The argument:**
     - It misses 30° by about 2.3 km.
     - The 360-degree circle is Mesopotamian and later, so 30° had no meaning to the builders.
     - Fourth-Dynasty pyramids range from Meidum (about 29°23′ N) to Abu Rawash (about 30°02′ N). Giza is a good limestone outcrop near the Memphite capital.
   - **Citation:** none found. Coordinates are approximate **[unchecked]**.
   - **Strength:** moderate to strong. This is the weakest of the proponents' items to begin with.

7. **The Herodotus reading is a reconstruction.** Herodotus gives side and height as equal, which is plainly wrong for the monument. The face-area statement is Taylor's reworking.
   - **Citations:**
     - Fischler, R. (1979). "What did Herodotus really say? or how to build (a theory of) the Great Pyramid." *Environment and Planning B* 6(1), 89–93, doi:10.1068/b060089, **peer-reviewed** **[checked: abstract and listing only]**.
     - Markowsky, G. (1992). "Misconceptions about the golden ratio." *College Mathematics Journal* 23(1), 2–19, **peer-reviewed** **[checked bibliographically; content via secondary sources]**.
     - Herz-Fischler, R. (2000). *The Shape of the Great Pyramid*. Waterloo: Wilfrid Laurier UP, xii + 293 pp. Academic press, not a journal **[checked: catalogue and contents]**. Reviews say he examines eleven theories and calls the Herodotus reference "nonexistent". His own verdict among the theories was **[unchecked]**; Reynolds (*Nexus Network Journal* 3(4), 2001) says only that the conclusions hold "no surprises".

8. **The height is inferred, not measured.** The original height comes from the base and the casing angle (Petrie §25 is marked "projected" in `g1.json`). π, φ and 43,200 are therefore all one measurement, the angle, seen three ways. This is a Seked observation from its own records, not a citation.

## 5. Where it stands

The numbers are real: Seked's database reproduces the π and φ fits at 0.03 to 0.04 per cent and the orientation at about 4′. No one disputes them.

What has changed since the 1990s is the explanation:
- The seked of 5½ (shared with Meidum) produces π and φ together.
- 43,200 adds only a chosen factor.
- Peer-reviewed work since Spence (2000) has field-tested several plausible ways to find north. Every star-based solution dates the orientation within the conventional Fourth Dynasty or a century or two earlier.

The proponents' strongest remaining point is the cluster itself, and the fact that the Egyptians left no document saying how they did it. The second is a gap in the evidence, not evidence of something else.

## 6. What the picture should show

**For the claim:**
1. **Square and circle.** The base square on the plateau, with a circle of radius equal to the pyramid's height swung from the apex's foot. Its circumference unrolls along the base and the two lengths match: A1's `ghost-profile`.
2. **The golden face.** One face triangle beside a square standing on the height, with the two areas filling to the same level. The Kepler triangle is drawn inside the cross-section: A2, `face_square: true`.
3. **The pyramid on the globe.** The pyramid shrinks into the northern hemisphere at 1:43,200 (B1, `ghost-earth`), then a cut to the compass rose on the pavement. The measured side is shown 3′54″ off true north and exaggerated ×120 (C1), with the scale factor stated on screen.

**For the reply (one image):** a cubit rod with the seked laid against it, 7 palms up and 5½ across. The three ghost profiles from A3 (seked, π, φ) are drawn over the casing inside the ±2′ survey band, and they print as a single line. Beside it, Meidum rises on the same slope a generation earlier. A good alternative is the Fourth-Dynasty orientation sequence (Meidum −24′ to Menkaure +14′) as six compass needles getting better and then worse.

## 7. Open questions

**The facts**
- **Which angle?** The canonical `g1.face.angle` is Lehner's tabulated 51°50′40″, unverified. Petrie's verified adopted value, 51°52′ ± 2′, puts the π slope ahead of the seked. A modern photogrammetric casing angle (GPMP / AERA) would help. I found none published.
- **Is 5½ itself in the Rhind papyrus?** The summary I read gives "5 palms 2 fingers" in RMP 59. Standard accounts more often give 5 palms 1 finger for both parts of 59. This needs checking against Peet (1923), Chace, or Robins & Shute (1987).
- **Spence's date:** 2467 vs 2480 ± 5 BC in C1 (see Receipts).
- **The 2001 *Nature* exchange:** the exact pages and wording of Rawlins & Pickering and Spence's reply are unconfirmed.
- **The 2001 *JHA* paper:** Belmonte's end page and his Khufu date are unconfirmed.

**Unfound sources**
- Page numbers for Hancock 1995 on 43,200, 30° and orientation; for Tompkins 1971 on 30° and refraction; and the start and end of Stecchini's appendix.
- Petrie's own statement on whether the π relation was intended (`petrie-1883`): section not found.
- Herodotus 2.124 wording, not checked against a translation.
- Herz-Fischler's own ranking of the eleven theories, not confirmed.
- A 2014 *Nexus Network Journal* article (doi 10.1007/s00004-014-0193-9) appears to argue φ survives without Herodotus. It is a possible peer-reviewed pro-φ voice, but I could not identify the author or check it.

**Unresolved arguments**
- The "rolling drum" explanation of π (horizontal distances measured by turns of a drum) is sometimes attributed to Mendelssohn, *The Riddle of the Pyramids* (1974). Both the attribution and the idea are **[unchecked]**.
- Whether "equinox" was an Egyptian concept, and therefore whether Dash's method is culturally plausible, is argued but I found no peer-reviewed rebuttal.

## 8. New sources

```json
[
  {"id": "taylor-1859", "kind": "proponent", "year": 1859, "citation": "Taylor, J. (1859). The Great Pyramid: Why Was It Built? & Who Built It? London. Reissued Cambridge: Cambridge University Press (Cambridge Library Collection), 2014.", "url": "https://bvbvf1.bib-bvb.de/vufind/Record/DE-604.BV043914896/Details", "note": "Checked bibliographically against library catalogues on 2026-10-20; original publisher (Longman) unchecked. Source of the pi-in-the-profile claim in English and of the reading of Herodotus 2.124 as face area = height squared; page not found."},
  {"id": "herz-fischler-2000", "kind": "critique", "year": 2000, "citation": "Herz-Fischler, R. (2000). The Shape of the Great Pyramid. Waterloo, Ontario: Wilfrid Laurier University Press. xii + 293 pp. ISBN 0-88920-324-5.", "url": "https://muse.jhu.edu/book/14297", "note": "Checked: bibliographic details and table of contents (Project MUSE, catalogue records) on 2026-10-20. History of eleven theories of the shape, including pi, golden ratio, seked and the Herodotus reading. The author's own verdict among them is unchecked; academic press, not a journal."},
  {"id": "rossi-imhausen-2009", "kind": "paper", "year": 2009, "citation": "Rossi, C. & Imhausen, A. (2009). Architecture and mathematics in the time of Senusret I: Sections G, H and I of Papyrus Reisner I. In S. Ikram & A. Dodson (eds), Beyond the Horizon: Studies in Egyptian Art, Archaeology and History in Honour of Barry J. Kemp. Cairo, pp. 440 ff.", "url": "https://re.public.polimi.it/retrieve/e0c31c09-da17-4599-e053-1705fe0aef77/Rossi%26Imhausen.pdf", "note": "Checked pp. 440-441 against the PDF on 2026-10-20: the seked model against pi and phi theories (p. 440); six architectural problems RMP 56-60 and MMP 14, seked always in palms and fingers (p. 441). End page not found."},
  {"id": "dash-2017", "kind": "paper", "year": 2017, "citation": "Dash, G. (2017). Occam's Egyptian razor: the equinox and the alignment of the pyramids. Journal of Ancient Egyptian Architecture 2, 1-8.", "url": "https://web.ujaen.es/investiga/egiptologia/journalarchitecture/downloads/JAEA2/JAEA2_Dash.pdf", "note": "Checked pp. 1, 6, 7 on 2026-10-20: gnomon test -7.3' against -5.9' expected (p. 6); mean of Khufu, Khafre, Red Pyramid -6.2' (p. 6); Table 3 casing alignments of six Fourth-Dynasty pyramids (p. 7). CC BY-NC 2.0. Distinct from dash-2015, the AERAgram survey."},
  {"id": "dash-2015-jha", "kind": "paper", "year": 2015, "citation": "Dash, G. (2015). On the field testing of methods the Egyptians may have used to find cardinal directions. Journal for the History of Astronomy 46(3), 351-364.", "note": "Unchecked: taken from the bibliography of dash-2017. Peer-reviewed."},
  {"id": "belmonte-2001", "kind": "paper", "year": 2001, "citation": "Belmonte, J. A. (2001). On the orientation of Old Kingdom Egyptian pyramids. Journal for the History of Astronomy 32, Archaeoastronomy supplement 26, S1 ff.", "url": "https://www.iac.es/en/science-and-technology/publications/orientation-old-kingdom-egyptian-pyramids", "note": "Checked against the IAC publication record and press release on 2026-10-20: critiques Spence, proposes meridian transits of Phecda and Megrez. End page and the Khufu date (2571-2565 BC, quoted secondarily) unchecked."},
  {"id": "rawlins-pickering-2001", "kind": "critique", "year": 2001, "citation": "Rawlins, D. & Pickering, K. (2001). Astronomical orientation of the pyramids. Nature 412, 699; with reply by K. Spence, 699-700.", "url": "https://www.nature.com/articles/35089138", "note": "Unchecked: pages from the Nature listing of Spence's reply; the argument (cos 30 degree correction, Thuban and 10 Draconis, 2627 BC) from an excerpt of the letter seen in search results. Peer-reviewed correspondence."},
  {"id": "magli-2009", "kind": "paper", "year": 2009, "citation": "Magli, G. (2009). Akhet Khufu: archaeo-astronomical hints at a common project of the two main pyramids of Giza, Egypt. Nexus Network Journal 11(1), 35-50.", "url": "https://arxiv.org/abs/0708.3632", "note": "Checked bibliographically against the arXiv and journal listings on 2026-10-20; content read at abstract level only. Peer-reviewed."},
  {"id": "magli-2013", "kind": "reference", "year": 2013, "citation": "Magli, G. (2013). Architecture, Astronomy and Sacred Landscape in Ancient Egypt. New York: Cambridge University Press.", "note": "Unchecked: from the bibliography of dash-2017, which cites p. 90 on the neglect of the equinox method."},
  {"id": "tupikova-2022", "kind": "paper", "year": 2022, "citation": "Tupikova, I. (2022). Astronomical Orientation of the Pyramids and Stellar Alignments. Max Planck Institute for the History of Science, Preprint 511.", "url": "https://www.mpiwg-berlin.mpg.de/preprint/astronomical-orientation-pyramids-and-stellar-alignments", "note": "Checked the preprint page on 2026-10-20: proposes Alioth-Mizar or Kochab-zeta UMi; says earlier work shifted chronologies to fit. Preprint, not peer-reviewed."},
  {"id": "puchkov-2023", "kind": "paper", "year": 2023, "citation": "Puchkov, A. (2023). Multi-star target model for astronomical orientation of the Old Kingdom Egyptian pyramids. The Oriental Studies 91.", "url": "https://skhodoznavstvo.org.ua/index.php/journal/article/download/290/291", "note": "Unchecked: abstract seen only as summarised in search results; pages not found. Argues the Old Kingdom is about two centuries older than the textual chronology."},
  {"id": "fischler-1979", "kind": "critique", "year": 1979, "citation": "Fischler, R. (1979). What did Herodotus really say? or how to build (a theory of) the Great Pyramid. Environment and Planning B 6(1), 89-93. doi:10.1068/b060089.", "url": "https://journals.sagepub.com/doi/abs/10.1068/b060089", "note": "Checked: listing and abstract (RePEc, SAGE) on 2026-10-20; full text not read. Peer-reviewed. Traces the Herodotus face-area reading."},
  {"id": "markowsky-1992", "kind": "critique", "year": 1992, "citation": "Markowsky, G. (1992). Misconceptions about the golden ratio. The College Mathematics Journal 23(1), 2-19.", "note": "Checked bibliographically (JSTOR 2686193) on 2026-10-20; the Great Pyramid section read only through secondary accounts. Peer-reviewed."},
  {"id": "imhausen-2016", "kind": "reference", "year": 2016, "citation": "Imhausen, A. (2016). Mathematics in Ancient Egypt: A Contextual History. Princeton: Princeton University Press.", "note": "Unchecked: from memory. Standard modern account of the RMP, including the seked problems and the 256/81 circle rule."},
  {"id": "petrie-1892", "kind": "survey", "year": 1892, "citation": "Petrie, W. M. F. (1892). Medum. London: D. Nutt.", "note": "Unchecked: cited by dash-2017 (p. 6, Meidum casing alignment) and, via Wikipedia, for the Meidum slope of 51 deg 50' 35\"."},
  {"id": "isler-1989", "kind": "paper", "year": 1989, "citation": "Isler, M. (1989). An ancient method of finding and extending direction. Journal of the American Research Center in Egypt 26, 191-206.", "note": "Unchecked: from the bibliography of dash-2017. The solar gnomon (Indian circle) method."},
  {"id": "west-1979", "kind": "proponent", "year": 1979, "citation": "West, J. A. (1979). Serpent in the Sky: The High Wisdom of Ancient Egypt. New York: Harper & Row.", "note": "Unchecked: from memory. Brings Schwaller de Lubicz's phi readings to English readers; page not found."},
  {"id": "santillana-dechend-1969", "kind": "proponent", "year": 1969, "citation": "de Santillana, G. & von Dechend, H. (1969). Hamlet's Mill: An Essay on Myth and the Frame of Time. Boston: Gambit.", "note": "Unchecked: from memory. Origin of the precessional-number reading (72, 2,160, 4,320, 432,000) that Hancock 1995 applies to 1:43,200."}
]
```

**Sources consulted (web):**
- [Spence 2000 PDF](https://boinc.sk/sites/default/files/node/2018/08/Spence%202000.pdf)
- [Dash 2017, JAEA 2](https://web.ujaen.es/investiga/egiptologia/journalarchitecture/downloads/JAEA2/JAEA2_Dash.pdf) and the [JAEA 2 contents](https://web.ujaen.es/investiga/egiptologia/journalarchitecture/JAEA2.php)
- [Rossi & Imhausen 2009](https://re.public.polimi.it/retrieve/e0c31c09-da17-4599-e053-1705fe0aef77/Rossi%26Imhausen.pdf)
- [Rossi 2004, Conclusion to Part III](https://www.cambridge.org/core/books/architecture-and-mathematics-in-ancient-egypt/conclusion-to-part-iii-interpreting-the-slope-of-pyramids/E84024F8654A72857662F53D0FB14BEE)
- [Herz-Fischler 2000 on MUSE](https://muse.jhu.edu/book/14297), the [49th Shelf listing](https://49thshelf.com/content/view/full/223723) and the [Reynolds review](https://www.maths.tcd.ie/EMIS/journals/NNJ/reviews_v3n4-Reynolds.html)
- [IAC record for Belmonte 2001](https://www.iac.es/en/science-and-technology/publications/orientation-old-kingdom-egyptian-pyramids) and the [IAC press release](https://www.iac.es/en/outreach/news/new-study-astronomical-orientation-pyramids-egypt)
- [Tupikova 2022](https://www.mpiwg-berlin.mpg.de/preprint/astronomical-orientation-pyramids-and-stellar-alignments)
- [Magli 2009 on arXiv](https://arxiv.org/pdf/0708.3632)
- [Fischler 1979 on SAGE](https://journals.sagepub.com/doi/abs/10.1068/b060089)
- [Markowsky 1992 (mirror)](https://webarchive.lib.cuhk.edu.hk/20210329125916mp_/http://www.math.cuhk.edu.hk/~pschan/uged1533/markowsky.pdf)
- [Greenberg's Rhind page](https://sites.math.washington.edu//~greenber/Rhind.html)
- [Puchkov 2023](https://skhodoznavstvo.org.ua/index.php/journal/article/download/290/291)
- [Nature 35089138](https://www.nature.com/articles/35089138) and [35089140](https://www.nature.com/articles/35089140)
- [Wikipedia: Meidum](https://en.wikipedia.org/wiki/Meidum), [Seked](https://en.wikipedia.org/wiki/Seked) and [Pseudoscientific metrology](https://en.wikipedia.org/wiki/Pseudoscientific_metrology)
- [Seattle Times review, 1995](https://archive.seattletimes.com/archive/19950829/2138704/ancient-warnings----was-there-a-civilization-before-civilization-as-we-know-of)
- [Hall of Ma'at on 43,200](https://www.hallofmaat.com/?p=5554)
- [Taylor 1859 catalogue record](https://bvbvf1.bib-bvb.de/vufind/Record/DE-604.BV043914896/Details)
