UPDATE "franchises"
SET
  "name" = 'Roses',
  "primary_color" = '#B22247',
  "secondary_color" = '#FFFFFF',
  "accent_color" = '#1F4D2B',
  "updated_at" = now()
WHERE "abbreviation" = 'PDX';
