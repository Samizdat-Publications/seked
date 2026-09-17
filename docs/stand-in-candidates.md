# Stand-in candidates for stages 2 and 3

Surveyed 2026-09-17 through the Sketchfab and Poly Haven APIs, for the
sculpture and vegetation the design (docs/superpowers/specs/2026-09-17-realtime-plateau-design.md,
section 4) says is downloaded rather than built or generated. Nothing here is
in `blender/models.json` yet; a model goes in the manifest when it is used,
with its licence and attribution, and stays labelled a stand-in. Licences are
recorded and do not constrain the choice (Stewart, 2026-09-16).

## Sculpture (Sketchfab, all downloadable)

| Use | Model | uid | Author | Faces | Licence |
|---|---|---|---|---|---|
| Seated king for Khafre's valley temple (23 emplacements) | Seated Statue of Khafre | 135dc9f9c7d0426087f781cdd24019f6 | pmanuelian (Peter Der Manuelian, Harvard Giza Project) | 359k | CC BY |
| Same, second choice | Statue of Khafre, Egyptian Museum, Cairo | 071b25978c054c73bd179f89c33a5ffe | danderson4 | 999k | CC BY |
| Same, a Giza valley-temple piece | Khafre Statue from Valley Temple, Giza | cc102bd39c5d4a4b89b38f2f8fe109c7 | megalithomania1 | 229k | CC BY-NC-SA |
| A queen for Menkaure's temples | Colossal seated statue of Khamerernebty II | 7b7b6392c05f46bc81a0a8d39ec8ec57 | pmanuelian | 89k | CC BY-NC-SA |
| Small sphinx for an avenue or a door | Small sphinx, Alexandria | bb9eb7d8a3ec4ae4ae4e0925fd2e0071 | PolarNick239 | 250k | CC BY |
| Guardian for the ancient temple doors (Assyrian, wrong culture: last resort) | Saluting Protective Spirit, 883 to 859 BC | e059aaa709694929abcd87c2411c1a06 | Cleveland Museum of Art | 919k | CC0 |

Second search the same evening, for the guardians and the boat:

| Use | Model | uid | Author | Faces | Licence |
|---|---|---|---|---|---|
| Guardian jackal for the ancient temple doors | Recumbent Jackal Final Model | a2c4b91186874cdcbd1ecd80c821c9e0 | camcolab | 169k | CC BY |
| Same, second choice | Anubis | f75756aa97704f2784c97bb7c00b2ac3 | lovadahn | 101k | CC BY |
| Khufu's solar ship, for the boat pits opened and for the harbour | Khufu solar ship - EGYPT | 5c56a4feeb8e4c67b5a4d903b4a96e5a | juanbrualla | (not stated) | CC BY |
| Quarry faces and scoop marks for the Aswan look of the granite | Aswan Unfinished Obelisk Tip, Quarry Scoop Marks | 61ea7351f46941a69f7cf6089e1f7a13, d0789b64b2734c01bcb6d6299bffc6de | zeptepi | 48k, 39k | CC BY-NC-SA |

So the guardian jackal need not be generated unless the two scans turn out
to be poor when fetched; look at them before spending credits. Meshy stays
for what no scan gives once the temples are built (Stewart lifted the credit
ceiling on 2026-09-17: generate when the scene needs it and ask him to top up).

## Vegetation

| Use | Model | Source | Faces | Licence |
|---|---|---|---|---|
| Date palm, instanced along the water (ancient and built) | Date Palm | Sketchfab 11acf710e6c149daa8d6fb8cdc5d087f (evolveduk) | 10k | CC BY |
| Palm with undergrowth, a hero specimen | Date palm and vegetation | Sketchfab 734c4537ca8547209a54df49f134824a (borsh_and) | 41k | CC BY |
| Grass cards | grass_medium_01, grass_bermuda_01 | Poly Haven | low | CC0 |
| Scrub for the drying `built` state | shrub_01 to shrub_04, wild_rooibos_bush | Poly Haven | low | CC0 |
| Savanna trees for the Green Sahara horizon | island_tree_01, tree_small_02 | Poly Haven | mid | CC0 |
| Quarry rubble and boulders | boulder_01, namaqualand_boulder_02 to 06, sand_rocks_small_01, rock_face_01 | Poly Haven | mid | CC0 |

Poly Haven has no palm. Its assets download through the API already used by
`scripts/textures.py` (`https://api.polyhaven.com/files/<id>` gives the glTF).
