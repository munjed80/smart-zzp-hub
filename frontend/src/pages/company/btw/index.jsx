import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../../config/api';
import CompanyHeader from '../../../components/CompanyHeader';
import '../../statements/styles.css';
import '../worklogs/worklogs.css';

/**
 * Format currency amount in Dutch format
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted amount
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

/**
 * Company BTW Overview Page Component
 * Displays BTW calculation for a company based on period selection
 */
function CompanyBtwPage() {
  // Form state
  const [periodType, setPeriodType] = useState('quarter');
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodValue, setPeriodValue] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  
  // Result state
  const [btwResult, setBtwResult] = useState(null);

  // Check authentication on mount - redirect to home if no companyId
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCompanyId = localStorage.getItem('companyId');
      
      // If missing, redirect to home page
      if (!storedCompanyId) {
        window.location.href = '/';
        return;
      }
      
      setCompanyId(storedCompanyId);
    }
  }, []);

  /**
   * Handle form submission to calculate BTW
   * @param {Event} e - Form submit event
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBtwResult(null);

    // Basic validation
    if (!year || year < 2000 || year > 2100) {
      setError('Vul een geldig jaar in');
      return;
    }

    if (periodType === 'month' && (!periodValue || periodValue < 1 || periodValue > 12)) {
      setError('Vul een geldig maandnummer in (1-12)');
      return;
    }

    if (periodType === 'quarter' && (!periodValue || periodValue < 1 || periodValue > 4)) {
      setError('Vul een geldig kwartaalnummer in (1-4)');
      return;
    }

    try {
      setIsLoading(true);

      let url = `${API_BASE_URL}/api/btw/overview?companyId=${companyId}&period=${periodType}&year=${year}`;
      
      if (periodType !== 'year') {
        url += `&value=${periodValue}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Kan BTW overzicht niet berekenen');
      }

      const result = await response.json();
      setBtwResult(result);
    } catch (err) {
      console.error('Error calculating BTW overview:', err);
      setError(err.message || 'Er is een fout opgetreden');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Get the max value for period input based on period type
   * @returns {number} - Max value for period input
   */
  function getMaxPeriodValue() {
    return periodType === 'month' ? 12 : 4;
  }

  /**
   * Handle period type change and reset period value appropriately
   * @param {string} newType - New period type
   */
  function handlePeriodTypeChange(newType) {
    setPeriodType(newType);
    // Reset period value when switching types
    if (newType === 'month') {
      setPeriodValue(new Date().getMonth() + 1);
    } else if (newType === 'quarter') {
      setPeriodValue(Math.ceil((new Date().getMonth() + 1) / 3));
    } else {
      setPeriodValue(1);
    }
  }

  // Wait for companyId to be set
  if (!companyId) {
    return (
      <div className="statements-page">
        <CompanyHeader />
        <div className="container">
          <h1 className="page-title">BTW Overzicht (bedrijf)</h1>
          <div className="loading">Laden...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="statements-page">
      <CompanyHeader />
      <div className="container">
        <h1 className="page-title">BTW Overzicht (bedrijf)</h1>

        {/* Error message */}
        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* BTW calculation form */}
        <div className="form-container">
          <form onSubmit={handleSubmit} className="worklog-form">
            <div className="form-group">
              <label htmlFor="periodType" className="form-label">
                Periode
              </label>
              <select
                id="periodType"
                className="form-input"
                value={periodType}
                onChange={(e) => handlePeriodTypeChange(e.target.value)}
                disabled={isLoading}
              >
                <option value="month">Maand</option>
                <option value="quarter">Kwartaal</option>
                <option value="year">Jaar</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="year" className="form-label">
                  Jaar
                </label>
                <input
                  type="number"
                  id="year"
                  className="form-input"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || '')}
                  min="2000"
                  max="2100"
                  disabled={isLoading}
                />
              </div>

              {periodType !== 'year' && (
                <div className="form-group">
                  <label htmlFor="periodValue" className="form-label">
                    {periodType === 'month' ? 'Maand' : 'Kwartaal'}
                  </label>
                  <input
                    type="number"
                    id="periodValue"
                    className="form-input"
                    value={periodValue}
                    onChange={(e) => setPeriodValue(parseInt(e.target.value) || '')}
                    min="1"
                    max={getMaxPeriodValue()}
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Bezig...' : 'Berekenen'}
            </button>
          </form>
        </div>

        {/* BTW result box */}
        {btwResult && (
          <div className="btw-summary" style={{ marginTop: '1.5rem' }}>
            <h2 className="btw-summary-title">Resultaat</h2>
            <div className="btw-summary-rows">
              <div className="btw-summary-row">
                <span className="btw-label">Omzet (excl. BTW):</span>
                <span className="btw-amount">{formatCurrency(btwResult.subtotal)}</span>
              </div>
              <div className="btw-summary-row">
                <span className="btw-label">BTW over omzet:</span>
                <span className="btw-amount">{formatCurrency(btwResult.btw)}</span>
              </div>
              <div className="btw-summary-row btw-balance-row">
                <span className="btw-label">Netto (incl. BTW):</span>
                <span className="btw-amount btw-balance">{formatCurrency(btwResult.net)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanyBtwPage;
