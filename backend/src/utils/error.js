/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (100-599, covering 1xx-5xx ranges)
 * @param {string} message - Error message (should be in Dutch for user-facing errors)
 */
export function sendError(res, statusCode, message) {
  // Validate inputs (these errors indicate programming mistakes, not runtime issues)
  if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
    throw new Error('Invalid response object');
  }
  
  if (typeof statusCode !== 'number' || statusCode < 100 || statusCode > 599) {
    throw new Error('Invalid status code: must be between 100 and 599');
  }
  
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Invalid message: must be a non-empty string');
  }
  
  return res.status(statusCode).json({ error: message });
}
