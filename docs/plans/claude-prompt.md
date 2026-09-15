# Claude implementation prompt — Checkmate v0.1 social UI

You are working on branch `feature/claude-social-ui`. This is a standalone assignment —
you do not need any other conversation history to execute it.

## Scope: frontend/UI only

You own:
- Feed UI
- Video card/player
- Profile pages (video feed on profile)
- Upload screens (video post + video reply creation)
- Video reply UI (thread view)
- Emoji reaction UI
- Follow/unfollow UI
- Reporting/blocking UI
- 18+ gating UI
- Navigation
- Loading / error / empty states
- Styling and accessibility
- Frontend mocks built from Codex's published contracts

## Explicitly out of scope — do not touch

- `backend/**` (schema, migrations, routes, middleware, lib) — entirely Codex's.
- `src/types/index.ts` — this is the shared contract file Codex publishes. Read it,
  never edit it. If a type you need is missing or wrong, do not add/change it yourself —
  flag the gap and either work against a local mock type in the meantime or wait for
  Codex to update the shared file.
- `backend/src/routes/judge.ts`, the `JudgeSession`/`JudgeEvent` mediation feature, and
  any dating/matching surfaces (`Discover.tsx`, `SwipeCard.tsx`, `MatchProfile.tsx`,
  `Chat.tsx`, `matches.ts`, `messages.ts`, `premium.ts`) — unrelated in-flight work,
  leave it alone.
- Do not merge into `feature/codex-social-core`, and do not accept merges from it
  directly — integration happens through the normal PR/review path, not agent-to-agent
  merges.

## Product constraints (non-negotiable for v0.1)

- Video-first: posts are video only, no text-only posts.
- Replies to a post are video only. **No written comments anywhere in the UI** — no
  text input that posts as a comment, full stop.
- Emoji reactions are allowed (tap/pick from a fixed set), never free text.
- Captions exist only as metadata on the original post; they are not interactive and
  never appear on replies.
- Replies form a thread (backed by `parentPostId` — you don't need to know the DB
  details, just that "reply to post X" and "get replies for post X" are the operations).

## Current code you're modifying (read before you start)

- `src/components/PostCard.tsx` — feed card: author row, video, caption, actions.
  Currently has a `Heart` like button and a `MessageCircle` comment button opening
  `CommentSheet`. Replace: reaction bar (multi-emoji, not just heart) + reply CTA
  (opens the reply thread / launches the recorder), remove the comment affordance.
- `src/components/CommentSheet.tsx` — bottom sheet with a text comment list + text
  input + `EmojiCommentBar`. This is retired. Replace with a `ReplyThread` component:
  vertical video feed of replies to a post, using the same player pattern as the main
  feed, with a "Reply" CTA that launches `VideoRecorder`. No text input anywhere in it.
- `src/components/EmojiCommentBar.tsx` — four categories (Like/Fire/Boom/Vibes) each
  with emoji variants, currently feeds into the comment text field. Rework into
  `ReactionPicker.tsx`: same visual design, but selecting an emoji calls the reaction
  API directly (upsert my reaction on this post) — delete the "append to text field"
  and "submit as comment" branches entirely.
- `src/pages/CreatePost.tsx`, `src/pages/Studio.tsx` — video creation flow. Verify
  there is no path to submit a caption-only / video-less post. Add a reply-mode entry
  point (pre-fills target post, skips caption per Codex's contract decision — check
  the contract for whether replies accept captions at all).
- `src/pages/PostDetail.tsx` — becomes the thread root view: root video + reaction bar
  + reply feed underneath (using `ReplyThread`).
- `src/pages/HomeFeed.tsx`, `src/pages/Explore.tsx`, `src/pages/PublicProfile.tsx` —
  confirm these render root posts only and surface a reply count (not a comment count).
- `src/components/FollowButton.tsx`, `src/components/ReportModal.tsx` — likely no
  functional change; re-verify field names against the final contract once published.
- `src/routes/AppRoutes.tsx` — wire any new route needed for the thread/reply view.
  (Note: this file currently has unrelated uncommitted changes on `main` from other
  work — coordinate with the user before branching so you don't inherit an unrelated
  diff; don't attribute pre-existing changes in this file to yourself.)
- `src/pages/Onboarding.tsx` — 18+ gating already exists client-side (DOB check at
  signup, rejects under-18). No change expected here unless the server contract for
  `/auth/register` changes shape; verify, don't redesign.

## Handoff boundary — how you get the API

```
Codex produces: OpenAPI spec + shared TypeScript types (src/types/index.ts) + mock
                 response shape examples
        ↓
You build the full UI against those contracts, using a local mock layer (e.g.
`src/lib/mockSocialApi.ts`) that matches the published response shapes exactly —
same function signatures you'll eventually call on `src/lib/api.ts`, so the swap
is mechanical.
        ↓
Codex completes the real backend and merges it on their branch.
        ↓
You swap the mock layer for real `api.ts` calls. This should be a small, mechanical
diff if your mock matched the contract — if it isn't small, the contract drifted and
that's a Codex-side fix, not something to patch around client-side.
```

Until Codex publishes the contract, build against your best-effort mock shaped to
match `src/types/index.ts` as it exists today, and flag anywhere the current types
(`Post`, `SocialComment`, `SocialNotification`) don't yet reflect the video-first
model (e.g. `SocialComment` shouldn't exist post-rebuild; `Post` needs `parentPostId`
and `replyCount`) — those are gaps Codex needs to close, not something to paper over
in your own types file.

## Acceptance criteria for your surfaces

- Cannot submit a post without a video attached, anywhere in the UI.
- No text input exists that results in a comment being posted — verify by grep,
  not just by testing the happy path.
- Reaction picker allows exactly one active reaction per user per post; picking a
  new emoji replaces the old one in the UI optimistically.
- Reply CTA always opens the recorder targeting the correct parent post; the new
  reply appears in the thread view without a full page reload.
- Feed, profile, and explore views show only root posts, each with an accurate
  reply count.
- Follow/unfollow, report, and block flows work unchanged against the new post model.
- 18+ gating UI still blocks under-18 signup at the client (defense in depth; server
  enforcement is Codex's responsibility).
- All new/changed surfaces have loading, error, and empty states — no bare spinners
  forever, no silent failures.
- Keyboard/screen-reader accessibility on interactive elements you touch (reaction
  picker, reply CTA, follow button) — don't regress existing accessibility.

## What "done" looks like before you ask for integration

1. Full UI flow works end-to-end against your mock layer: create post → view in feed
   → reply with video → see it in the thread → react with an emoji → follow the
   author → report/block from the UI.
2. `npx tsc -p tsconfig.app.json --noEmit` is clean.
3. No references to `Comment`/`CommentSheet`/comment-related copy remain in the UI
   you touched.
4. You've noted, in your PR description, every place your mock assumed something
   about the contract that Codex hasn't confirmed yet, so integration doesn't
   surface it as a surprise.

Do not modify backend files, shared types, or migrations to make your mock "more
correct" — if the shared contract is wrong or missing, that's a note for Codex, not
something you fix yourself.
