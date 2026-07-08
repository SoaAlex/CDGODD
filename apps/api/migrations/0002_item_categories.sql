-- Migration number: 0002    item_categories
-- Items can now belong to several categories: move the single
-- items.category_id FK into an item_categories join table.

CREATE TABLE item_categories (
  item_id     INTEGER NOT NULL REFERENCES items(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  PRIMARY KEY (item_id, category_id)
);
CREATE INDEX idx_item_categories_category ON item_categories(category_id);

INSERT INTO item_categories (item_id, category_id)
  SELECT id, category_id FROM items WHERE category_id IS NOT NULL;

ALTER TABLE items DROP COLUMN category_id;
