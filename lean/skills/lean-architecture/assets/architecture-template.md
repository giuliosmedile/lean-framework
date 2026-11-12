---
title: '{title} — Architecture'
status: draft          # draft | final
paradigm: '{named pattern}'
updated: '{date}'
spec: SPEC.md
---

<!-- A shape, not a script: keep only the sections this system needs. A small feature may be paradigm + 3 ADs + conventions. Delete every comment. -->

# {Title} — Architecture

## Paradigm

<!-- Name it; map its layers to directories/modules. -->

```mermaid
flowchart LR
  %% dependency direction: who may depend on whom
```

## Modules

<!-- What thinks vs what talks. lean-plan draws parallel lanes from this table. -->

| Module | Responsibility | Talks to | Holds state | May depend on |
|---|---|---|---|---|
| | | | | |

## Decisions

### AD-1 — {decision}

- **Binds:** {CAP-ids, areas, or `all`}
- **Prevents:** {the divergence this stops}
- **Rule:** {the enforceable constraint}

## Conventions

| Concern | Convention |
| --- | --- |
| Naming (entities, files, endpoints, events) | |
| Data formats (ids, dates, money, error shape) | |
| Errors, logging, config, auth | |
| Testing (where tests live, what level covers what) | |

## Stack

<!-- Seed. Versions verified current at authoring. -->

| Name | Version |
| --- | --- |
| | |

## Structural Seed

<!-- Minimal source tree; add a deployment/environment diagram and core-entity ERD only when non-obvious. -->

```text
{root}/
```

## Capability Map

| Capability | Lives in | Governed by |
| --- | --- | --- |
| CAP-1 | | AD-… |

## Deferred

<!-- Decisions intentionally left to stories or later, each with why it can wait. -->

## Open Questions

## Decision Log

<!-- Append-only: `{date} — {decision | adopted | assumption | version | change} — {gist, with reason and options weighed}` -->
