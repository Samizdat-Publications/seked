You are researching one chapter of a documentary for the Seked project. The repository is the
current directory; read `CLAUDE.md` and `docs/rethink-2026-10.md` first. The documentary is a
steelman: the strongest case for an older Giza, made as its proponents make it (Hancock, Bauval,
Schoch, West and others), with the archaeologists' reply given in every chapter, quieter than
the claim but never left out. Your job is research, not prose: find what each side actually
says, where it says it, and how strong it is.

{{chapter}}

Rules:

- Cite precisely: author, year, title, publisher or journal, volume and pages, and the page or
  figure for each specific claim when you can find it. Mark a citation **[checked]** when you
  confirmed it against the work itself (or a scan, abstract or publisher page you fetched), and
  **[unchecked]** when it comes from memory or a secondary source, naming that source. Never
  invent a page number: write "page not found".
- Quote sparingly: a phrase, or one sentence at most per source, only where the exact words
  matter. Paraphrase the rest.
- Say which work is peer-reviewed and which is not. Bring both sides up to date, to 2026: not
  only the 1990s exchange.
- Do not write to any file. Your final answer is the brief itself, in Markdown.
- Use the measurement database where it helps: `data/claims/*.yaml`, `data/measurements/*.json`,
  `data/sources.json`. Name the existing source id for any work you cite that is already there.

Your answer, in this order:

1. **The claim at full strength** (up to 250 words): the version a fair-minded proponent would
   sign.
2. **The proponents' evidence**: a numbered list. Each item gives the observation, who makes
   it, the citation, and how strong it is (what would have to be true for it to be wrong).
3. **Receipts**: what Seked's database can compute or show for this chapter (a measurement, a
   residual, a date from precession), with the keys or claim ids involved, or the data that
   would have to be added.
4. **The archaeologists' reply**: a numbered list in the same shape, strongest first, the
   newest work included.
5. **Where it stands**: two or three sentences on the state of the question now, fair to both
   sides.
6. **What the picture should show**: the two or three images that would make the claim
   legible to an ordinary viewer, and the one image for the reply.
7. **Open questions**: what is unsettled, and anything you could not confirm.
8. **New sources**: a JSON array of records in `data/sources.json`'s shape (`id`, `kind` one of
   `proponent`, `critique`, `paper`, `reference`, `survey`; `year`, `citation`, `url`, `note`)
   for the works you cite that are not already there, each `note` saying whether you checked it.
