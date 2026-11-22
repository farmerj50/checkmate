-- One-time recovery for the pre-migrations social schema.
-- Back up and inspect the database first. This deliberately rejects databases
-- containing legacy social content; those require a separate data migration.
-- After this succeeds, verify the schema against the social-core migration,
-- baseline 20260915162234_codex_social_core, then run prisma migrate deploy.
-- Do not add this script to application startup.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public;

LOCK TABLE posts, post_likes, comments, notifications IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM posts)
       OR EXISTS (SELECT 1 FROM post_likes)
       OR EXISTS (SELECT 1 FROM comments)
       OR EXISTS (SELECT 1 FROM notifications) THEN
        RAISE EXCEPTION 'Legacy social tables contain data; refusing automatic recovery';
    END IF;
    IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
        RAISE EXCEPTION 'Migration history already exists; inspect it before recovery';
    END IF;
END $$;

CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "NotificationType_new" AS ENUM ('NEW_FOLLOWER', 'POST_LIKED', 'NEW_MATCH');
ALTER TABLE notifications ALTER COLUMN type TYPE "NotificationType_new"
    USING (type::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";

ALTER TABLE posts RENAME COLUMN "mediaUrl" TO "videoUrl";
ALTER TABLE posts
    DROP COLUMN "mediaType",
    ADD COLUMN "thumbnailUrl" TEXT,
    ADD COLUMN visibility "Visibility" NOT NULL DEFAULT 'PUBLIC',
    ADD COLUMN "parentPostId" TEXT,
    ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "deletedAt" TIMESTAMP(3),
    ADD COLUMN "replyCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE notifications DROP COLUMN "commentId";
DROP TABLE post_likes;
DROP TABLE comments;

CREATE TABLE post_reactions (
    id TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    emoji TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT post_reactions_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "post_reactions_postId_userId_emoji_key"
    ON post_reactions ("postId", "userId", emoji);
ALTER TABLE posts ADD CONSTRAINT "posts_parentPostId_fkey"
    FOREIGN KEY ("parentPostId") REFERENCES posts(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE post_reactions ADD CONSTRAINT "post_reactions_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES posts(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE post_reactions ADD CONSTRAINT "post_reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
