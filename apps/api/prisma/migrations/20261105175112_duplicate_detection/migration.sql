CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION jobflow_company_key(name text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT nullif(btrim(regexp_replace(
        regexp_replace(
            regexp_replace(lower(name), '[^[:alnum:]]+', ' ', 'g'),
            '(^| )(тов|тзов|фоп|пп|прат|пат|llc|inc|ltd|corp|gmbh)(?= |$)', ' ', 'g'
        ),
        ' +', ' ', 'g'
    )), '')
$$;

CREATE FUNCTION jobflow_url_key(url text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT nullif(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
        lower(url),
        '^https?://', ''),
        '^www\.', ''),
        '[?#].*', ''),
        '/+$', ''
    ), '')
$$;
