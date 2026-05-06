-- PrimaWell Lead Intelligence System — Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database.

-- Enable UUID extension (already enabled on Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- LEADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name         TEXT NOT NULL,
  industry             TEXT,
  email                TEXT,
  phone                TEXT,
  website              TEXT,
  facebook             TEXT,
  address              TEXT,
  qualification        TEXT NOT NULL CHECK (qualification IN ('HIGH', 'MEDIUM', 'LOW')),
  qualification_reason TEXT NOT NULL DEFAULT '',
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'New'
                         CHECK (status IN ('New', 'Reviewed', 'Ready for Outreach')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_leads_qualification ON leads(qualification);
CREATE INDEX IF NOT EXISTS idx_leads_status        ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_industry      ON leads(industry);
CREATE INDEX IF NOT EXISTS idx_leads_created_at    ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_company_name  ON leads USING gin(to_tsvector('english', company_name));

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- Internal tool — disable RLS for simplicity.
-- Enable and configure if you add authentication later.
-- =====================================================
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- OPTIONAL: Sample data for testing
-- =====================================================
INSERT INTO leads (company_name, industry, email, phone, website, address, qualification, qualification_reason, status)
VALUES
  ('Cebu Solutions Corp',    'BPO / Call Center', 'info@cebusolutions.com.ph', '+63 32 234 5678', 'https://www.cebusolutions.com.ph', 'IT Park, Lahug, Cebu City', 'HIGH',   'Has website, email, and phone',           'New'),
  ('Pacific Outsourcing Inc','BPO / Call Center', 'contact@pacificoutsourcing.ph', NULL, 'https://www.pacificoutsourcing.ph', 'AS Fortuna St, Mandaue City', 'MEDIUM', 'Missing phone; has website and email',    'New'),
  ('Island Manufacturing',   'Manufacturing',     NULL, '+63 32 345 6789', NULL, 'M.C. Briones St, Mandaue City', 'LOW', 'Missing website and email; Has phone',    'New'),
  ('Metro Logistics Group',  'Logistics',         'ops@metrologistics.ph', '+63 32 456 7890', 'https://www.metrologistics.ph', 'A.C. Cortes Ave, Mandaue City', 'HIGH', 'Has website, email, and phone', 'Reviewed'),
  ('Horizon Retail Corp',    'Retail / Trade',    'sales@horizonretail.com', NULL, NULL, 'Banilad, Cebu City', 'LOW', 'Missing phone and website; Has email', 'New');
