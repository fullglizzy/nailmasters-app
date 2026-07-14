-- Add full-text search support for nail_designs
-- Run this if the column doesn't already exist

-- Add search_vector column
ALTER TABLE nail_designs ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search_vector
CREATE OR REPLACE FUNCTION update_nail_designs_search_vector()
RETURNS trigger AS $$
DECLARE
  tags_text text;
  techniques_text text;
  mood_tags_text text;
  materials_text text;
  decor_tags_text text;
  trend_tags_text text;
  occasion_tags_text text;
BEGIN
  -- Extract text from JSONB arrays
  SELECT COALESCE(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(NEW.tags)
  INTO tags_text;
  SELECT COALESCE(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(NEW.techniques)
  INTO techniques_text;
  SELECT COALESCE(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(NEW.mood_tags)
  INTO mood_tags_text;
  SELECT COALESCE(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(NEW.materials)
  INTO materials_text;
  SELECT COALESCE(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(NEW.decor_tags)
  INTO decor_tags_text;
  SELECT COALESCE(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(NEW.trend_tags)
  INTO trend_tags_text;
  SELECT COALESCE(string_agg(value, ' '), '')
  FROM jsonb_array_elements_text(NEW.occasion_tags)
  INTO occasion_tags_text;

  NEW.search_vector :=
    setweight(to_tsvector('russian', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(NEW.color, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(tags_text, '')), 'C') ||
    setweight(to_tsvector('russian', coalesce(techniques_text, '')), 'C') ||
    setweight(to_tsvector('russian', coalesce(mood_tags_text, '')), 'D') ||
    setweight(to_tsvector('russian', coalesce(materials_text, '')), 'D') ||
    setweight(to_tsvector('russian', coalesce(decor_tags_text, '')), 'D') ||
    setweight(to_tsvector('russian', coalesce(trend_tags_text, '')), 'D') ||
    setweight(to_tsvector('russian', coalesce(occasion_tags_text, '')), 'D');
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
  setweight(to_tsvector('russian', coalesce(color, '')), 'B') ||
  setweight(to_tsvector('russian', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(tags)), '')), 'C') ||
  setweight(to_tsvector('russian', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(techniques)), '')), 'C') ||
  setweight(to_tsvector('russian', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(mood_tags)), '')), 'D') ||
  setweight(to_tsvector('russian', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(materials)), '')), 'D') ||
  setweight(to_tsvector('russian', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(decor_tags)), '')), 'D') ||
  setweight(to_tsvector('russian', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(trend_tags)), '')), 'D') ||
  setweight(to_tsvector('russian', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(occasion_tags)), '')), 'D');

-- Create GIN index
CREATE INDEX IF NOT EXISTS idx_nail_designs_search ON nail_designs USING GIN(search_vector);
