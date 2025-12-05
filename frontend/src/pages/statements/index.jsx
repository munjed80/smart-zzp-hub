import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';
import Header from '../../components/Header';
import './styles.css';

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

  // Get ZZP ID from localStorage
  const [zzpId, setZzpId] = useState(null);

  // Expenses state (stored in database via API)
  const [expenses, setExpenses] = useState([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState('');

  /**
   * Calculate BTW (VAT) totals from statements and expenses
   * @param {Array} statementsList - List of statements
   * @param {Array} expensesList - List of expenses
   * @returns {Object} - BTW income, expenses, and balance
   */
  function calculateBtwTotals(statementsList, expensesList) {
    // Calculate BTW over income (21% of total amounts)
    const btwIncome = statementsList.reduce((sum, statement) => {
      return sum + ((statement.total_amount || 0) * 0.21);
    }, 0);

    // Calculate BTW over expenses (21% of expense amounts)
    const btwExpenses = expensesList.reduce((sum, expense) => {
      return sum + ((expense.amount || 0) * 0.21);
    }, 0);

    // BTW balance
    const btwBalance = btwIncome - btwExpenses;

    return { btwIncome, btwExpenses, btwBalance };
  }

  // Calculate BTW totals whenever statements or expenses change
  const btwTotals = calculateBtwTotals(statements, expenses);

  /**
   * Handle adding a new expense
   */
  async function handleAddExpense() {
    // Validate inputs
    if (!expenseCategory.trim()) {
      return;
    }

    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    // Use current date if no date provided
    const dateToUse = expenseDate || new Date().toISOString().split('T')[0];

    try {
      // POST to API
      const response = await fetch(`${API_BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zzpId,
          expenseDate: dateToUse,
          category: expenseCategory.trim(),
          amount: amount,
          notes: expenseNotes.trim() || null
        })
      });

      if (!response.ok) {
        throw new Error('Kan uitgave niet opslaan');
      }

      const savedExpense = await response.json();
      setExpenses([savedExpense, ...expenses]);

      // Reset form
      setExpenseCategory('');
      setExpenseAmount('');
      setExpenseNotes('');
      setExpenseDate('');
      setShowExpenseForm(false);
    } catch (err) {
      console.error('Error saving expense:', err);
      setError(err.message || 'Fout bij opslaan uitgave');
    }
  }

  /**
   * Handle removing an expense
   * @param {string} expenseId - ID of expense to remove
   */
  async function handleRemoveExpense(expenseId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/expenses/${expenseId}`, {
        method: 'DELETE'
      });

      if (!response.ok && response.status !== 204) {
        throw new Error('Kan uitgave niet verwijderen');
      }

      setExpenses(expenses.filter(exp => exp.id !== expenseId));
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError(err.message || 'Fout bij verwijderen uitgave');
    }
  }

  // Check authentication on mount - redirect to login if no zzpId
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedZzpId = localStorage.getItem('zzpId');
      if (!storedZzpId) {
        // Redirect to login page if not authenticated
        window.location.href = '/login';
        return;
      }
      setZzpId(storedZzpId);
    }
  }, []);

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
    // Wait for zzpId to be set (after auth check)
    if (!zzpId) {
      return;
    }

    async function fetchStatements() {
      try {
        setLoading(true);
        setError(null);

        const url = `${API_BASE_URL}/api/statements?zzpId=${zzpId}`;

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
   * Fetch expenses from the API
   */
  useEffect(() => {
    // Wait for zzpId to be set (after auth check)
    if (!zzpId) {
      return;
    }

    async function fetchExpenses() {
      try {
        const url = `${API_BASE_URL}/api/expenses?zzpId=${zzpId}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Kan uitgaven niet laden');
        }

        const data = await response.json();
        setExpenses(data.items || []);
      } catch (err) {
        console.error('Error fetching expenses:', err);
        // Don't set error - expenses are not critical
      }
    }

    fetchExpenses();
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

      const response = await fetch(`${API_BASE_URL}/api/invoices/generate`, {
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
        `${API_BASE_URL}/api/statements?zzpId=${zzpId}`
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
        <Header />
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
        <Header />
        <div className="container">
          <h1 className="page-title">Overzichten</h1>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="statements-page">
      <Header />
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

        {/* BTW Summary box */}
        {statements.length > 0 && (
          <div className="btw-summary">
            <h2 className="btw-summary-title">BTW overzicht</h2>
            <div className="btw-summary-rows">
              <div className="btw-summary-row">
                <span className="btw-label">BTW over omzet:</span>
                <span className="btw-amount">{formatCurrency(btwTotals.btwIncome)}</span>
              </div>
              <div className="btw-summary-row">
                <span className="btw-label">BTW over kosten:</span>
                <span className="btw-amount">{formatCurrency(btwTotals.btwExpenses)}</span>
              </div>
              <div className="btw-summary-row btw-balance-row">
                <span className="btw-label">BTW balans:</span>
                <span className="btw-amount btw-balance">{formatCurrency(btwTotals.btwBalance)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <a
                href="/btw"
                className="btn btn-primary"
              >
                Uitgebreid overzicht
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const currentYear = new Date().getFullYear();
                  const url = `${API_BASE_URL}/api/btw/export?scope=zzp&zzpId=${zzpId}&period=year&year=${currentYear}`;
                  window.open(url, '_blank');
                }}
              >
                Exporteer als CSV
              </button>
            </div>
          </div>
        )}

        {/* Expenses section */}
        <div className="expenses-section">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowExpenseForm(!showExpenseForm)}
          >
            {showExpenseForm ? 'Annuleren' : 'Uitgaven toevoegen'}
          </button>

          {/* Expense form */}
          {showExpenseForm && (
            <div className="expense-form">
              <div className="expense-form-group">
                <label htmlFor="expenseDate" className="expense-label">
                  Datum
                </label>
                <input
                  type="date"
                  id="expenseDate"
                  className="expense-input"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>

              <div className="expense-form-group">
                <label htmlFor="expenseCategory" className="expense-label">
                  Categorie
                </label>
                <input
                  type="text"
                  id="expenseCategory"
                  className="expense-input"
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  placeholder="bijv. Kantoorbenodigdheden"
                />
              </div>

              <div className="expense-form-group">
                <label htmlFor="expenseAmount" className="expense-label">
                  Bedrag (€)
                </label>
                <input
                  type="number"
                  id="expenseAmount"
                  className="expense-input"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="expense-form-group">
                <label htmlFor="expenseNotes" className="expense-label">
                  Notities
                </label>
                <textarea
                  id="expenseNotes"
                  className="expense-input expense-textarea"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Optionele notities..."
                  rows="2"
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddExpense}
              >
                Opslaan
              </button>
            </div>
          )}

          {/* Expenses list */}
          {expenses.length > 0 && (
            <div className="expenses-list">
              <h3 className="expenses-list-title">Uitgaven</h3>
              {expenses.map((expense) => (
                <div key={expense.id} className="expense-item">
                  <div className="expense-item-info">
                    <span className="expense-item-date">
                      {expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('nl-NL') : ''}
                    </span>
                    <span className="expense-item-category">{expense.category}</span>
                    <span className="expense-item-amount">{formatCurrency(expense.amount)}</span>
                  </div>
                  {expense.notes && (
                    <span className="expense-item-notes">{expense.notes}</span>
                  )}
                  <button
                    type="button"
                    className="expense-remove-btn"
                    onClick={() => handleRemoveExpense(expense.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
