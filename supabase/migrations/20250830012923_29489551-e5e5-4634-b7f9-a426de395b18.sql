-- Phase 1: Add Manager role to existing enum (must be in separate transaction)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Manager';