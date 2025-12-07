import { Router } from 'express';
import { sendError } from '../utils/error.js';
import { calcBTW } from '../utils/calc.js';
import { query } from '../db/client.js';

const router = Router();

// UUID regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Generate Dutch AI accountant tips based on financial data
 * @param {Object} metrics - Financial metrics
 * @param {string} question - Optional user question
 * @returns {Array} - Array of tip strings
 */
function generateTips(metrics, question) {
  const tips = [];
  
  // Tip 1: Tax reservation
  const taxReservationPercentage = 35;
  const taxReservation = Number((metrics.netProfit3m * (taxReservationPercentage / 100)).toFixed(2));
  tips.push(`Reserveer ongeveer ${taxReservationPercentage}% van uw netto winst (€ ${taxReservation.toLocaleString('nl-NL')}) voor belastingen.`);
  
  // Tip 2: BTW payment
  if (metrics.btwToPayEstimate > 0) {
    tips.push(`U heeft ongeveer € ${metrics.btwToPayEstimate.toLocaleString('nl-NL')} aan BTW te betalen. Zorg dat u dit bedrag apart zet.`);
  }
  
  // Tip 3: Expense ratio analysis
  const expenseRatio3m = metrics.totalExpenses3m > 0 
    ? Number(((metrics.totalExpenses3m / metrics.totalIncome3m) * 100).toFixed(1))
    : 0;
  
  if (expenseRatio3m > 30) {
    tips.push(`Uw uitgaven zijn ${expenseRatio3m}% van uw inkomsten. Controleer of alle uitgaven zakelijk noodzakelijk zijn.`);
  } else if (expenseRatio3m < 15 && metrics.totalExpenses3m > 0) {
    tips.push(`Uw uitgaven zijn laag (${expenseRatio3m}%). Vergeet niet om alle zakelijke kosten te registreren voor belastingaftrek.`);
  } else {
    tips.push(`Uw uitgaven-inkomsten ratio van ${expenseRatio3m}% is gezond voor een ZZP'er.`);
  }
  
  // Tip 4: Income trend
  const incomeGrowth = metrics.totalIncome3m > 0 && metrics.totalIncome12m > 0
    ? Number((((metrics.totalIncome3m * 4) / metrics.totalIncome12m - 1) * 100).toFixed(1))
    : 0;
  
  if (incomeGrowth > 10) {
    tips.push(`Uw omzet groeit met ongeveer ${incomeGrowth}% op jaarbasis. Uitstekend! Overweeg om te investeren in uw bedrijf.`);
  } else if (incomeGrowth < -10) {
    tips.push(`Let op: uw omzet daalt met ongeveer ${Math.abs(incomeGrowth)}%. Analyseer nieuwe kansen of markten.`);
  }
  
  // Tip 5: Question-specific advice
  if (question && question.toLowerCase().includes('pensioen')) {
    tips.push('Denk aan uw pensioen: reserveer 10-15% van uw winst voor een lijfrente of andere pensioenvoorziening.');
  } else if (question && question.toLowerCase().includes('buffer')) {
    const bufferMonths = 6;
    const monthlyExpense = metrics.totalExpenses3m / 3;
    const recommendedBuffer = Number((monthlyExpense * bufferMonths).toFixed(2));
    tips.push(`Een financiële buffer van ${bufferMonths} maanden uitgaven (€ ${recommendedBuffer.toLocaleString('nl-NL')}) geeft u zekerheid bij tegenvallers.`);
  } else if (question && question.toLowerCase().includes('auto') || question && question.toLowerCase().includes('lease')) {
    tips.push('Bij zakelijk autogebruik: registreer brandstof, onderhoud en afschrijving nauwkeurig voor optimale belastingaftrek.');
  }
  
  return tips;
}

/**
 * POST /api/ai/accountant
 * AI Accountant endpoint - provides financial analysis and tips for ZZP users
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
    
    // Calculate date ranges
    const now = new Date();
    const date3MonthsAgo = new Date(now);
    date3MonthsAgo.setMonth(date3MonthsAgo.getMonth() - 3);
    const date12MonthsAgo = new Date(now);
    date12MonthsAgo.setMonth(date12MonthsAgo.getMonth() - 12);
    
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    // Fetch paid statements for income (last 3 months)
    const statements3m = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM statements
       WHERE zzp_id = $1
         AND status = 'paid'
         AND created_at >= $2`,
      [zzpId, formatDate(date3MonthsAgo)]
    );
    
    // Fetch paid statements for income (last 12 months)
    const statements12m = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM statements
       WHERE zzp_id = $1
         AND status = 'paid'
         AND created_at >= $2`,
      [zzpId, formatDate(date12MonthsAgo)]
    );
    
    // Fetch expenses (last 3 months)
    const expenses3m = await query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE zzp_id = $1
         AND expense_date >= $2`,
      [zzpId, formatDate(date3MonthsAgo)]
    );
    
    // Fetch expenses (last 12 months)
    const expenses12m = await query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE zzp_id = $1
         AND expense_date >= $2`,
      [zzpId, formatDate(date12MonthsAgo)]
    );
    
    // Calculate metrics
    const totalIncome3m = Number((parseFloat(statements3m.rows[0].total) || 0).toFixed(2));
    const totalIncome12m = Number((parseFloat(statements12m.rows[0].total) || 0).toFixed(2));
    const totalExpenses3m = Number((parseFloat(expenses3m.rows[0].total) || 0).toFixed(2));
    const totalExpenses12m = Number((parseFloat(expenses12m.rows[0].total) || 0).toFixed(2));
    
    const netProfit3m = Number((totalIncome3m - totalExpenses3m).toFixed(2));
    const netProfit12m = Number((totalIncome12m - totalExpenses12m).toFixed(2));
    
    // Calculate BTW estimate (21% on income minus 21% on expenses)
    const btwOnIncome = calcBTW(totalIncome3m);
    const btwOnExpenses = calcBTW(totalExpenses3m);
    const btwToPayEstimate = Number((btwOnIncome - btwOnExpenses).toFixed(2));
    
    const metrics = {
      totalIncome3m,
      totalExpenses3m,
      netProfit3m,
      totalIncome12m,
      totalExpenses12m,
      netProfit12m,
      btwToPayEstimate
    };
    
    // Generate tips
    const tips = generateTips(metrics, question);
    
    // Build summary text
    const summary = `Gebaseerd op uw financiële gegevens van de afgelopen 3 maanden: ` +
      `u heeft € ${totalIncome3m.toLocaleString('nl-NL')} verdiend, ` +
      `€ ${totalExpenses3m.toLocaleString('nl-NL')} uitgegeven, ` +
      `met een netto winst van € ${netProfit3m.toLocaleString('nl-NL')}. ` +
      (btwToPayEstimate > 0 
        ? `Uw geschatte BTW-verplichting is € ${btwToPayEstimate.toLocaleString('nl-NL')}. `
        : '') +
      `Hieronder vindt u persoonlijke adviezen voor uw financiële situatie.`;
    
    res.json({
      summary,
      tips,
      metrics
    });
    
  } catch (error) {
    console.error('Error in AI accountant:', error);
    sendError(res, 500, 'Kon analyse niet uitvoeren');
  }
});

export default router;
