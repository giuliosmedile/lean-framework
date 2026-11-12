---
title: '{title}'
status: draft          # draft | final
stakes: internal       # hobby | internal | launch
updated: '{date}'
companions: []         # files every downstream step MUST read with this spec (UX.md, compliance.md, …)
sources: []            # input documents this spec was distilled from (paths under docs/) — read on update, not downstream
---

<!-- Fill, then delete every comment. Cut optional sections that don't earn their place; never write "N/A". -->

# {Title}

## Why

<!-- One paragraph: the pain, opportunity, vision, or mandate behind this; who is affected; why now. Every downstream trade-off resolves against this. -->

## Users & Journeys

<!-- Optional. Only when journeys drive decisions. Named protagonist, captured from the user's narration. -->

- **UJ-1. {Persona doing the thing}** — {entry state} → {what they do, in order} → {where value lands}. Realized by CAP-…

## Capabilities

<!-- Stable IDs, never renumbered. WHAT, not HOW. Group under ### headings when there are many. -->

- **CAP-1 — {short name}**
  - **intent:** {Who can do what, to achieve what.}
  - **success:** {Testable/demonstrable condition. Given/When/Then when it helps.}
  - **out of scope:** {optional — what this capability explicitly does not cover}

## Quality Requirements

<!-- Cross-cutting NFRs with numbers/bounds. Cut if none are real. -->

- **QR-1:** {e.g. p95 latency < 300 ms for search at 50 rps}

## Constraints

<!-- Non-negotiables that rule something out: platform, deadline, regulation, budget, must-integrate-with. -->

- {constraint}

## Non-goals

- {Explicitly out of scope. At least one.}

## Success Signal

<!-- How we'll know it worked in the world. If you name metrics, name one counter-metric not to optimize. -->

## Glossary

<!-- Optional. Domain nouns used identically everywhere downstream. -->

## Assumptions

<!-- Every [ASSUMPTION] tag, indexed. Omit if none. -->

## Open Questions

<!-- Real decisions a human must make. Mark blockers with (blocker). Omit if none. -->

## Decision Log

<!-- Append-only, one line each, newest last: `{date} — {decision | change | assumption | dropped} — {gist, with reason}`. Never edit or reorder entries; a later entry supersedes an earlier one. -->
