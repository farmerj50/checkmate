# Checkmate v0.1 — Video-First Rebuild Plan

Status: **Planning only.** No code changes, no migrations, no release branches. This document is the shared reference for Codex (backend owner) and Claude (frontend owner).

## 0. Product constraints (final for v0.1)

- Video-first. Users create **video posts only** — no text-only posts.
- Replies to a post are **video only**. No written comments anywhere.
- Emoji reactions are allowed (not free text).
- Captions are metadata on the *original* post only — never on replies, never comment-like.
- Replies are threaded via `parentPostId` (post-to-post, not a separate Comment entity).
- Keep: follow/unfollow, user profiles, profile video feeds, reporting, blocking, 18+ gating.
- `Comment` model is removed entirely.

## 1. Revised v0.1 architecture

```
Post (video only)
 ├─ authorId          → User
 ├─ mediaUrl / mediaType (VIDEO fixed for v0.1, IMAGE type kept in enum but unused by UI)
 ├─ caption            → metadata only, non-interactive
 ├─ parentPostId       → Post? (null = root post, set = video reply)
 ├─ replies[]          → Post[] (self-relation via parentPostId)
 ├─ reactions[]        → PostReaction[] (emoji, replaces PostLike as the sole engagement primitive)
 └─ reports/blocks     → existing Report/Block models, unchanged (user-to-user, already generic)

Follow (unchanged)
Notification (unchanged, POST_COMMENTED → replaced by POST_REPLIED)
```

Key decision — **reactions replace likes**: the current heart-only `PostLike` and the
free-text-capable `CommentSheet`/`EmojiCommentBar` combo both go away. `EmojiCommentBar`'s
four categories (Like / Fire / Boom / Vibes) become the reaction picker — that UI already
exists and needs no redesign, only rewiring. `PostReaction` replaces `PostLike`:
one active emoji per user per post, changeable, no text field possible.

**Threading model**: a reply is just a `Post` with `parentPostId` set and `mediaType: VIDEO`.
Feed queries default to `parentPostId: null` (roots only); a post's reply thread is
`GET /social/posts/:id/replies`, itself paginated the same way as the feed. This avoids a
parallel data model and keeps reactions/reports/blocks working identically on replies and
root posts for free.

**18+ gating**: `dateOfBirth` already exists on `User` and Onboarding already blocks
signup client-side (`src/pages/Onboarding.tsx:240-250`). Gap: there is no server-side
enforcement at registration. This must be closed as part of v0.1 (Codex, auth/authorization
scope) since client-side checks are bypassable.

## 2. Detailed task breakdown

### Schema & migration
1. Drop `Comment` model, its relation on `Post`, and `Notification.commentId` FK usage.
2. Drop `PostLike`, add `PostReaction { id, postId, userId, emoji, createdAt }`, unique on `(postId, userId)` (one active reaction per user, upsert-on-change).
3. Add `parentPostId String?` + self-relation `parent`/`replies` on `Post`.
4. Add index `@@index([parentPostId])` and `@@index([parentPostId, createdAt])` for thread pagination.
5. Update `NotificationType`: `POST_COMMENTED` → `POST_REPLIED`; keep `POST_LIKED` name but repoint semantics to reaction, or add `POST_REACTED` (Codex's call — pick one, document it in the API contract section below once decided).
6. Server-side DOB/18+ check on `POST /auth/register` (reject or flag underage at the API layer, not just UI).
7. Write and test the migration against the existing `posts`/`post_likes`/`comments` tables (data migration plan: existing comments are hard-deleted — confirm with product owner that v0.1 has no legacy data to preserve, since staging/prod may already have rows).

### API layer (`backend/src/routes/social.ts`)
8. `POST /social/posts` — reject `mediaType !== 'VIDEO'` for v0.1 (schema keeps the enum for future-proofing, API enforces video-only).
9. `POST /social/posts/:id/reply` — creates a `Post` with `parentPostId = :id`, video-only, caption forbidden or ignored (decide and document).
10. `GET /social/posts/:id/replies` — cursor-paginated thread, same shape as feed.
11. Replace `POST/GET /posts/:id/comments*` with `POST /social/posts/:id/reactions` (upsert emoji) and `DELETE /social/posts/:id/reactions` (remove mine).
12. Update `GET /posts/feed`, `GET /posts/user/:userId` to filter `parentPostId: null` and include `replyCount` via `_count.replies` instead of `_count.comments`.
13. Update notification emit on reply + reaction; remove comment notification code path.

### Frontend
14. `PostCard.tsx`: swap `MessageCircle` (comments) affordance for a reply affordance that opens the camera/recorder targeted at `parentPostId`; swap `Heart` toggle for the reaction bar (long-press or tap opens `EmojiCommentBar`-derived picker, shows current reaction).
15. Replace `CommentSheet.tsx` with a `ReplyThread` view (vertical video feed of replies, same player component as main feed, "Reply" CTA that launches `VideoRecorder`).
16. `EmojiCommentBar.tsx` → repurpose as `ReactionPicker.tsx`, wired to the reaction endpoints, no text input path at all (delete the text-submit branch).
17. `CreatePost.tsx` / `Studio.tsx`: confirm no text-only path exists (check current flow allows caption-only submission — must require video); add reply mode (pre-filled `parentPostId`, disable caption if replies shouldn't carry captions per product decision).
18. `PostDetail.tsx`: becomes the thread root view — root video + reactions + reply feed underneath.
19. Feed empty/loading/error states for reply threads.
20. 18+ gating UI: confirm Onboarding copy/validation still matches server enforcement once Codex lands it; no client logic change expected unless server contract changes.

## 3. Codex task list (backend/data owner)

- [ ] Finalize schema diff (Post self-relation, PostReaction, drop Comment/PostLike) in `backend/prisma/schema.prisma`
- [ ] Write and run the Prisma migration
- [ ] Rewrite `backend/src/routes/social.ts`: posts (video-only enforcement), replies, reactions, feed/thread queries, notifications
- [ ] Server-side 18+ enforcement in `backend/src/routes/auth.ts` (`POST /auth/register`)
- [ ] Confirm `backend/src/routes/upload.ts` handles reply-video uploads identically to post uploads (likely no change needed — verify)
- [ ] Confirm `backend/src/routes/safety.ts` (report/block) needs no change — it's already user-to-user and generic; add `postId` to `Report` only if product wants per-post reporting (currently reports target users only — flag this gap explicitly, see §7)
- [ ] Define and publish shared types in `src/types/index.ts` for `Post` (with `parentPostId`, `replyCount`), `PostReaction`, updated `SocialNotification` — this file is the contract handoff point
- [ ] Integration/backend tests: feed pagination, thread pagination, reaction upsert/toggle, video-only rejection, 18+ rejection, cascade delete of replies when root post is deleted
- [ ] Document final API contract (fill in §7 below with real request/response shapes once implemented)

## 4. Claude task list (frontend owner)

- [ ] `PostCard.tsx` — reaction bar + reply CTA, remove comment icon/count
- [ ] New `ReplyThread.tsx` (replaces `CommentSheet.tsx`) — video thread view
- [ ] `ReactionPicker.tsx` (rework of `EmojiCommentBar.tsx`) — no text-submit path
- [ ] `PostDetail.tsx` — root post + reply thread composition
- [ ] `CreatePost.tsx` / `Studio.tsx` — verify/enforce video-required, add reply-mode entry point
- [ ] `HomeFeed.tsx`, `Explore.tsx`, `PublicProfile.tsx` — confirm they only render root posts (`parentPostId == null`) and surface `replyCount`
- [ ] `FollowButton.tsx`, `ReportModal.tsx` — no functional change expected; re-verify against final contract
- [ ] Navigation entry point for a post's reply thread (route wiring in `src/routes/AppRoutes.tsx`)
- [ ] Loading / error / empty states for feed and thread views
- [ ] Build all of the above against a mock API (see §9) until Codex's endpoints land, then swap the mock layer for `src/lib/api.ts` calls

## 5. Dependency order

1. **Codex**: schema + migration (blocks everything else)
2. **Codex**: publish shared types in `src/types/index.ts` + API contract doc (§7) — this is the handoff point; Claude can start UI work against mocks *before* this lands, but cannot wire real calls until it does
3. **Claude** (parallel, from step 0): build UI against mocked responses shaped to the *proposed* contract in §7
4. **Codex**: implement routes (posts/replies/reactions/feed/notifications)
5. **Codex**: 18+ server-side enforcement (independent, can happen anytime after schema)
6. **Claude**: swap mocks for real `api.ts` calls once Codex's routes are live in dev
7. **Both**: integration pass (§9)
8. **Both**: release-readiness checklist (§10)

## 6. File / folder ownership boundaries

**Codex — backend, schema, contracts:**
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/**`
- `backend/src/routes/social.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/upload.ts`, `backend/src/routes/safety.ts`
- `backend/src/lib/**`, `backend/src/middleware/**`
- `src/types/index.ts` (shared contract — Claude reads, does not edit)
- Backend test files (`backend/**/*.test.ts` or equivalent)

**Claude — frontend UI:**
- `src/pages/HomeFeed.tsx`, `Explore.tsx`, `PostDetail.tsx`, `CreatePost.tsx`, `Studio.tsx`, `PublicProfile.tsx`, `Profile.tsx`
- `src/components/PostCard.tsx`, `CommentSheet.tsx` (→ retired), `EmojiCommentBar.tsx` (→ reworked), `FollowButton.tsx`, `ReportModal.tsx`, `VideoRecorder.tsx`, `VideoEditorModal.tsx`, `Navigation.tsx`
- `src/routes/AppRoutes.tsx`
- `src/lib/api.ts` (call sites only — no contract changes)

**Explicitly out of scope for both** (do not touch under this plan): `backend/src/routes/judge.ts`, `backend/src/routes/matches.ts`, `backend/src/routes/messages.ts`, `backend/src/routes/premium.ts`, dating/matching UI (`Discover.tsx`, `SwipeCard.tsx`, `MatchProfile.tsx`, `Chat.tsx`), and the in-flight `JudgeSession`/`JudgeEvent` mediation feature already in the schema diff.

## 7. API contract list (proposed — Codex to confirm and finalize)

| Endpoint | Method | Purpose | Notes |
|---|---|---|---|
| `/social/posts` | POST | Create root video post | Rejects non-VIDEO `mediaType` |
| `/social/posts/:id/reply` | POST | Create video reply | Sets `parentPostId`; body likely just `{ mediaUrl }` |
| `/social/posts/feed` | GET | Root feed, cursor-paginated | Filters `parentPostId: null`, adds `replyCount` |
| `/social/posts/:id/replies` | GET | Reply thread, cursor-paginated | Same shape as feed |
| `/social/posts/user/:userId` | GET | Profile video feed | Roots only |
| `/social/posts/:id` | DELETE | Delete own post | Cascades to replies (schema `onDelete: Cascade`) |
| `/social/posts/:id/reactions` | POST | Upsert my emoji reaction | Body `{ emoji }`; replaces like toggle |
| `/social/posts/:id/reactions` | DELETE | Remove my reaction | |
| `/social/posts/:id/reactions` | GET | Reaction counts + mine | Replaces `/likes` |
| `/social/follow/:userId` | POST/DELETE | unchanged | |
| `/social/notifications` | GET | unchanged shape, `POST_COMMENTED` → `POST_REPLIED`, `POST_LIKED` → reaction-based | |
| `/auth/register` | POST | unchanged route, adds server-side 18+ check | |

**Removed:** `POST/GET/DELETE /social/posts/:id/comments*`.

## 8. Acceptance criteria per major feature

- **Video post creation**: cannot submit without a video file; caption optional; rejected server-side if `mediaType != VIDEO`.
- **Video reply**: reply always carries `parentPostId`; appears in the parent's thread ordered newest-first (or oldest-first — Codex to confirm ordering); reply count on parent updates immediately (optimistic) and reconciles with server.
- **Emoji reactions**: one active reaction per user per post; changing reaction replaces, not stacks; no free-text path exists anywhere in the reaction UI or API.
- **No written comments**: grep-verifiable — no `Comment` model, no text-body route accepts arbitrary post-attached prose.
- **Follow/unfollow**: unchanged behavior, still functions against the new feed filtering.
- **Profile video feed**: shows only root posts by that user; reply counts visible; replies by that user are reachable only via the thread view, not the profile grid (confirm this is the intended UX — flag if not).
- **Reporting/blocking**: still functions on users; flag as a gap if product wants per-post reporting (not currently modeled).
- **18+ gating**: signup rejected server-side for DOB implying age < 18, not just client-side.

## 9. Integration plan

- Claude builds against a local mock layer (e.g. a `src/lib/mockSocialApi.ts` swappable behind the same function signatures as `api.ts`, shaped to §7) so UI work isn't blocked on Codex.
- Once Codex's routes are live in the dev backend, Claude removes the mock layer and points at real `api.ts` calls — this should be a low-diff swap if the mock matched the contract in §7.
- Joint smoke pass once both sides land: create post → reply → react → verify feed/thread/notification/profile all reflect it — in the actual running app, not just type-checked.
- Any contract drift discovered during integration gets fixed by Codex (contract owner); Claude does not patch around a mismatched contract by reshaping data client-side.

## 10. Release-readiness checklist

- [ ] Migration applied cleanly to a fresh DB and to a copy of current dev data (no orphaned `Comment`/`PostLike` references left dangling)
- [ ] No remaining references to `Comment` or `PostLike` in either codebase (`grep -r` clean)
- [ ] Backend integration tests green (feed, thread, reactions, video-only enforcement, 18+ enforcement, cascade delete)
- [ ] Frontend TypeScript build clean (`npx tsc -p tsconfig.app.json --noEmit`)
- [ ] Manual pass: create video post, reply with video, react, follow/unfollow, report, block, thread pagination, feed pagination — all in the running app
- [ ] 18+ gating verified end-to-end (client + server reject under-18 DOB)
- [ ] No text-only post or comment path reachable from any UI surface
- [ ] `docs/plans/video-first-v0.1-plan.md` (this file) updated to reflect any decisions made during implementation that diverged from the proposal
- [ ] Explicit go/no-go conversation before cutting a release branch or freezing develop — **not done as part of this planning phase**
