-- Smart ZZP Hub - PostgreSQL Database Schema
-- This schema defines the core tables for the MVP

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
-- Stores user authentication and profile information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    user_type TEXT NOT NULL CHECK (user_type IN ('zzp', 'company')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Companies table
-- Stores information about companies that work with ZZP freelancers
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kvk_number TEXT,
    btw_number TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ZZP Users table
-- Stores information about ZZP freelancers linked to companies
CREATE TABLE zzp_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    external_ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Worklogs table
-- Stores individual work entries logged by companies for ZZP users
CREATE TABLE worklogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    zzp_id UUID NOT NULL REFERENCES zzp_users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    tariff_type TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'EUR',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Statements table
-- Stores weekly aggregated statements for ZZP users
CREATE TABLE statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    zzp_id UUID NOT NULL REFERENCES zzp_users(id) ON DELETE CASCADE,
    year INT NOT NULL,
    week_number INT NOT NULL,
    total_amount NUMERIC,
    currency TEXT DEFAULT 'EUR',
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
-- Stores expenses logged by ZZP users for BTW calculation
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zzp_id UUID NOT NULL REFERENCES zzp_users(id) ON DELETE CASCADE,
    expense_date DATE NOT NULL,
    category TEXT,
    amount NUMERIC(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_zzp_users_user_id ON zzp_users(user_id);
CREATE INDEX idx_worklogs_company_id ON worklogs(company_id);
CREATE INDEX idx_worklogs_zzp_id ON worklogs(zzp_id);
CREATE INDEX idx_worklogs_work_date ON worklogs(work_date);
CREATE INDEX idx_statements_company_id ON statements(company_id);
CREATE INDEX idx_statements_zzp_id ON statements(zzp_id);
CREATE INDEX idx_statements_year_week ON statements(year, week_number);
CREATE INDEX idx_expenses_zzp_id ON expenses(zzp_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
