import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../../config/api';
import CompanyHeader from '../../../components/CompanyHeader';
import '../../statements/styles.css';
import '../worklogs/worklogs.css';

/**
 * Get the current ISO week number
 * @returns {number} - Current ISO week number
 */
function getCurrentWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

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
 * Get Dutch status label
 * @param {string} status - Status value
 * @returns {string} - Dutch label
 */
function getStatusLabel(status) {
  const statusLabels = {
    'open': 'Open',
    'approved': 'Goedgekeurd',
    'invoiced': 'Gefactureerd',
    'paid': 'Betaald'
  };
  return statusLabels[status] || status;
}

/**
 * Get CSS class for status badge
 * @param {string} status - Status value
 * @returns {string} - CSS class name
 */
function getStatusClass(status) {
  const statusClasses = {
    'open': 'status-open',
    'approved': 'status-approved',
    'invoiced': 'status-invoiced',
    'paid': 'status-paid'
  };
  return statusClasses[status] || '';
}

/**
 * Company Statements Page Component
 * Allows companies to generate and view statements for ZZP workers
 */
function CompanyStatementsPage() {
  // Form state
  const [zzpId, setZzpId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [weekNumber, setWeekNumber] = useState(getCurrentWeekNumber());
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  
  // Statements list state
  const [statements, setStatements] = useState([]);
  const [loadingStatements, setLoadingStatements] = useState(true);

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

  // Fetch statements when companyId is set
  useEffect(() => {
    if (!companyId) {
      return;
    }

    async function fetchStatements() {
      try {
        setLoadingStatements(true);

        const response = await fetch(
          `${API_BASE_URL}/api/statements?companyId=${companyId}`
        );

        if (!response.ok) {
          throw new Error('Kan overzichten niet laden');
        }

        const data = await response.json();
        setStatements(data.items || []);
      } catch (err) {
        console.error('Error fetching statements:', err);
        // Don't set error for table fetch, just log it
      } finally {
        setLoadingStatements(false);
      }
    }

    fetchStatements();
  }, [companyId]);

  /**
   * Handle form submission to generate statement
   * @param {Event} e - Form submit event
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!year || year < 2020 || year > 2100) {
      setError('Vul een geldig jaar in');
      return;
    }

    if (!weekNumber || weekNumber < 1 || weekNumber > 53) {
      setError('Vul een geldig weeknummer in (1-53)');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/api/statements/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyId,
          zzpId: zzpId.trim() || undefined, // Send undefined if empty (for all ZZP)
          year: parseInt(year),
          weekNumber: parseInt(weekNumber)
        })
      });

      if (!response.ok) {
        throw new Error('Kan overzicht niet genereren');
      }

      const result = await response.json();
      
      // Show success message with total amount
      const totalAmount = formatCurrency(result.total_amount || 0);
      setSuccess(`Overzicht succesvol gegenereerd! Totaalbedrag: ${totalAmount}`);

      // Refresh the statements list
      const statementsResponse = await fetch(
        `${API_BASE_URL}/api/statements?companyId=${companyId}`
      );
      
      if (statementsResponse.ok) {
        const data = await statementsResponse.json();
        setStatements(data.items || []);
      }
    } catch (err) {
      console.error('Error generating statement:', err);
      setError(err.message || 'Er is een fout opgetreden');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Wait for companyId to be set
  if (!companyId) {
    return (
      <div className="statements-page">
        <CompanyHeader />
        <div className="container">
          <h1 className="page-title">Overzichten genereren</h1>
          <div className="loading">Laden...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="statements-page">
      <CompanyHeader />
      <div className="container">
        <h1 className="page-title">Overzichten genereren</h1>

        {/* Error message */}
        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* Success message */}
        {success && (
          <div className="success-message">{success}</div>
        )}

        {/* Generate statement form */}
        <div className="form-container">
          <form onSubmit={handleSubmit} className="worklog-form">
            <div className="form-group">
              <label htmlFor="zzpId" className="form-label">
                ZZP ID (optioneel - laat leeg voor alle ZZP)
              </label>
              <input
                type="text"
                id="zzpId"
                className="form-input"
                value={zzpId}
                onChange={(e) => setZzpId(e.target.value)}
                placeholder="bijv. zzp_123"
                disabled={isSubmitting}
              />
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
                  onChange={(e) => setYear(e.target.value)}
                  min="2020"
                  max="2100"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="weekNumber" className="form-label">
                  Weeknummer
                </label>
                <input
                  type="number"
                  id="weekNumber"
                  className="form-input"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value)}
                  min="1"
                  max="53"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Bezig...' : 'Genereer overzicht'}
            </button>
          </form>
        </div>

        {/* Statements table */}
        <h2 className="page-title" style={{ marginTop: '2rem' }}>Bestaande overzichten</h2>
        
        {loadingStatements ? (
          <div className="loading">Laden...</div>
        ) : statements.length === 0 ? (
          <div className="empty-state">
            <p>Geen overzichten gevonden.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="statements-table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>ZZP</th>
                  <th>Bedrag</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((statement) => (
                  <tr key={statement.id}>
                    <td>
                      <span className="week-label">
                        Week {statement.week_number}, {statement.year}
                      </span>
                    </td>
                    <td>
                      <span>{statement.zzp_id || '-'}</span>
                    </td>
                    <td>
                      <span className="amount">
                        {formatCurrency(statement.total_amount || 0)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(statement.status)}`}>
                        {getStatusLabel(statement.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanyStatementsPage;
