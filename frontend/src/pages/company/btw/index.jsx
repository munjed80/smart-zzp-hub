import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../../config/api';
import { getUser, isAuthenticated } from '../../../services/auth';
import CompanyHeader from '../../../components/CompanyHeader';
import '../../btw/btw.css';

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
 * @param {string} dateStr - Date string
 * @returns {string} - Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('nl-NL');
}

/**
 * Company BTW Overview Page Component
 * Displays BTW calculation with period controls, transaction table, and chart
 */
function CompanyBtwPage() {
  // Period state
  const [periodType, setPeriodType] = useState('quarter');
  const [year, setYear] = useState(new Date().getFullYear());
  const [periodValue, setPeriodValue] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  
  // Data state
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categoryTotals, setCategoryTotals] = useState({});
  
  // Table state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Check authentication on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!isAuthenticated()) {
        window.location.href = '/login';
        return;
      }
      const user = getUser();
      if (user && user.userType === 'company' && user.profileId) {
        setCompanyId(user.profileId);
      } else {
        // Fallback to localStorage for backward compatibility
        const storedCompanyId = localStorage.getItem('companyId');
        if (storedCompanyId) {
          setCompanyId(storedCompanyId);
        } else {
          window.location.href = '/';
        }
      }
    }
  }, []);

  /**
   * Fetch BTW transactions from API
   */
  async function fetchTransactions() {
    if (!companyId) return;
    
    try {
      setIsLoading(true);
      setError(null);

      let url = `${API_BASE_URL}/api/btw/transactions?scope=company&companyId=${companyId}&period=${periodType}&year=${year}`;
      if (periodType !== 'year') {
        url += `&value=${periodValue}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Kan BTW gegevens niet laden');
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
      setSummary(data.summary || null);
      setCategoryTotals(data.categoryTotals || {});
    } catch (err) {
      console.error('Error fetching BTW transactions:', err);
      setError(err.message || 'Er is een fout opgetreden');
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch data when period changes or companyId is set
  useEffect(() => {
    if (companyId) {
      fetchTransactions();
    }
  }, [companyId, periodType, year, periodValue]);

  /**
   * Handle period type change
   */
  function handlePeriodTypeChange(newType) {
    setPeriodType(newType);
    if (newType === 'month') {
      setPeriodValue(new Date().getMonth() + 1);
    } else if (newType === 'quarter') {
      setPeriodValue(Math.ceil((new Date().getMonth() + 1) / 3));
    } else {
      setPeriodValue(1);
    }
  }

  /**
   * Handle sort
   */
  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  /**
   * Export CSV
   */
  function handleExportCsv() {
    let url = `${API_BASE_URL}/api/btw/export?scope=company&companyId=${companyId}&period=${periodType}&year=${year}`;
    if (periodType !== 'year') {
      url += `&value=${periodValue}`;
    }
    window.open(url, '_blank');
  }

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(tx => 
        tx.description?.toLowerCase().includes(term) ||
        tx.category?.toLowerCase().includes(term) ||
        tx.notes?.toLowerCase().includes(term)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [transactions, searchTerm, sortField, sortDirection]);

  // Calculate chart data (monthly BTW over time)
  const chartData = useMemo(() => {
    const monthlyData = {};
    
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { received: 0 };
      }
      
      monthlyData[monthKey].received += tx.btwAmount;
    });
    
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        received: Math.round(data.received * 100) / 100
      }));
  }, [transactions]);

  // Calculate max value for chart scaling
  const chartMax = useMemo(() => {
    if (chartData.length === 0) return 100;
    const max = Math.max(...chartData.map(d => d.received));
    return Math.ceil(max / 100) * 100 || 100;
  }, [chartData]);

  // Wait for companyId
  if (!companyId) {
    return (
      <div className="btw-page">
        <CompanyHeader />
        <div className="btw-container">
          <h1 className="btw-title">BTW Overzicht (bedrijf)</h1>
          <div className="btw-loading">Laden...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="btw-page">
      <CompanyHeader />
      <div className="btw-container">
        <h1 className="btw-title">BTW Overzicht (bedrijf)</h1>

        {/* Error message */}
        {error && <div className="btw-error">{error}</div>}

        {/* Period controls */}
        <div className="btw-controls">
          <div className="btw-control-group">
            <label htmlFor="periodType" className="btw-label">Periode</label>
            <select
              id="periodType"
              className="btw-select"
              value={periodType}
              onChange={(e) => handlePeriodTypeChange(e.target.value)}
              disabled={isLoading}
            >
              <option value="month">Maand</option>
              <option value="quarter">Kwartaal</option>
              <option value="year">Jaar</option>
            </select>
          </div>

          <div className="btw-control-group">
            <label htmlFor="year" className="btw-label">Jaar</label>
            <input
              type="number"
              id="year"
              className="btw-input"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              min="2000"
              max="2100"
              disabled={isLoading}
            />
          </div>

          {periodType !== 'year' && (
            <div className="btw-control-group">
              <label htmlFor="periodValue" className="btw-label">
                {periodType === 'month' ? 'Maand' : 'Kwartaal'}
              </label>
              <input
                type="number"
                id="periodValue"
                className="btw-input"
                value={periodValue}
                onChange={(e) => setPeriodValue(parseInt(e.target.value) || 1)}
                min="1"
                max={periodType === 'month' ? 12 : 4}
                disabled={isLoading}
              />
            </div>
          )}

          <button
            type="button"
            className="btw-btn btw-btn-secondary"
            onClick={handleExportCsv}
            disabled={isLoading || transactions.length === 0}
          >
            Exporteer als CSV
          </button>
        </div>

        {isLoading ? (
          <div className="btw-loading">Laden...</div>
        ) : (
          <>
            {/* Summary cards */}
            {summary && (
              <div className="btw-summary-grid">
                <div className="btw-card btw-card-income">
                  <div className="btw-card-label">Omzet</div>
                  <div className="btw-card-value">{formatCurrency(summary.totalIncome)}</div>
                  <div className="btw-card-btw">BTW te ontvangen: {formatCurrency(summary.btwReceived)}</div>
                </div>
                <div className="btw-card btw-card-balance">
                  <div className="btw-card-label">Totaal incl. BTW</div>
                  <div className="btw-card-value">{formatCurrency(summary.totalIncome + summary.btwReceived)}</div>
                  <div className="btw-card-btw">Af te dragen aan Belastingdienst</div>
                </div>
              </div>
            )}

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="btw-chart-container">
                <h2 className="btw-section-title">BTW over tijd</h2>
                <div className="btw-chart">
                  <div className="btw-chart-y-axis">
                    <span>{formatCurrency(chartMax)}</span>
                    <span>{formatCurrency(chartMax / 2)}</span>
                    <span>€ 0</span>
                  </div>
                  <div className="btw-chart-bars">
                    {chartData.map((d, i) => (
                      <div key={i} className="btw-chart-bar-group">
                        <div className="btw-chart-bar-container">
                          <div
                            className="btw-chart-bar btw-chart-bar-received"
                            style={{ height: `${(d.received / chartMax) * 100}%`, width: '80%' }}
                            title={`BTW: ${formatCurrency(d.received)}`}
                          />
                        </div>
                        <span className="btw-chart-label">{d.month}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="btw-chart-legend">
                  <span className="btw-legend-item btw-legend-received">BTW over omzet</span>
                </div>
              </div>
            )}

            {/* Category totals */}
            {Object.keys(categoryTotals).length > 0 && (
              <div className="btw-categories">
                <h2 className="btw-section-title">Totalen per categorie</h2>
                <div className="btw-category-grid">
                  {Object.entries(categoryTotals).map(([cat, totals]) => (
                    <div key={cat} className="btw-category-card">
                      <div className="btw-category-name">{cat}</div>
                      <div className="btw-category-row">
                        <span>Omzet:</span>
                        <span className="btw-category-income">{formatCurrency(totals.income)}</span>
                      </div>
                      <div className="btw-category-row btw-category-btw">
                        <span>BTW:</span>
                        <span>{formatCurrency(totals.btwReceived)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction table */}
            <div className="btw-transactions">
              <h2 className="btw-section-title">Transacties</h2>
              
              {/* Table controls */}
              <div className="btw-table-controls">
                <input
                  type="text"
                  className="btw-search"
                  placeholder="Zoeken..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="btw-empty">Geen transacties gevonden</div>
              ) : (
                <div className="btw-table-wrapper">
                  <table className="btw-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('date')} className="btw-th-sortable">
                          Datum {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('category')} className="btw-th-sortable">
                          Type {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('quantity')} className="btw-th-sortable btw-th-right">
                          Aantal {sortField === 'quantity' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('unitPrice')} className="btw-th-sortable btw-th-right">
                          Tarief {sortField === 'unitPrice' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('amount')} className="btw-th-sortable btw-th-right">
                          Bedrag {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="btw-th-right">BTW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx) => (
                        <tr key={`${tx.source}-${tx.id}`} className="btw-row-income">
                          <td>{formatDate(tx.date)}</td>
                          <td>{tx.category}</td>
                          <td className="btw-td-amount">{tx.quantity}</td>
                          <td className="btw-td-amount">{formatCurrency(tx.unitPrice)}</td>
                          <td className="btw-td-amount">{formatCurrency(tx.amount)}</td>
                          <td className="btw-td-amount">{formatCurrency(tx.btwAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CompanyBtwPage;
