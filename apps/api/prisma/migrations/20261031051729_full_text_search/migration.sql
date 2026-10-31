CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TEXT SEARCH CONFIGURATION jobflow_search (COPY = simple);

ALTER TEXT SEARCH CONFIGURATION jobflow_search
    ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;

CREATE OR REPLACE FUNCTION applications_search_vector() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('jobflow_search', coalesce(NEW.company, '')), 'A') ||
        setweight(to_tsvector('jobflow_search', coalesce(NEW.position, '')), 'A') ||
        setweight(to_tsvector('jobflow_search', coalesce(array_to_string(NEW.stack, ' '), '')), 'B') ||
        setweight(to_tsvector('jobflow_search', coalesce(NEW.raw_text, '')), 'C');
    RETURN NEW;
END;
$$;

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "search_vector" tsvector;

-- CreateIndex
CREATE INDEX "notes_search_vector_idx" ON "notes" USING GIN ("search_vector");

CREATE FUNCTION notes_search_vector() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector := to_tsvector('jobflow_search', NEW.body);
    RETURN NEW;
END;
$$;

CREATE TRIGGER notes_search_vector_fill
    BEFORE INSERT OR UPDATE OF "body" ON "notes"
    FOR EACH ROW EXECUTE FUNCTION notes_search_vector();

CREATE FUNCTION jobflow_search_query(q text) RETURNS tsquery
LANGUAGE sql STABLE STRICT AS $$
    SELECT CASE
        WHEN numnode(w) = 0 THEN w
        ELSE to_tsquery('jobflow_search', replace(w::text || ' ', ''' ', ''':* '))
    END
    FROM websearch_to_tsquery('jobflow_search', q) AS w
$$;

UPDATE "applications" SET "company" = "company";

UPDATE "notes" SET "body" = "body";
