/**
 * Shared utility functions for formatting
 * Used across multiple components for consistency
 */

/**
 * Format currency amount in Dutch format
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted amount (e.g., € 1.234,56)
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

/**
 * Format date in Dutch format
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date (DD-MM-YYYY)
 */
export function formatDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(date));
}

/**
 * Get current quarter (1-4)
 * @returns {number} - Current quarter
 */
export function getCurrentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}
