-- Migration: 001_initial_schema
-- Description: Initial database schema for time-off requests
-- Created: 2025-01-01

-- Create schema version tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main time-off requests table
CREATE TABLE IF NOT EXISTS time_off_requests (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Requester information
  requester_email VARCHAR(255) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  requester_id VARCHAR(255),

  -- Supervisor information
  supervisor_email VARCHAR(255) NOT NULL,
  supervisor_name VARCHAR(255) NOT NULL,
  supervisor_id VARCHAR(255),

  -- Request details
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type VARCHAR(50) DEFAULT 'vacation',
  reason TEXT,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ,
  status_changed_by VARCHAR(255),

  -- Integration
  calendar_event_id VARCHAR(255),

  -- Rejection details
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT valid_leave_type CHECK (leave_type IN ('vacation', 'sick', 'personal', 'other'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_requests_requester ON time_off_requests(requester_email);
CREATE INDEX IF NOT EXISTS idx_requests_supervisor ON time_off_requests(supervisor_email);
CREATE INDEX IF NOT EXISTS idx_requests_status ON time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_requests_created ON time_off_requests(created_at DESC);

-- Compound index for supervisor pending requests query
CREATE INDEX IF NOT EXISTS idx_requests_supervisor_pending
  ON time_off_requests(supervisor_email, status)
  WHERE status = 'pending';

-- Record migration
INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;

-- Comments
COMMENT ON TABLE time_off_requests IS 'Stores time-off requests submitted through the widget';
COMMENT ON COLUMN time_off_requests.status IS 'Request status: pending, approved, or rejected';
COMMENT ON COLUMN time_off_requests.calendar_event_id IS 'Microsoft Graph calendar event ID (set on approval)';
COMMENT ON COLUMN time_off_requests.requester_id IS 'Microsoft Graph user ID of requester';
COMMENT ON COLUMN time_off_requests.supervisor_id IS 'Microsoft Graph user ID of supervisor';
