# STE-80 — write so a tired reader cannot misread it

Active when the `_lean/` config has `lean.prose = "ste80"`. The default, `plain`, has no wording rules and this file is not read. It sits on top of either `lean.style`: `kiss.md` still sets the length and the shape; this file sets how each sentence is written.

It follows ASD-STE100 (Simplified Technical English) to about 80%. Keep the sentence rules. Do not enforce the approved-word dictionary.

## Where it applies

| Applies | Does not apply |
|---|---|
| Replies to the user (`kiss.md` §C) | Worker prompts and returns (`orchestration.md` §3) |
| Documents a person reads: SPEC, UX, ARCHITECTURE, EPIC, story Intent and notes, retros, review reports | Code, commit messages, file paths, ids (`CAP-n`, `AD-n`), status words, quoted source text |
| | Text already inside a `<frozen-after-approval>` block: do not rewrite it (the hash would break). New frozen text follows the rules. |

## Rules

**Sentences**
1. Procedure: at most 20 words. Description: at most 25 words.
2. One idea per sentence. One instruction per sentence.
3. Active voice. Imperative for instructions: "Run the check."
4. Condition first: "If the check fails, read the log."
5. Simple tenses only: present, past, `will`.

**Words (English text only)**
6. One word for one thing, everywhere. Never vary a term for style.
7. No `-ing` as a verb ("Before you start", not "Before starting"). No noun stack longer than three.
8. Use the short common word ("use", not "utilize"). Use one verb instead of a phrasal verb ("install", not "set up"). Keep "the" and "a": do not drop them to save words.

**Paragraphs and warnings**
9. Topic sentence first. At most 6 sentences (3 under `kiss`, see `kiss.md` §B). Link ideas with "because", "but", "then".
10. A warning starts with the command, then gives the risk in one sentence: "Do not edit the frozen block. The check will fail."

## Other languages

STE is an English standard. When the reply or document language is not English, apply rules 1–5 and 9–10 only. Skip rules 6–8: they depend on English words.

## Conflicts and self-check

- `kiss.md` caps win. STE never makes a reply longer than 12 lines or a document longer than its cap.
- Technical names and verbs stay as they are (`API`, `deploy`, `compile`).
- Before you send: split any sentence over the limit, find `-ing` verbs and passives, and merge synonyms of your key terms.
