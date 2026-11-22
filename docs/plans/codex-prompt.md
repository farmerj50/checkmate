# Codex implementation prompt — Checkmate v0.1 social backend

You are working in the worktree `../checkmate-codex`, on branch `feature/codex-social-core`.
This is a standalone assignment — you do not need any other conversation history to
execute it. Do not switch branches inside this worktree, and do not touch
`../checkmate-claude` (a different worktree, owned by the frontend agent) or the main
checkout (`checkematapp`, kept on `main` as the control workspace).

## REVISION NOTICE — read this first

An earlier pass at this contract (already uncommitted in this worktree, in
`backend/prisma/schema.prisma`, `backend/prisma/seed.ts`, `backend/src/routes/social.ts`,
`backend/docs/openapi-v0.1.yaml`, `shared/types/index.ts`) took a **greenfield rewrite**
direction: username/password auth with access/refresh tokens, a minimal `User` type that
drops nearly all existing profile fields, and a signed-URL + `/ingest/notify` webhook
upload architecture. **That direction is rejected.** It replaced working CheckMate
foundation (Firebase auth, the full dating-profile `User` model, the existing multer
upload pipeline) instead of extending it.

**Your first task, before any further feature implementation, is to reconcile this
work with the existing CheckMate backend**, per the corrected direction below. Nothing
in the earlier draft is deleted for you — it's sitting uncommitted in this worktree so
you can review it, keep whatever's genuinely reusable (e.g. the shape of the `Post`
self-relation / `Reaction` idea), and rebuild the parts that assumed a greenfield
backend (auth, `User`, upload) on top of what already exists instead.

## Corrected architecture direction — extend, don't replace

- **Auth: Firebase stays.** Do not replace Firebase authentication. Do not create a
  parallel username/password auth system. `POST /auth/register` and Firebase token
  verification (`backend/src/middleware/auth.ts`) remain the identity layer.
- **User model: extend, don't replace.** Do not reduce `User` to a social-only shape.
  Keep every existing field (`firstName`, `lastName`, `dateOfBirth`, `gender`,
  `location`, `interests`, `profilePictures`, `profileVideos`, Firebase identity, all
  of it) and add social fields alongside them: `username`, `displayName`, `bio`,
  `avatarUrl`, `followerCount`, `followingCount`, `postCount`, `isPrivate`,
  `socialStatus`. (Note: `bio` already exists on `User` — reuse it rather than adding
  a duplicate field; `followerCount`/`followingCount`/`postCount` can be computed via
  `_count` relations instead of stored denormalized counters unless you have a
  specific perf reason to denormalize — your call, but document it either way.)
- **Upload: extend the existing multer pipeline, don't replace it with signed-URL
  ingestion.** The v0.1 flow stays: multer upload → video validation → store video →
  create `Post` → generate thumbnail if needed → publish into feed. Migrating to
  signed object-storage uploads is a legitimate future step when volume requires it,
  not something v0.1 needs. Only deviate from this if you find the current upload
  implementation genuinely cannot support the video-reply flow — if so, say so
  explicitly and explain why before implementing an alternative, don't just swap it.
- **The goal is converting CheckMate into a social platform, not a greenfield
  rewrite.** Every decision should default to "extend what's there" over "replace
  it with something cleaner." A cleaner greenfield architecture existing is not a
  reason to build it for v0.1.

## Scope: backend, schema, contracts only

You own:
- Database/schema design (`backend/prisma/schema.prisma`, migrations)
- Post/reply relationship model
- API contracts (OpenAPI spec + shared TypeScript types)
- Feed logic
- Upload/storage backend
- Auth/authorization, including server-side 18+ enforcement
- Follow/reaction/report/block backend
- Migrations
- Integration and backend tests
- Shared types/interfaces (`src/types/index.ts`)
- Complex edge cases and security-sensitive logic

## Explicitly out of scope — do not touch

- Any frontend UI: `src/pages/**`, `src/components/**` (other than reading them to
  understand what shape of data the UI needs).
- `src/routes/AppRoutes.tsx`.
- `backend/src/routes/judge.ts`, `JudgeSession`/`JudgeEvent` mediation feature, and
  any dating/matching backend (`matches.ts`, `messages.ts`, `premium.ts`) — unrelated
  in-flight work, leave it alone.
- Do not merge into `feature/claude-social-ui`, and do not accept merges from it
  directly — integration happens through the normal PR/review path.

## Product constraints (non-negotiable for v0.1)

- Video-first: posts are video only, no text-only posts. Enforce this at the API
  layer, not just assume the client behaves.
- Replies to a post are video only, threaded via a post-to-post relationship
  (`parentPostId`) — not a separate Comment entity.
- **The `Comment` model is removed entirely.** No written-comment code path should
  exist anywhere in the API surface after this work.
- Emoji reactions replace likes as the sole non-video engagement primitive: one
  active reaction per user per post, no free text ever accepted.
- Captions are metadata on the root post only — no caption-as-comment behavior, and
  decide (and document in the contract) whether replies may carry a caption at all.
- 18+ gating must be enforced server-side at registration, not just trusted from the
  client. `dateOfBirth` already exists on `User`; client-side Onboarding already
  rejects under-18 (`src/pages/Onboarding.tsx`) but that's bypassable — close the
  server-side gap.

## Current backend state (read before you start)

- `backend/prisma/schema.prisma` — `Post` (video/image, caption, author), `PostLike`
  (heart-only), `Comment` (free text, 500 char), `Follow`, `Report`, `Block`,
  `Notification`. Note: this file currently has an unrelated uncommitted diff on
  `main` adding `JudgeSession`/`JudgeEvent` — that's a different feature, not yours;
  don't revert it, don't build on it, coordinate with the user on how it gets
  separated from your branch before you start.
- `backend/src/routes/social.ts` — full CRUD today for posts, likes, comments,
  follow/unfollow, notifications. This is the file you rewrite for reactions/replies.
- `backend/src/routes/safety.ts` — report/block, already generic user-to-user (not
  post-scoped). Flag explicitly whether v0.1 needs per-post reporting (it isn't
  currently modeled) rather than silently adding it or silently skipping it.
- `backend/src/routes/upload.ts` — existing video upload handling; verify it already
  works unmodified for reply videos (same media constraints as root posts) before
  assuming you need to change it.
- `backend/src/routes/auth.ts` — `POST /auth/register`, where server-side 18+
  enforcement needs to land.
- `src/types/index.ts` — current `Post` type has no `parentPostId`/`replyCount`;
  `SocialComment` exists and needs to go away; `SocialNotification` types reference
  `POST_COMMENTED` which needs to become `POST_REPLIED` (or equivalent — your call,
  document it).

## Required schema changes

1. Remove `Comment` model and its relation on `Post`; remove `Notification.commentId`
   usage tied to it.
2. Remove `PostLike`; add `PostReaction { id, postId, userId, emoji, createdAt }`,
   unique on `(postId, userId)` — upsert-on-change semantics (changing emoji replaces,
   doesn't stack).
3. Add `parentPostId String?` + self-relation (`parent` / `replies`) on `Post`, with
   `onDelete: Cascade` so deleting a root post removes its reply thread.
4. Index `parentPostId` and `(parentPostId, createdAt)` for thread pagination.
5. Decide and document the final `NotificationType` naming for reply/reaction events.
6. Write the migration; decide and document what happens to existing `Comment`/
   `PostLike` rows in any environment that already has data (hard delete vs.
   preserved-but-orphaned) — don't assume it's empty everywhere.
7. Extend `User` with the social fields listed above (`username`, `displayName`,
   `avatarUrl`, `isPrivate`, `socialStatus`, plus follower/following/post counts
   however you decide to compute them) — additively, alongside every existing field.
   This is a normal additive migration on the existing `User` table, not a new model.

## Required API changes (`backend/src/routes/social.ts` and friends)

- `POST /social/posts` — enforce `mediaType === 'VIDEO'` for v0.1.
- `POST /social/posts/:id/reply` — creates a `Post` with `parentPostId = :id`.
- `GET /social/posts/:id/replies` — cursor-paginated, same shape/limit pattern as feed.
- `GET /social/posts/feed`, `GET /social/posts/user/:userId` — filter to
  `parentPostId: null`, include `replyCount` via `_count.replies`.
- Replace `/posts/:id/comments*` with `POST/DELETE/GET /social/posts/:id/reactions`.
- Update notification emission for reply + reaction events; delete the comment
  notification path.
- Server-side 18+ check on `POST /auth/register`.

## Contract deliverable — publish before Claude's UI wiring starts

Produce and publish (in `src/types/index.ts` plus an OpenAPI doc, and mock response
shape examples for at least: feed page, thread page, reaction toggle, reply create):

- Final `Post` type (with `parentPostId`, `replyCount`, no `commentCount`)
- `PostReaction` type
- Updated `SocialNotification` type (reply/reaction variants)
- Removal of `SocialComment`
- Real example JSON for each endpoint's success and error responses

This is the handoff point — Claude builds the entire UI against this contract via a
mock layer before your real endpoints exist. If you change the contract after
publishing it, that's a breaking change to communicate explicitly, not a silent diff.

## Acceptance criteria for your surfaces

- No `Comment` model, table, or route remains anywhere in the codebase after this work.
- `POST /social/posts` and the reply endpoint reject non-video media server-side
  (test this, don't just trust client validation).
- Reaction upsert is atomic and idempotent per `(postId, userId)`.
- Deleting a root post cascades and removes its full reply thread (test this).
- `POST /auth/register` rejects a DOB implying age < 18, independent of client input.
- Feed and thread pagination both work correctly with cursors across page boundaries.
- Backend integration tests cover: feed pagination, thread pagination, reaction
  upsert/toggle, video-only rejection, 18+ rejection, cascade delete on root removal.

## What "done" looks like before you ask for integration

1. Migration applied cleanly to a fresh DB.
2. All routes above implemented and covered by integration tests, green.
3. Contract (`src/types/index.ts` + OpenAPI + mock examples) published and stable —
   not still shifting under Claude's feet.
4. `grep -r` for `Comment`/`PostLike` across `backend/` and `src/types` comes back
   clean except where intentionally referenced in migration history.

Do not modify frontend UI files to "make the demo work" — if the UI needs something
your contract doesn't provide, that's a note back to Claude/the user, not something
you patch in `src/pages` or `src/components` yourself.
