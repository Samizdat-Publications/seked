# Chapter 8 research: What would settle it

A headless draft from `python scripts/research.py start 8`: claude-haiku-5-5, claude-opus-5-5 at high effort, 64 turns, $2.05 on the API key, ended 2026-10-20T02:27:35+00:00. Citations marked [unchecked] are still to be checked against the work itself, and nothing here is data until it is entered in `data/`.

---

# Chapter 8 brief: what would settle it

**How this was researched.** I read `CLAUDE.md`, `docs/rethink-2026-10.md` (chapter 8 is "Drilling the ditch floor, the cavities under the Sphinx, the surveys not yet made"), `data/sources.json`, `data/structures.json` and `data/measurements/g1-voids.json`. Where I checked a figure against the work itself (the paper, a scan, the abstract or the publisher's page), it is marked **[checked]**. Anything taken from a secondary page or from memory is marked **[unchecked]**, with the secondary source named.

---

## 1. The claim at full strength

The age of the Sphinx is not a matter of opinion. It can be tested, and the tests have not been done.

In 1991 the seismic survey by Dobecki and Schoch, run with the antiquities authority's permission, found the limestone under the enclosure floor weathered to 1.8–2.5 m in front of and beside the Sphinx, but only about 1.2 m behind it. On the hypothesis's own logic, the front was cut long before the back. The same survey found a rectangular low-velocity anomaly under the forepaws.

Every one of these questions has a physical answer:

- A core through the floor at the front and at the back would measure the weathered zone directly.
- A cross-hole survey would show whether the paw anomaly is a room or a fissure.
- Luminescence dating of buried temple joints, and of the sediments in the ditch, would date when the stone was cut and covered.

The ScanPyramids muon work has shown what an instrumented answer looks like: a void announced with error bars, then confirmed with an endoscope. Yet Giza's floor has been drilled only for conservation. Four boreholes, 20 m deep, went into the bedrock around the Sphinx in 2008, and no account of how weathered their rock was has ever been published. Access is controlled by one authority, and its best-known official has publicly dismissed the hypothesis.

A fair proponent does not claim the tests would prove an older Sphinx. The claim is that the question is open until somebody looks, and that the looking is cheap.

---

## 2. The proponents' evidence

1. **The weathered zone under the floor is deeper at the front than at the back.**
   - *Who:* Dobecki & Schoch (`dobecki-schoch-1992`), from refraction lines shot in April 1991. Schoch, "Redating the Great Sphinx of Giza", *KMT* 3(2) (1992), 53–59, 66–70, gives about 1.8–2.5 m on the east, north and south and about 1.2 m on the west.
   - *Status of the figures:* **[checked]** as Harrell (1994, below) quotes them. The *Geoarchaeology* paper is peer reviewed, 7(6), 527–544; its title, authors and DOI 10.1002/gea.3340070603 are **[checked]** at Semantic Scholar, but its abstract is not online and I could not read the paper itself, so its page-level figures are **[unchecked]**.
   - *How the date follows:* Schoch assumes the rear was cut under Khafre, c. 2500 BCE. He then reads the 50–100% greater front depth, using a weathering rate that slows over time, as a minimum of c. 7000–5000 BCE for the front (**[unchecked]**: Wikipedia's summary of Schoch, and memory of Schoch & McNally, *Voices of the Rocks*, 1999).
   - *Strength:* moderate. It is wrong if the velocity contrast comes from the rock's original bedding and not from weathering, or if wet sand rather than open air did the weathering. See reply 3.

2. **There is a cavity under the forepaws.**
   - *Who:* Dobecki & Schoch's seismic lines show a rectangular low-velocity anomaly in front of the Sphinx. The project already models it as `sphinx.paw-cavity`, tier `claimed`, "about 5 m down".
   - *Status:* the size and depth are **[unchecked]**; I could not read them in the paper.
   - *Other surveys:* Waseda University (Yoshimura, 1987) reported a north–south tunnel beneath the Sphinx and cavities near both hind paws by electromagnetic sounding (**[unchecked]**: *Christian Science Monitor*, 23 June 1987, and a PBS NOVA reader-mail page that returned HTTP 401). Florida State's three-week survey for the Schor expedition in April 1996 reported "rooms and tunnels" in front of the Sphinx and from its rear (**[unchecked]**, same NOVA page).
   - *Strength:* weak to moderate. Three teams using three methods reported anomalies, but none has been ground-truthed. It is wrong if the anomalies are karst or joint-set fissures, which are common in the Mokattam limestone.

3. **The floor can be drilled, because it has been.**
   - *What happened:* in early 2008 the Supreme Council of Antiquities (SCA) and Cairo University's Engineering Center for Archaeology and Environment drilled "four boreholes four-inches in diameter and 20 meters (66 feet) deep into the bedrock beneath the Sphinx" and lowered cameras into them.
   - *Where the holes are:* the plan in the source shows PZ/S1 by the forepaws on the north, PZ/S2 behind the rump, PZ/S3 on the north flank and PZ/S4 to the south-east. Ground elevations are printed beside them: 20.492, 20.480, 20.505 and 20.193.
   - *Source:* YSI Inc., Application Note A579 (2009), pp. 1–2 **[checked]**. It is a vendor note, not peer reviewed.
   - *Why it matters:* this is close to the very test Schoch's argument calls for, made for another reason. As far as I can find, no log of the weathered zone was published from it.
   - *Strength:* strong as a point about access, but it is an absence of publication, not a finding.

4. **Physical dates from Giza scatter older than the king lists.**
   - *Who:* Liritzis & Vafiadou (2015), surface luminescence dating, *Journal of Cultural Heritage* 16, 134–150, peer reviewed **[checked]**. Table 1 (p. 137) gives:

     | Sample | Material | Age |
     |---|---|---|
     | Valley Temple VT1 | granite | 3060 ± 470 BCE |
     | Sphinx Temple ST5 | granite | 3100 ± 540 BCE |
     | Sphinx Temple ST4 | granite | 2740 ± 640 BCE |
     | Menkaure's pyramid | granite | 3450 ± 950 BCE |
     | Osiris Shaft sarcophagi | dacite, granite | 2930 ± 600 and 2870 ± 570 BCE |

   - *What the authors say:* their abstract reports "in some cases, predating... by some hundred of years". In the discussion (p. 147) they write that it is "a reasonable assumption that some structures were already present at Giza when the large-scale works of the fourth dynasty began".
   - *Radiocarbon:* the mortar project of 1984 found ages averaging 374 years older than the historical dates (**[checked]** on Ancient Egypt Research Associates' page, the project team's own summary; see reply 2).
   - *Strength:* weak for an *older Giza* in the strong sense. Every one of these ages lies within about 1.2 standard deviations of c. 2500 BCE. They do not reach toward 7000 BCE.

5. **The Hall of Records and the radar anomalies are what drilling would test.**
   - *The legend:* Cayce's readings (`cayce`) put a chamber of records between the Sphinx and the Nile, reached under the right paw (**[unchecked]**: secondary summaries; I did not confirm the reading numbers).
   - *The radar:* in March 2025 the Khafre Project (`khafre-project-2025`) announced eight shafts going down about 648 m, and chambers, beneath Khafre's pyramid, from SAR (synthetic-aperture radar) Doppler tomography. It was a press conference, not a paper (**[checked]**: Moss, *National Geographic*, 16 April 2025).
   - *Hancock's site:* it published a sympathetic but hedged review conceding the findings are "not proof of lost civilizations" and calling for the method paper (Pilicy, 27 June 2025, grahamhancock.com **[checked]**).
   - *The team:* reported to have filed a formal request with the Egyptian authorities in December 2025 (**[unchecked]**: a fringe news site).
   - *Strength:* the Cayce chamber is legendary. The SAR claim is now very weak (reply 4).

6. **The authority controls the evidence.**
   - *The record:* the Schor and Florida State survey of 1996 ended in a dispute with the authority. Hancock and Bauval argued that the paw anomaly should be opened and the surveys published (`hancock-bauval-1996`; **[unchecked]**, from memory; page not found).
   - *Today:* Zahi Hawass says no permit was ever granted for the Khafre radar work and calls it "baseless" (Moss 2025 **[checked]**).
   - *Strength:* this is a fact about governance, not about rock. It would be wrong to imply suppression: the authority did permit the 1991 seismic survey, the 1978 drilling, the 2008 drilling and ScanPyramids.

---

## 3. Receipts: what Seked can compute or show

**Already in the database**

- **The model of an instrumented answer.** `data/measurements/g1-voids.json` holds the ScanPyramids results, all verified:
  - the north-face corridor (`void.north_face_corridor.*`): 9.06 ± 0.07 m long, 2.02 ± 0.06 m wide, 2.18 ± 0.17 m high, about 20 m above the ground and 0.84 ± 0.05 m behind the Chevron (`procureur-2023`);
  - the Big Void (`void.big.length.min` = 30 m, `void.big.centre.from_queens_chamber_floor.min/max` = 40–50 m, `void.big.inclination.hypotheses` = 2) (`morishima-2017`).

  The chapter can show a muon-found void with its error box beside the Sphinx's claimed cavity, which has none.
- **Tiers.** `data/structures.json` already separates `g1.big-void` and `g1.north-face-corridor` (instrumented), `sphinx.paw-cavity` and `g2.sar-shafts` (claimed) and `hall-of-records` (legendary). That separation is the chapter's argument in one picture.
- **The enclosure.** `sphinx.enclosure.margin.north` and `.west` (`arce-sphinx-mapping-oc`) place the ditch the cores would go into.

**Data that would have to be added**

1. **Weathered-zone thickness under the floor.** Front/sides 1.8–2.5 m and rear 1.2 m, method `seismic refraction`, source `dobecki-schoch-1992` (or `schoch-1992-kmt`), `verified: false` until read from the paper. Proposed keys: `sphinx.floor.weathered.east`, `.north`, `.south`, `.west`. This would let the scene draw the weathered layer as a translucent slab under the floor, thicker at the front.
2. **The 2008 boreholes as points.** PZ/S1–S4 and their printed ground elevations (20.492, 20.480, 20.505, 20.193; the datum is presumably metres above sea level, which the note does not say). The positions would be read with `scripts/plate.py` from the YSI plan, so they are `scaled from plate` with a sigma and never verified. The figure has no scale bar; it would have to be registered on the outline of the Sphinx. The rendered depth is 20 m, as transcribed.
3. **The water table.** About 15–15.5 m elevation around the Sphinx, against a floor at about 20 m (Sharafeldin et al. 2019). This puts a level in the cross-section and shows why a core is a conservation question as well as a dating one.
4. **Physical dates.** The luminescence ages in Liritzis & Vafiadou Table 1 and the radiocarbon offsets. The database's units are metres and degrees, so dates need a new quantity, e.g. `quantity: "epoch"`, unit `yr` with negative years for BCE, as the claims' `epoch:` field already uses. That is a schema decision for Stewart.

   Once stored, a residual is easy to compute against a conventional Khafre of c. 2520 BCE:

   | Sample | Age | Against Khafre (c. 2520 BCE) | Against Schoch's 7000 BCE |
   |---|---|---|---|
   | ST2 | 2220 ± 220 BCE | 1.4σ younger | about 22σ |
   | VT1 | 3060 ± 470 BCE | 1.1σ older | 8.4σ |
   | ST5 | 3100 ± 540 BCE | 1.1σ older | 7.2σ |
   | Menkaure granite | 3450 ± 950 BCE | 1.0σ older | 3.7σ |

   Against 10,500 BCE every sample is more than 7σ away. These are my arithmetic on the checked table, not the authors' statements.
5. **The Menkaure east-face voids, 2025** (Helal et al.): 1.4 m and 1.13 m behind the face; 1.0 × 1.5 m and 0.9 × 0.7 m. A second `instrumented` entry made with methods other than muons.
6. **Corrections to existing records.**
   - The note on `g2.sar-shafts` says "the Egyptian antiquities authority rejected it". What I found is Hawass, a former minister, calling it baseless and saying no permit was granted. I found no ministry statement.
   - `khafre-project-2025` should gain the retracted 2022 paper as its peer-reviewed antecedent (see §8).

**A precession tie-in.** If the slider in chapter 5 is reused, mark Schoch's 7000–5000 BCE and the luminescence and radiocarbon spread (c. 3400–2200 BCE) on the same timeline as C5's 10,500 BCE (`C5.yaml`, epoch −10499).

---

## 4. The archaeologists' reply (strongest first)

1. **Every physical date from Giza falls in the third millennium BCE.**
   - *The 1990s radiocarbon:* the Bonani et al. (2001) project collected more than 450 organic samples in 1984 and 1995. Figure 1 (p. 1300) places every Fourth Dynasty monument roughly between 2900 and 2400 BCE. *Radiocarbon* 43(3), 1297–1320, peer reviewed **[checked]**.
   - *Who paid for it:* the 1984 project was funded by the Edgar Cayce Foundation, whose "interest in the project rested on a hypothesis offered by Cayce that the Giza pyramids dated to 10,500 BC" (p. 1297 **[checked]**). The test the Hall of Records school asked for was done, with their money.
   - *The luminescence authors:* Liritzis and Vafiadou, the work proponents cite, write that "none of the dates for the Sphinx Temple or for Giza as a whole corroborates a prehistoric age" (p. 148 **[checked]**).
   - *Their tightest Giza date:* ST2, limestone at the base of the Sphinx Temple's outer wall in contact with bedrock in front of the Sphinx, gives 2220 ± 220 BCE (Table 1, note e, p. 137–138 **[checked]**).
   - *Later radiocarbon:* Bronk Ramsey et al. (2010, *Science* 328, 1554–1557), using short-lived plant samples and a Bayesian model, put Djoser's accession at 2691–2625 BCE (**[unchecked]**: abstract via ScienceDaily and index pages).
   - *Escape hatch:* none of these dates the Sphinx's own rock, and the temple blocks could have been re-set. But the proponent who says the temple cores are as old as the Sphinx (Schoch argued this; **[unchecked]**, memory) has to explain why their buried contacts date to the third millennium.

2. **The old radiocarbon offset shrank and has a known cause.**
   - The 1984 offset of about 374 years fell to 100–200 years in the 1995 samples. Ages for Khufu's pyramid alone scatter over about 400 years, and the cause is old or recycled wood burned to make mortar (AERA, "How Old Are the Pyramids?" **[checked]**; Lehner et al., "Dating the Pyramids", *Archaeology* 52(5), 1999, 26–33 **[unchecked]**).
   - Liritzis and Vafiadou repeat the old-wood explanation (p. 147 **[checked]**).
   - The offset is centuries, not millennia, and it points to old fuel, not an old monument.

3. **The seismic result has non-weathering explanations, and it cuts both ways.**
   - Harrell, "The Sphinx Controversy: Another Look at the Geological Evidence", *KMT* 5(2) (1994), 70–74, not peer reviewed **[checked]** via the Hall of Maat repost. He notes that the rear line's "weathered" and "sound" layers have velocities 23–28% lower than the side lines, which on Schoch's own logic would make the back *older*.
   - He also argues that the low-velocity layer may be the limestone's original depositional facies (a shoal-reef bed), that the beds dip south-east and so drop eastward, and that the boundary on the rear line was picked too high.
   - On the weathering itself, he attributes it to buried wet sand, swelling clay and salt crystallisation.
   - Gauri, Sinai & Bandyopadhyay, *Geoarchaeology* 10(2) (1995), 119–133, peer reviewed, attribute the rounded profile to salt weathering and the alternation of hard and soft beds in an arid climate (**[unchecked]**: abstract via secondary sites).
   - A peer-reviewed survey of the plateau in 2019 found the upper 3–6 m around the Sphinx and temples to be a low-velocity layer of 500–1000 m/s, and the water table at about 15–15.5 m against a floor at 20 m (Sharafeldin et al., *Geoscientific Instrumentation, Methods and Data Systems* 8, 29–43 **[checked]**). Groundwater and salts are an active weathering agent today.

4. **The cavities were looked for, and some were drilled.**
   - *1978:* five 4-inch holes were air-drilled into the largest seismic and resistivity anomalies, three in the temple area and two on the platform, and inspected by borehole television. They found "only minor natural cracks in the bedrock" and "no major rooms, cavities or voids, or even filled cavities under the Sphinx". The source is Lambert Dolphin's notes, written in 1999 because no formal report was filed. Not peer reviewed **[checked]**. Notably, that work had an add-on paid for by the Association for Research and Enlightenment (A.R.E.), Cayce's organisation.
   - *2008:* the boreholes went 20 m into the bedrock around the Sphinx with cameras (YSI 2009 **[checked]**). Mainstream accounts say no chamber was found (**[unchecked]**; I found no published log either way).
   - *The known passages:* the ARCE mapping documents the passage in the rump and the small cavities as dead ends (`sphinx.passages`, `arce-sphinx-1991`).
   - *A reported reversal:* a PBS NOVA page reports that a later study by Dobecki Earth Sciences "found no evidence to support the contention that the weathering had occurred during an ancient period of higher rainfall" (**[unchecked]**: search snippet; the page returned 401). If true, it matters a great deal, and it needs confirming.

5. **The SAR shafts under Khafre do not survive scrutiny.**
   - *The peer-reviewed antecedent is retracted.* Biondi & Malanga, *Remote Sensing* 14(20), 5231 (2022), on Khufu's pyramid, was retracted on 10 August 2026 after the journal "confirmed serious methodological flaws and statistical errors" (Retraction Watch, 31 August 2026 **[checked]**; I did not fetch the notice itself). The authors disagree with the retraction.
   - *Specialists' objections:* Lawrence Conyers (ground-penetrating radar, University of Denver): "it just doesn't work". Sarah Parcak (satellite archaeology): SAR "can't see through rock. Period." (Retraction Watch; Moss 2025 **[checked]**).
   - *Hawass:* "baseless", and no permits were granted (Moss 2025 **[checked]**).
   - *Status:* the 2025 Khafre claims remain unpublished. I found no peer-reviewed paper as of October 2026.

6. **The instrumented route exists and the authority uses it.**
   - *1970:* Alvarez et al. ran a muon survey of Khafre's pyramid from its lower chamber, covered about 19% of it and found no hidden chamber (*Science* 167, 832–839, peer reviewed; **[unchecked]**: APS News, index records).
   - *ScanPyramids:* found the Big Void (`morishima-2017`) and the north-face corridor (`procureur-2023`). The corridor was confirmed by ground-penetrating radar, ultrasound and a roughly 5 mm endoscope (Elkarmoty et al., *NDT&E International*, article 102809, October 2023; **[unchecked]**: abstract via TUM; volume not confirmed).
   - *Menkaure, 2025:* two air-filled voids behind the granite casing on the east face, found by ground-penetrating radar, ultrasound and electrical resistivity "in collaboration with and under the supervision of" the SCA and the Ministry (Helal et al., *NDT&E International* 2025, 103331; TUM press release, November 2025 **[checked]**).
   - *Khafre, now:* the ScIDEP collaboration is building scintillator muon telescopes for Khafre's pyramid (Gamal et al., arXiv:2503.21959, 2025, workshop proceedings, not yet data **[checked]**).
   - *The point:* Egypt permits peer-reviewed, instrumented work. Projects that announce by press conference are the ones without permits.

7. **The Sphinx sits in the Khafre complex.** It fits the quarry sequence, the causeway, the drainage and the Sphinx Temple, whose core blocks came out of the Sphinx ditch (`lehner-hawass-2017`, `arce-sphinx-1991`; **[unchecked]**, page not found).
   - Even the geologist most sympathetic to an early Sphinx, Colin Reader, puts it only a few centuries early. First Early Dynastic (Reader 2001, *Archaeometry* 43(1), 149–159 **[unchecked]**: Reader's CV), now the Second Dynasty (Reader, *Rewriting the History of the Great Sphinx*, Archaeopress 2026 **[checked]** via the review in *The Past*).
   - Reader's work is the strongest geological challenge still standing, and it stays within dynastic Egypt.

---

## 5. Where it stands

Every physical date taken at Giza has come out in the third millennium BCE: the radiocarbon from 1984 and 1995 (the first round paid for by the Cayce Foundation to test 10,500 BCE) and the luminescence of 2015. The 1978 drill holes found only cracks. The 2025 radar claim has lost its peer-reviewed foundation to a retraction.

What is still genuinely untested is the one measurement the weathering argument rests on. No published core or borehole log measures the weathered zone under the front and back of the enclosure floor. No cross-hole or sediment-dating study has addressed the paw anomaly or the ditch fill. The 2008 boreholes show that such work is physically and administratively possible.

---

## 6. What the picture should show

**For the claim**

1. **A cut-away of the enclosure floor.** A long section east to west under the Sphinx, with the weathered layer as a translucent band about 2 m deep at the front thinning to 1.2 m at the rump, a dashed core going down at each end, and the line "this has never been measured directly". Add the 2008 water table at 15 m elevation as a blue line.
2. **The plan from above with the anomalies.** The tiers drawn side by side: the paw anomaly (claimed, dashed), the Cayce hall (legendary, ghosted), and the four 2008 boreholes as small solid pins labelled "drilled 2008, logs not published".
3. **The model answer.** Khufu's pyramid in section with the muon detectors in the Queen's Chamber, the Big Void's 40–50 m error box, and the corridor behind the Chevron with the endoscope's line of sight. This is what "settled" looks like, from data already verified in `g1-voids.json`.

**For the reply**

- **A date strip.** One timeline from 11,000 BCE to 2000 BCE. Every physical date from Giza appears as a dot with its error bar: the radiocarbon cloud, the luminescence ages, Sphinx Temple ST2. All of them crowd into 3400–2200 BCE, while the markers for 10,500 BCE and 7000 BCE stand alone and far to the left. Caption: "The tests that have been done."

---

## 7. Open questions and what I could not confirm

- **The 1992 paper itself.** The exact numbers and figure pages of Dobecki & Schoch (1992), including the paw anomaly's dimensions and depth (the project's "about 5 m" is **[unchecked]**). The abstract is not online; the paper needs a library copy.
- **The 2008 borehole logs.** Was a log of rock quality or weathering made for PZ/S1–S4, and does it exist in the SCA or Cairo University archive? Hawass and Lehner commented on a video of the drilling (YouTube 3qGzfZHWbZE, cited in YSI 2009; not viewed).
- **The reported Dobecki Earth Sciences finding.** Whether a later Dobecki study concluded there was "no evidence" of weathering in a wet period. It is a single snippet from the NOVA page that returned 401. Confirm before using.
- **Whether Schoch has ever proposed coring.** I found no primary source showing that Schoch, Hancock or West formally proposed coring the floor, or that the authority refused it. Claims of refusal circulate only in partisan Substack posts. Do not state a refusal without a primary source.
- **The Schor/Florida State survey of 1996.** Whether its permit was halted, and why. Unconfirmed.
- **Liritzis & Vafiadou's text against their table.** Their text gives the Valley Temple as "early 4th mill BC (3000 ± 420 BC)" (p. 148), but Table 1 gives 3060 ± 470 BCE, which in any case is not fourth millennium. Their Table 1 also gives a limestone Valley Temple age of 1050 ± 540 BCE that nobody takes as a construction date. The method's scatter at Giza is large.
- **Radiocarbon samples from the Sphinx Temple.** Liritzis & Vafiadou refer to radiocarbon samples from the Sphinx Temple. I did not read the Bonani appendix to confirm which samples and what ages.
- **Cosmogenic exposure dating.** I found no attempt at Giza. Its difficulties for this problem are my own reasoning, not a cited source:
  - the Sphinx was buried in sand for much of its history (inherited and shielded production);
  - the carved surfaces are eroding, which is the very quantity in dispute, so a ³⁶Cl concentration gives a steady-state erosion rate integrated over roughly the last 60 cm of loss, not a carving date;
  - the enclosure walls have been patched repeatedly.

  Precedents for ³⁶Cl in limestone exist (a Hittite wall at Hattusha has been reported), but I did not confirm the citation.
- **Sediment dating of the ditch fill.** OSL on the lowest sediment in the enclosure would give a minimum age for the cut. I found no study.
- **Cross-hole tests between the 2008 boreholes.** Seismic or electrical-resistivity tomography between the holes would directly test the paw anomaly. This is a suggestion from this brief, not anyone's published proposal.
- **Official Egyptian position on the Khafre radar.** I found no ministry statement on the Khafre SAR claims, nor any response to the team's reported December 2025 request.

---

## 8. New sources

```json
[
  {
    "id": "schoch-1992-kmt",
    "kind": "proponent",
    "year": 1992,
    "citation": "Schoch, R. M. (1992). Redating the Great Sphinx of Giza. KMT: A Modern Journal of Ancient Egypt 3(2), 53–59, 66–70.",
    "note": "Not peer reviewed. Gives the subsurface weathering from the 1991 seismic lines as about 1.8–2.5 m on the east, north and south of the enclosure floor and 1.2 m on the west. Figures checked only as quoted by Harrell 1994 (harrell-1994); the article itself not seen; page for the figures not found."
  },
  {
    "id": "harrell-1994",
    "kind": "critique",
    "year": 1994,
    "citation": "Harrell, J. A. (1994). The Sphinx Controversy: Another Look at the Geological Evidence. KMT 5(2), 70–74.",
    "url": "https://www.hallofmaat.com/?p=3243",
    "note": "Not peer reviewed. Checked against the Hall of Maat repost (2001): the rear line's layers are 23–28% slower than the sides; the low-velocity layer may be original depositional facies; wet sand, clay and salt weathering. Page numbers of the repost are not the magazine's."
  },
  {
    "id": "gauri-1995",
    "kind": "critique",
    "year": 1995,
    "citation": "Gauri, K. L., Sinai, J. J. & Bandyopadhyay, J. K. (1995). Geologic weathering and its implications on the age of the Sphinx. Geoarchaeology 10(2), 119–133.",
    "note": "Peer reviewed. Unchecked: citation and abstract via secondary sites (Hall of Maat, academia.edu listing); the paper not read."
  },
  {
    "id": "reader-2001",
    "kind": "paper",
    "year": 2001,
    "citation": "Reader, C. D. (2001). A geomorphological study of the Giza necropolis, with implications for the development of the site. Archaeometry 43(1), 149–159.",
    "note": "Peer reviewed. Argues the Sphinx predates Khufu, by centuries not millennia. Unchecked: citation from Reader's own CV via search; the paper not read."
  },
  {
    "id": "reader-2026",
    "kind": "proponent",
    "year": 2026,
    "citation": "Reader, C. D. (2026). Rewriting the History of the Great Sphinx. Oxford: Archaeopress. ISBN 978-1-805-83209-6.",
    "url": "https://the-past.com/review/books/rewriting-the-history-of-the-great-sphinx/",
    "note": "Book; puts the Sphinx in the Second Dynasty, head first a Mafdet lion later recarved by Khufu. Checked against the review in The Past only; the book not read."
  },
  {
    "id": "liritzis-vafiadou-2015",
    "kind": "paper",
    "year": 2015,
    "citation": "Liritzis, I. & Vafiadou, A. (2015). Surface luminescence dating of some Egyptian monuments. Journal of Cultural Heritage 16, 134–150. doi:10.1016/j.culher.2014.05.007",
    "url": "https://liritzis.eu/wp-content/uploads/2019/01/EGYPTIAN-MONUMENTS-DATED-BY-SURFACE-LUMINESCENCE-DATING.pdf",
    "note": "Peer reviewed. Checked against the authors' PDF: Table 1 p. 137 (Sphinx Temple ST2 limestone 2220 ± 220 BC; ST4 2740 ± 640; ST5 3100 ± 540; ST3 1190 ± 340; Valley Temple VT1 granite 3060 ± 470, VT9a limestone 1050 ± 540; Menkaure granite 3450 ± 950; Osiris Shaft 2930 ± 600 and 2870 ± 570); p. 148 'none of the dates for the Sphinx Temple or for Giza as a whole corroborates a prehistoric age'. Text p. 148 gives the Valley Temple as 3000 ± 420 BC, inconsistent with the table."
  },
  {
    "id": "bonani-2001",
    "kind": "paper",
    "year": 2001,
    "citation": "Bonani, G., Haas, H., Hawass, Z., Lehner, M., Nakhla, S., Nolan, J., Wenke, R. & Wölfli, W. (2001). Radiocarbon dates of Old and Middle Kingdom monuments in Egypt. Radiocarbon 43(3), 1297–1320. doi:10.1017/S0033822200038558",
    "url": "https://www.cambridge.org/core/journals/radiocarbon/article/radiocarbon-dates-of-old-and-middle-kingdom-monuments-in-egypt/A967302ADD527BFEB9226457682C0B4A",
    "note": "Peer reviewed (proceedings of the 17th International 14C Conference). Checked pp. 1297–1300: over 450 samples 1984–1995; the 1984 project funded by the Edgar Cayce Foundation to test Cayce's 10,500 BC hypothesis (p. 1297); Figure 1 p. 1300 compares calibrated ranges with Clayton's chronology. Appendices not read."
  },
  {
    "id": "aera-radiocarbon",
    "kind": "reference",
    "citation": "Ancient Egypt Research Associates. How Old Are the Pyramids? (web page summarising the 1984 and 1995 radiocarbon projects).",
    "url": "https://aeraweb.org/how-old-are-the-pyramids/",
    "note": "Not peer reviewed; the project team's own summary. Checked: 1984 dates averaged 374 years older than expected; 1995 dates 100–200 years older; Khufu's dates scatter over about 400 years; old-wood explanation."
  },
  {
    "id": "lehner-1999-dating",
    "kind": "paper",
    "year": 1999,
    "citation": "Lehner, M., Nakhla, S., Hawass, Z., Bonani, G., Wölfli, W., Haas, H., Wenke, R., Nolan, J. & Wetterstrom, W. (1999). Dating the Pyramids. Archaeology 52(5), 26–33.",
    "url": "https://archive.archaeology.org/9909/abstracts/pyramids.html",
    "note": "Popular magazine, not peer reviewed. Unchecked: citation from a bibliography via search; not read."
  },
  {
    "id": "bronk-ramsey-2010",
    "kind": "paper",
    "year": 2010,
    "citation": "Bronk Ramsey, C. et al. (2010). Radiocarbon-based chronology for dynastic Egypt. Science 328(5985), 1554–1557. doi:10.1126/science.1189395",
    "note": "Peer reviewed. Unchecked: abstract via ScienceDaily and index records (Djoser's accession 2691–2625 BCE); the paper not read."
  },
  {
    "id": "dolphin-1978",
    "kind": "survey",
    "year": 1999,
    "citation": "Dolphin, L. (1999). Geophysical Studies around the Sphinx (1978): project leader's notes on the 1978 seismic, resistivity and drilling survey, written 21 July 1999.",
    "url": "https://www.ldolphin.org/egypt/sphinx.html",
    "note": "Not peer reviewed; no formal report was filed. Checked: five 4-inch air-drilled holes into the largest anomalies (three in the temple area, two on the platform), borehole TV found 'only minor natural cracks'; sponsored by private investors with an add-on for the A.R.E."
  },
  {
    "id": "ysi-2009-sphinx",
    "kind": "survey",
    "year": 2009,
    "citation": "YSI Inc. (2009). YSI Level Scouts Monitor Groundwater Levels to Help Protect the Great Sphinx. Application Note A579.",
    "url": "https://www.xylem.com/siteassets/brand/ysi/resources/case-study/a579-ysi-level-scouts-monitor-groundwater-beneath-the-sphinx.pdf",
    "note": "Vendor note, not peer reviewed. Checked pp. 1–2: early 2008, SCA with Cairo University's Engineering Center for Archaeology and Environment drilled four 4-inch boreholes 20 m into the bedrock around the Sphinx, with cameras; plan of PZ/S1–S4 with printed elevations 20.492, 20.480, 20.505, 20.193; water table 4.6 m below the surface; eight pump stations from June 2008."
  },
  {
    "id": "sharafeldin-2019",
    "kind": "paper",
    "year": 2019,
    "citation": "Sharafeldin, S. M., Essa, K. S., Youssef, M. A. S., Karsli, H., Diab, Z. E. & Sayil, N. (2019). Shallow geophysical techniques to investigate the groundwater table at the Great Pyramids of Giza, Egypt. Geoscientific Instrumentation, Methods and Data Systems 8, 29–43. doi:10.5194/gi-8-29-2019",
    "url": "https://gi.copernicus.org/articles/8/29/2019/",
    "note": "Peer reviewed, open access. Checked: ERT, shallow seismic refraction and GPR profiles including the Sphinx and Sphinx Temple; surface layer 500–1000 m/s, 3–6 m; water table about 15–15.5 m elevation near the Sphinx against a base at about 20 m. Does not discuss Schoch."
  },
  {
    "id": "biondi-malanga-2022",
    "kind": "proponent",
    "year": 2022,
    "citation": "Biondi, F. & Malanga, C. (2022). Synthetic Aperture Radar Doppler Tomography Reveals Details of Undiscovered High-Resolution Internal Structure of the Great Pyramid of Giza. Remote Sensing 14(20), 5231. doi:10.3390/rs14205231. RETRACTED 10 August 2026.",
    "url": "https://arxiv.org/abs/2208.00811",
    "note": "Was peer reviewed; retracted for 'serious methodological flaws and statistical errors', the authors disagreeing. Retraction checked via Retraction Watch (2026-08-31); the notice itself not fetched. The peer-reviewed antecedent of khafre-project-2025."
  },
  {
    "id": "retraction-watch-2026-giza",
    "kind": "critique",
    "year": 2026,
    "citation": "Retraction Watch (31 August 2026). Journal retracts paper claiming network of corridors inside the Great Pyramid of Giza.",
    "url": "https://retractionwatch.com/2026/08/31/retraction-corridors-inside-great-pyramid-giza/",
    "note": "Journalism. Checked: retraction date, notice wording, quotations from Conyers and Parcak; the 2025 Khafre claims unpublished."
  },
  {
    "id": "moss-2025-natgeo",
    "kind": "critique",
    "year": 2025,
    "citation": "Moss, C. (16 April 2025). Is there really a secret city under Egypt's Giza pyramids? National Geographic.",
    "url": "https://www.nationalgeographic.com/history/article/is-there-a-secret-city-under-the-pyramids-",
    "note": "Journalism. Checked: the Khafre claims not peer reviewed; Hawass calls them 'baseless' and says no permits were granted; criticism from Parcak, Conyers, Dibble and Rossi."
  },
  {
    "id": "pilicy-2025",
    "kind": "proponent",
    "year": 2025,
    "citation": "Pilicy, D. (27 June 2025). Tomographic Evidence Beneath the Pyramid of Khafre: Methodological Appraisal and Critical Responses. grahamhancock.com.",
    "url": "https://grahamhancock.com/pilicyd1/",
    "note": "Not peer reviewed; a sympathetic review on Hancock's site. Checked: concedes the findings are 'not proof of lost civilizations' and that the methodology is undisclosed."
  },
  {
    "id": "helal-2025",
    "kind": "paper",
    "year": 2025,
    "citation": "Helal, K., Pugacheva, P., Allam, H. et al. (2025). Detection of two anomalies behind the Eastern face of the Menkaure Pyramid using a combination of non-destructive testing techniques. NDT & E International, 103331. doi:10.1016/j.ndteint.2025.103331",
    "url": "https://www.tum.de/en/news-and-events/all-news/press-releases/details/detection-of-air-filled-anomalies-in-menkaure-pyramid-could-indicate-new-entrance",
    "note": "Peer reviewed; ScanPyramids, Cairo University and TUM, under SCA supervision. Checked against the TUM press release (November 2025): voids 1.4 m and 1.13 m behind the face, 1.0 × 1.5 m and 0.9 × 0.7 m. The paper itself not read; volume not confirmed."
  },
  {
    "id": "elkarmoty-2023",
    "kind": "paper",
    "year": 2023,
    "citation": "Elkarmoty, M. et al. (2023). Localization and shape determination of a hidden corridor in the Great Pyramid of Giza using non-destructive testing. NDT & E International, 102809. doi:10.1016/j.ndteint.2023.102809",
    "url": "https://portal.fis.tum.de/en/publications/localization-and-shape-determination-of-a-hidden-corridor-in-the-/",
    "note": "Peer reviewed. Unchecked: abstract via the TUM portal and search; GPR and ultrasonic confirmation of the north-face corridor and endoscope access; volume not confirmed."
  },
  {
    "id": "alvarez-1970",
    "kind": "paper",
    "year": 1970,
    "citation": "Alvarez, L. W. et al. (1970). Search for hidden chambers in the pyramids. Science 167(3919), 832–839.",
    "url": "https://fisherp.mit.edu/wp-content/uploads/2025/08/AlvarezPyramids.pdf",
    "note": "Peer reviewed. The first muon survey at Giza, from the lower chamber of Khafre's pyramid; about 19% of the volume, no chamber found. Unchecked: via APS News and index records; the PDF not read."
  },
  {
    "id": "scidep-2025",
    "kind": "paper",
    "year": 2025,
    "citation": "Gamal, M., Aly, S., Geeraerts, D., Hecht, A., Kouzes, R. et al. (2025). The ScIDEP Muon Radiography Project at the Egyptian Pyramid of Khafre. arXiv:2503.21959 (Muography2024 proceedings).",
    "url": "https://arxiv.org/abs/2503.21959",
    "note": "Workshop proceedings, preprint. Checked against the arXiv abstract: scintillator muon telescopes under construction to scan Khafre's pyramid from its burial chamber and outside; no science data yet."
  },
  {
    "id": "csm-1987-waseda",
    "kind": "reference",
    "year": 1987,
    "citation": "Christian Science Monitor (23 June 1987). New Sphinx riddle. Hi-tech probes may solve ancient mystery.",
    "url": "https://www.csmonitor.com/1987/0623/dsphi.html",
    "note": "Journalism on the Waseda (Yoshimura) electromagnetic survey and its reported cavity east of the Sphinx. Unchecked: search snippet only."
  }
]
```
