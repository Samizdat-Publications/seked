# The GitHub research handoff, answered (21 October 2026)

A separate chat thread surveyed GitHub and the web for Giza and Göbekli Tepe material and left a handoff
(`build/research-handoff/`, not committed: it holds other people's data). Its four asks, answered here. Nothing outside
has been imported into `data/` or the repo; that waits on Stewart's licensing answers below.

## 1. The Petrie ledger against today's tree

`compare_ledger_vs_seked.py` (read before running: it only reads two inputs and writes a CSV) against the ledger at
`hadijannat/pyramid-acid-plant-test@5536a28`, over today's `data/measurements` (972 numeric records): **133 exact, 52
near, 13 none**, against 133, 51 and 14 on the old main. One row moved: the top platform's half-width (5.5321 m) now
falls "near" Göbekli Tepe's central pillar height (5.5 m), a coincidence of value, not a match. The rethink changed
nothing about how the tree reads Petrie. Output: `build/research-handoff/compare-current.csv`.

## 2. Claim C2 at Petrie's Queen's Chamber north angle

Evaluated with `@seked/claims` on the canonical preset, the angle overridden, epoch 2450 BCE:

| Comparison | at 39.1167° (kept) | at 37.4667° (Petrie §44) |
|---|---|---|
| King's Chamber south, Alnitak | −0.450 %, within | −0.450 %, within |
| King's Chamber north, Thuban | +2.060 %, **not within** | +2.060 %, **not within** |
| Queen's Chamber south, Sirius | +0.632 %, within | +0.632 %, within |
| Queen's Chamber north, Kochab | −0.606 %, within | **−4.799 %, not within** (about 1°53′) |
| C2 as a whole | does not hold | does not hold |

Petrie's angle adds a second failing shaft; it does not change C2's verdict, which already fails on Thuban. At
37°28′ Kochab would meet the shaft roughly five centuries later than at 39°07′ (about 4.9 years per arcminute; an
estimate, not solved).

**Proposal:** add `qc.shaft.north.angle` from `petrie-1883` (37.4667°, sigma about 0.13° from his three readings, a note
that it covers the lower section only) as a second record of the same key, checked against Birdsall's transcription,
and let the presets choose: `canonical` keeps Gantenbrink first, `petrie-1883` shows Petrie's. The claim page then
shows both, and its note says plainly that 39°07′ is not a figure Gantenbrink printed (he gives 33.3° to 40.1° over
17 m). This needs no new key, follows the preset rule, and is reversible.

## 3. A pillar data model

The carvings are not survey data, and the stand-in is labelled. So pillars get their own file outside the measurement
database's rules, `data/gobekli/pillars.json`, built by a script from the inputs, never typed:

- **Inventory and layout**, imported from the Mlekuž corpus (`dmlekuz/gobekli-statistical-structuralism@ec20475`, data
  CC BY 4.0, code MIT) by the handoff's parser: per pillar, its building, faces and zones, each motif's identity,
  layout relations, facing, grouping, the `is_maybe` flag and the erased or recarved records. An `is_maybe` or erased
  figure is never drawn as settled.
- **Placement**, from the records we have: the Haklay and Gopher plan (positions, the central pair's axes) and the
  printed heights (`data/measurements/gobekli.json`).
- **Reliefs**, one entry per carved face: the reference images used (path, author, licence), the method (height map
  from the excavators' drawing, from a scan render, from photographs, or from a mesh), the height map's path, its
  status, and every assumed value with `assumed: true` and a note: relief depth (no source prints it in millimetres;
  a stated look choice, for instance 20 mm), the face's outline where no drawing gives it, the scale where none is
  printed.
- **Scans**, when one is used: the model, its author, licence and source, and which pillars it covers, labelled a
  stand-in wherever shown.

The renderer reads this file; the exhibit's chapter 7 figures read it too.

## 4. Questions for Stewart

1. **The Mlekuž corpus** (CC BY 4.0 data, MIT code): may it be imported into `data/gobekli/` with its citation? It
   is the inventory of what is carved where on 48 pillars.
2. **rmark's Göbekli Tepe scan** on Sketchfab (CC BY, downloadable, 3.26 million faces from about 400 photographs, the
   main excavation area with Enclosure D at its centre): may it be fetched through `scripts/models.py` and used as
   today's Göbekli Tepe, credited and labelled a stand-in? It is better than any model we would build.
3. **Megalithomania's object scans** (Göbekli and Karahan Tepe pieces, CC BY-NC-SA): usable since Seked is
   non-commercial; share-alike means a derivative we publish carries the same licence. Yes or no?
4. **ArqueoloGuia's model** (the one you found): no download and no licence shown; only with the author's answer.
5. **Petrie's shaft angle**: add his 37°28′ as a second source of `qc.shaft.north.angle`, as proposed above?
6. **The DAI**: a short request for the Pillar 18 scan (Hochschule Karlsruhe), drafted for you to send?
