-- Migration: Create time_off_requests table
-- Run this SQL in your Neon database console or via psql

-- Create enum types for request status and leave type
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE leave_type AS ENUM ('vacation', 'sick', 'personal', 'other');

-- Main time-off requests table
CREATE TABLE time_off_requests (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Requester information
  requester_email VARCHAR(255) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  requester_id VARCHAR(255), -- Microsoft 365 user ID

  -- Supervisor information (looked up from Graph API manager field)
  supervisor_email VARCHAR(255) NOT NULL,
  supervisor_name VARCHAR(255),
  supervisor_id VARCHAR(255), -- Microsoft 365 user ID

  -- Request details
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type leave_type DEFAULT 'vacation',
  reason TEXT,

  -- Status tracking
  status request_status DEFAULT 'pending',
  status_changed_at TIMESTAMP WITH TIME ZONE,
  status_changed_by VARCHAR(255),
  rejection_reason TEXT,

  -- Calendar event created on approval
  calendar_event_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Indexes for common query patterns
CREATE INDEX idx_requests_requester ON time_off_requests(requester_email);
CREATE INDEX idx_requests_supervisor ON time_off_requests(supervisor_email);
CREATE INDEX idx_requests_status ON time_off_requests(status);
CREATE INDEX idx_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX idx_requests_created ON time_off_requests(created_at DESC);

-- Add a comment describing the table
COMMENT ON TABLE time_off_requests IS 'Stores employee time-off requests with approval workflow';
