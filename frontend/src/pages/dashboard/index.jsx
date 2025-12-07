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
 * Format date in Dutch format
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(date));
}

/**
 * ZZP Income Dashboard Component
 * Displays income summary, paid statements, and expenses
 */
function DashboardPage() {
  // State management
  const [paidStatements, setPaidStatements] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zzpId, setZzpId] = useState(null);

  // Check authentication on mount - redirect to login if not authenticated
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
   * Fetch paid statements and expenses from the API
   */
  useEffect(() => {
    // Wait for zzpId to be set (after auth check)
    if (!zzpId) {
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch paid statements
        const statementsUrl = `${API_BASE_URL}/api/statements?zzpId=${zzpId}&status=paid`;
        const statementsResponse = await fetch(statementsUrl);

        if (!statementsResponse.ok) {
          throw new Error('Kan betaalde overzichten niet laden');
        }

        const statementsData = await statementsResponse.json();
        setPaidStatements(statementsData.items || []);

        // Fetch expenses
        const expensesUrl = `${API_BASE_URL}/api/expenses?zzpId=${zzpId}`;
        const expensesResponse = await fetch(expensesUrl);

        if (!expensesResponse.ok) {
          throw new Error('Kan uitgaven niet laden');
        }

        const expensesData = await expensesResponse.json();
        setExpenses(expensesData.items || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message || 'Er is een fout opgetreden');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [zzpId]);

  // Calculate totals
  const totalOmzet = paidStatements.reduce((sum, statement) => {
    return sum + (statement.total_amount || 0);
  }, 0);

  const totaleUitgaven = expenses.reduce((sum, expense) => {
    return sum + (expense.amount || 0);
  }, 0);

  const nettoWinst = totalOmzet - totaleUitgaven;

  // Get recent items (last 5)
  const recentPaidStatements = [...paidStatements]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date))
    .slice(0, 5);

  // Render loading state
  if (loading) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="container">
          <h1 className="page-title">Dashboard</h1>
          <div className="loading">Laden...</div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="container">
          <h1 className="page-title">Dashboard</h1>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Header />
      <div className="container">
        <h1 className="page-title">Dashboard</h1>

        {/* Summary card */}
        <div className="summary-card">
          <h2 className="summary-title">Inkomensoverzicht</h2>
          <div className="summary-rows">
            <div className="summary-row">
              <span className="summary-label">Inkomsten (omzet):</span>
              <span className="summary-amount positive">{formatCurrency(totalOmzet)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Uitgaven:</span>
              <span className="summary-amount negative">{formatCurrency(totaleUitgaven)}</span>
            </div>
            <div className="summary-row summary-total">
              <span className="summary-label">Netto winst:</span>
              <span className={`summary-amount ${nettoWinst >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(nettoWinst)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent paid statements */}
        <div className="dashboard-section">
          <h2 className="section-title">Laatste betaalde overzichten</h2>
          {recentPaidStatements.length === 0 ? (
            <div className="empty-state">
              <p>Geen betaalde overzichten gevonden.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Jaar</th>
                    <th>Bedrag</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPaidStatements.map((statement) => (
                    <tr key={statement.id}>
                      <td>Week {statement.week_number}</td>
                      <td>{statement.year}</td>
                      <td className="amount">{formatCurrency(statement.total_amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent expenses */}
        <div className="dashboard-section">
          <h2 className="section-title">Laatste uitgaven</h2>
          {recentExpenses.length === 0 ? (
            <div className="empty-state">
              <p>Geen uitgaven gevonden.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Categorie</th>
                    <th>Bedrag</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        {expense.expense_date ? formatDate(expense.expense_date) : '-'}
                      </td>
                      <td>{expense.category}</td>
                      <td className="amount">{formatCurrency(expense.amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Back to statements button */}
        <div className="dashboard-actions">
          <a href="/statements" className="btn btn-secondary">
            Terug naar overzichten
          </a>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
