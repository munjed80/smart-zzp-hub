import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'smart-zzp-hub-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Ensure JWT_SECRET is set in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable must be set in production');
  process.exit(1);
}
