import jwt from 'jsonwebtoken';

// JWT secret - should be in environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || 'smart-zzp-hub-secret-key';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Geen authenticatie token' });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      userType: decoded.userType,
      profileId: decoded.profileId
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Ongeldig of verlopen token' });
  }
}

/**
 * Optional authentication middleware
 * Attaches user info if token present, but doesn't require it
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        userType: decoded.userType,
        profileId: decoded.profileId
      };
    } catch (error) {
      // Token invalid, but that's okay for optional auth
    }
  }
  
  next();
}
