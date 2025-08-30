-- Phase 1: Add Manager role to existing enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Manager';