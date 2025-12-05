import React from 'react';
import './Header.css';

/**
 * Company Header Component
 * Displays the app title and logout button for company portal
 */
function CompanyHeader() {
  /**
   * Handle logout - clear both companyId and zzpId from localStorage and redirect to home
   */
  function handleLogout() {
    localStorage.removeItem('companyId');
    localStorage.removeItem('zzpId');
    window.location.href = '/';
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

export default CompanyHeader;
