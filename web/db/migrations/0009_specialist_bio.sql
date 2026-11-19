-- "About me" text of a specialist profile, shown on the profile page to signed-in users once published.
-- Plain text (line breaks allowed); rendered escaped, never as HTML.
-- Rollback: ALTER TABLE specialist_profiles DROP COLUMN bio;

ALTER TABLE specialist_profiles
  ADD COLUMN bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 2000);
