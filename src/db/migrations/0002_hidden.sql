-- Issue #10: allow admins to hide songs from the public songbook.
ALTER TABLE "song" ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false;
