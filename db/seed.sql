-- Smart ZZP Hub - Development Seed Data
-- This file contains test data for development environments only
-- DO NOT apply this in production

-- Test user (password: 'test123' - bcrypt hashed)
INSERT INTO users (id, email, password_hash, full_name, user_type, role)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'test@example.com',
    '$2b$10$VsgEgXIUpdPnL71nINi3Q.YvDImHJyoE02d/rJJJNuROPsQa3AZAq',
    'Test User',
    'zzp_user',
    'zzp_user'
) ON CONFLICT (email) DO NOTHING;

-- Test company user (password: 'company123' - bcrypt hashed)
INSERT INTO users (id, email, password_hash, full_name, user_type, role)
VALUES (
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    'company@example.com',
    '$2b$10$VsgEgXIUpdPnL71nINi3Q.YvDImHJyoE02d/rJJJNuROPsQa3AZAq',
    'Company Admin',
    'company_admin',
    'company_admin'
) ON CONFLICT (email) DO NOTHING;

-- Test company
INSERT INTO companies (id, user_id, name, kvk_number, btw_number, email)
VALUES (
    'c1d2e3f4-a5b6-7890-cdef-123456789abc',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Test Company BV',
    '12345678',
    'NL123456789B01',
    'info@testcompany.nl'
) ON CONFLICT (id) DO NOTHING;

-- Company for company user
INSERT INTO companies (id, user_id, name, kvk_number, btw_number, email)
VALUES (
    'd2e3f4a5-b6c7-8901-def0-234567890123',
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    'Company User BV',
    '87654321',
    'NL987654321B01',
    'company@example.com'
) ON CONFLICT (id) DO NOTHING;

-- Link users to companies for tenant scoping
UPDATE users SET company_id = 'c1d2e3f4-a5b6-7890-cdef-123456789abc' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
UPDATE users SET company_id = 'd2e3f4a5-b6c7-8901-def0-234567890123' WHERE id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';

-- Test ZZP user linked to the test company
INSERT INTO zzp_users (id, user_id, company_id, full_name, email)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'd2e3f4a5-b6c7-8901-def0-234567890123',
    'Test ZZP User',
    'test@example.com'
) ON CONFLICT (id) DO NOTHING;

-- Sample worklogs for testing
INSERT INTO worklogs (company_id, zzp_id, work_date, tariff_type, quantity, unit_price, notes)
VALUES 
    ('d2e3f4a5-b6c7-8901-def0-234567890123', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '7 days', 'hour', 8, 75.00, 'Development work'),
    ('d2e3f4a5-b6c7-8901-def0-234567890123', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '6 days', 'hour', 6, 75.00, 'Code review'),
    ('d2e3f4a5-b6c7-8901-def0-234567890123', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '5 days', 'hour', 8, 75.00, 'Feature implementation'),
    ('d2e3f4a5-b6c7-8901-def0-234567890123', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '4 days', 'hour', 4, 75.00, 'Bug fixes'),
    ('d2e3f4a5-b6c7-8901-def0-234567890123', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '3 days', 'hour', 8, 75.00, 'Testing');

-- Sample expenses for testing
INSERT INTO expenses (zzp_id, expense_date, category, amount, notes)
VALUES 
    ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '10 days', 'Kantoorbenodigdheden', 150.00, 'Office supplies'),
    ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '8 days', 'Software', 49.99, 'Software subscription'),
    ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '5 days', 'Reiskosten', 75.50, 'Travel to client'),
    ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '2 days', 'Telefoon', 25.00, 'Phone costs');
