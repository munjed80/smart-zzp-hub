#!/bin/bash

# Smart ZZP Hub - Database Setup Script
# This script initializes the PostgreSQL database

set -e

echo "=========================================="
echo "Smart ZZP Hub - Database Setup"
echo "=========================================="
echo ""

# Load environment variables
if [ -f "../backend/.env" ]; then
    export $(cat ../backend/.env | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set in .env file"
    echo "Please create a .env file with DATABASE_URL"
    exit 1
fi

echo "Database URL configured"
echo ""

# Extract database connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_URL=$DATABASE_URL

echo "Checking PostgreSQL connection..."
if psql "$DB_URL" -c '\q' 2>/dev/null; then
    echo "✓ Database connection successful"
else
    echo "✗ Database connection failed"
    echo "Please ensure:"
    echo "  1. PostgreSQL is running"
    echo "  2. Database user has proper permissions"
    echo "  3. DATABASE_URL format is correct"
    exit 1
fi

echo ""
echo "Running schema migration..."
psql "$DB_URL" -f ../db/schema.sql

echo ""
echo "✓ Schema created successfully"

# Check if seed data should be loaded
if [ "$1" == "--seed" ]; then
    echo ""
    echo "Loading seed data..."
    if [ -f "../db/seed.sql" ]; then
        psql "$DB_URL" -f ../db/seed.sql
        echo "✓ Seed data loaded successfully"
    else
        echo "⚠ No seed.sql file found, skipping seed data"
    fi
fi

echo ""
echo "=========================================="
echo "Database setup completed successfully!"
echo "=========================================="
