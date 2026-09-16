/* עזרי ממשק משותפים לכל הכלים: יצירת אלמנטים, פרסור ועיצוב מספרים, שדות קלט */
(function () {
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    return append(el, children);
  }

  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  /** החלפת תוכן אלמנט; מקבל מערכים מקוננים ומדלג על null/false */
  const fill = (el, ...children) => { el.replaceChildren(); return append(el, children); };

  /** "1,800,000" / "5.4%" / "₪ 300" → מספר; ריק או לא תקין → NaN */
  function num(value) {
    const s = String(value ?? '').replace(/[,\s₪%]/g, '');
    return s === '' ? NaN : Number(s);
  }

  const ok = (...xs) => xs.every((x) => Number.isFinite(x));

  function money(x, digits = 2) {
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function plain(x, digits = 4) {
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('en-US', { maximumFractionDigits: digits });
  }

  function pct(x, digits = 4) {
    if (!Number.isFinite(x)) return '—';
    return (x * 100).toFixed(digits) + '%';
  }

  /** קטע מספרי/נוסחה שנשאר משמאל לימין בתוך טקסט עברי */
  const ltr = (text, cls) => h('bdi', { class: 'ltr' + (cls ? ' ' + cls : ''), dir: 'ltr' }, text);

  // רצף "מתמטי" בלי אותיות עבריות: מספרים, אותיות לטיניות ואופרטורים
  const MATH_RUN = /[A-Za-z0-9([{√∑Δ][A-Za-z0-9\s.,=+\-−–×÷/^()[\]{}%√∑Δ·²³_*<>≈≤≥'|:]*[A-Za-z0-9)\]}%²³']/g;

  /** טקסט עברי רב-שורות שבו נוסחאות ומספרים מוצגים משמאל לימין */
  function richText(text) {
    return String(text).split('\n').map((line) => {
      const parts = [];
      let last = 0;
      for (const m of line.matchAll(MATH_RUN)) {
        if (!/[A-Za-z=+×÷^√∑]/.test(m[0])) continue; // מספר רגיל — הדפדפן מסתדר לבד
        parts.push(line.slice(last, m.index), ltr(m[0]));
        last = m.index + m[0].length;
      }
      parts.push(line.slice(last));
      return h('div', { class: 'rich-line' }, parts);
    });
  }

  /** שדה קלט מספרי עם תווית ויחידה */
  function field({ label, value = '', suffix, hint, onInput, placeholder }) {
    const input = h('input', { type: 'text', inputmode: 'decimal', dir: 'ltr', value, placeholder, oninput: onInput });
    const el = h('label', { class: 'field' },
      h('span', { class: 'field-label' }, label),
      h('span', { class: 'field-control' }, input, suffix && h('span', { class: 'field-suffix' }, suffix)),
      hint && h('span', { class: 'field-hint' }, hint));
    return { el, input, get value() { return num(input.value); }, set(v) { input.value = v; } };
  }

  function select({ label, options, value, onChange }) {
    const sel = h('select', { onchange: onChange },
      options.map(([v, text]) => h('option', { value: v, selected: String(v) === String(value) }, text)));
    const el = h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-control' }, sel));
    return { el, input: sel, get value() { return sel.value; }, set(v) { sel.value = v; } };
  }

  /** קבוצת כפתורי בחירה (segmented control) */
  function segmented({ options, value, onChange }) {
    const el = h('div', { class: 'segmented', role: 'radiogroup' });
    const api = { el, value, set(v) { api.value = v; render(); } };
    const render = () => {
      el.replaceChildren(...options.map(([v, text]) =>
        h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(v === api.value),
          class: v === api.value ? 'active' : '',
          onclick: () => { api.value = v; render(); onChange(v); },
        }, text)));
    };
    render();
    return api;
  }

  /** לשוניות בתוך כלי */
  function tabs(items) {
    const bar = h('div', { class: 'tabs', role: 'tablist' });
    const body = h('div', { class: 'tab-body' });
    const built = new Map();
    const show = (id) => {
      bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
      if (!built.has(id)) built.set(id, items.find((t) => t.id === id).render());
      body.replaceChildren(built.get(id));
    };
    items.forEach((t) => bar.append(h('button', { type: 'button', role: 'tab', 'data-id': t.id, onclick: () => show(t.id) }, t.title)));
    show(items[0].id);
    return h('div', { class: 'tabs-wrap' }, bar, body);
  }

  /** תוצאה מרכזית */
  const result = (label, value, sub) =>
    h('div', { class: 'result' }, h('div', { class: 'result-label' }, label), h('div', { class: 'result-value' }, ltr(value)), sub && h('div', { class: 'result-sub' }, sub));

  /** שורת נוסחה עם הצבה */
  const formula = (...lines) => h('div', { class: 'formula', dir: 'ltr' }, lines.map((l) => h('div', {}, l)));

  const note = (kind, ...children) => h('div', { class: 'note note-' + kind }, children);

  function table(headers, rows, { highlight } = {}) {
    return h('div', { class: 'table-wrap' },
      h('table', {},
        h('thead', {}, h('tr', {}, headers.map((x) => h('th', {}, x)))),
        h('tbody', {}, rows.map((r, i) => h('tr', { class: highlight && highlight(i) ? 'hl' : '' }, r.map((c) => h('td', {}, c)))))));
  }

  window.UI = { h, fill, num, ok, money, plain, pct, ltr, richText, field, select, segmented, tabs, result, formula, note, table };
})();
