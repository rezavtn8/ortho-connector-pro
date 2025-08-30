-- Make clinic_id nullable in all tables to support single-user mode
-- This aligns the database schema with the reverted single-user codebase

ALTER TABLE patient_sources ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE monthly_patients ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE source_tags ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE patient_changes_log ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE marketing_visits ALTER COLUMN clinic_id DROP NOT NULL;