/**
 * Currency and BTW calculation utilities
 * All monetary values are rounded to 2 decimal places
 */

// BTW rate for Netherlands (21%)
const BTW_RATE = 0.21;

/**
 * Round a monetary value to 2 decimal places
 * @param {number} value - The value to round
 * @returns {number} - Rounded value
 */
function roundMoney(value) {
  return Number(value.toFixed(2));
}

/**
 * Calculate line total from quantity and unit price
 * @param {number} quantity - Quantity of items
 * @param {number} unitPrice - Price per unit
 * @returns {number} - Line total rounded to 2 decimals
 */
export function calcLineTotal(quantity, unitPrice) {
  return roundMoney(quantity * unitPrice);
}

/**
 * Calculate BTW amount (21% default)
 * @param {number} amount - Amount to calculate BTW on
 * @param {number} rate - Optional BTW rate (defaults to 0.21)
 * @returns {number} - BTW amount rounded to 2 decimals
 */
export function calcBTW(amount, rate = BTW_RATE) {
  return roundMoney(amount * rate);
}

/**
 * Calculate totals from an array of line items
 * @param {Array} lines - Array of objects with quantity and unitPrice properties
 * @returns {Object} - Object with subtotal, btw, and total
 */
export function calcTotals(lines, rate = BTW_RATE) {
  const subtotal = lines.reduce((sum, line) => {
    return sum + calcLineTotal(line.quantity, line.unitPrice);
  }, 0);
  
  const btw = calcBTW(subtotal, rate);
  const total = roundMoney(subtotal + btw);
  
  return {
    subtotal: roundMoney(subtotal),
    btw,
    total
  };
}
