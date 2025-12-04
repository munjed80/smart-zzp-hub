import React, { useState } from 'react';
import '../statements/styles.css';
import './login.css';

/**
 * Login Page Component
 * Simple Dutch login form for ZZP users
 */
function LoginPage() {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    try {
      setIsSubmitting(true);

      // Mock login: store a mock zzpId in localStorage
      // In production, this would be replaced with actual authentication
      localStorage.setItem('zzpId', 'zzp_123');
      localStorage.setItem('userEmail', email);

      // Redirect to statements page
      window.location.href = '/statements';
    } catch (err) {
      console.error('Login error:', err);
      setError('Inloggen mislukt. Probeer het opnieuw.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1 className="login-title">Smart ZZP Hub</h1>
          <p className="login-subtitle">Inloggen</p>

          {/* Error message */}
          {error && (
            <div className="error-message">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
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
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary login-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Bezig...' : 'Inloggen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
