/* מחשבון ריבית — חוברת 1, פרקים 1–2 */
(function () {
  const { h, fill, num, ok, money, plain, pct, ltr, field, select, segmented, tabs, result, formula, note, table } = UI;

  const FREQS = [
    [1, 'שנתית'], [2, 'חצי-שנתית'], [4, 'רבעונית'], [12, 'חודשית'], [52, 'שבועית'], [365, 'יומית'],
  ];
  const freqName = (m) => (FREQS.find(([v]) => v === m) || [, m + ' בשנה'])[1];

  /** כפתורי "טען דוגמה מהחוברת" */
  const presets = (items, apply) =>
    h('div', { class: 'presets' },
      h('span', {}, 'דוגמאות מהחוברת:'),
      items.map((p) => h('button', { type: 'button', class: 'link-btn', onclick: () => apply(p) }, p.name)));

  const layout = (inputs, output, cls = '') => h('div', { class: 'calc ' + cls }, h('div', { class: 'panel inputs' }, inputs), h('div', { class: 'panel outputs' }, output));

  // ---------------------------------------------------------------------------
  // 1. סכום חד-פעמי: FV / PV / r / n
  // ---------------------------------------------------------------------------
  function singleSum() {
    const out = h('div');
    let solveFor = 'fv';
    const f = {
      pv: field({ label: 'ערך נוכחי PV', suffix: '₪', value: '10,000', onInput: calc }),
      fv: field({ label: 'ערך עתידי FV', suffix: '₪', onInput: calc }),
      r: field({ label: 'ריבית לתקופה r', suffix: '%', value: '5', onInput: calc }),
      n: field({ label: 'מספר תקופות n', value: '5', onInput: calc }),
    };
    const seg = segmented({
      value: solveFor,
      options: [['fv', 'ערך עתידי'], ['pv', 'ערך נוכחי'], ['r', 'ריבית'], ['n', 'מספר תקופות']],
      onChange: (v) => { solveFor = v; calc(); },
    });

    function calc() {
      for (const [k, x] of Object.entries(f)) {
        x.input.disabled = k === solveFor;
        x.el.classList.toggle('solving', k === solveFor);
      }
      const pv = f.pv.value, fv = f.fv.value, r = f.r.value / 100, n = f.n.value;
      const parts = [];

      if (solveFor === 'fv' && ok(pv, r, n)) {
        const v = Fin.fv(pv, r, n);
        f.fv.set(money(v));
        parts.push(
          result('ערך עתידי (ריבית דריבית)', money(v) + ' ₪', ['מקדם צבירה ', ltr(`(1+r)^n = ${plain(Math.pow(1 + r, n), 6)}`)]),
          formula('FV = PV × (1 + r)^n', `FV = ${money(pv)} × (1 + ${plain(r, 6)})^${plain(n)} = ${money(v)}`),
          note('warn', 'מסיח נפוץ — ריבית פשוטה: ', ltr(`${money(pv)} × (1 + ${plain(r, 6)} × ${plain(n)}) = ${money(Fin.fvSimple(pv, r, n))}`)),
          growthTable(pv, r, n));
      } else if (solveFor === 'pv' && ok(fv, r, n)) {
        const v = Fin.pv(fv, r, n);
        f.pv.set(money(v));
        parts.push(
          result('ערך נוכחי', money(v) + ' ₪', ['מקדם היוון ', ltr(`1/(1+r)^n = ${plain(1 / Math.pow(1 + r, n), 6)}`)]),
          formula('PV = FV / (1 + r)^n', `PV = ${money(fv)} / (1 + ${plain(r, 6)})^${plain(n)} = ${money(v)}`),
          note('warn', 'מסיח נפוץ — היוון בריבית פשוטה: ', ltr(`${money(fv)} / (1 + ${plain(r, 6)} × ${plain(n)}) = ${money(Fin.pvSimple(fv, r, n))}`)),
          note('info', 'הנחה גלומה (ההפרש כאחוז מהסכום העתידי): ', ltr(pct(1 - v / fv, 2))));
      } else if (solveFor === 'r' && ok(pv, fv, n) && pv > 0 && fv > 0 && n > 0) {
        const v = Fin.rate(pv, fv, n);
        f.r.set((v * 100).toFixed(4));
        parts.push(
          result('ריבית לתקופה', pct(v), ['תשואה כוללת לכל התקופה ', ltr(pct(fv / pv - 1, 2))]),
          formula('r = (FV / PV)^(1/n) − 1', `r = (${money(fv)} / ${money(pv)})^(1/${plain(n)}) − 1 = ${pct(v)}`),
          note('warn', 'מסיח נפוץ — חלוקת התשואה הכוללת במספר התקופות (ריבית פשוטה): ', ltr(pct(Fin.rateSimple(pv, fv, n)))),
          note('info', 'זו גם "ריבית האדישות" בין קבלת PV היום לקבלת FV בעוד n תקופות.'));
      } else if (solveFor === 'n' && ok(pv, fv, r) && pv > 0 && fv > 0 && r > 0) {
        const v = Fin.periods(pv, fv, r);
        f.n.set(plain(v, 4));
        parts.push(
          result('מספר תקופות', plain(v, 4), ['אם התקופה היא שנה: ', ltr(String(Math.floor(v))), ' שנים ו-', ltr(plain((v % 1) * 12, 1)), ' חודשים']),
          formula('n = ln(FV / PV) / ln(1 + r)', `n = ln(${plain(fv / pv, 6)}) / ln(${plain(1 + r, 6)}) = ${plain(v, 4)}`),
          note('info', 'בדיקת סבירות — כלל 72 (זמן הכפלה): ', ltr(`72 / ${plain(r * 100, 4)} ≈ ${plain(0.72 / r, 2)}`), ' תקופות. מדויק: ', ltr(plain(Fin.periods(1, 2, r), 2))),
          note('warn', 'מסיח נפוץ — ריבית פשוטה: ', ltr(plain(Fin.periodsSimple(pv, fv, r), 4))));
      } else {
        parts.push(note('info', 'מלאו את שלושת השדות האחרים כדי לקבל תוצאה.'));
      }
      parts.push(note('muted', 'r ו-n חייבים להיות באותן יחידות זמן: ריבית שנתית עם שנים, ריבית חודשית עם חודשים. להמרה — לשונית "המרת ריביות".'));
      fill(out, ...parts);
    }

    function growthTable(pv, r, n) {
      if (!Number.isInteger(n) || n < 1 || n > 60) return null;
      const rows = [];
      let bal = pv;
      for (let t = 1; t <= n; t++) {
        const interest = bal * r;
        rows.push([t, money(bal), money(interest), money(bal + interest), money(Fin.fvSimple(pv, r, t))]);
        bal += interest;
      }
      return h('details', { class: 'more' }, h('summary', {}, 'טבלת צבירה לפי תקופה'),
        table(['תקופה', 'יתרת פתיחה', 'ריבית', 'יתרת סגירה', 'בריבית פשוטה'], rows));
    }

    const examples = presets([
      { name: 'דוגמה 1.2', solve: 'fv', pv: '50,000', r: '4', n: '8' },
      { name: 'דוגמה 1.4', solve: 'pv', fv: '1,000,000', r: '6', n: '20' },
      { name: 'דוגמה 1.6', solve: 'r', pv: '8,000', fv: '12,000', n: '6' },
      { name: 'דוגמה 1.8', solve: 'n', pv: '1', fv: '2', r: '7' },
    ], (p) => {
      solveFor = p.solve;
      seg.set(p.solve);
      for (const k of ['pv', 'fv', 'r', 'n']) f[k].set(p[k] ?? '');
      calc();
    });

    calc();
    return layout([h('div', { class: 'field-label' }, 'מה מחפשים?'), seg.el, f.pv.el, f.fv.el, f.r.el, f.n.el, examples], out);
  }

  // ---------------------------------------------------------------------------
  // 2. המרת ריביות: לתקופה / נקובה / אפקטיבית / רציפה / מראש
  // ---------------------------------------------------------------------------
  function conversion() {
    const out = h('div');
    const value = field({ label: 'ריבית', suffix: '%', value: '6', onInput: calc });
    const type = select({
      label: 'סוג הריבית',
      value: 'nominal',
      options: [
        ['nominal', 'שנתית נקובה (נומינלית)'],
        ['effective', 'שנתית אפקטיבית'],
        ['periodic', 'ריבית לתקופה'],
        ['advance', 'ריבית מראש (ניכיון) לתקופה'],
        ['continuous', 'שנתית רציפה'],
      ],
      onChange: calc,
    });
    const freq = select({ label: 'תדירות ההרכבה / התקופה', value: 12, options: FREQS.map(([v, t]) => [v, `${t} (m=${v})`]), onChange: calc });

    function calc() {
      const x = value.value / 100;
      const t = type.value;
      const m = Number(freq.value);
      freq.el.hidden = t === 'effective' || t === 'continuous';
      if (!ok(x)) return fill(out, note('info', 'הזינו ריבית.'));

      let eff;
      const steps = [];
      const warns = [];
      if (t === 'nominal') {
        const i = x / m;
        eff = Fin.effectiveFromPeriodic(i, m);
        steps.push(`i = r_nom / m = ${pct(x, 4)} / ${m} = ${pct(i, 6)}`, `r_eff = (1 + i)^m − 1 = (1 + ${plain(i, 8)})^${m} − 1 = ${pct(eff)}`);
        warns.push(['טעות נפוצה — הוצאת שורש מריבית נקובה: ', ltr(pct(Fin.periodicFromEffective(x, m), 6)), ' לתקופה (שגוי).']);
      } else if (t === 'effective') {
        eff = x;
        const i12 = Fin.periodicFromEffective(x, 12);
        steps.push(`i_month = (1 + r_eff)^(1/12) − 1 = ${plain(1 + x, 6)}^(1/12) − 1 = ${pct(i12, 6)}`);
        warns.push(['טעות נפוצה — חלוקה ב-12 של ריבית אפקטיבית: ', ltr(pct(x / 12, 6)), ' לחודש (שגוי; נכון ', ltr(pct(i12, 6)), ').']);
      } else if (t === 'periodic') {
        eff = Fin.effectiveFromPeriodic(x, m);
        steps.push(`r_eff = (1 + i)^m − 1 = (1 + ${plain(x, 8)})^${m} − 1 = ${pct(eff)}`, `r_nom = i × m = ${pct(x * m, 4)}`);
        warns.push(['טעות נפוצה — הכפלה במקום הרכבה: ', ltr(pct(x * m)), ' זו הריבית הנקובה, לא האפקטיבית.']);
      } else if (t === 'advance') {
        const i = Fin.effectiveFromDiscount(x);
        eff = Fin.effectiveFromPeriodic(i, m);
        steps.push(`i = d / (1 − d) = ${plain(x, 6)} / ${plain(1 - x, 6)} = ${pct(i, 6)}`, `r_eff = (1 + i)^m − 1 = ${pct(eff)}`);
        warns.push(['ריבית מראש תמיד "יקרה" מהנקוב. טעות נפוצה — ', ltr(`d / (1 + d) = ${pct(x / (1 + x))}`), ' (החישוב ההפוך).']);
      } else {
        eff = Fin.effectiveFromContinuous(x);
        steps.push(`r_eff = e^r − 1 = e^${plain(x, 6)} − 1 = ${pct(eff)}`);
      }

      const rows = FREQS.map(([mm]) => {
        const i = Fin.periodicFromEffective(eff, mm);
        return [freqName(mm), ltr(pct(i, 6)), ltr(pct(i * mm)), ltr(pct(Fin.effectiveFromPeriodic(i, mm)))];
      });
      rows.push(['רציפה', '—', ltr(pct(Fin.continuousFromEffective(eff))), ltr(pct(eff))]);

      // ריבית לתקופה "עגולה" שמסתתרת מאחורי אפקטיבית מוזרה (סעיף 2.3)
      const round = FREQS
        .map(([mm]) => [mm, Fin.periodicFromEffective(eff, mm)])
        .filter(([mm, i]) => mm !== 1 && Math.abs(i * 1e4 - Math.round(i * 1e4 / 5) * 5) < 0.02 && Math.round(i * 1e4) > 0);

      fill(out,
        result('ריבית שנתית אפקטיבית', pct(eff)),
        formula(...steps),
        round.length && t !== 'periodic' && t !== 'nominal'
          ? note('good', 'זיהוי מספר "עגול": ', round.map(([mm, i]) => [ltr(pct(i, 2)), ' ל' + (mm === 12 ? 'חודש' : mm === 4 ? 'רבעון' : mm === 2 ? 'חצי שנה' : 'תקופה') + '. ']))
          : null,
        ...warns.map((w) => note('warn', ...w)),
        h('h3', {}, 'אותה ריבית בכל התדירויות'),
        table(['תדירות', 'ריבית לתקופה', 'שנתית נקובה', 'שנתית אפקטיבית'], rows, {
          highlight: (idx) => (t === 'nominal' || t === 'periodic' || t === 'advance') && FREQS[idx] && FREQS[idx][0] === m,
        }),
        note('muted', 'להשוואה בין הצעות בתדירויות שונות משווים תמיד ריבית אפקטיבית שנתית, לא נקובה. ריבית ריאלית (ניכוי אינפלציה) היא מושג אחר — פרק 7.'));
    }

    const examples = presets([
      { name: '5.4% נקובה חודשית (2.1א)', v: '5.4', t: 'nominal', m: 12 },
      { name: '9% אפקטיבית (שאלה 2.2)', v: '9', t: 'effective' },
      { name: '1.5% לחודש (שאלה 2.6)', v: '1.5', t: 'periodic', m: 12 },
      { name: '8% מראש (שאלה 2.4)', v: '8', t: 'advance', m: 1 },
      { name: '7.397% אפקטיבית', v: '7.397', t: 'effective' },
    ], (p) => { value.set(p.v); type.set(p.t); if (p.m) freq.set(p.m); calc(); });

    calc();
    return layout([value.el, type.el, freq.el, examples], out);
  }

  // ---------------------------------------------------------------------------
  // 3. ריביות משתנות: מכפלת מקדמים, ממוצע גיאומטרי, היוון משיכות
  // ---------------------------------------------------------------------------
  function variableRates() {
    const out = h('div');
    const rowsEl = h('div', { class: 'rows' });
    const deposit = field({ label: 'הפקדה היום (לא חובה)', suffix: '₪', value: '20,000', onInput: calc });
    let rows = [{ r: '4', k: '1', c: '' }, { r: '5', k: '1', c: '' }, { r: '6', k: '1', c: '' }];

    function renderRows() {
      fill(rowsEl,
        h('div', { class: 'row row-head' }, h('span', {}, 'ריבית לתקופה %'), h('span', {}, 'מס׳ תקופות'), h('span', {}, 'תזרים בסוף כל תקופה ₪'), h('span')),
        rows.map((row, idx) => h('div', { class: 'row' },
          ['r', 'k', 'c'].map((key) => h('input', {
            type: 'text', inputmode: 'decimal', dir: 'ltr', value: row[key],
            'aria-label': { r: 'ריבית', k: 'מספר תקופות', c: 'תזרים' }[key],
            oninput: (e) => { row[key] = e.target.value; calc(); },
          })),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'מחק שורה', onclick: () => { rows.splice(idx, 1); renderRows(); calc(); } }, '✕'))),
        h('button', { type: 'button', class: 'link-btn', onclick: () => { rows.push({ r: '', k: '1', c: '' }); renderRows(); calc(); } }, '+ הוספת שורה'));
    }

    function calc() {
      // פריסת השורות לתקופות בודדות
      const rates = [], flows = [];
      for (const row of rows) {
        const r = num(row.r) / 100, k = num(row.k), c = num(row.c);
        if (!ok(r) || !Number.isInteger(k) || k < 1) continue;
        for (let j = 0; j < k; j++) { rates.push(r); flows.push(ok(c) ? c : 0); }
      }
      if (!rates.length) return fill(out, note('info', 'הזינו לפחות ריבית אחת.'));

      const factor = Fin.compoundFactor(rates);
      const geo = Fin.geometricMean(rates);
      const d = deposit.value;
      const hasFlows = flows.some((c) => c !== 0);
      const parts = [
        result('מקדם צבירה מצטבר', plain(factor, 6), ['על פני ', ltr(String(rates.length)), ' תקופות']),
        formula(`(1+r₁)(1+r₂)… = ${rates.map((r) => plain(1 + r, 6)).join(' × ')} = ${plain(factor, 6)}`),
      ];
      if (ok(d)) parts.push(result('ערך עתידי של ההפקדה', money(d * factor) + ' ₪'));
      parts.push(
        result('ריבית ממוצעת (גיאומטרית)', pct(geo), 'הריבית הקבועה שנותנת אותה תוצאה'),
        formula(`r̄ = (${plain(factor, 6)})^(1/${rates.length}) − 1 = ${pct(geo)}`),
        note('warn', 'מסיח נפוץ — ממוצע חשבוני: ', ltr(pct(Fin.arithmeticMean(rates))), '. וגם: סכום הריביות בריבית פשוטה ', ltr(pct(rates.reduce((s, r) => s + r, 0), 2)), '.'));

      if (hasFlows) {
        const pvFlows = Fin.pvVariable(flows, rates);
        let f = 1;
        const tbl = flows.map((c, t) => { f *= 1 + rates[t]; return [t + 1, ltr(pct(rates[t], 3)), ltr(plain(f, 6)), ltr(money(c)), ltr(money(c / f))]; });
        parts.push(
          result('ערך נוכחי של התזרים (כמה להפקיד היום)', money(pvFlows) + ' ₪'),
          note('warn', 'כל תקופה מהוונת בריבית שלה — מקדם ההיוון בתקופה t הוא מכפלת כל המקדמים עד t, ולא ', ltr('(1+r_t)^t'), '.'),
          table(['תקופה', 'ריבית', 'מקדם מצטבר', 'תזרים', 'ערך נוכחי'], tbl));
      }
      parts.push(note('muted', 'אם הריביות בתדירויות שונות (למשל 4% לשנה ואז 0.4% לחודש) — המירו קודם לאותה תקופה בלשונית "המרת ריביות", או הזינו שורה עם 12 תקופות חודשיות.'));
      fill(out, ...parts);
    }

    const examples = presets([
      { name: 'דוגמה 1.3', dep: '20,000', rows: [['4', '1', ''], ['5', '1', ''], ['6', '1', '']] },
      { name: 'שאלה 1.5', dep: '100,000', rows: [['3', '1', ''], ['4', '1', ''], ['5', '1', ''], ['6', '2', '']] },
      { name: 'דוגמה 1.9 (משיכות)', dep: '', rows: [['4', '1', '25,000'], ['5', '1', '25,000'], ['6', '1', '25,000']] },
    ], (p) => { deposit.set(p.dep); rows = p.rows.map(([r, k, c]) => ({ r, k, c })); renderRows(); calc(); });

    renderRows();
    calc();
    return layout([deposit.el, rowsEl, examples], out);
  }

  // ---------------------------------------------------------------------------
  // 4. תזרים מזומנים: ערך נוכחי / עתידי של כמה סכומים, הנחה גלומה
  // ---------------------------------------------------------------------------
  function cashFlows() {
    const out = h('div');
    const rowsEl = h('div', { class: 'rows' });
    const rate = field({ label: 'שיעור היוון לתקופה', suffix: '%', value: '7', onInput: calc });
    let rows = [{ t: '0', a: '1,000,000' }, { t: '3', a: '3,000,000' }];

    function renderRows() {
      fill(rowsEl,
        h('div', { class: 'row row-2 row-head' }, h('span', {}, 'מועד (תקופה)'), h('span', {}, 'סכום ₪'), h('span')),
        rows.map((row, idx) => h('div', { class: 'row row-2' },
          ['t', 'a'].map((key) => h('input', {
            type: 'text', inputmode: 'decimal', dir: 'ltr', value: row[key],
            'aria-label': key === 't' ? 'מועד' : 'סכום',
            oninput: (e) => { row[key] = e.target.value; calc(); },
          })),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'מחק שורה', onclick: () => { rows.splice(idx, 1); renderRows(); calc(); } }, '✕'))),
        h('button', { type: 'button', class: 'link-btn', onclick: () => { rows.push({ t: '', a: '' }); renderRows(); calc(); } }, '+ הוספת סכום'));
    }

    function calc() {
      const r = rate.value / 100;
      const flows = rows.map((x) => ({ t: num(x.t), amount: num(x.a) })).filter((x) => ok(x.t, x.amount));
      if (!ok(r) || !flows.length) return fill(out, note('info', 'הזינו שיעור היוון ולפחות סכום אחד.'));

      const pv = Fin.pvFlows(flows, r);
      const T = Math.max(...flows.map((x) => x.t));
      const fv = Fin.fvFlows(flows, r, T);
      const nominal = flows.reduce((s, x) => s + x.amount, 0);

      fill(out,
        result('ערך נוכחי של התזרים', money(pv) + ' ₪'),
        formula('PV = Σ C_t / (1 + r)^t',
          'PV = ' + flows.map((x) => `${money(x.amount, 0)}/${plain(1 + r, 6)}^${plain(x.t)}`).join(' + '),
          '   = ' + flows.map((x) => money(x.amount / Math.pow(1 + r, x.t))).join(' + ') + ` = ${money(pv)}`),
        result(`ערך עתידי במועד ${plain(T)}`, money(fv) + ' ₪'),
        h('div', { class: 'kv' },
          h('div', {}, 'סכום נומינלי (ללא היוון)'), h('div', {}, ltr(money(nominal) + ' ₪')),
          h('div', {}, 'הנחה כלכלית גלומה'), h('div', {}, ltr(money(nominal - pv) + ' ₪')),
          h('div', {}, 'כאחוז מהסכום הנומינלי'), h('div', {}, ltr(pct(1 - pv / nominal, 2)))),
        note('warn', 'שימו לב לשאלה: הנחה "מסך המחיר" מחושבת על כל הסכום, כולל מה שמשולם היום — לא רק על החלק הנדחה.'),
        note('muted', 'מועד 0 = היום. אפשר להזין מועדים לא שלמים (למשל 0.5 לחצי תקופה). תשלומים יוצאים — בסימן מינוס.'));
    }

    const examples = presets([
      { name: 'דוגמה 1.5 (דירה)', r: '4.8', rows: [['0', '800,000'], ['4', '3,200,000']] },
      { name: 'שאלה 1.7', r: '5', rows: [['2', '15,000'], ['4', '20,000']] },
      { name: 'שאלה 1.8 (מגרש)', r: '7', rows: [['0', '1,000,000'], ['3', '3,000,000']] },
    ], (p) => { rate.set(p.r); rows = p.rows.map(([t, a]) => ({ t, a })); renderRows(); calc(); });

    renderRows();
    calc();
    return layout([rate.el, rowsEl, examples], out);
  }

  // ---------------------------------------------------------------------------
  // 5. ריבית אמיתית של הלוואה (עמלות, מענקים, ריבית מראש) והשוואת הצעות
  // ---------------------------------------------------------------------------
  function loanOffers() {
    const out = h('div');
    const listEl = h('div', { class: 'offers' });
    const principal = field({ label: 'סכום ההלוואה', suffix: '₪', value: '100,000', onInput: calc });
    const blank = () => ({ rate: '', type: 'periodic', m: '12', years: '1', open: '', openUnit: '%', close: '', closeUnit: '₪', grant: '' });
    let offers = [];

    function renderOffers() {
      fill(listEl,
        offers.map((o, idx) => {
          const inp = (key, label, suffix) => h('label', { class: 'field' },
            h('span', { class: 'field-label' }, label),
            h('span', { class: 'field-control' },
              h('input', { type: 'text', inputmode: 'decimal', dir: 'ltr', value: o[key], oninput: (e) => { o[key] = e.target.value; calc(); } }),
              suffix && h('span', { class: 'field-suffix' }, suffix)));
          const sel = (key, label, options) => h('label', { class: 'field' },
            h('span', { class: 'field-label' }, label),
            h('span', { class: 'field-control' },
              h('select', { onchange: (e) => { o[key] = e.target.value; renderOffers(); calc(); } },
                options.map(([v, t]) => h('option', { value: v, selected: String(v) === String(o[key]) }, t)))));
          const unitToggle = (key) => h('button', {
            type: 'button', class: 'unit-btn', title: 'החלפת יחידה',
            onclick: () => { o[key] = o[key] === '%' ? '₪' : '%'; renderOffers(); calc(); },
          }, o[key]);

          return h('fieldset', { class: 'offer', 'data-idx': idx },
            h('legend', {}, 'הצעה ' + (idx + 1),
              offers.length > 1 && h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'מחק הצעה', onclick: () => { offers.splice(idx, 1); renderOffers(); calc(); } }, '✕')),
            h('div', { class: 'grid-2' },
              inp('rate', 'ריבית', '%'),
              sel('type', 'סוג', [['periodic', 'לתקופה'], ['nominal', 'שנתית נקובה'], ['effective', 'שנתית אפקטיבית'], ['advance', 'שנתית מראש']]),
              (o.type === 'periodic' || o.type === 'nominal') && sel('m', 'תדירות', FREQS.slice(0, 4).map(([v, t]) => [v, t])),
              inp('years', 'תקופה בשנים'),
              h('div', { class: 'field-with-unit' }, inp('open', 'עמלת פתיחה (מיד)'), unitToggle('openUnit')),
              h('div', { class: 'field-with-unit' }, inp('close', 'עמלת סגירה (בפירעון)'), unitToggle('closeUnit')),
              inp('grant', 'מענק ללווה בפירעון', '₪')));
        }),
        offers.length < 6 && h('button', { type: 'button', class: 'link-btn', onclick: () => { offers.push(blank()); renderOffers(); calc(); } }, '+ הוספת הצעה להשוואה'));
    }

    function calc() {
      const P = principal.value;
      const fee = (v, unit) => { const x = num(v); return !ok(x) ? 0 : unit === '%' ? (P * x) / 100 : x; };
      const results = offers.map((o) => {
        const x = num(o.rate) / 100, years = num(o.years), mSel = Number(o.m);
        if (!ok(P, x, years) || years <= 0) return null;
        let rate = x, m = 1, inAdvance = false;
        if (o.type === 'periodic') { m = mSel; }
        else if (o.type === 'nominal') { m = mSel; rate = x / mSel; }
        else if (o.type === 'advance') { inAdvance = true; }
        return Fin.loanTrueRate({ principal: P, rate, m, years, inAdvance, openFee: fee(o.open, o.openUnit), closeFee: fee(o.close, o.closeUnit), endGrant: num(o.grant) || 0 });
      });

      const valid = results.map((r, i) => [r, i]).filter(([r]) => r && ok(r.annualRate));
      if (!valid.length) return fill(out, note('info', 'מלאו סכום, ריבית ותקופה.'));
      const best = valid.reduce((a, b) => (b[0].annualRate < a[0].annualRate ? b : a));

      fill(out,
        valid.length > 1 && result('ההצעה הזולה ביותר', 'הצעה ' + (best[1] + 1), ['ריבית אפקטיבית שנתית ', ltr(pct(best[0].annualRate, 3))]),
        ...valid.map(([r, i]) => h('div', { class: 'offer-result' + (valid.length > 1 && i === best[1] ? ' best' : '') },
          h('h3', {}, 'הצעה ' + (i + 1)),
          h('div', { class: 'kv' },
            h('div', {}, 'מתקבל בפועל היום'), h('div', {}, ltr(money(r.received) + ' ₪')),
            h('div', {}, 'מוחזר בפועל בפירעון'), h('div', {}, ltr(money(r.repaid) + ' ₪')),
            h('div', {}, 'ריבית לכל התקופה'), h('div', {}, ltr(pct(r.termRate, 3))),
            h('div', {}, h('strong', {}, 'ריבית אפקטיבית שנתית')), h('div', {}, h('strong', {}, ltr(pct(r.annualRate, 3)))),
            h('div', {}, 'ללא עמלות ומענקים'), h('div', {}, ltr(pct(r.annualRateNoFees, 3)))),
          formula(`r_year = (${money(r.repaid, 0)} / ${money(r.received, 0)})^(1/${plain(num(offers[i].years))}) − 1 = ${pct(r.annualRate, 3)}`))),
        note('warn', 'משווים תזרימים, לא כותרות: עמלה בתחילת ההלוואה מקטינה את הסכום שמתקבל; עמלה בסוף מגדילה את ההחזר. בהלוואה ארוכה משנה — מוציאים שורש.'),
        note('muted', 'המחשבון מניח החזר חד-פעמי (קרן + ריבית) בתום התקופה. "שנתית מראש": הלווה מקבל את הקרן בניכוי הריבית בכל שנה ומחזיר את מלוא הקרן.'));
    }

    const load = (p) => { principal.set(p.P); offers = p.offers.map((o) => ({ ...blank(), ...o })); renderOffers(); calc(); };
    const examples = presets([
      { name: 'דוגמה 2.4', P: '100,000', offers: [
        { rate: '5', type: 'effective', open: '0.35', openUnit: '%' },
        { rate: '0.4', type: 'periodic', m: '12', close: '0.4', closeUnit: '%' },
        { rate: '5', type: 'advance' }] },
      { name: 'דוגמה 2.5', P: '100,000', offers: [
        { rate: '0.55', type: 'periodic', m: '12', years: '2', open: '1,100', openUnit: '₪' },
        { rate: '0.5', type: 'periodic', m: '12', years: '2', close: '1,500' },
        { rate: '1.7', type: 'periodic', m: '4', years: '2' }] },
      { name: 'דוגמה 2.6', P: '1,800,000', offers: [
        { rate: '3.6', type: 'nominal', m: '12', years: '2', open: '1.5', openUnit: '%', grant: '18,000' }] },
    ], load);

    load({ P: '100,000', offers: [{ rate: '0.4', type: 'periodic', m: '12', close: '400' }] });
    return layout([principal.el, listEl, examples], out, 'wide');
  }

  Portal.register({
    id: 'interest',
    group: 'finance',
    icon: '٪',
    title: 'מחשבון ריבית',
    description: 'ערך עתידי ונוכחי, חילוץ ריבית ותקופות, המרת ריבית נקובה/אפקטיבית, ריביות משתנות, תזרים וריבית אמיתית עם עמלות.',
    chapters: 'פרקים 1–2',
    render: () => tabs([
      { id: 'single', title: 'סכום חד-פעמי', render: singleSum },
      { id: 'convert', title: 'המרת ריביות', render: conversion },
      { id: 'variable', title: 'ריביות משתנות', render: variableRates },
      { id: 'flows', title: 'תזרים מזומנים', render: cashFlows },
      { id: 'loan', title: 'ריבית אמיתית (עמלות)', render: loanOffers },
    ]),
  });
})();
