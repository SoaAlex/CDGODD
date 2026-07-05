-- Dev seed: a few French items, pre-approved, no images yet.
INSERT INTO categories (key) VALUES ('food'), ('culture'), ('daily-life');

INSERT INTO category_translations (category_id, lang, name) VALUES
  (1, 'fr', 'Nourriture'),
  (2, 'fr', 'Culture'),
  (3, 'fr', 'Vie quotidienne');

INSERT INTO items (category_id, status, created_at) VALUES
  (1, 'approved', unixepoch('now') * 1000),
  (1, 'approved', unixepoch('now') * 1000),
  (2, 'approved', unixepoch('now') * 1000),
  (2, 'approved', unixepoch('now') * 1000),
  (3, 'approved', unixepoch('now') * 1000),
  (3, 'approved', unixepoch('now') * 1000);

INSERT INTO item_translations (item_id, lang, label) VALUES
  (1, 'fr', 'Le quinoa'),
  (2, 'fr', 'La côte de bœuf'),
  (3, 'fr', 'Le théâtre subventionné'),
  (4, 'fr', 'La chasse'),
  (5, 'fr', 'Le vélo cargo'),
  (6, 'fr', 'La résidence secondaire');
