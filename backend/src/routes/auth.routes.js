import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/client.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/jwt.js';
import { sendError } from '../utils/error.js';

const router = Router();
const ROLE_MAP = {
  zzp: 'zzp_user',
  company: 'company_admin',
  company_admin: 'company_admin',
  company_staff: 'company_staff'
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, userType, companyId: bodyCompanyId } = req.body;
    const normalizedType = userType || 'zzp_user';
    const role = ROLE_MAP[normalizedType] || (normalizedType === 'zzp_user' ? 'zzp_user' : null);

    // Validate required fields
    if (!email || !password) {
      return sendError(res, 400, 'E-mail en wachtwoord zijn verplicht');
    }

    if (!role) {
      return sendError(res, 400, 'Ongeldig gebruikerstype');
    }

    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return sendError(res, 400, 'E-mailadres is al in gebruik');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, full_name, user_type, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, user_type, role, company_id, created_at`,
      [email.toLowerCase(), passwordHash, fullName || null, role, role]
    );

    const user = userResult.rows[0];

    // Create associated profile based on user type
    let profileId = null;
    let companyId = bodyCompanyId || null;
    if (role === 'zzp_user') {
      if (!companyId) {
        const companyResult = await query(
          `INSERT INTO companies (user_id, name, email)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [user.id, `${fullName || 'Nieuw Bedrijf'}`, email.toLowerCase()]
        );
        companyId = companyResult.rows[0].id;
      } else {
        const companyCheck = await query('SELECT id FROM companies WHERE id = $1', [companyId]);
        if (companyCheck.rows.length === 0) {
          return sendError(res, 400, 'Bedrijf bestaat niet');
        }
      }
      const zzpResult = await query(
        `INSERT INTO zzp_users (user_id, company_id, full_name, email)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [user.id, companyId, fullName || null, email.toLowerCase()]
      );
      profileId = zzpResult.rows[0].id;
    } else if (role === 'company_admin') {
      const companyResult = await query(
        `INSERT INTO companies (user_id, name, email)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [user.id, fullName || 'Nieuw Bedrijf', email.toLowerCase()]
      );
      profileId = companyResult.rows[0].id;
      companyId = companyResult.rows[0].id;
    } else if (role === 'company_staff') {
      if (!companyId) {
        return sendError(res, 400, 'Bedrijf-ID is verplicht voor medewerkers');
      }
      const companyCheck = await query('SELECT id FROM companies WHERE id = $1', [companyId]);
      if (companyCheck.rows.length === 0) {
        return sendError(res, 400, 'Bedrijf bestaat niet');
      }
      profileId = companyId;
    }

    if (companyId) {
      await query('UPDATE users SET company_id = $1 WHERE id = $2', [companyId, user.id]);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: role,
        profileId: profileId,
        companyId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: role,
        companyId,
        profileId: profileId
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    sendError(res, 500, 'Registratie mislukt');
  }
});

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return sendError(res, 400, 'E-mail en wachtwoord zijn verplicht');
    }

    // Find user by email
    const userResult = await query(
      'SELECT id, email, password_hash, full_name, user_type, role, company_id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 401, 'Ongeldige inloggegevens');
    }

    const user = userResult.rows[0];
    const role = user.role || ROLE_MAP[user.user_type] || 'zzp_user';
    let companyId = user.company_id || null;

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return sendError(res, 401, 'Ongeldige inloggegevens');
    }

    // Get profile ID based on user type
    let profileId = null;
    if (role === 'zzp_user') {
      const zzpResult = await query(
        'SELECT id, company_id FROM zzp_users WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      if (zzpResult.rows.length > 0) {
        profileId = zzpResult.rows[0].id;
        companyId = companyId || zzpResult.rows[0].company_id;
      }
    } else {
      const companyResult = await query(
        'SELECT id FROM companies WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      if (companyResult.rows.length > 0) {
        profileId = companyResult.rows[0].id;
        companyId = companyId || companyResult.rows[0].id;
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role,
        companyId,
        profileId: profileId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role,
        companyId,
        profileId: profileId
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    sendError(res, 500, 'Inloggen mislukt');
  }
});

/**
 * GET /api/auth/me
 * Get current user info from JWT token
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Geen authenticatie token');
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user details
      const userResult = await query(
        'SELECT id, email, full_name, user_type, role, company_id FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return sendError(res, 401, 'Gebruiker niet gevonden');
      }

      const user = userResult.rows[0];

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role || decoded.role,
        companyId: user.company_id || decoded.companyId,
        profileId: decoded.profileId
      });
    } catch (jwtError) {
      return sendError(res, 401, 'Ongeldig token');
    }
  } catch (error) {
    console.error('Error getting user info:', error);
    sendError(res, 500, 'Kon gebruiker niet ophalen');
  }
});

export default router;
