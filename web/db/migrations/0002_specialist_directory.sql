-- Specialist directory (ТЗ module 2/3): categories + public specialist profiles searched by signed-in users.
-- Rating/review aggregates are plain columns until the reviews module exists.

-- Verification states from ТЗ section 6. Automated checks never set `confirmed`; only a moderator does.
CREATE TYPE verification_status AS ENUM (
  'draft', 'submitted', 'auto_check', 'awaiting_moderation',
  'needs_documents', 'confirmed', 'rejected', 'blocked'
);

-- Editable through the future admin panel. Names are localized: {"ru": "...", "uz": "...", "en": "..."}.
CREATE TABLE specialist_categories (
  slug       text PRIMARY KEY CHECK (slug ~ '^[a-z_]{1,40}$'),
  name       jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO specialist_categories (slug, name, sort_order) VALUES
  ('speech_therapist',    '{"ru":"Логопеды","uz":"Logopedlar","en":"Speech therapists"}', 10),
  ('defectologist',       '{"ru":"Дефектологи","uz":"Defektologlar","en":"Defectologists"}', 20),
  ('psychologist',        '{"ru":"Психологи","uz":"Psixologlar","en":"Psychologists"}', 30),
  ('special_educator',    '{"ru":"Специальные педагоги","uz":"Maxsus pedagoglar","en":"Special educators"}', 40),
  ('tutor',               '{"ru":"Тьюторы","uz":"Tyutorlar","en":"Tutors"}', 50),
  ('sensory_integration', '{"ru":"Сенсорная интеграция","uz":"Sensor integratsiya","en":"Sensory integration"}', 60),
  ('physio_therapy',      '{"ru":"Специалисты ЛФК","uz":"Davolovchi jismoniy tarbiya mutaxassislari","en":"Physical therapy (LFK)"}', 70),
  ('rehabilitation',      '{"ru":"Реабилитологи","uz":"Reabilitologlar","en":"Rehabilitation specialists"}', 80),
  ('aba',                 '{"ru":"ABA-специалисты","uz":"ABA mutaxassislari","en":"ABA specialists"}', 90),
  ('other',               '{"ru":"Другие специалисты","uz":"Boshqa mutaxassislar","en":"Other specialists"}', 100);

CREATE TABLE specialist_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid UNIQUE REFERENCES users (id) ON DELETE SET NULL,
  display_name        text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  category            text NOT NULL REFERENCES specialist_categories (slug),
  headline            text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 200),
  city                text NOT NULL CHECK (city ~ '^[a-z_]{1,30}$'),
  formats             text[] NOT NULL DEFAULT '{}' CHECK (formats <@ ARRAY['online', 'offline']),
  -- Prices in UZS (first market: Uzbekistan). price_to = price_from for a single fixed price.
  price_from          integer NOT NULL CHECK (price_from >= 0),
  price_to            integer NOT NULL CHECK (price_to >= price_from),
  experience_years    smallint NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 70),
  -- Children's age range (years) the specialist works with.
  age_min             smallint NOT NULL DEFAULT 0 CHECK (age_min BETWEEN 0 AND 18),
  age_max             smallint NOT NULL DEFAULT 18 CHECK (age_max BETWEEN 0 AND 18),
  rating_avg          numeric(2, 1) NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
  reviews_count       integer NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
  popularity          integer NOT NULL DEFAULT 0 CHECK (popularity >= 0),
  verification_status verification_status NOT NULL DEFAULT 'draft',
  is_published        boolean NOT NULL DEFAULT false,
  -- Synthetic development data; shown with a visible badge and never created by migrations.
  is_demo             boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (age_max >= age_min),
  -- Only profiles that reached moderation can be public; blocked/rejected/draft never are.
  CHECK (NOT is_published OR verification_status IN ('awaiting_moderation', 'confirmed'))
);

CREATE INDEX specialist_profiles_listing_idx
  ON specialist_profiles (category, city, rating_avg DESC) WHERE is_published;
CREATE INDEX specialist_profiles_popularity_idx
  ON specialist_profiles (popularity DESC, id) WHERE is_published;
