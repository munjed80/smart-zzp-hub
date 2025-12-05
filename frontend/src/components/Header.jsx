import React from 'react';
import './Header.css';

/**
 * Header Component
 * Displays the app title and logout button
 */
function Header() {
  /**
   * Handle logout - clear localStorage and redirect to login
   */
  function handleLogout() {
    localStorage.removeItem('zzpId');
    window.location.href = '/login';
  }

  return (
    <header className="header">
      <div className="header-container">
        <h1 className="header-title">Smart ZZP Hub</h1>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Uitloggen
        </button>
      </div>
    </header>
  );
}

export default Header;
