CREATE TYPE "JudgeStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'TIER1_NOTICE', 'RECOMMENDED_STOP', 'COOLDOWN', 'PAUSED', 'DECLINED');

ALTER TABLE "likes" ADD COLUMN "isPass" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "judge_sessions" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "JudgeStatus" NOT NULL DEFAULT 'REQUESTED',
    "tier" INTEGER NOT NULL DEFAULT 0,
    "userAApproved" BOOLEAN NOT NULL DEFAULT false,
    "userBApproved" BOOLEAN NOT NULL DEFAULT false,
    "userAAgreesToStop" BOOLEAN NOT NULL DEFAULT false,
    "userBAgreesToStop" BOOLEAN NOT NULL DEFAULT false,
    "userAWantsToContinue" BOOLEAN NOT NULL DEFAULT false,
    "userBWantsToContinue" BOOLEAN NOT NULL DEFAULT false,
    "judgeRecommendedStop" BOOLEAN NOT NULL DEFAULT false,
    "judgeStrikeCount" INTEGER NOT NULL DEFAULT 0,
    "stopReason" TEXT,
    "confidenceLevel" TEXT,
    "cooldownEndsAt" TIMESTAMP(3),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "judge_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "judge_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "judge_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "judge_sessions_matchId_key" ON "judge_sessions"("matchId");
CREATE INDEX "judge_events_sessionId_createdAt_idx" ON "judge_events"("sessionId", "createdAt");
ALTER TABLE "judge_sessions" ADD CONSTRAINT "judge_sessions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "judge_sessions" ADD CONSTRAINT "judge_sessions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "judge_events" ADD CONSTRAINT "judge_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "judge_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "judge_events" ADD CONSTRAINT "judge_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
