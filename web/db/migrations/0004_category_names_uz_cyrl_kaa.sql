-- Category names for the Uzbek Cyrillic and Karakalpak (Latin) interface languages. DRAFT translations.
UPDATE specialist_categories sc SET name = sc.name || v.names
FROM (VALUES
  ('speech_therapist',    '{"uz-cyrl":"Логопедлар","kaa":"Logopedler"}'::jsonb),
  ('defectologist',       '{"uz-cyrl":"Дефектологлар","kaa":"Defektologlar"}'::jsonb),
  ('psychologist',        '{"uz-cyrl":"Психологлар","kaa":"Psixologlar"}'::jsonb),
  ('special_educator',    '{"uz-cyrl":"Махсус педагоглар","kaa":"Arnawlı pedagoglar"}'::jsonb),
  ('tutor',               '{"uz-cyrl":"Тюторлар","kaa":"Tyutorlar"}'::jsonb),
  ('sensory_integration', '{"uz-cyrl":"Сенсор интеграция","kaa":"Sensor integraciya"}'::jsonb),
  ('physio_therapy',      '{"uz-cyrl":"Даволовчи жисмоний тарбия мутахассислари","kaa":"Dene tárbiyası (LFK) mutaxassisleri"}'::jsonb),
  ('rehabilitation',      '{"uz-cyrl":"Реабилитологлар","kaa":"Reabilitologlar"}'::jsonb),
  ('aba',                 '{"uz-cyrl":"ABA мутахассислари","kaa":"ABA mutaxassisleri"}'::jsonb),
  ('other',               '{"uz-cyrl":"Бошқа мутахассислар","kaa":"Basqa mutaxassisler"}'::jsonb)
) AS v(slug, names)
WHERE sc.slug = v.slug;
