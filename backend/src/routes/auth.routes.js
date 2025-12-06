import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/client.js';

const router = Router();

// JWT secret - should be in environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || 'smart-zzp-hub-secret-key';
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, userType } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail en wachtwoord zijn verplicht' });
    }

    if (!['zzp', 'company'].includes(userType)) {
      return res.status(400).json({ error: 'Ongeldig gebruikerstype' });
    }

    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'E-mailadres is al in gebruik' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, full_name, user_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, user_type, created_at`,
      [email.toLowerCase(), passwordHash, fullName || null, userType]
    );

    const user = userResult.rows[0];

    // Create associated profile based on user type
    let profileId = null;
    if (userType === 'zzp') {
      // First create a placeholder company for the ZZP user
      const companyResult = await query(
        `INSERT INTO companies (user_id, name, email)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [user.id, `${fullName || email}'s Company`, email.toLowerCase()]
      );
      
      // Then create ZZP profile
      const zzpResult = await query(
        `INSERT INTO zzp_users (user_id, company_id, full_name, email)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [user.id, companyResult.rows[0].id, fullName || null, email.toLowerCase()]
      );
      profileId = zzpResult.rows[0].id;
    } else {
      // Create company profile
      const companyResult = await query(
        `INSERT INTO companies (user_id, name, email)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [user.id, fullName || 'Nieuw Bedrijf', email.toLowerCase()]
      );
      profileId = companyResult.rows[0].id;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type,
        profileId: profileId
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
        userType: user.user_type,
        profileId: profileId
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Registratie mislukt' });
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
      return res.status(400).json({ error: 'E-mail en wachtwoord zijn verplicht' });
    }

    // Find user by email
    const userResult = await query(
      'SELECT id, email, password_hash, full_name, user_type FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }

    // Get profile ID based on user type
    let profileId = null;
    if (user.user_type === 'zzp') {
      const zzpResult = await query(
        'SELECT id FROM zzp_users WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      if (zzpResult.rows.length > 0) {
        profileId = zzpResult.rows[0].id;
      }
    } else {
      const companyResult = await query(
        'SELECT id FROM companies WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      if (companyResult.rows.length > 0) {
        profileId = companyResult.rows[0].id;
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type,
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
        userType: user.user_type,
        profileId: profileId
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Inloggen mislukt' });
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
      return res.status(401).json({ error: 'Geen authenticatie token' });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user details
      const userResult = await query(
        'SELECT id, email, full_name, user_type FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Gebruiker niet gevonden' });
      }

      const user = userResult.rows[0];

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        userType: user.user_type,
        profileId: decoded.profileId
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Ongeldig token' });
    }
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Kon gebruiker niet ophalen' });
  }
});

export default router;
