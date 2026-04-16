INSERT INTO "franchises" ("name", "city_id", "abbreviation", "primary_color", "secondary_color", "accent_color", "conference", "division")
VALUES
  ('Aces',        (SELECT c.id FROM cities c JOIN states s ON c.state_id = s.id WHERE c.name = 'Reno'          AND s.code = 'NV'), 'RNO', '#000000', '#C0C0C0', '#CC0000', 'Mountain', 'Mountain'),
  ('Riveters',    (SELECT c.id FROM cities c JOIN states s ON c.state_id = s.id WHERE c.name = 'Portland'      AND s.code = 'OR'), 'PDX', '#004225', '#FFFFFF', '#A8A9AD', 'Pacific',  'Pacific'),
  ('Republic',    (SELECT c.id FROM cities c JOIN states s ON c.state_id = s.id WHERE c.name = 'Sacramento'    AND s.code = 'CA'), 'SAC', '#8B0000', '#FFD700', '#FFFFFF', 'Pacific',  'Pacific'),
  ('Admirals',    (SELECT c.id FROM cities c JOIN states s ON c.state_id = s.id WHERE c.name = 'San Diego'     AND s.code = 'CA'), 'SDG', '#002244', '#FFFFFF', '#F2A900', 'Pacific',  'Pacific'),
  ('Pioneers',    (SELECT c.id FROM cities c JOIN states s ON c.state_id = s.id WHERE c.name = 'Salt Lake City' AND s.code = 'UT'), 'SLC', '#4B0082', '#FFFFFF', '#A8A9AD', 'Mountain', 'Mountain'),
  ('Spuds',       (SELECT c.id FROM cities c JOIN states s ON c.state_id = s.id WHERE c.name = 'Boise'         AND s.code = 'ID'), 'BOI', '#FF6600', '#003B2F', '#FFFFFF', 'Mountain', 'Mountain'),
  ('Lava',        (SELECT c.id FROM cities c JOIN states s ON c.state_id = s.id WHERE c.name = 'Honolulu'      AND s.code = 'HI'), 'HNL', '#CC0000', '#000000', '#FF8200', 'Pacific',  'Pacific'),
  ('Roadrunners', (SELECT c.id FROM cities c JOIN states s ON c.state_id = s.id WHERE c.name = 'Albuquerque'   AND s.code = 'NM'), 'ABQ', '#00778B', '#FFD700', '#FFFFFF', 'Mountain', 'Mountain')
ON CONFLICT ("abbreviation") DO UPDATE SET
  "primary_color"   = EXCLUDED."primary_color",
  "secondary_color" = EXCLUDED."secondary_color",
  "accent_color"    = EXCLUDED."accent_color",
  "conference"      = EXCLUDED."conference",
  "division"        = EXCLUDED."division",
  "city_id"         = EXCLUDED."city_id",
  "updated_at"      = now();
