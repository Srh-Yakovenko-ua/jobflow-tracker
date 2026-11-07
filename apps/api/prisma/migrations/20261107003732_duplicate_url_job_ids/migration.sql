CREATE OR REPLACE FUNCTION jobflow_url_key(url text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT CASE WHEN key ~ '[/?#]' THEN key END
    FROM (
        SELECT rtrim(substring(bare FROM '^[^?#]*'), '/')
            || coalesce('?' || (
                SELECT string_agg(m[1] || '=' || m[2], '&' ORDER BY m[1])
                FROM regexp_matches(
                    coalesce(substring(bare FROM '^[^?#]*\?([^#]*)'), ''),
                    '(?:^|&)(currentjobid|jk|vjk)=([^&]+)', 'g'
                ) AS m
            ), '')
            || coalesce('#' || nullif(rtrim(substring(bare FROM '#(/[^?]*)'), '/'), ''), '') AS key
        FROM (
            SELECT regexp_replace(regexp_replace(lower(url), '^https?://', ''), '^www\.', '') AS bare
        ) AS stripped
    ) AS keyed
$$;
