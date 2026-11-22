# Legacy deployment recovery

The deployment on 2026-11-22 failed with Prisma P3005 because the earlier
application used `db push`, leaving an existing schema without migration history.
That schema also predates the video-first social tables, so recording the initial
migration without first reconciling the schema would leave the API broken.

`legacy-social-core.sql` converts that specific legacy schema to the schema in
`20260915162234_codex_social_core`. It runs in one transaction, locks the affected
social tables, and rejects existing migration history or any posts, post likes,
comments, or notifications. It does not modify user accounts. Databases with
legacy social content need a separately reviewed data migration.

This is an operator recovery script, outside the normal migration directory.
Never run it automatically at startup or use `db push --accept-data-loss` to
bypass this failure.

Before any use, take and verify a full backup, inspect the actual schema, and
rehearse the procedure on an isolated restore. Run the SQL with a client that
stops on errors, such as `psql -X -v ON_ERROR_STOP=1 -f
prisma/recovery/legacy-social-core.sql`. Verify that the result matches a clean
database created from the first migration before recording its baseline.
With `DATABASE_URL` explicitly set to the inspected database, from `backend`:

```sh
npx prisma migrate resolve --applied 20260915162234_codex_social_core
npx prisma migrate deploy
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --exit-code
```

The final diff must exit with code 0. Verify existing records are unchanged before
restarting the API. Subsequent deployments continue using `prisma migrate deploy`
through `start.sh`.
