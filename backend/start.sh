#!/bin/sh
echo "Running prisma db push..."
npx prisma db push --accept-data-loss --skip-generate || echo "prisma db push failed, continuing..."
echo "Starting server..."
exec npx tsx src/server.ts
