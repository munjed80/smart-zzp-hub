/**
 * ISO Week utilities
 * Provides functions for working with ISO week numbers
 */

/**
 * Get ISO week information from a date string
 * @param {string} dateString - ISO date string (e.g., "2024-01-15")
 * @returns {Object} - { year, weekNumber }
 */
export function getISOWeekInfo(dateString) {
  const date = new Date(dateString);
  
  // Get the ISO week number
  // ISO week starts on Monday and the first week contains January 4th
  const dayOfWeek = date.getUTCDay() || 7; // Make Sunday = 7
  
  // Set to nearest Thursday (current date + 4 - day of week)
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  
  // Get first day of the year
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  
  // Calculate week number
  const weekNumber = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  
  // The year is the year of the Thursday
  const year = thursday.getUTCFullYear();
  
  return { year, weekNumber };
}

/**
 * Get the current ISO week info
 * @returns {Object} - { year, weekNumber }
 */
export function getCurrentISOWeekInfo() {
  const now = new Date();
  return getISOWeekInfo(now.toISOString().split('T')[0]);
}

/**
 * Get the start and end dates of an ISO week
 * @param {number} year - ISO year
 * @param {number} weekNumber - ISO week number
 * @returns {Object} - { startDate, endDate } as ISO date strings
 */
export function getWeekDateRange(year, weekNumber) {
  // January 4th is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  
  // Find Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  
  // Calculate the Monday of the requested week
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  
  // Calculate Sunday (end of week)
  const targetSunday = new Date(targetMonday);
  targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);
  
  return {
    startDate: targetMonday.toISOString().split('T')[0],
    endDate: targetSunday.toISOString().split('T')[0]
  };
}
