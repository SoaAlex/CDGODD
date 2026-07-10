-- Category names for en/pt/es/nl/de. These previously lived hardcoded in the
-- game's i18n bundles (packages/shared/src/i18n/*.json); the DB is now the
-- single source of truth for category names and the admin panel edits these
-- rows. OR IGNORE keeps any name an admin already saved for a (category, lang).
WITH new_names(key, lang, name) AS (
  VALUES
    ('food',       'en', 'Food'),
    ('food',       'pt', 'Comida'),
    ('food',       'es', 'Comida'),
    ('food',       'nl', 'Eten'),
    ('food',       'de', 'Essen'),
    ('culture',    'en', 'Culture'),
    ('culture',    'pt', 'Cultura'),
    ('culture',    'es', 'Cultura'),
    ('culture',    'nl', 'Cultuur'),
    ('culture',    'de', 'Kultur'),
    ('daily-life', 'en', 'Daily life'),
    ('daily-life', 'pt', 'Vida quotidiana'),
    ('daily-life', 'es', 'Vida cotidiana'),
    ('daily-life', 'nl', 'Dagelijks leven'),
    ('daily-life', 'de', 'Alltag')
)
INSERT OR IGNORE INTO category_translations (category_id, lang, name)
SELECT c.id, n.lang, n.name
  FROM new_names n
  JOIN categories c ON c.key = n.key;
