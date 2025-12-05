import React from 'react';
import { useRouter } from 'next/router';
import './statements/styles.css';
import './login/login.css';

/**
 * Home Page Component
 * Entry page with navigation to ZZP portal and Company portal
 */
function HomePage() {
  const router = useRouter();

  /**
   * Navigate to the ZZP login page
   */
  function handleZzpLogin() {
    router.push('/login');
  }

  /**
   * Navigate to the company portal (worklogs)
   */
  function handleCompanyPortal() {
    router.push('/company/worklogs');
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1 className="login-title">Smart ZZP Hub</h1>
          <p className="login-subtitle">
            Welkom bij Smart ZZP Hub. Kies hieronder uw portaal om verder te gaan.
          </p>

          <div className="home-buttons">
            <button
              type="button"
              className="btn btn-primary home-button"
              onClick={handleZzpLogin}
            >
              ZZP inloggen
            </button>

            <button
              type="button"
              className="btn btn-secondary home-button"
              onClick={handleCompanyPortal}
            >
              Bedrijf omgeving
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
