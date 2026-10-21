-- Grant
GRANT USAGE ON SCHEMA public TO jobflow_analytics;

ALTER DEFAULT PRIVILEGES FOR ROLE jobflow_app IN SCHEMA public GRANT SELECT ON TABLES TO jobflow_analytics;

GRANT SELECT ON "user_settings", "searches", "applications", "stage_events", "timeline_events", "rejection_reasons", "scheduled_events", "resumes", "reminders", "plans", "plan_items" TO jobflow_analytics;
