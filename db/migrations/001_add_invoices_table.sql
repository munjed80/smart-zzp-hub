-- Add invoices table for official invoice numbering
-- Migration: Add invoices table

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID UNIQUE NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_statement_id ON invoices(statement_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
