-- Add full-text search support for nail_designs
-- Run this if the column doesn't already exist

-- Add search_vector column
ALTER TABLE nail_designs ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search_vector
CREATE OR REPLACE FUNCTION update_nail_designs_search_vector()
RETURNS trigger AS $$
DECLARE
  tags_text text;
BEGIN
  -- Extract text from JSONB array: ["tag1","tag2"] -> "tag1 tag2"
  SELECT COALESCE(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(NEW.tags)
  INTO tags_text;

  NEW.search_vector :=
    setweight(to_tsvector('russian', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(tags_text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_nail_designs_search_vector ON nail_designs;
CREATE TRIGGER trg_nail_designs_search_vector
  BEFORE INSERT OR UPDATE ON nail_designs
  FOR EACH ROW EXECUTE FUNCTION update_nail_designs_search_vector();

-- Update existing rows
UPDATE nail_designs SET search_vector =
  setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('russian', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('russian', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(tags)), '')), 'C');

-- Create GIN index
CREATE INDEX IF NOT EXISTS idx_nail_designs_search ON nail_designs USING GIN(search_vector);
