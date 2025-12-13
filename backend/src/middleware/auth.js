import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';
import { sendError } from '../utils/error.js';

/**
 * Authenticate incoming request using Bearer JWT token
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Geen toegang, eerst inloggen');
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, 401, 'Ongeldig of verlopen token');
  }
}

/**
 * Authorize request by allowed roles
 * @param {string[]} roles
 */
export function requireRoles(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Geen toegang, eerst inloggen');
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 'Geen rechten voor deze actie');
    }
    next();
  };
}

/**
 * Ensure requester only accesses own company data
 */
export function assertCompanyScope(req, res, companyId) {
  if (!companyId) {
    sendError(res, 400, 'Bedrijf-ID is verplicht');
    return false;
  }
  if (req.user.role === 'company_admin' || req.user.role === 'company_staff') {
    if (req.user.companyId !== companyId) {
      sendError(res, 403, 'Geen toegang tot dit bedrijf');
      return false;
    }
  }
  if (req.user.role === 'zzp_user' && req.user.companyId && req.user.companyId !== companyId) {
    sendError(res, 403, 'Geen toegang tot dit bedrijf');
    return false;
  }
  return true;
}

/**
 * Ensure requester only accesses own ZZP data
 */
export function assertZzpScope(req, res, zzpId) {
  if (!zzpId) {
    sendError(res, 400, 'ZZP-ID is verplicht');
    return false;
  }
  if (req.user.role === 'zzp_user' && req.user.profileId !== zzpId) {
    sendError(res, 403, 'Geen toegang tot deze ZZP gegevens');
    return false;
  }
  return true;
}
