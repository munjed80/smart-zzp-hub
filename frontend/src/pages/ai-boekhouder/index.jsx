import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';
import Header from '../../components/Header';
import '../statements/styles.css';

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
 * AI Boekhouder (AI Accountant) Page Component
 * Provides financial analysis and tips for ZZP users
 */
function AIBoekhouderPage() {
  // State management
  const [zzpId, setZzpId] = useState(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

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
   * Handle analyze button click
   */
  async function handleAnalyze() {
    if (!zzpId) {
      setError('Geen ZZP-ID gevonden. Log opnieuw in.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setAnalysisResult(null);

      const response = await fetch(`${API_BASE_URL}/api/ai/accountant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zzpId,
          question: question.trim() || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon analyse niet uitvoeren');
      }

      const data = await response.json();
      setAnalysisResult(data);
    } catch (err) {
      console.error('Error analyzing:', err);
      setError(err.message || 'Er is een fout opgetreden bij de analyse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header />
      
      <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        <h1>AI Boekhouder</h1>
        
        <p style={{ marginBottom: '30px', color: '#666' }}>
          Krijg direct inzicht in uw financiële situatie en ontvang persoonlijke tips 
          van de AI boekhouder op basis van uw actuele cijfers.
        </p>

        {/* Question input section */}
        <div style={{ marginBottom: '30px' }}>
          <label 
            htmlFor="question" 
            style={{ 
              display: 'block', 
              marginBottom: '10px',
              fontWeight: 'bold'
            }}
          >
            Stel uw vraag aan de AI boekhouder (optioneel):
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Bijv: Hoe veel moet ik reserveren voor pensioen? Of: Hoe bouw ik een financiële buffer op?"
            rows={4}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !zzpId}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Analyseren...' : 'Analyseer mijn cijfers'}
        </button>

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33'
          }}>
            {error}
          </div>
        )}

        {/* Analysis results */}
        {analysisResult && (
          <div style={{ marginTop: '30px' }}>
            {/* Summary */}
            <div style={{
              padding: '20px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <h2 style={{ marginTop: 0, marginBottom: '15px' }}>Analyse Samenvatting</h2>
              <p style={{ margin: 0, lineHeight: '1.6' }}>
                {analysisResult.summary}
              </p>
            </div>

            {/* Metrics box */}
            <div style={{
              padding: '20px',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Financiële Kerncijfers</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {/* 3 months */}
                <div>
                  <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                    Laatste 3 maanden
                  </h3>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#666' }}>Omzet:</span>{' '}
                    <strong>{formatCurrency(analysisResult.metrics.totalIncome3m)}</strong>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#666' }}>Uitgaven:</span>{' '}
                    <strong>{formatCurrency(analysisResult.metrics.totalExpenses3m)}</strong>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#666' }}>Netto winst:</span>{' '}
                    <strong style={{ color: '#22c55e' }}>
                      {formatCurrency(analysisResult.metrics.netProfit3m)}
                    </strong>
                  </div>
                </div>

                {/* 12 months */}
                <div>
                  <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                    Laatste 12 maanden
                  </h3>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#666' }}>Omzet:</span>{' '}
                    <strong>{formatCurrency(analysisResult.metrics.totalIncome12m)}</strong>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#666' }}>Uitgaven:</span>{' '}
                    <strong>{formatCurrency(analysisResult.metrics.totalExpenses12m)}</strong>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#666' }}>Netto winst:</span>{' '}
                    <strong style={{ color: '#22c55e' }}>
                      {formatCurrency(analysisResult.metrics.netProfit12m)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* BTW estimate */}
              <div style={{ 
                marginTop: '20px', 
                paddingTop: '20px', 
                borderTop: '1px solid #e2e8f0' 
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>BTW schatting (3 maanden):</span>{' '}
                  <strong style={{ color: analysisResult.metrics.btwToPayEstimate > 0 ? '#ef4444' : '#22c55e' }}>
                    {formatCurrency(analysisResult.metrics.btwToPayEstimate)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Tips list */}
            <div style={{
              padding: '20px',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '6px'
            }}>
              <h2 style={{ marginTop: 0, marginBottom: '15px' }}>
                Adviezen van de AI Boekhouder
              </h2>
              
              <ul style={{ 
                margin: 0, 
                paddingLeft: '20px',
                lineHeight: '1.8' 
              }}>
                {analysisResult.tips.map((tip, index) => (
                  <li key={index} style={{ marginBottom: '10px' }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIBoekhouderPage;
