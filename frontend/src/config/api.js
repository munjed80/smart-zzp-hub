/**
 * API configuration
 * Centralized API base URL for consistent API calls across the application
 */

// API base URL - reads from environment variable or falls back to localhost
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
