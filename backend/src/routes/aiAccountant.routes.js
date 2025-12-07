import { Router } from 'express';
import { sendError } from '../utils/error.js';
import { calcBTW } from '../utils/calc.js';
import { query } from '../db/client.js';

const router = Router();

// UUID regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Calculate standard deviation for volatility analysis
 * @param {Array} values - Array of numbers
 * @returns {number} - Standard deviation
 */
function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(val => Math.pow(val - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate financial health score (0-100)
 * @param {Object} metrics - Financial metrics
 * @returns {Object} - { score, label }
 */
function calculateHealthScore(metrics) {
  let score = 50; // Start at neutral
  
  // Factor 1: Profit margin (max +20 points)
  if (metrics.profitMarginPercent > 0) {
    score += Math.min(20, metrics.profitMarginPercent / 2);
  } else {
    score -= 20; // Penalty for negative margin
  }
  
  // Factor 2: Income stability (max +15 points, -15 for high volatility)
  const volatilityRatio = metrics.incomeVolatility / (metrics.avgIncome6m || 1);
  if (volatilityRatio < 0.2) {
    score += 15; // Very stable
  } else if (volatilityRatio < 0.4) {
    score += 10; // Stable
  } else if (volatilityRatio < 0.6) {
    score += 5; // Moderate
  } else {
    score -= 15; // High volatility is risky
  }
  
  // Factor 3: Expense ratio (max +15 points)
  const expenseRatio = metrics.totalExpenses12m > 0 
    ? (metrics.totalExpenses12m / (metrics.totalIncome12m || 1)) * 100 
    : 0;
  if (expenseRatio < 20) {
    score += 15; // Very lean
  } else if (expenseRatio < 35) {
    score += 10; // Good
  } else if (expenseRatio < 50) {
    score += 5; // Acceptable
  } else {
    score -= 10; // Too high
  }
  
  // Factor 4: Growth trend (max +10 points)
  const growth6m = metrics.avgIncome6m > 0 && metrics.avgIncome12m > 0
    ? ((metrics.avgIncome6m / metrics.avgIncome12m - 1) * 100)
    : 0;
  if (growth6m > 10) {
    score += 10; // Strong growth
  } else if (growth6m > 0) {
    score += 5; // Positive growth
  } else if (growth6m < -10) {
    score -= 10; // Declining
  }
  
  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));
  
  // Classify
  let label;
  if (score >= 70) {
    label = 'gezond';
  } else if (score >= 40) {
    label = 'aandacht nodig';
  } else {
    label = 'risicovol';
  }
  
  return { score: Math.round(score), label };
}

/**
 * Generate observations based on financial data
 * @param {Object} data - All analyzed data
 * @returns {Array} - Array of observation strings
 */
function generateObservations(data) {
  const observations = [];
  const { metrics, monthlyData } = data;
  
  // Observation 1: Average performance
  if (metrics.avgIncome6m > 0) {
    observations.push(
      `Op basis van de laatste 6 maanden is uw gemiddelde netto winst € ${metrics.avgNetProfit6m.toLocaleString('nl-NL')} per maand.`
    );
  }
  
  // Observation 2: Trend analysis
  if (metrics.avgIncome6m > 0 && metrics.avgIncome3m > 0) {
    const recentTrend = ((metrics.avgIncome3m / metrics.avgIncome6m - 1) * 100);
    if (Math.abs(recentTrend) > 5) {
      const direction = recentTrend > 0 ? 'gestegen' : 'gedaald';
      observations.push(
        `Uw omzet is de laatste 3 maanden ${direction} met ${Math.abs(recentTrend).toFixed(1)}% ten opzichte van uw 6-maands gemiddelde.`
      );
    }
  }
  
  // Observation 3: Volatility
  if (metrics.incomeVolatility > 0 && metrics.avgIncome6m > 0) {
    const volatilityRatio = (metrics.incomeVolatility / metrics.avgIncome6m) * 100;
    if (volatilityRatio > 50) {
      observations.push(
        `Uw inkomsten fluctueren sterk (variatie van ${volatilityRatio.toFixed(0)}%). Dit kan uw cashflow beïnvloeden.`
      );
    }
  }
  
  // Observation 4: Best/Worst months
  if (monthlyData.topMonths.length > 0) {
    const best = monthlyData.topMonths[0];
    observations.push(
      `Uw beste maand was ${best.month} met € ${best.income.toLocaleString('nl-NL')} omzet.`
    );
  }
  
  if (monthlyData.worstMonths.length > 0) {
    const worst = monthlyData.worstMonths[0];
    if (worst.netProfit < 0) {
      observations.push(
        `Let op: in ${worst.month} was uw netto winst negatief (€ ${worst.netProfit.toLocaleString('nl-NL')}).`
      );
    }
  }
  
  // Observation 5: BTW pattern
  if (metrics.btwPerQuarter && metrics.btwPerQuarter.length > 0) {
    const latestQ = metrics.btwPerQuarter[metrics.btwPerQuarter.length - 1];
    if (latestQ.btwToPay > 0) {
      observations.push(
        `In Q${latestQ.quarter} ${latestQ.year} heeft u € ${latestQ.btwToPay.toLocaleString('nl-NL')} aan BTW te betalen.`
      );
    }
  }
  
  return observations;
}

/**
 * Generate recommendations based on analysis
 * @param {Object} data - All analyzed data
 * @param {string} question - Optional user question
 * @returns {Array} - Array of recommendation strings
 */
function generateRecommendations(data, question) {
  const recommendations = [];
  const { metrics } = data;
  
  // Recommendation 1: Tax reservation
  if (metrics.avgNetProfit6m > 0) {
    const taxReservation = metrics.avgNetProfit6m * 0.35;
    recommendations.push(
      `Reserveer maandelijks ongeveer € ${taxReservation.toLocaleString('nl-NL')} (35% van netto winst) voor belastingen en BTW.`
    );
  }
  
  // Recommendation 2: BTW buffer
  const avgBTW = metrics.btwPerQuarter && metrics.btwPerQuarter.length > 0
    ? metrics.btwPerQuarter.reduce((sum, q) => sum + q.btwToPay, 0) / metrics.btwPerQuarter.length
    : 0;
  if (avgBTW > 0) {
    const monthlyBTW = avgBTW / 3;
    recommendations.push(
      `Zet maandelijks ongeveer € ${monthlyBTW.toLocaleString('nl-NL')} opzij voor BTW-betalingen.`
    );
  }
  
  // Recommendation 3: Expense management
  const expenseRatio = metrics.totalIncome12m > 0
    ? (metrics.totalExpenses12m / metrics.totalIncome12m) * 100
    : 0;
  if (expenseRatio > 40) {
    recommendations.push(
      `Uw kosten zijn ${expenseRatio.toFixed(0)}% van uw omzet. Analyseer waar u kunt besparen.`
    );
  } else if (expenseRatio < 15) {
    recommendations.push(
      `Controleer of u alle zakelijke uitgaven registreert voor optimale belastingaftrek.`
    );
  }
  
  // Recommendation 4: Volatility management
  if (metrics.incomeVolatility > 0 && metrics.avgIncome6m > 0) {
    const volatilityRatio = (metrics.incomeVolatility / metrics.avgIncome6m) * 100;
    if (volatilityRatio > 50) {
      const bufferMonths = 6;
      const buffer = (metrics.avgExpenses6m || metrics.avgIncome6m * 0.3) * bufferMonths;
      recommendations.push(
        `Bouw een buffer op van € ${buffer.toLocaleString('nl-NL')} (${bufferMonths} maanden uitgaven) vanwege wisselende inkomsten.`
      );
    }
  }
  
  // Recommendation 5: Growth strategy
  if (metrics.healthScore >= 70) {
    recommendations.push(
      `Uw financiële gezondheid is goed. Overweeg te investeren in groei (marketing, tools, opleiding).`
    );
  } else if (metrics.healthScore < 40) {
    recommendations.push(
      `Focus op stabiliteit: zorg voor vaste klanten en controleer uw uitgaven kritisch.`
    );
  }
  
  // Question-specific recommendations
  if (question) {
    const lowerQ = question.toLowerCase();
    if (lowerQ.includes('pensioen')) {
      const pensionReservation = metrics.avgNetProfit6m * 0.12;
      recommendations.push(
        `Voor pensioenopbouw: reserveer 10-15% van uw winst (€ ${pensionReservation.toLocaleString('nl-NL')}/maand) voor lijfrente.`
      );
    }
    if (lowerQ.includes('buffer') || lowerQ.includes('reserve')) {
      const buffer = (metrics.avgExpenses6m || metrics.avgIncome6m * 0.3) * 6;
      recommendations.push(
        `Een financiële buffer van 6 maanden uitgaven (€ ${buffer.toLocaleString('nl-NL')}) geeft zekerheid.`
      );
    }
    if (lowerQ.includes('auto') || lowerQ.includes('lease')) {
      recommendations.push(
        `Zakelijk autogebruik: houd een rittenadministratie bij en registreer alle autokosten (brandstof, onderhoud, verzekering).`
      );
    }
  }
  
  return recommendations;
}

/**
 * Classify question type
 * @param {string} question - User question
 * @returns {string} - Question type
 */
function classifyQuestion(question) {
  if (!question) return 'general';
  
  const lower = question.toLowerCase();
  if (lower.includes('btw') || lower.includes('belasting')) {
    return 'btw';
  } else if (lower.includes('omzet') || lower.includes('inkomen') || lower.includes('winst')) {
    return 'income';
  } else if (lower.includes('uitgaven') || lower.includes('kosten') || lower.includes('uitgave')) {
    return 'expenses';
  }
  return 'general';
}

/**
 * POST /api/ai/accountant
 * Smart AI Accountant endpoint - comprehensive financial analysis for ZZP users
 * Request body: { zzpId, question (optional) }
 */
router.post('/', async (req, res) => {
  try {
    const { zzpId, question } = req.body;
    
    // Validate zzpId
    if (!zzpId) {
      return sendError(res, 400, 'ZZP-ID is verplicht');
    }
    
    if (!UUID_REGEX.test(zzpId)) {
      return sendError(res, 400, 'Ongeldige ZZP-ID');
    }
    
    // Calculate date ranges (24 months for comprehensive analysis)
    const now = new Date();
    const date24MonthsAgo = new Date(now);
    date24MonthsAgo.setMonth(date24MonthsAgo.getMonth() - 24);
    
    const formatDate = (date) => date.toISOString().split('T')[0];
    const formatMonth = (date) => date.toISOString().substring(0, 7);
    
    // Fetch all statements with details
    const statementsResult = await query(
      `SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        status,
        total_amount
       FROM statements
       WHERE zzp_id = $1
         AND created_at >= $2
       ORDER BY month DESC`,
      [zzpId, formatDate(date24MonthsAgo)]
    );
    
    // Fetch all expenses with details
    const expensesResult = await query(
      `SELECT 
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        amount
       FROM expenses
       WHERE zzp_id = $1
         AND expense_date >= $2
       ORDER BY month DESC`,
      [zzpId, formatDate(date24MonthsAgo)]
    );
    
    // Aggregate monthly data
    const monthlyMap = new Map();
    
    // Process statements (focus on paid, but include all)
    statementsResult.rows.forEach(row => {
      const month = row.month;
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { month, income: 0, paidIncome: 0, expenses: 0 });
      }
      const data = monthlyMap.get(month);
      const amount = parseFloat(row.total_amount) || 0;
      data.income += amount;
      if (row.status === 'paid') {
        data.paidIncome += amount;
      }
    });
    
    // Process expenses
    expensesResult.rows.forEach(row => {
      const month = row.month;
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { month, income: 0, paidIncome: 0, expenses: 0 });
      }
      const data = monthlyMap.get(month);
      data.expenses += parseFloat(row.amount) || 0;
    });
    
    // Convert to sorted array and calculate net profit
    const monthlyIncome = [];
    const monthlyExpenses = [];
    const monthlyNetProfit = [];
    const monthlyData = {
      topMonths: [],
      worstMonths: []
    };
    
    Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([month, data]) => {
        const income = Number(data.paidIncome.toFixed(2)); // Use paid income for accurate analysis
        const expenses = Number(data.expenses.toFixed(2));
        const netProfit = Number((income - expenses).toFixed(2));
        
        monthlyIncome.push({ month, amount: income });
        monthlyExpenses.push({ month, amount: expenses });
        monthlyNetProfit.push({ month, amount: netProfit });
        
        monthlyData.topMonths.push({ month, income, netProfit });
        monthlyData.worstMonths.push({ month, income, netProfit });
      });
    
    // Sort for top/worst
    monthlyData.topMonths.sort((a, b) => b.income - a.income);
    monthlyData.topMonths = monthlyData.topMonths.slice(0, 3);
    monthlyData.worstMonths.sort((a, b) => a.netProfit - b.netProfit);
    monthlyData.worstMonths = monthlyData.worstMonths.slice(0, 3);
    
    // Calculate rolling averages
    const incomeValues = monthlyIncome.map(m => m.amount);
    const expenseValues = monthlyExpenses.map(m => m.amount);
    const netProfitValues = monthlyNetProfit.map(m => m.amount);
    
    const recent3m = incomeValues.slice(-3);
    const recent6m = incomeValues.slice(-6);
    const recent12m = incomeValues.slice(-12);
    
    const avgIncome3m = recent3m.length > 0
      ? Number((recent3m.reduce((s, v) => s + v, 0) / recent3m.length).toFixed(2))
      : 0;
    const avgIncome6m = recent6m.length > 0
      ? Number((recent6m.reduce((s, v) => s + v, 0) / recent6m.length).toFixed(2))
      : 0;
    const avgIncome12m = recent12m.length > 0
      ? Number((recent12m.reduce((s, v) => s + v, 0) / recent12m.length).toFixed(2))
      : 0;
    
    const avgExpenses3m = expenseValues.slice(-3).length > 0
      ? Number((expenseValues.slice(-3).reduce((s, v) => s + v, 0) / expenseValues.slice(-3).length).toFixed(2))
      : 0;
    const avgExpenses6m = expenseValues.slice(-6).length > 0
      ? Number((expenseValues.slice(-6).reduce((s, v) => s + v, 0) / expenseValues.slice(-6).length).toFixed(2))
      : 0;
    
    const avgNetProfit3m = recent3m.length > 0
      ? Number((avgIncome3m - avgExpenses3m).toFixed(2))
      : 0;
    const avgNetProfit6m = recent6m.length > 0
      ? Number((avgIncome6m - avgExpenses6m).toFixed(2))
      : 0;
    
    // Calculate volatility
    const incomeVolatility = Number(calculateStdDev(recent6m).toFixed(2));
    
    // Calculate totals
    const totalIncome3m = Number(recent3m.reduce((s, v) => s + v, 0).toFixed(2));
    const totalIncome12m = Number(recent12m.reduce((s, v) => s + v, 0).toFixed(2));
    const totalExpenses3m = Number(expenseValues.slice(-3).reduce((s, v) => s + v, 0).toFixed(2));
    const totalExpenses12m = Number(expenseValues.slice(-12).reduce((s, v) => s + v, 0).toFixed(2));
    
    // Calculate profit margin
    const profitMarginPercent = totalIncome12m > 0
      ? Number(((totalIncome12m - totalExpenses12m) / totalIncome12m * 100).toFixed(1))
      : 0;
    
    // Calculate BTW per quarter
    const btwPerQuarter = [];
    const quarterMap = new Map();
    
    monthlyIncome.forEach(m => {
      const [year, month] = m.month.split('-');
      const quarter = Math.ceil(parseInt(month) / 3);
      const key = `${year}-Q${quarter}`;
      
      if (!quarterMap.has(key)) {
        quarterMap.set(key, { year: parseInt(year), quarter, income: 0, expenses: 0 });
      }
      quarterMap.get(key).income += m.amount;
    });
    
    monthlyExpenses.forEach(m => {
      const [year, month] = m.month.split('-');
      const quarter = Math.ceil(parseInt(month) / 3);
      const key = `${year}-Q${quarter}`;
      
      if (!quarterMap.has(key)) {
        quarterMap.set(key, { year: parseInt(year), quarter, income: 0, expenses: 0 });
      }
      quarterMap.get(key).expenses += m.amount;
    });
    
    Array.from(quarterMap.values())
      .sort((a, b) => a.year - b.year || a.quarter - b.quarter)
      .forEach(q => {
        const btwOmzet = calcBTW(q.income);
        const btwKosten = calcBTW(q.expenses);
        const btwToPay = Number((btwOmzet - btwKosten).toFixed(2));
        
        btwPerQuarter.push({
          year: q.year,
          quarter: q.quarter,
          btwOmzet: Number(btwOmzet.toFixed(2)),
          btwKosten: Number(btwKosten.toFixed(2)),
          btwToPay
        });
      });
    
    // Build comprehensive metrics
    const metrics = {
      monthsAnalyzed: monthlyIncome.length,
      monthlyIncome,
      monthlyExpenses,
      monthlyNetProfit,
      avgIncome3m,
      avgIncome6m,
      avgIncome12m,
      avgExpenses3m,
      avgExpenses6m,
      avgNetProfit3m,
      avgNetProfit6m,
      totalIncome3m,
      totalExpenses3m,
      totalIncome12m,
      totalExpenses12m,
      profitMarginPercent,
      incomeVolatility,
      btwPerQuarter,
      healthScore: 0,
      healthLabel: 'gezond'
    };
    
    // Calculate health score
    const health = calculateHealthScore(metrics);
    metrics.healthScore = health.score;
    metrics.healthLabel = health.label;
    
    // Generate insights
    const observations = generateObservations({ metrics, monthlyData });
    const recommendations = generateRecommendations({ metrics, monthlyData }, question);
    
    // Classify question
    const questionContext = {
      originalQuestion: question || null,
      interpretedType: classifyQuestion(question)
    };
    
    res.json({
      metrics,
      observations,
      recommendations,
      questionContext
    });
    
  } catch (error) {
    console.error('Error in AI accountant:', error);
    sendError(res, 500, 'Kon analyse niet uitvoeren');
  }
});

export default router;
