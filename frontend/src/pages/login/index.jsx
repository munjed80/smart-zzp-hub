import React, { useState } from 'react';
import { login, register, isAuthenticated, getUser } from '../../services/auth';
import '../statements/styles.css';
import './login.css';

/**
 * Login Page Component
 * Dutch login/register form for ZZP and Company users
 */
function LoginPage() {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userType, setUserType] = useState('zzp');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Check if already logged in
  React.useEffect(() => {
    if (isAuthenticated()) {
      const user = getUser();
      if (user) {
        // Redirect based on user type
        if (user.userType === 'zzp') {
          window.location.href = '/statements';
        } else {
          window.location.href = '/company/worklogs';
        }
      }
    }
  }, []);

  /**
   * Handle form submission
   * @param {Event} e - Form submit event
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!email.trim()) {
      setError('Vul uw e-mailadres in');
      return;
    }

    if (!password.trim()) {
      setError('Vul uw wachtwoord in');
      return;
    }

    if (isRegisterMode && !fullName.trim()) {
      setError('Vul uw naam in');
      return;
    }

    try {
      setIsSubmitting(true);

      let user;
      if (isRegisterMode) {
        user = await register(email, password, fullName, userType);
      } else {
        user = await login(email, password);
      }

      // Redirect based on user type
      if (user.userType === 'zzp') {
        window.location.href = '/statements';
      } else {
        window.location.href = '/company/worklogs';
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Er is een fout opgetreden');
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Toggle between login and register mode
   */
  function toggleMode() {
    setIsRegisterMode(!isRegisterMode);
    setError(null);
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1 className="login-title">Smart ZZP Hub</h1>
          <p className="login-subtitle">
            {isRegisterMode ? 'Registreren' : 'Inloggen'}
          </p>

          {/* Error message */}
          {error && (
            <div className="error-message">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {isRegisterMode && (
              <>
                <div className="form-group">
                  <label htmlFor="fullName" className="form-label">
                    Naam
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Uw volledige naam"
                    disabled={isSubmitting}
                    autoComplete="name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Type account</label>
                  <div className="user-type-selector">
                    <label className="user-type-option">
                      <input
                        type="radio"
                        name="userType"
                        value="zzp"
                        checked={userType === 'zzp'}
                        onChange={(e) => setUserType(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <span>ZZP'er</span>
                    </label>
                    <label className="user-type-option">
                      <input
                        type="radio"
                        name="userType"
                        value="company"
                        checked={userType === 'company'}
                        onChange={(e) => setUserType(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <span>Bedrijf</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                E-mail
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@voorbeeld.nl"
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Wachtwoord
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary login-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Bezig...' : (isRegisterMode ? 'Registreren' : 'Inloggen')}
            </button>
          </form>

          <div className="login-toggle">
            <button
              type="button"
              className="toggle-button"
              onClick={toggleMode}
              disabled={isSubmitting}
            >
              {isRegisterMode 
                ? 'Al een account? Inloggen' 
                : 'Nog geen account? Registreren'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
