import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';
import Header from '../../components/Header';
import './btw.css';

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
 * Get current quarter (1-4)
 * @returns {number} - Current quarter
 */
function getCurrentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

/**
 * BTW Aangifte Hulp Page Component
 * Helps ZZP users prepare their BTW declaration with calculated amounts
 */
function BtwAangifteHulpPage() {
  // State management
  const [zzpId, setZzpId] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [btwData, setBtwData] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedZzpId = localStorage.getItem('zzpId');
      if (!storedZzpId) {
        window.location.href = '/login';
        return;
      }
      setZzpId(storedZzpId);
    }
  }, []);

  /**
   * Fetch BTW data from API
   */
  async function fetchBtwData() {
    if (!zzpId) return;

    try {
      setLoading(true);
      setError(null);

      const url = `${API_BASE_URL}/api/btw/transactions?scope=zzp&zzpId=${encodeURIComponent(zzpId)}&period=quarter&year=${encodeURIComponent(year)}&value=${encodeURIComponent(quarter)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Kan BTW gegevens niet laden');
      }

      const data = await response.json();
      setBtwData(data);
    } catch (err) {
      console.error('Error fetching BTW data:', err);
      setError(err.message || 'Er is een fout opgetreden');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handle calculate button click
   */
  function handleCalculate() {
    fetchBtwData();
  }

  // Auto-fetch on mount and when parameters change
  useEffect(() => {
    if (zzpId) {
      fetchBtwData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zzpId, year, quarter]);

  // Calculate BTW amounts
  const btwOverOmzet = btwData?.summary?.btwReceived || 0;
  const voorbelasting = btwData?.summary?.btwPaid || 0;
  const teBetalenBtw = Math.max(0, btwOverOmzet - voorbelasting);
  const subtotal = btwData?.summary?.totalIncome || 0;

  // Render loading state
  if (!zzpId) {
    return (
      <div className="btw-page">
        <Header />
        <div className="btw-container">
          <h1 className="btw-title">BTW aangifte hulp</h1>
          <div className="btw-loading">Laden...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="btw-page">
      <Header />
      <div className="btw-container">
        <h1 className="btw-title">BTW aangifte hulp</h1>

        {/* Error message */}
        {error && <div className="btw-error">{error}</div>}

        {/* Form */}
        <div className="btw-aangifte-form">
          <div className="btw-form-row">
            <div className="btw-form-group">
              <label htmlFor="year" className="btw-label">Jaar</label>
              <input
                type="number"
                id="year"
                className="btw-input"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                min="2000"
                max="2100"
                disabled={loading}
              />
            </div>

            <div className="btw-form-group">
              <label htmlFor="quarter" className="btw-label">Kwartaal</label>
              <select
                id="quarter"
                className="btw-select"
                value={quarter}
                onChange={(e) => setQuarter(parseInt(e.target.value))}
                disabled={loading}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>

            <div className="btw-form-group">
              <button
                type="button"
                className="btw-btn btw-btn-primary"
                onClick={handleCalculate}
                disabled={loading}
              >
                {loading ? 'Bezig...' : 'Berekenen'}
              </button>
            </div>
          </div>
        </div>

        {/* Help box */}
        {btwData && !loading && (
          <div className="btw-aangifte-help">
            <h2 className="btw-section-title">Bedragen voor aangifte</h2>
            
            <div className="btw-help-rows">
              <div className="btw-help-row">
                <span className="btw-help-label">Omzet exclusief BTW (21%):</span>
                <span className="btw-help-value">{formatCurrency(subtotal)}</span>
              </div>
              
              <div className="btw-help-row">
                <span className="btw-help-label">BTW over omzet (21%):</span>
                <span className="btw-help-value">{formatCurrency(btwOverOmzet)}</span>
              </div>
              
              <div className="btw-help-row">
                <span className="btw-help-label">Voorbelasting (BTW over kosten):</span>
                <span className="btw-help-value">{formatCurrency(voorbelasting)}</span>
              </div>
              
              <div className="btw-help-row btw-help-total">
                <span className="btw-help-label">Te betalen BTW:</span>
                <span className="btw-help-value btw-help-amount">{formatCurrency(teBetalenBtw)}</span>
              </div>
            </div>

            <div className="btw-help-info">
              <p>
                <strong>Let op:</strong> Deze bedragen zijn een hulpmiddel voor het invullen 
                van uw BTW-aangifte in het portaal van de Belastingdienst. Dit is geen 
                officiële aangifte. Controleer altijd de bedragen in uw administratie 
                voordat u de aangifte indient.
              </p>
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="btw-actions">
          <a href="/btw" className="btw-btn btw-btn-secondary">
            Terug naar BTW overzicht
          </a>
        </div>
      </div>
    </div>
  );
}

export default BtwAangifteHulpPage;
