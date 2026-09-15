# Codex Backend Checklist (v0.1)

Planning-only artifacts and PR-level subtasks for Codex (backend/core).

## 1. Contracts & shared types (must complete first)
- [ ] Write `backend/docs/openapi-v0.1.yaml` (skeleton) — done
- [ ] Generate TypeScript types from OpenAPI and publish to `shared/types` (v0.1)
- [ ] Provide mock server (e.g., json-server or mock-openapi)

Acceptance:
- OpenAPI file present and `shared/types` compiles; mock server responds with example payloads.

## 2. DB design & migrations
- [ ] Draft ERD and review
- [ ] Implement migrations for: `users`, `posts`, `reactions`, `follows`, `blocks`, `reports`, `moderation_logs`
- [ ] Add indices: `created_at`, `parent_post_id`, `author_id,created_at`, unique reactions

Acceptance:
- Migrations apply on fresh DB and rollback cleanly.

## 3. Auth & 18+ enforcement
- [ ] Implement signup/login endpoints; store `isAdult` from DOB
- [ ] Middleware `requireAuth` and `requireAdult`
- [ ] Token refresh endpoint

Acceptance:
- Protected routes enforce auth; under-18 users cannot sign up or upload.

## 4. Signed upload flow
- [ ] POST `/uploads/signed` — validate size/mime and return signed URL + token
- [ ] Validate upload ownership on `/ingest/notify`

Acceptance:
- Signed URLs expire; server validates callbacks and token ownership.

## 5. Ingestion & transcoding
- [ ] Worker spec; job queue setup
- [ ] Transcode to canonical formats; extract thumbnail
- [ ] Callback updates `Post` metadata and moderation status

Acceptance:
- Ingested items produce canonical `videoUrl` and `thumbnailUrl`.

## 6. Posts & replies
- [ ] POST `/posts` create post after upload
- [ ] Enforce `parentPostId` relationship
- [ ] Atomic update to `replyCount` (concurrency-safe)

Acceptance:
- Replies create Post records with correct `parentPostId` and reply counts remain accurate under concurrent operations.

## 7. Reactions / follows / blocks / reports
- [ ] Create endpoints + DB behavior
- [ ] Deduplication rules (one reaction per user/emoji per post)
- [ ] Rate limiting for abuse

Acceptance:
- Reaction counts consistent; block hides interactions.

## 8. Feed service
- [ ] Implement `/feed` (cursor-based); `/profiles/:id/posts`
- [ ] Basic ranking: recency + follow weight + engagement

Acceptance:
- Cursor pagination works; feed respects blocks and privacy.

## 9. Moderation backend
- [ ] Moderation queue, admin actions
- [ ] Automated classifier hooks (optional)

Acceptance:
- Reports appear in queue; admin can action items and create logs.

## 10. Tests & CI
- [ ] Unit tests for all services
- [ ] Integration tests using ephemeral DB
- [ ] Contract tests for OpenAPI
- [ ] Migration apply/rollback tests

Acceptance:
- CI passes; critical modules have tests and coverage thresholds.

## PR checklist for Codex
- [ ] OpenAPI updated if API changed
- [ ] `shared/types` updated
- [ ] Migration files added (idempotent)
- [ ] Tests added/updated
- [ ] Run `make migrate` and `make migrate:rollback` locally
- [ ] Security checklist updated (threats and mitigations)

## Handover to Claude (frontend)
- [ ] Publish OpenAPI + `shared/types` with mock server
- [ ] Provide example requests and Postman collection

---
> Notes: This is planning-only. Do not modify frontend UI files in `frontend/src`.
