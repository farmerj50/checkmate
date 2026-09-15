# Worktree & branch setup — video-first v0.1 split

Recorded 2026-09-15, for whoever picks this up next.

## Physical layout

| Folder | Branch | Owner |
|---|---|---|
| `C:\Users\gabby\checkematapp` | `main` | Control workspace — not for feature work by either agent |
| `C:\Users\gabby\checkmate-codex` | `feature/codex-social-core` | Codex only |
| `C:\Users\gabby\checkmate-claude` | `feature/claude-social-ui` | Claude only |

Rule: neither agent switches branches inside the other's worktree. Integration between
the two branches happens through normal PR/review, never a direct merge from one
agent's branch into the other's.

## Stash bookkeeping

As of this setup, `git stash list` (shared across all three worktrees — stash is
per-repo, not per-worktree) should show exactly one entry:

```
stash@{0}: On main: WIP Judge/Resolve before social split
```

This is **unrelated** pre-existing work (the `JudgeSession`/`JudgeEvent` AI-mediation
feature) that predates this split. Leave it alone — do not pop it into either social
worktree. It'll get sorted onto whatever branch it actually belongs to later, separately.

A second stash (Codex's first-pass greenfield contract attempt) was created and then
popped directly into `../checkmate-codex` — it is no longer in the stash list, it's
uncommitted working-tree state in that worktree. See `codex-prompt.md`'s "REVISION
NOTICE" section for what to do with it.

## Reference docs in this folder

- `video-first-v0.1-plan.md` — original combined plan (superseded in parts by the
  corrected architecture direction; kept for the product-constraints section and
  general background)
- `codex-prompt.md` — standalone prompt for the backend agent, includes the corrected
  "extend, don't replace" architecture direction
- `claude-prompt.md` — standalone prompt for the frontend agent

These are plain files, copied into each worktree for local reference (not committed —
copy again if you regenerate them from the main checkout).
