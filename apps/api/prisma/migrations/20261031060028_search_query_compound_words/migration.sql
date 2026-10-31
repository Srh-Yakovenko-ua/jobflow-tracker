CREATE OR REPLACE FUNCTION jobflow_search_query(q text) RETURNS tsquery
LANGUAGE sql STABLE STRICT AS $$
    SELECT CASE
        WHEN numnode(w) = 0 THEN w
        ELSE replace(w::text || ' ', ''' ', ''':* ')::tsquery
    END
    FROM websearch_to_tsquery('jobflow_search', q) AS w
$$;
