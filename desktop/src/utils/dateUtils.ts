/**
 * Date utility functions to handle timezone-safe date operations
 */

/**
 * Get local date string in YYYY-MM-DD format
 * This avoids timezone issues that occur with toISOString()
 *
 * @param date - Date object (defaults to current date)
 * @returns Date string in YYYY-MM-DD format using local timezone
 *
 * @example
 * // If local time is Oct 26, 2025 at 1:00 AM (UTC+8)
 * getLocalDateString() // Returns "2025-10-26"
 * // vs toISOString().split('T')[0] would return "2025-10-25" (UTC time)
 */
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Convert a date string (YYYY-MM-DD) to a Date object at local midnight
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object set to midnight in local timezone
 */
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};
