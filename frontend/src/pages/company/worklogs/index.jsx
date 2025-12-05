import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../../config/api';
import CompanyHeader from '../../../components/CompanyHeader';
import '../../statements/styles.css';
import './worklogs.css';

/**
 * Company Worklogs Page Component
 * Allows companies to log ZZP work with a simple form
 */
function WorklogsPage() {
  // Form state
  const [zzpId, setZzpId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [tariffType, setTariffType] = useState('uur');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [companyId, setCompanyId] = useState(null);

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
   * Reset the form to initial state
   */
  function resetForm() {
    setZzpId('');
    setWorkDate('');
    setTariffType('uur');
    setQuantity('');
    setUnitPrice('');
    setNotes('');
  }

  /**
   * Handle form submission
   * @param {Event} e - Form submit event
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!zzpId.trim()) {
      setError('Vul het ZZP ID in');
      return;
    }

    if (!workDate) {
      setError('Selecteer een datum');
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Vul een geldig aantal in');
      return;
    }

    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      setError('Vul een geldig tarief in');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/api/worklogs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyId,
          zzpId: zzpId.trim(),
          workDate,
          tariffType,
          quantity: parseFloat(quantity),
          unitPrice: parseFloat(unitPrice),
          currency: 'EUR',
          notes: notes.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Kan werkregistratie niet opslaan');
      }

      setSuccess('Werkregistratie succesvol opgeslagen!');
      resetForm();
    } catch (err) {
      console.error('Error saving worklog:', err);
      setError(err.message || 'Er is een fout opgetreden');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Wait for companyId to be set
  if (!companyId) {
    return (
      <div className="worklogs-page">
        <CompanyHeader />
        <div className="container">
          <h1 className="page-title">Werkregistratie</h1>
          <div className="loading">Laden...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="worklogs-page">
      <CompanyHeader />
      <div className="container">
        <h1 className="page-title">Werkregistratie</h1>

        {/* Error message */}
        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* Success message */}
        {success && (
          <div className="success-message">{success}</div>
        )}

        {/* Worklog form */}
        <div className="form-container">
          <form onSubmit={handleSubmit} className="worklog-form">
            <div className="form-group">
              <label htmlFor="zzpId" className="form-label">
                ZZP ID
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

            <div className="form-group">
              <label htmlFor="workDate" className="form-label">
                Datum
              </label>
              <input
                type="date"
                id="workDate"
                className="form-input"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="tariffType" className="form-label">
                Type
              </label>
              <select
                id="tariffType"
                className="form-input"
                value={tariffType}
                onChange={(e) => setTariffType(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="stop">Stop</option>
                <option value="uur">Uur</option>
                <option value="locatie">Locatie</option>
                <option value="punt">Punt</option>
                <option value="project">Project</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="quantity" className="form-label">
                  Aantal
                </label>
                <input
                  type="number"
                  id="quantity"
                  className="form-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="unitPrice" className="form-label">
                  Tarief (€)
                </label>
                <input
                  type="number"
                  id="unitPrice"
                  className="form-input"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                Notities
              </label>
              <textarea
                id="notes"
                className="form-input form-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optionele notities..."
                rows="3"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Bezig...' : 'Opslaan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default WorklogsPage;
