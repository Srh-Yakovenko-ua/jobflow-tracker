#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname template1 \
  --set app_password="$POSTGRES_APP_PASSWORD" \
  --set analytics_password="$POSTGRES_ANALYTICS_PASSWORD" <<'SQL'
CREATE ROLE jobflow_app LOGIN CREATEDB PASSWORD :'app_password';
CREATE ROLE jobflow_analytics LOGIN PASSWORD :'analytics_password';
GRANT USAGE ON SCHEMA public TO jobflow_analytics;
ALTER DEFAULT PRIVILEGES FOR ROLE jobflow_app IN SCHEMA public GRANT SELECT ON TABLES TO jobflow_analytics;
CREATE DATABASE jobflow OWNER jobflow_app;
CREATE DATABASE jobflow_test OWNER jobflow_app;
SQL
