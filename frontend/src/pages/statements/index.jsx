import React, { useState, useEffect } from 'react';
import './styles.css';

// API base URL - can be configured via environment variable
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

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
 * ZZP Statements Dashboard Component
 * Displays a list of statements for a ZZP user with invoice generation functionality
 */
function StatementsPage() {
  // State management
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(null);
  const [invoiceDownload, setInvoiceDownload] = useState(null);

  // Get ZZP ID from URL query parameters
  // Note: In production with React Router, use useSearchParams() hook instead
  const [zzpId] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('zzpId') || '';
    }
    return '';
  });

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (invoiceDownload?.downloadUrl) {
        URL.revokeObjectURL(invoiceDownload.downloadUrl);
      }
    };
  }, [invoiceDownload]);

  /**
   * Fetch statements from the API
   */
  useEffect(() => {
    async function fetchStatements() {
      try {
        setLoading(true);
        setError(null);

        const url = zzpId 
          ? `${API_BASE_URL}/statements?zzpId=${zzpId}`
          : `${API_BASE_URL}/statements`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Kan overzichten niet laden');
        }

        const data = await response.json();
        setStatements(data.items || []);
      } catch (err) {
        console.error('Error fetching statements:', err);
        setError(err.message || 'Er is een fout opgetreden');
      } finally {
        setLoading(false);
      }
    }

    fetchStatements();
  }, [zzpId]);

  /**
   * Generate invoice for a statement
   * @param {string} statementId - Statement ID
   */
  async function handleGenerateInvoice(statementId) {
    try {
      setGeneratingInvoice(statementId);
      setError(null);
      setInvoiceDownload(null);

      const response = await fetch(`${API_BASE_URL}/invoices/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statementId })
      });

      if (!response.ok) {
        throw new Error('Kan factuur niet genereren');
      }

      const invoice = await response.json();

      // Validate PDF data before processing
      if (!invoice.pdf || typeof invoice.pdf !== 'string') {
        throw new Error('Ongeldige factuur data ontvangen');
      }

      // Revoke previous download URL to prevent memory leak
      if (invoiceDownload?.downloadUrl) {
        URL.revokeObjectURL(invoiceDownload.downloadUrl);
      }

      // Create download link for the PDF
      const pdfBlob = base64ToBlob(invoice.pdf, 'application/pdf');
      const downloadUrl = URL.createObjectURL(pdfBlob);

      setInvoiceDownload({
        statementId,
        invoiceNumber: invoice.invoiceNumber,
        downloadUrl,
        total: invoice.total
      });

      // Refresh statements to update status
      const statementsResponse = await fetch(
        zzpId 
          ? `${API_BASE_URL}/statements?zzpId=${zzpId}`
          : `${API_BASE_URL}/statements`
      );
      
      if (statementsResponse.ok) {
        const data = await statementsResponse.json();
        setStatements(data.items || []);
      }
    } catch (err) {
      console.error('Error generating invoice:', err);
      setError(err.message || 'Fout bij genereren factuur');
    } finally {
      setGeneratingInvoice(null);
    }
  }

  /**
   * Convert base64 string to Blob
   * @param {string} base64 - Base64 encoded string
   * @param {string} contentType - MIME type
   * @returns {Blob} - Blob object
   */
  function base64ToBlob(base64, contentType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  /**
   * View/download existing invoice
   * Note: Currently regenerates invoice since storage isn't implemented yet.
   * In production, this would fetch a saved invoice from storage.
   * @param {string} statementId - Statement ID
   */
  function handleViewInvoice(statementId) {
    // TODO: Fetch saved invoice from storage when implemented
    // For now, regenerate the invoice for viewing
    handleGenerateInvoice(statementId);
  }

  // Render loading state
  if (loading) {
    return (
      <div className="statements-page">
        <div className="container">
          <h1 className="page-title">Overzichten</h1>
          <div className="loading">Laden...</div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && statements.length === 0) {
    return (
      <div className="statements-page">
        <div className="container">
          <h1 className="page-title">Overzichten</h1>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="statements-page">
      <div className="container">
        <h1 className="page-title">Overzichten</h1>
        
        {/* Error notification */}
        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* Invoice download notification */}
        {invoiceDownload && (
          <div className="success-message">
            <span>Factuur {invoiceDownload.invoiceNumber} gegenereerd!</span>
            <a 
              href={invoiceDownload.downloadUrl}
              download={`${invoiceDownload.invoiceNumber}.pdf`}
              className="download-link"
            >
              Download PDF
            </a>
          </div>
        )}

        {/* Empty state */}
        {statements.length === 0 ? (
          <div className="empty-state">
            <p>Geen overzichten gevonden.</p>
          </div>
        ) : (
          /* Statements table */
          <div className="table-container">
            <table className="statements-table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Bedrag</th>
                  <th>Status</th>
                  <th>Actie</th>
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
                      <span className="amount">
                        {formatCurrency(statement.total_amount || 0)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(statement.status)}`}>
                        {getStatusLabel(statement.status)}
                      </span>
                    </td>
                    <td>
                      {statement.status === 'open' ? (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleGenerateInvoice(statement.id)}
                          disabled={generatingInvoice === statement.id}
                        >
                          {generatingInvoice === statement.id ? 'Bezig...' : 'Maak factuur'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleViewInvoice(statement.id)}
                          disabled={generatingInvoice === statement.id}
                        >
                          {generatingInvoice === statement.id ? 'Bezig...' : 'Bekijk'}
                        </button>
                      )}
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

export default StatementsPage;
