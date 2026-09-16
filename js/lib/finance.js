/*
 * פונקציות מימון טהורות (ללא DOM). כל הריביות בשבר עשרוני: 5% = 0.05.
 * נטען בדפדפן כ-window.Fin, וב-Node דרך require לצורך בדיקות.
 */
(function (root) {
  const pow = Math.pow;

  const Fin = {
    // ---- פרק 1: סכום חד-פעמי, ריבית דריבית ----
    fv: (pv, r, n) => pv * pow(1 + r, n),
    pv: (fv, r, n) => fv / pow(1 + r, n),
    rate: (pv, fv, n) => pow(fv / pv, 1 / n) - 1,
    periods: (pv, fv, r) => Math.log(fv / pv) / Math.log(1 + r),

    // ---- ריבית פשוטה (לבדיקת מסיחים) ----
    fvSimple: (pv, r, n) => pv * (1 + r * n),
    pvSimple: (fv, r, n) => fv / (1 + r * n),
    rateSimple: (pv, fv, n) => (fv / pv - 1) / n,
    periodsSimple: (pv, fv, r) => (fv / pv - 1) / r,

    // ---- הרכבה רציפה ----
    fvContinuous: (pv, r, t) => pv * Math.exp(r * t),

    // ---- פרק 2: המרות ריבית. m = מספר תקופות בשנה ----
    periodicFromNominal: (nominal, m) => nominal / m,
    nominalFromPeriodic: (i, m) => i * m,
    effectiveFromPeriodic: (i, m) => pow(1 + i, m) - 1,
    periodicFromEffective: (eff, m) => pow(1 + eff, 1 / m) - 1,
    effectiveFromContinuous: (r) => Math.exp(r) - 1,
    continuousFromEffective: (eff) => Math.log(1 + eff),

    // ריבית מראש (ניכיון) d → ריבית אפקטיבית לתקופה, ולהפך
    effectiveFromDiscount: (d) => d / (1 - d),
    discountFromEffective: (i) => i / (1 + i),

    // ---- ריביות משתנות ----
    compoundFactor: (rates) => rates.reduce((f, r) => f * (1 + r), 1),
    geometricMean: (rates) => pow(Fin.compoundFactor(rates), 1 / rates.length) - 1,
    arithmeticMean: (rates) => rates.reduce((s, r) => s + r, 0) / rates.length,

    /** ערך נוכחי של תזרים סכומים בסוף תקופות בריביות משתנות. flows[k] בסוף תקופה k+1, rates[k] לתקופה k+1 */
    pvVariable(flows, rates) {
      let factor = 1;
      let total = 0;
      flows.forEach((amount, k) => {
        factor *= 1 + rates[k];
        total += (amount || 0) / factor;
      });
      return total;
    },

    // ---- תזרים מזומנים: [{t, amount}] ----
    pvFlows: (flows, r) => flows.reduce((s, f) => s + f.amount / pow(1 + r, f.t), 0),
    fvFlows: (flows, r, T) => flows.reduce((s, f) => s + f.amount * pow(1 + r, T - f.t), 0),

    /**
     * ריבית אפקטיבית "אמיתית" של הלוואה בהחזר חד-פעמי, כולל עמלות ומענקים (סעיף 2.6).
     * rate — ריבית לתקופה (שבר), m — תקופות בשנה, years — אורך ההלוואה בשנים.
     * inAdvance — הריבית היא שיעור ניכיון שנתי המשולם מראש.
     */
    loanTrueRate({ principal, rate, m = 1, years = 1, inAdvance = false, openFee = 0, closeFee = 0, endGrant = 0 }) {
      let received, repaid;
      if (inAdvance) {
        received = principal * pow(1 - rate, years) - openFee;
        repaid = principal + closeFee - endGrant;
      } else {
        received = principal - openFee;
        repaid = principal * pow(1 + rate, m * years) + closeFee - endGrant;
      }
      const termFactor = repaid / received;
      return {
        received,
        repaid,
        termRate: termFactor - 1,
        annualRate: pow(termFactor, 1 / years) - 1,
        annualRateNoFees: inAdvance ? Fin.effectiveFromDiscount(rate) : pow(1 + rate, m) - 1,
      };
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Fin;
  else root.Fin = Fin;
})(this);
