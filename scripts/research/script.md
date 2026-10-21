You are drafting the script of a documentary for the Seked project. The repository is the
current directory. Read, in this order: `CLAUDE.md`, `docs/rethink-2026-10.md`, `docs/plan.html`
(the chapters, the page and the rules), then every brief in `docs/research/` (`ch1.md` to
`ch8.md`), which hold the research, the sources and their checked or unchecked status. Then read
`data/claims/` for the claims named as receipts, and `docs/dossier.md` for their residuals.

The documentary is the strongest case for an older Giza, illustrated for an ordinary viewer: a
steelman of Hancock, Bauval and Schoch, told as a scroll documentary in nine chapters (0 to 8, as
the plan lists them). The archaeologists' reply is in every chapter, quieter than the claim and
never left out. The rule that keeps it honest: **the steelman is in the words and the pictures,
never in the numbers.**

Write the script. For each chapter, in this shape:

```
## N. Title

**Narration** (150 to 220 words: what the voice says and the reader reads)

<the text, in short paragraphs>

**Beats**

- "<a phrase from the narration, quoted exactly>" → <what the stage does from here: which render,
  which overlay, which parameter the scroll drives, from what to what>
- ...

**Receipts**

- <claim id, or a proposed new claim with its inputs and free choices>: <what the reader is shown,
  and what it says, in the claim's own terms, including when it misses its tolerance>

**The reply** (80 to 150 words, the collapsed panel)

<the archaeologists' strongest answer and the newest work, fairly put>

**Spoken reply** (one sentence, for the second, quieter voice in autoplay)

**Sources**: <ids from data/sources.json, or the new ids proposed in the briefs, marked
"(new, unchecked)" where the brief did not check them>
```

How the narration should sound:

- Plain, concrete and spoken. Short sentences. Present tense where the reader is looking at
  something. No hype, no rhetorical questions in a row, no "mysterious", "ancient secrets" or
  "what if I told you". The pictures carry the wonder; the words say what is there.
- Make the claim at its strongest, in its proponents' terms, without hedging every sentence. Name
  the proponent at least once in each chapter, so the reader always knows whose case it is
  ("Robert Schoch, a geologist, looked at these walls in 1990 and saw rain."). Never sneer at it
  and never wink at the reader.
- Never state as fact what the briefs mark unchecked. Never bend a number: if a receipt misses its
  tolerance, the narration may still make the case, but it does not claim the number fits.
- Each chapter's narration ends on the thought that carries the reader into the next.
- Chapter 0 asks the question the piece answers and is under 120 words. Chapter 8 ends the piece:
  what would settle it, and an honest close.
- Quote a source only in a short phrase, where the exact words matter.

Then, after the nine chapters:

- **Running time**: the word count of each chapter's narration and the total, at 150 words a minute.
- **Open questions for Stewart**: anything in the script that rests on an unchecked source, or a
  choice of emphasis that is Stewart's to make.

Do not write to any file. Your final answer is the script itself, in Markdown, starting with
`# Seked: the script`.
