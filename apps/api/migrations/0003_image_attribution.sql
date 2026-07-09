-- Image attribution: where an item's image came from and the credit that
-- must be displayed (CC BY / CC BY-SA require author + license + link).
-- All NULL = manual upload / legacy image, no credit needed.
ALTER TABLE items ADD COLUMN image_source TEXT;      -- 'wikimedia' | 'pixabay' | 'ai'
ALTER TABLE items ADD COLUMN image_author TEXT;      -- plain text, HTML stripped
ALTER TABLE items ADD COLUMN image_license TEXT;     -- 'CC BY-SA 4.0' | 'CC0' | 'Public domain' | 'Pixabay' | 'ai-generated'
ALTER TABLE items ADD COLUMN image_source_url TEXT;  -- Commons file page / Pixabay page URL
