# Research for chapter 8: The shafts under Khafre's pyramid

A headless draft from `python scripts/research.py start khafre-sar`: claude-haiku-5-5, claude-opus-5-5 at high effort, 93 turns, $3.01 on the API key, ended 2026-10-20T04:32:49+00:00. Citations marked [unchecked] are still to be checked against the work itself, and nothing here is data until it is entered in `data/`.

---

# Chapter 8 research brief: the shafts under Khafre's pyramid

Status of the sources: I checked the retraction against Crossref's records, read Hawass's statement in Al-Ahram Weekly, and read the first and last pages of Alvarez's 1970 *Science* paper. Most of the Khafre Project's own numbers come only from secondary reports. Their primary document, a "Project Abstract" PDF on Google Drive, is over 10 MB and could not be fetched here.

---

## 1. The claim at full strength

A radar engineer with a solid record of peer-reviewed SAR papers (Filippo Biondi: Mosul dam, ship wakes, river velocities) developed a method that does not depend on radar going into rock. Biondi said himself that direct penetration is "absolutely less than 10 meters". Instead, the method splits a satellite's synthetic aperture into Doppler sub-apertures and reads the tiny vibrations of the ground surface, driven by background seismic noise. It treats them as an acoustic signal from what lies beneath, in the way seismology or ultrasound reads a body.

Applied to the Great Pyramid in a paper that passed peer review (2022), the method is said to have recovered the known chambers and the muon-detected Big Void. Applied to Khafre on 15–16 March 2025, it shows:

- five evenly spaced chambers inside the pyramid's base;
- eight hollow vertical cylinders about 10–12 m across, in two north–south rows of four, each wrapped in a descending spiral;
- the cylinders ending about 648 m down in two cubic chambers about 80 m on a side;
- further structures toward 1.2 km and perhaps 2 km.

The team says four separate satellite operators gave the same picture. Fair-minded proponents do not call this proof. They call it an anomaly pattern too regular to be geology, which deserves a borehole, and they note that muon surveys, which look upward from chambers, cannot test anything beneath the base.

## 2. The proponents' evidence

1. **The method exists and was peer reviewed once.** Biondi & Malanga, "Synthetic Aperture Radar Doppler Tomography Reveals Details of Undiscovered High-Resolution Internal Structure of the Great Pyramid of Giza", *Remote Sensing* 14(20), 5231, published 19 Oct 2022, CC BY 4.0 **[checked: Crossref record]**; arXiv preprint 2208.00811, 1 Aug 2022 **[checked]**.
   - The data are COSMO-SkyMed time series. The abstract states outright that SAR normally sees only surfaces and that the method reads micro-movements instead **[checked: arXiv abstract]**.
   - About 20 structures are claimed inside Khufu **[checked: Opus Magnum page and Retraction Watch, both reporting]**.
   - *Strength:* the paper was **retracted on 10 August 2026** (see Reply, item 1). For this evidence to stand, the retraction's "methodological flaws and statistical errors" would have to be wrong.
2. **The method on a volcano.** Biondi (2022), "Scanning Inside Volcanoes with Synthetic Aperture Radar Echography Tomographic Doppler Imaging", *Remote Sensing* 14(15), 3828 **[unchecked: Wikitia list and Pilicy 2025]**. It is the same method on a natural target, and its retraction status was not checked. *Strength:* it was never validated against an independent subsurface survey of that volcano, as far as I found.
3. **The Khafre anomaly pattern.** Eight cylinders, two rows of four running north–south, spirals, two cubes of about 80 m, and five "djed" chambers in the base. This comes from Malanga, Biondi, Mei and Nicole Ciccolo, Khafre Project press conference, 15 March 2025, with a second day on 16 March and the video posted 22 March. Sources:
   - Collins 2025, figs. 1–3, credited "Khafre SAR Project" **[checked: ResearchGate abstract and captions]**;
   - Bonaventura, *Geopop*, 25 Mar 2025 **[checked]**;
   - Opus Magnum page **[checked]**.

   *Strength:* not peer reviewed and no paper published; the processing (the "steering matrix") is undisclosed (Pilicy 2025, **[checked]**). For it to be wrong, the regularity would have to come from the processing itself: sidelobes, periodic artefacts, or interpretation drawn onto noise.
4. **Several satellites agree.** Biondi, on Jesse Michels' *American Alchemy* podcast, reported by WION on 9 Dec 2025: Umbra, Capella, ICEYE and COSMO-SkyMed "gave exactly the same results" **[checked: WION report; podcast not heard]**. *Strength:* this is an interview claim with no data released. Agreement among sensors does not rule out a shared artefact if the same processing is applied to all of them. As far as I know all four are X-band **[unchecked: from memory]**.
5. **"The critics attack the wrong thing."** Pilicy, "Tomographic Evidence Beneath the Pyramid of Khafre: Methodological Appraisal and Critical Responses", grahamhancock.com, 27 Jun 2025 **[checked]**.
   - It argues that the penetration objection (Hawass, Parcak) misreads a vibration method.
   - It says Shermer and Milo Rossi argued from the weakest image (its Fig. 3) rather than the tomogram (Fig. 1).
   - It concedes the gaps: no paper, no disclosed method, an unclear role for AI, and no account of how natural voids were told from artificial ones.

   *Strength:* this is the best-argued sympathetic piece. It concedes that the work is "not proof".
6. **Later expansions.**
   - Menkaure: a "90 per cent chance" it shares Khafre's pillars (Biondi to the Daily Mail, via WION, 11 Jun 2025, **[checked: WION]**).
   - A buried "second Sphinx", at about 80 % confidence (Matt Beall podcast, 26 Mar 2026, **[unchecked: secondary coverage]**).
   - Books: Malanga & Biondi, *Khnum-Khufu. Cheope: la fine di un mistero*, Spazio Interiore, Sept 2023, 216 pp. **[checked: retailer]**; Malanga, Biondi & Mei, *Giza. La città svelata. Dove gli dèi manipolavano la vita*, Spazio Interiore, June 2026, 256 pp., EAN 9791281798304 **[checked: Macrolibrarsi listing]**.
   - Joe Rogan Experience #2443, 23 Jan 2026 **[unchecked: podcast index]**; History Channel, *The UnXplained*, "What's Really Hidden Beneath the Pyramids of Giza?", August 2026 **[checked: Retraction Watch report]**.

   *Strength:* adds reach, not evidence.

## 3. Receipts

- **Structure tier already in the database:** `g2.sar-shafts`, evidence `claimed`, source `khafre-project-2025` (`data/structures.json`). Its note gives "a complex to about 1.2 km", which matches the transcript summaries (Moody 2025; Ahram's 1,220 m).
- **Depth against the pyramid.** 648 m ÷ `g2.base.side.mean` (215.25 m, lehner-1997) = 3.0 base sides, and 648 ÷ `g2.height.original` (143.5 m) = 4.5 pyramid heights. That is a new comparison, or just a label on the overlay.
- **Depth against what is excavated.** The deepest levels the database places:
  - `g2.passage.horizontal.floor.begin.up` = −3.0 m (maragioglio-rinaldi-1966, p. 55, verified);
  - `g2.chamber.great.floor.up` = −3.0 m (unverified, read from pp. 55/57).

  The claimed shafts go about 216 times deeper than any known room of Khafre's.
- **Not in the database:** the level of the lower chamber.
  - Petrie's `g2.chamber.lower.length.north` and the other lower-chamber records give its plan (10.46 × 3.13 m) but no level.
  - Maragioglio and Rinaldi give only angles for the lower system (`g2.passage.lower_descending.angle` −22°40′, `g2.passage.lower_ascending.angle` 21°40′) and no depth. I re-read pp. 53–63 of the OCR and confirmed this.
  - A level would have to come from Hölscher 1912's sections or Lehner 1997 and be entered as a new key.
- **Water table (data to add).** Sharafeldin et al. 2019 put the plateau's groundwater at about +14.5 to +17 m above sea level, with the fractured-limestone table 4–7 m below ground near the Sphinx **[checked]**.
  - `g2.base.elevation.relative` puts Khafre's base about 10 m above Khufu's.
  - The absolute elevation of Khufu's base (about 60 m above sea level, **[unchecked: from memory]**) is not in the database. With it, the water table lies about 55 m below Khafre's base, and roughly 590 m of each claimed shaft would be below it.
  - Keys needed: `g1.base.elevation.msl`, and a `giza.watertable.elevation` record on `sharafeldin-2019`.
- **Radar penetration (data to add as a reference figure, not a measurement of the monument).**
  - L-band SIR-A in hyper-arid sand: imaging depth at most about 1.5 m measured in the field, and 2–3 m in dune sand (Schaber et al. 1986, **[unchecked: abstract snippet]**).
  - About 1–2 m measured in the field and at least 5 m calculated (McCauley et al. 1982, **[unchecked: abstract snippet]**).
  - ESA's figure: "up to 10 meters" (TRT World, **[checked]**).
- **No claim YAML exists.** A claim could compare the shaft depth with radar imaging depth, but it would have no `for` source beyond a press conference. The honest receipt is the gap between the two depths, drawn to scale.

## 4. The archaeologists' reply

1. **The method's one peer-reviewed paper was retracted.** Retraction notice, *Remote Sensing* 18(16), 2679, DOI 10.3390/rs18162679, published 10 Aug 2026, CC BY 4.0 **[checked: Crossref record]**.
   - A reader raised concerns about methodology. The editors "confirmed serious methodological flaws and statistical errors" that undermined the conclusions. The authors disagree with the retraction.
   - These words are **[checked: as quoted in Santoro, Retraction Watch, 31 Aug 2026]**; the MDPI page itself returned 403.
   - The date in your summary, 10 August 2026, is **confirmed**.
   - The notice alleges no misconduct (Greenme and Newsweek, **[unchecked]**).
   - Note: the 2022 paper is about Khufu; the Khafre work was never in a journal.
2. **The physics: the satellite cannot sense what it does not see.** Lawrence Conyers (University of Denver, radar in archaeology) called the underground city "a huge exaggeration" (Daily Mail, March 2025, via Egyptian Streets **[checked]**).
   - He told AFP that radar waves attenuate in the ground (via Yahoo/Euronews **[checked]**).
   - He told Retraction Watch that a radar sensor measures only what it directly "sees", and that the claimed micro-vibrations are far too small for a satellite to detect. He had told the journal in 2022 not to publish without a reviewer who understood the mathematics **[checked: Retraction Watch]**.
   - He also conceded that small natural or ritual caves under pyramids are plausible **[checked: Yahoo]**.
   - Biondi accepts the penetration limit (TRT World, **[checked]**). So the dispute is entirely about whether surface vibrations can be measured and inverted to 648 m.
3. **No independent reprocessing exists.** I found no published reanalysis of their data, because the raw data and code have not been released (Pilicy 2025 concedes this **[checked]**). This is the central evidential gap. Sabine Hossenfelder said the published images show cherry-picking (reported in Pilicy 2025 **[unchecked: video not seen]**).
4. **Egypt's antiquities authorities.** Zahi Hawass, in Al-Ahram Weekly, 8 Apr 2025 (Nevine El-Aref, "Controversy over Pyramid claims") **[checked]**:
   - radar use inside the pyramid is "completely false" and "fake news";
   - "No radar devices have been used inside the Pyramid";
   - the researchers "have never come to Egypt to do research";
   - the base is natural bedrock carved to about 8 m, with no shafts beneath.

   He called the team "completely wrong" (*The National*, via Yahoo **[checked as reported]**). The Ministry did not authorize work at Khafre (Egyptian Streets **[checked]**; Salima Ikram to Decrypt **[checked]**). Mamdouh al-Damaty, former minister: "utterly baseless" **[checked: Egyptian Streets]**.
5. **Other Egyptologists and scientists on record.**
   - Salima Ikram (American University in Cairo): no paper, no raw data, "most machinery cannot penetrate that deeply" (Decrypt, 25 Mar 2025 **[checked]**).
   - Sarah Parcak: SAR "can't see through rock. Period." **[checked: Retraction Watch]**.
   - Flint Dibble and Milo Rossi: the reconstruction recalls the *Total Recall* reactor; the water table would flood deep megastructures (Moss, *National Geographic*, 16 Apr 2025 **[checked]**).
   - Lynn Dodd (University of Southern California): voids next to pyramids are usually construction or robbers' shafts (Decrypt **[checked]**).
   - Hussein Abdel-Basir **[checked: Egyptian Streets]**.
   - Snopes found the most widely shared cross-section image AI-generated, 99.9 % by Hive (via Decrypt **[checked as quoted]**). An Annahar FactCheck traced a viral clip to an AI-art TikTok account, @weltmysterien **[unchecked: search snippet]**.
6. **The model of a real survey (ScanPyramids and its successors).** These used several independent instruments, published in peer review, and were confirmed:
   - Morishima et al. 2017, *Nature* 552, 386–390 (`morishima-2017`);
   - Procureur et al. 2023, *Nature Communications* 14, 1144 (`procureur-2023`, CC BY 4.0). The corridor it found was then seen by endoscope **[unchecked: from memory]**.
   - Helal et al. 2025, "Detection of two anomalies behind the Eastern face of the Menkaure Pyramid using a combination of non-destructive testing techniques", *NDT & E International* 155, 103331, DOI 10.1016/j.ndteint.2025.103331, by Cairo University, TU Munich and others, Hawass among the authors **[checked: TUM portal]**. It used ERT, GPR at 200/600 MHz and ultrasound, fused together. It found two air-filled anomalies about 1.1 m and 1.4 m behind the granite, about 1.5 × 1 m and 0.9 × 0.7 m **[sizes unchecked: secondary report]**.

   The contrast with the Khafre claim is depth (metres against hundreds of metres), disclosure and replication.
7. **Khafre has been muon-scanned before.** Alvarez et al. 1970, "Search for Hidden Chambers in the Pyramids", *Science* 167, 832–839, 6 Feb 1970 **[checked: scan]**.
   - Detectors in the Belzoni Chamber recorded over a million muons through about 100 m of limestone.
   - They looked through a 35° half-angle cone, 19 % of the volume, and found "no chambers with volumes similar to the four known chambers" of Khufu and Sneferu (p. 839).
   - This bears on the five "djed" chambers claimed inside the base, if they fall inside that cone (not established).
   - **Fair to the claim:** muons come from the sky, so neither Alvarez nor ScanPyramids says anything about what lies below a detector.

## 5. Where it stands

The claim rests on one unpublished application of a method whose only peer-reviewed showing was retracted for methodological and statistical errors. No raw data, code or independent reanalysis exists, and Egypt has neither permitted nor confirmed any work. Proponents can fairly say that no instrumented survey has tested the depths in question, and that a borehole or deep seismic line would settle it. Until the data are released, it remains an interpretation of an anomaly, not a measurement of a structure.

## 6. What the picture should show

- **The claim, at scale.** A cutaway of Khafre's pyramid on the ground plane with the eight cylinders below in two north–south rows, spirals, and the two 80 m cubes at −648 m. The pyramid's 143.5 m height is drawn beside the shafts for scale. Mark the whole of it "claimed — interpretation of SAR anomalies, not peer reviewed".
- **Measured against interpreted.** The project's tomogram (Pilicy Fig. 1, or Collins Fig. 3) side by side with the team's own 3D rendering (Collins Fig. 2), so the viewer sees which lines are data and which are drawing.
- **The known substructure.** The excavated passages and Belzoni Chamber at about −3 m, thin as a hairline at this scale, with Alvarez's 35° muon cone drawn up from the chamber.
- **The reply image.** The same section with three horizontal lines:
  - radar imaging depth in dry sand (about 1.5 m; ESA's 10 m at most);
  - the water table (about 55 m down, pending data);
  - the shafts' 648 m.

  The empty column between 10 m and 648 m is the argument.

## 7. Open questions

- **The primary document.** The Project Abstract PDF on Google Drive, file id 1Leaa2tf3OHK31OTmdey_CRa-0vC9-CTD, is over 10 MB and was not read. It probably holds the figure numbers, the shaft spacing and the depth labels. Read it before modelling.
- **Venue.** I could not confirm Bologna. Only Moody's Medium summary of the transcript says Bologna; AFP/Euronews say "a briefing in Italy".
- **Figure drift.**
  - Cube side: 80 m (most reports) against 90 m (National Geographic, TRT).
  - Coil end: 648 m against about 1,067 m ("3,500 ft", Biondi, Dec 2025).
  - Deeper structures: 1.2 km against 2 km against "4,000 ft". Ahram adds an "over 1,980 m across" extent.
  - Hawass quoted a depth of "168 meters" (TRT).
- **No data at all for:** shaft spacing, the rows' offset from the base centre, which corner or side they lie under, spiral pitch, and the djed chambers' size.
- **Whether the five djed chambers fall inside Alvarez's 19 % cone.**
- **Status of the volcano paper** (*Remote Sensing* 14, 3828).
- **Helal 2025's licence and anomaly sizes.**
- **The 2022 paper's figure numbers.** ResearchGate labels the 3D reconstruction "Figure 22" while its file is fig16. Confirm against the PDF (44 MB, not fetched).
- **Not seen directly:** the Snopes article (paywalled here) and the History Channel episode.

## For the model

Positions use Seked's frame: origin at Khufu's base centre, +X east, +Y north, +Z up. Khafre's centre is 353.86 m south and 334.41 m west (`g2.centre.offset.*`), and its base is about 10 m higher.

| Feature | Value (m) | Measured or interpreted | Source and figure |
|---|---|---|---|
| Vertical cylinders, count | 8 | interpreted (anomalies read as shafts) | press conference 15 Mar 2025; Collins 2025 fig. 2–3 [checked: captions]; Geopop [checked] |
| Layout in plan | two rows of 4, rows north–south | interpreted | Collins 2025 text, "SAR-based images indicate… north-south" [checked: abstract page]; Greek Reporter 24 Mar 2025 "two parallel rows of four" [checked] |
| Spacing, offset from base centre, side or corner | **not published** | — | none found |
| Diameter | 10.1–11.9 (33–39 ft) | interpreted | TBS News / Daily Mail syndication, 23 Mar 2025 [checked: TBS]; figure number not found |
| Spiral around each | present; pitch and width not published | interpreted | Geopop; Pilicy 2025 |
| Shaft bottom | −648 below the plateau surface (reported as below the base) | interpreted | Geopop; Collins; Moss/NatGeo [all checked]; Ahram rounds it to "610 m" |
| Water level or "water system" | about −640 (above the cubes) | interpreted | TRT World [checked]; Moody 2025 [checked] |
| Cubic chambers | 2, each about 80 per side (some reports 90); 4 shafts into each | interpreted | Geopop, Collins [checked]; TBS: "two rectangular enclosures ~260 ft (79 m) per side, each with four shafts" [checked] |
| Five djed chambers | inside the pyramid's base, evenly spaced, above the Belzoni chamber; size not published | interpreted | Collins fig. 1 [checked: caption]; Decrypt [checked] |
| Deeper structures | about −1,200 (Moody, Ahram −1,220); "about 2 km" (NatGeo, Geopop); coils ending about −1,067 (Biondi, Dec 2025) | interpreted | as cited |
| Known Khafre substructure | upper horizontal passage and crypt floor at about −3.0; upper threshold +12.90; descending passage −26°38′; lower system angles only; lower chamber 10.46 × 3.13, level unknown | measured | `g2-interior.json`, maragioglio-rinaldi-1966, petrie-1883 |

What the claimants have shown, by kind:

- **Tomograms or slices of processed data:** the "latest tomography" (Pilicy Fig. 1, "available as of March 22"), Collins fig. 3, and the 2022 paper's tomograms. They are colour-coded: blue is dense; red, green and yellow are voids, per Collins.
- **The authors' own 3D renderings of the interpretation:** Collins fig. 1 and 2 (Khafre SAR Project) and the 2022 paper's 3D reconstruction ("Figure 22", "downstream of the interpretation of tomograms").
- **AI images by third parties, not the team's:** the viral cross-section (Snopes) and the @weltmysterien video.
- **No depth maps with published scale bars** were found.

## Images and rights

| Image | Where | URL | Resolution | Licence | Ask |
|---|---|---|---|---|---|
| 2022 Khufu tomograms and 3D reconstruction ("Fig. 22"), SAR geometry (Fig. 3), vibrations (Figs. 4, 6), sub-apertures (Fig. 7) | Biondi & Malanga 2022 (retracted) | https://www.mdpi.com/2072-4292/14/20/5231 ; arXiv 2208.00811 | not determined | CC BY 4.0 [checked: Crossref licence field]; the arXiv copy is under arXiv's non-exclusive licence | none needed; must be captioned "retracted 10 Aug 2026" |
| Khafre "latest tomography" | Pilicy 2025, Fig. 1, "Reproduced with permission of Khafre SAR Project" | https://grahamhancock.com/pilicyd1/ | not determined | authors' copyright | Khafre Project press office, ufficiostampa@expedition-nicoleciccolo.com [checked: Opus Magnum page] |
| Djed chambers; 8 wells and cubes (rendering); 8-tube anomaly (tomogram) | Collins 2025, figs. 1–3, credit Khafre SAR Project | https://www.researchgate.net/publication/390267683 | not determined | authors' copyright | as above |
| Project Abstract figures | Google Drive PDF | https://drive.google.com/file/d/1Leaa2tf3OHK31OTmdey_CRa-0vC9-CTD/view | over 10 MB, not opened | authors' copyright | as above |
| Press conference frames | YouTube, Nicole Ciccolo channel, posted 22 Mar 2025 | https://www.youtube.com/watch?v=xDpdJFlLpRE (also qop3jd9qL9E) | timestamps not found (YouTube blocked fetch) | authors' copyright | as above |
| Corridor muography (reply) | Procureur 2023 | https://www.nature.com/articles/s41467-023-36351-0 | — | CC BY 4.0 | none |
| Water-table maps (reply) | Sharafeldin 2019 | https://gi.copernicus.org/articles/8/29/2019/ | — | CC BY 4.0 [checked] | none |
| Menkaure ERT/GPR fusion (reply) | Helal 2025 | https://doi.org/10.1016/j.ndteint.2025.103331 | — | "© 2025 The Author(s)", probably open access; licence not checked | check the article page |
| Alvarez detector and cone (reply) | *Science* 167, 832 | MIT copy (scan) | 4768 × 6490 px scan | AAAS copyright | AAAS permissions |

## New sources

```json
[
  {"id": "biondi-malanga-2022", "kind": "proponent", "year": 2022, "citation": "Biondi, F. & Malanga, C. (2022). Synthetic Aperture Radar Doppler Tomography Reveals Details of Undiscovered High-Resolution Internal Structure of the Great Pyramid of Giza. Remote Sensing 14(20), 5231. doi:10.3390/rs14205231. RETRACTED 2026-08-10.", "url": "https://www.mdpi.com/2072-4292/14/20/5231", "note": "Checked against the Crossref record (published 2022-10-19, CC BY 4.0, updated-by retraction 10.3390/rs18162679) and the arXiv abstract 2208.00811. Peer reviewed, then retracted. MDPI page returned 403; figure numbers not checked."},
  {"id": "remote-sensing-retraction-2026", "kind": "critique", "year": 2026, "citation": "Remote Sensing Editorial Office (2026). RETRACTED: Biondi, F.; Malanga, C. Synthetic Aperture Radar Doppler Tomography Reveals Details of Undiscovered High-Resolution Internal Structure of the Great Pyramid of Giza. Remote Sens. 2022, 14, 5231. Remote Sensing 18(16), 2679. doi:10.3390/rs18162679.", "url": "https://www.mdpi.com/2072-4292/18/16/2679", "note": "Date 2026-08-10 and CC BY 4.0 checked against Crossref. The stated reasons ('serious methodological flaws and statistical errors', raised by a reader; authors disagree) checked only as quoted by Retraction Watch; MDPI page returned 403."},
  {"id": "retraction-watch-2026", "kind": "critique", "year": 2026, "citation": "Santoro, H. (2026). Journal retracts paper claiming network of corridors inside the Great Pyramid of Giza. Retraction Watch, 31 August 2026 (updated 1 September).", "url": "https://retractionwatch.com/2026/08/31/retraction-corridors-inside-great-pyramid-giza/", "note": "Checked. Quotes Conyers and Parcak; names the History Channel episode and Rogan #2443. Journalism, not peer reviewed."},
  {"id": "biondi-2022-volcano", "kind": "proponent", "year": 2022, "citation": "Biondi, F. (2022). Scanning Inside Volcanoes with Synthetic Aperture Radar Echography Tomographic Doppler Imaging. Remote Sensing 14(15), 3828. doi:10.3390/rs14153828.", "url": "https://doi.org/10.3390/rs14153828", "note": "Unchecked: from Wikitia's publication list and Pilicy 2025. Peer reviewed; current retraction status not checked."},
  {"id": "collins-2025", "kind": "proponent", "year": 2025, "citation": "Collins, A. (2025). What Really Lies Beneath the Pyramids? The Megastructures of Giza: A Preliminary Report. ResearchGate preprint, 28 March 2025.", "url": "https://www.researchgate.net/publication/390267683_What_Really_Lies_Beneath_the_Pyramids", "note": "Checked (abstract page and figure captions). Not peer reviewed. Source for the two N-S rows of four and the 80 m cubes; figs. 1-3 credited Khafre SAR Project."},
  {"id": "pilicy-2025", "kind": "proponent", "year": 2025, "citation": "Pilicy, D. (2025). Tomographic Evidence Beneath the Pyramid of Khafre: Methodological Appraisal and Critical Responses. grahamhancock.com, 27 June 2025.", "url": "https://grahamhancock.com/pilicyd1/", "note": "Checked. Sympathetic appraisal; concedes no paper, undisclosed steering-matrix method, no reproduction. Fig. 1 is the project's tomogram, reproduced with permission."},
  {"id": "malanga-biondi-2023", "kind": "proponent", "year": 2023, "citation": "Malanga, C. & Biondi, F. (2023). Khnum-Khufu. Cheope: la fine di un mistero. Quando gli dèi non volevano morire. Edizioni Spazio Interiore, 216 pp.", "url": "https://www.libreriauniversitaria.it/khnum-khufu-cheope-fine-mistero/libro/9791280002716", "note": "Checked against retailer listings only (September 2023). Not peer reviewed; contents not read."},
  {"id": "malanga-biondi-mei-2026", "kind": "proponent", "year": 2026, "citation": "Malanga, C., Biondi, F. & Mei, A. (2026). Giza. La città svelata. Dove gli dèi manipolavano la vita. Edizioni Spazio Interiore, 256 pp. EAN 9791281798304.", "url": "https://www.macrolibrarsi.it/libri/__giza-la-citta-svelata.php", "note": "Checked against the retailer listing (June 2026). Not peer reviewed; contents not read, so no figures are taken from it."},
  {"id": "el-aref-2025", "kind": "critique", "year": 2025, "citation": "El-Aref, N. (2025). Controversy over Pyramid claims. Al-Ahram Weekly, 8 April 2025.", "url": "https://english.ahram.org.eg/NewsContent/50/1207/544236/AlAhram-Weekly/Heritage/Controversy-over-Pyramid-claims.aspx", "note": "Checked. Hawass's statement: radar use 'completely false', no radar devices used, base bedrock carved to about 8 m, researchers never worked in Egypt."},
  {"id": "moss-2025", "kind": "critique", "year": 2025, "citation": "Moss, C. (2025). Is there really a secret city under Egypt's Giza pyramids? National Geographic, 16 April 2025.", "url": "https://www.nationalgeographic.com/history/article/is-there-a-secret-city-under-the-pyramids-", "note": "Checked. Dibble, Rossi, Conyers, Hawass, Parcak; gives the cubes as 90 m."},
  {"id": "nelson-2025-decrypt", "kind": "critique", "year": 2025, "citation": "Nelson, J. (2025). Ancient Mystery or Modern Hoax? Experts Debunk Giza Pyramid Claims. Decrypt, 25 March 2025.", "url": "https://decrypt.co/311432/ancient-mystery-modern-hoax-experts-debunk-giza-pyramid", "note": "Checked. Salima Ikram, Flora Anthony, Lynn Dodd; relays Snopes's finding that the viral cross-section is AI-generated."},
  {"id": "amza-trt-2025", "kind": "critique", "year": 2025, "citation": "Amza, A. (2025). EXCLUSIVE: Is there a secret city under the Giza Pyramids? Unpacking the controversy. TRT World.", "url": "https://www.trtworld.com/article/1bd4fb6965ee", "note": "Checked; undated on page (March-April 2025). ESA's statement that SAR penetration 'can go up to 10 meters'; Biondi: 'absolutely less than 10 meters'."},
  {"id": "nawar-2025", "kind": "critique", "year": 2025, "citation": "Nawar, B. (2025). Unraveling the Pyramid Mystery: Claims of an Underground City Debunked. Egyptian Streets, 26 March 2025.", "url": "https://egyptianstreets.com/2025/03/26/unraveling-the-pyramid-mystery-claims-of-an-underground-city-debunked/", "note": "Checked. Conyers, al-Damaty, Abdel-Basir; Ministry did not authorize work at Khafre."},
  {"id": "bonaventura-2025", "kind": "critique", "year": 2025, "citation": "Bonaventura, F. (2025). Strutture sotto la piramide di Chefren a Giza: verità o bufala? Geopop, 25 March 2025.", "url": "https://www.geopop.it/strutture-sotto-la-piramide-di-chefren-a-giza-verita-o-bufala-tutti-i-dubbi-sulla-presunta-scoperta/", "note": "Checked. Dates the press conference 15 March 2025, video posted 22 March; 8 shafts to 648 m, 80 m cubes, about 2 km."},
  {"id": "alvarez-1970", "kind": "survey", "year": 1970, "citation": "Alvarez, L. W. et al. (1970). Search for Hidden Chambers in the Pyramids. Science 167(3919), 832-839, 6 February 1970.", "url": "https://bpb-us-e1.wpmucdn.com/sites.mit.edu/dist/9/2055/files/2025/08/AlvarezPyramids.pdf", "note": "Checked pp. 832 and 839 of the scan: detectors in the Belzoni Chamber, 35-degree half-angle cone, 19 per cent of the volume, no chamber the size of the known Fourth Dynasty chambers. Peer reviewed. AAAS copyright."},
  {"id": "helal-2025", "kind": "survey", "year": 2025, "citation": "Helal, K., Pugacheva, P., Allam, H. et al., incl. Hawass, Z., Tayoubi, M., Grosse, C. U., Helal, H. & Elkarmoty, M. (2025). Detection of two anomalies behind the Eastern face of the Menkaure Pyramid using a combination of non-destructive testing techniques. NDT & E International 155, 103331.", "url": "https://doi.org/10.1016/j.ndteint.2025.103331", "note": "Citation and abstract checked on the TUM portal; peer reviewed. Anomaly depths and sizes (about 1.1 and 1.4 m) unchecked, from secondary reports; licence not checked."},
  {"id": "sharafeldin-2019", "kind": "paper", "year": 2019, "citation": "Sharafeldin, S. M., Essa, K. S., Youssef, M. A. S., Karsli, H., Diab, Z. E. & Sayil, N. (2019). Shallow geophysical techniques to investigate the groundwater table at the Great Pyramids of Giza, Egypt. Geoscientific Instrumentation, Methods and Data Systems 8, 29-43. doi:10.5194/gi-8-29-2019.", "url": "https://gi.copernicus.org/articles/8/29/2019/", "note": "Checked. Peer reviewed, CC BY 4.0. Water table about +14.5 to +17 m above sea level across the plateau."},
  {"id": "mccauley-1982", "kind": "paper", "year": 1982, "citation": "McCauley, J. F. et al. (1982). Subsurface valleys and geoarcheology of the eastern Sahara revealed by Shuttle radar. Science 218, 1004-1020.", "url": "https://pubs.usgs.gov/publication/70011668", "note": "Unchecked: abstract seen only in search snippets (USGS page returned 403); end page given as 1019 by one snippet. L-band penetration of dry sand: at least 1 m measured in the field, 2 m or more in places, at least 5 m calculated."},
  {"id": "schaber-1986", "kind": "paper", "year": 1986, "citation": "Schaber, G. G., McCauley, J. F., Breed, C. S. & Olhoeft, G. R. (1986). Shuttle imaging radar: physical controls on signal penetration and subsurface scattering in the eastern Sahara. IEEE Transactions on Geoscience and Remote Sensing GE-24(4), 603-623.", "url": "https://www.usgs.gov/publications/shuttle-imaging-radar-physical-controls-signal-penetration-and-subsurface-scattering", "note": "Unchecked: the imaging-depth maximum of 1.5 m comes from a search snippet; volume and pages from memory."}
]
```

The existing `khafre-project-2025` record should have its note updated to name:

- the press-conference dates, 15–16 March 2025 (Bologna unconfirmed);
- the YouTube recording (xDpdJFlLpRE);
- the Project Abstract PDF (Google Drive id above, not yet read);
- the press contact, ufficiostampa@expedition-nicoleciccolo.com.

Sources:
- [Retraction Watch, 31 Aug 2026](https://retractionwatch.com/2026/08/31/retraction-corridors-inside-great-pyramid-giza/)
- [Crossref record, 10.3390/rs14205231](https://api.crossref.org/works/10.3390/rs14205231)
- [Crossref record, 10.3390/rs18162679](https://api.crossref.org/works/10.3390/rs18162679)
- [arXiv 2208.00811](https://arxiv.org/abs/2208.00811)
- [Al-Ahram Weekly](https://english.ahram.org.eg/NewsContent/50/1207/544236/AlAhram-Weekly/Heritage/Controversy-over-Pyramid-claims.aspx)
- [National Geographic](https://www.nationalgeographic.com/history/article/is-there-a-secret-city-under-the-pyramids-)
- [Geopop](https://www.geopop.it/strutture-sotto-la-piramide-di-chefren-a-giza-verita-o-bufala-tutti-i-dubbi-sulla-presunta-scoperta/)
- [Greek Reporter](https://greekreporter.com/2025/03/24/giant-structures-beneath-pyramid-giza-evidence/)
- [TBS News](https://www.tbsnews.net/node/1099826)
- [Egyptian Streets](https://egyptianstreets.com/2025/03/26/unraveling-the-pyramid-mystery-claims-of-an-underground-city-debunked/)
- [Yahoo/Euronews](https://www.yahoo.com/news/going-underground-experts-clash-over-071249719.html)
- [Decrypt](https://decrypt.co/311432/ancient-mystery-modern-hoax-experts-debunk-giza-pyramid)
- [TRT World](https://www.trtworld.com/article/1bd4fb6965ee)
- [Pilicy, grahamhancock.com](https://grahamhancock.com/pilicyd1/)
- [Collins, ResearchGate](https://www.researchgate.net/publication/390267683_What_Really_Lies_Beneath_the_Pyramids)
- [Opus Magnum Khafre Project page](https://opusmagnum.org/khafreproject/)
- [WION, Dec 2025](https://wionews.com/trending/scientist-offers-more-proof-to-claim-colossal-structures-lie-under-egyptian-pyramids-1765286429938)
- [WION, Jun 2025](https://wionews.com/trending/another-lost-city-detected-under-egyptian-pyramid-by-scientists-bu-it-says-expert-1749609642375)
- [Egypt Independent](https://www.egyptindependent.com/separating-myth-from-fact-in-the-alleged-discovery-beneath-the-pyramids/)
- [Medium (Moody)](https://medium.com/the-mood/heres-the-giza-pyramid-press-conference-they-say-never-happened-52ba03ea07cc)
- [Macrolibrarsi](https://www.macrolibrarsi.it/libri/__giza-la-citta-svelata.php)
- [TUM portal, Helal 2025](https://portal.fis.tum.de/en/publications/detection-of-two-anomalies-behind-the-eastern-face-of-the-menkaur/)
- [Sharafeldin 2019](https://gi.copernicus.org/articles/8/29/2019/)
- [Alvarez 1970 (MIT copy)](https://fisherp.mit.edu/wp-content/uploads/2025/08/AlvarezPyramids.pdf)
- [USGS, McCauley 1982](https://pubs.usgs.gov/publication/70011668)
- [Wikitia, Filippo Biondi](https://wikitia.com/wiki/Filippo_Biondi)
- [Newsweek](https://www.newsweek.com/bombshell-great-pyramid-giza-study-retracted-12412886)
