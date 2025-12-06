import { API_BASE_URL } from '../config/api';

// Storage keys
const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

/**
 * Get stored authentication token
 * @returns {string|null} - JWT token or null
 */
export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get stored user info
 * @returns {Object|null} - User object or null
 */
export function getUser() {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Store authentication data
 * @param {string} token - JWT token
 * @param {Object} user - User object
 */
export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  
  // Also set legacy keys for backward compatibility
  if (user.userType === 'zzp') {
    localStorage.setItem('zzpId', user.profileId);
  } else if (user.userType === 'company') {
    localStorage.setItem('companyId', user.profileId);
  }
}

/**
 * Clear authentication data
 */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('zzpId');
  localStorage.removeItem('companyId');
  localStorage.removeItem('userEmail');
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - User data
 */
export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login mislukt');
  }

  setAuth(data.token, data.user);
  return data.user;
}

/**
 * Register new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} fullName - Full name
 * @param {string} userType - 'zzp' or 'company'
 * @returns {Promise<Object>} - User data
 */
export async function register(email, password, fullName, userType) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, fullName, userType })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Registratie mislukt');
  }

  setAuth(data.token, data.user);
  return data.user;
}

/**
 * Logout user
 */
export function logout() {
  clearAuth();
  window.location.href = '/login';
}

/**
 * Get authorization headers for API calls
 * @returns {Object} - Headers object with Authorization
 */
export function getAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Fetch with authentication
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    ...getAuthHeaders()
  };

  const response = await fetch(url, { ...options, headers });

  // If unauthorized, redirect to login
  if (response.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return response;
}
