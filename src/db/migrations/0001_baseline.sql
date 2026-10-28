-- Baseline: the schema Pony ORM created for the original Python backend.
-- Only IF NOT EXISTS statements, so this is a no-op against the production database
-- and creates the schema on an empty one.

CREATE TABLE IF NOT EXISTS "song" (
  "song_id" TEXT PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "melody" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  CONSTRAINT "unq_song__number" UNIQUE ("number"),
  CONSTRAINT "unq_song__title" UNIQUE ("title")
);

CREATE TABLE IF NOT EXISTS "tag" (
  "tag_id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "pretty_name_sv" TEXT NOT NULL,
  "pretty_name_en" TEXT NOT NULL,
  CONSTRAINT "unq_tag__name" UNIQUE ("name")
);

CREATE TABLE IF NOT EXISTS "songtotag" (
  "song" TEXT NOT NULL REFERENCES "song" ("song_id"),
  "tag" TEXT NOT NULL REFERENCES "tag" ("tag_id"),
  PRIMARY KEY ("song", "tag")
);

CREATE INDEX IF NOT EXISTS "idx_songtotag__tag" ON "songtotag" ("tag");
