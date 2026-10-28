-- Issues #8 and #9: signed in users can suggest new songs and edits to existing ones.
CREATE TABLE IF NOT EXISTS "suggestion" (
  "id" UUID PRIMARY KEY,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('new', 'edit')),
  "song_id" TEXT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT NOT NULL DEFAULT '',
  "melody" TEXT NOT NULL DEFAULT '',
  "text" TEXT NOT NULL,
  "tags" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "suggested_by_sub" TEXT NOT NULL,
  "suggested_by_cid" TEXT NOT NULL,
  "suggested_by_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "reviewed_at" TIMESTAMPTZ NULL,
  "reviewed_by_cid" TEXT NULL,
  "review_comment" TEXT NULL
);

CREATE INDEX IF NOT EXISTS "idx_suggestion__status" ON "suggestion" ("status");
CREATE INDEX IF NOT EXISTS "idx_suggestion__suggested_by_sub" ON "suggestion" ("suggested_by_sub");
