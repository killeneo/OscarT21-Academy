-- Uzbek (Latin) category names in the diacritic alphabet (Ş Ç Ó Ǵ Ń).
UPDATE specialist_categories sc SET name = jsonb_set(sc.name, '{uz}', to_jsonb(v.uz::text))
FROM (VALUES
  ('speech_therapist', 'Logopedlar'),
  ('defectologist', 'Defektologlar'),
  ('psychologist', 'Psixologlar'),
  ('special_educator', 'Maxsus pedagoglar'),
  ('tutor', 'Tyutorlar'),
  ('sensory_integration', 'Sensor integratsiya'),
  ('physio_therapy', 'Davolovçi jismoniy tarbiya mutaxassislari'),
  ('rehabilitation', 'Reabilitologlar'),
  ('aba', 'ABA mutaxassislari'),
  ('other', 'Boşqa mutaxassislar')
) AS v(slug, uz)
WHERE sc.slug = v.slug;
