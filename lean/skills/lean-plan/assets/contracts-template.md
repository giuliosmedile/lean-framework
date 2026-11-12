---
title: '{epic id} {title} — Contracts'
status: draft          # draft | frozen (after <E>-0 is done) — changes after freeze go through a contract change
updated: '{date}'
contracts_path: ''     # where the contract code lives, e.g. src/main/java/…/contracts/
fixtures_path: ''      # where the shared oracle fixtures live
---

<!-- Lives in the epic folder, only when the epic runs 2+ lanes. Bullets and tables only. Delete every comment. -->

# {Title} — Contracts

## Lanes

| Lane | Owner | Modules | First story (needs only <E>-0) | Nature of the work |
|---|---|---|---|---|
| A | | | | |

**Boundary rule:** lanes share no code except `contracts_path`. No imports between lane modules; only the composition root (`{path}`, owned by {lane/owner}) knows every lane. Enforced by a test from <E>-0.

## Seams

<!-- One row per port/gateway/type that crosses a lane boundary. Every row needs a real-implementation owner: an empty cell is an orphan, and the plan isn't ready. -->

| # | Port / type | Producer → consumer | Real impl (lane · story) | Fake (one, producer-owned) | Contract test | Checkpoint story |
|---|---|---|---|---|---|---|
| S-1 | | A → B | | | | |

### Value rules

<!-- What the types don't say and the lanes must agree on. Each rule is pinned by a contract test, not just written here. -->

| Seam | Rule (empty collections · null/absent · formats & units · ordering · id form · errors: return vs throw · shapes the producer may emit) |
|---|---|
| S-1 | |

## Oracle fixtures

<!-- Worked end-to-end examples as data, with every intermediate value at every seam. All lanes assert against the same numbers. -->

| Fixture | Seams covered | Intermediate values at each seam | Checked against real schema/catalog by |
|---|---|---|---|
| F-1 | S-1, S-2 | yes | {test name} |

## Vocabulary

| Term | Rejected synonyms (where they appeared) |
|---|---|

## Integration

- **Skeleton:** composition root wired with every lane's fake; `{test name}` runs F-1 end to end. It stays green on the integration branch at all times. Each lane swaps its fake for the real thing in the story that delivers it.
- **Cadence:** each lane merges to `{integration branch}` after every done story (or at the checkpoints below), never only at the end.
- **Seam checkpoints:** as soon as both sides of a seam are real, its checkpoint story runs F-1 through real producer → real consumer.

## Decisions due

<!-- Deferred decisions that must be taken before some story starts. lean-plan status flags any that are overdue. -->

| Decision | Decide by (story) | Owner | Status |
|---|---|---|---|

## Change Log

<!-- Contract changes after freeze: `{date} — C-n — {change} — requested by {lane} — types+fakes+fixtures+contract tests updated in {commit/story}`. -->
