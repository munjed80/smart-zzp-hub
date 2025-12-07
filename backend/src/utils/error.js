/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message (should be in Dutch for user-facing errors)
 */
export function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}
