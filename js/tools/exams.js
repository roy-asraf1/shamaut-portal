/* מועדי בחינות של מועצת שמאי המקרקעין: ספירה לאחור, לוח מועדים ועדכון ידני (מנהל) */
(function () {
  const { h, fill, note, table } = UI;

  const SOURCE = 'https://www.gov.il/he/pages/exam_date_2026';
  const REGISTER_URL = 'https://www.gov.il/he/service/exams_registeration_land_appraisal';
  const STALE_DAYS = 45; // אחרי כמה ימים בלי עדכון מזכירים לבדוק באתר המועצה

  const DAY = 24 * 60 * 60 * 1000;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const daysUntil = (date) => Math.round((new Date(date).setHours(0, 0, 0, 0) - today()) / DAY);
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const fmtTime = (d) => new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  function inDays(n) {
    if (n === 0) return 'היום';
    if (n === 1) return 'מחר';
    if (n < 0) return `לפני ${Math.abs(n)} ימים`;
    return `בעוד ${n} ימים`;
  }

  /** מה המצב: הרשמה פתוחה / נפתחה בעתיד / הכול עבר */
  function status(dates) {
    const upcoming = dates.filter((d) => d.exam_at && new Date(d.exam_at) >= today());
    if (!upcoming.length) return { kind: 'none' };
    const deadlines = upcoming.map((d) => d.apply_by).filter(Boolean).sort();
    const deadline = deadlines[0] || null;
    const left = deadline ? daysUntil(deadline) : null;
    return { kind: left === null ? 'exams' : left >= 0 ? 'open' : 'closed', deadline, next: upcoming[0], upcoming };
  }

  /** כרטיס המצב — מוצג גם בדף הבית */
  function summaryCard(dates, meta) {
    const st = status(dates);
    const checked = meta.exam_dates_checked_on;
    const staleDays = checked ? daysUntil(checked) * -1 : null;

    if (st.kind === 'none') {
      return h('div', { class: 'exam-banner alert' },
        h('div', { class: 'exam-banner-title' }, 'מועד הבחינות הבא טרם פורסם'),
        h('p', {},
          'כל המועדים שפורסמו כבר עברו. מועצת שמאי המקרקעין מפרסמת את ההודעה על המועד הבא בדרך כלל כשלושה חודשים מראש. ',
          checked ? `לוח המועדים כאן עודכן לאחרונה ב-${fmt(checked)}.` : ''),
        h('div', { class: 'row-actions' },
          h('a', { class: 'btn btn-primary', href: meta.exam_dates_source_url || SOURCE, target: '_blank', rel: 'noopener' }, 'בדיקה באתר המועצה'),
          h('a', { class: 'btn', href: '#/exams' }, 'לוח המועדים')));
    }

    const rows = [];
    if (st.kind === 'open') {
      rows.push(h('div', { class: 'exam-banner-title' }, `ההרשמה פתוחה — נסגרת ${inDays(daysUntil(st.deadline))}`),
        h('p', {}, `המועד האחרון להגשת בקשה להיבחן: ${fmt(st.deadline)}.`));
    } else if (st.kind === 'closed') {
      rows.push(h('div', { class: 'exam-banner-title' }, 'ההרשמה למועד הקרוב נסגרה'),
        h('p', {}, `המועד האחרון להגשה היה ${fmt(st.deadline)}.`));
    } else {
      rows.push(h('div', { class: 'exam-banner-title' }, 'מתקרבות בחינות'));
    }
    rows.push(h('p', {}, `הבחינה הקרובה: ${st.next.subject} — ${fmt(st.next.exam_at)} (${inDays(daysUntil(st.next.exam_at))}).`));

    return h('div', { class: 'exam-banner' + (st.kind === 'open' ? ' good' : '') },
      rows,
      staleDays !== null && staleDays > STALE_DAYS && note('warn', `לוח המועדים כאן לא עודכן ${staleDays} ימים — כדאי לוודא באתר המועצה.`),
      h('div', { class: 'row-actions' },
        st.kind === 'open' && h('a', { class: 'btn btn-primary', href: REGISTER_URL, target: '_blank', rel: 'noopener' }, 'למערכת ההרשמה'),
        h('a', { class: 'btn', href: '#/exams' }, 'לוח המועדים')));
  }

  // ---------------------------------------------------------------------------

  function render() {
    const root = h('div', { class: 'stack' }, h('div', { class: 'loading' }, 'טוען מועדים…'));

    Data.examDates().then(({ dates, meta }) => {
      const sessions = [...new Set(dates.map((d) => d.session))];
      const isAdmin = Portal.profile.role === 'admin';

      fill(root,
        summaryCard(dates, meta),
        meta.exam_dates_note && note('muted', meta.exam_dates_note),
        sessions.map((s) => {
          const rows = dates.filter((d) => d.session === s);
          const deadline = rows.map((r) => r.apply_by).filter(Boolean).sort()[0];
          return h('section', { class: 'panel stack' },
            h('div', { class: 'session-head' },
              h('h2', {}, s),
              deadline && h('div', { class: 'chip' + (daysUntil(deadline) >= 0 ? '' : ' chip-past') },
                `מועד אחרון להגשת בקשה: ${fmt(deadline)}`)),
            table(['בחינה', 'תאריך', 'שעה', 'מתי', 'תרגול'], rows.map((r) => [
              r.subject,
              fmt(r.exam_at),
              r.exam_at ? fmtTime(r.exam_at) : '—',
              h('span', { class: r.exam_at && daysUntil(r.exam_at) >= 0 ? 'score good' : 'muted' }, r.exam_at ? inDays(daysUntil(r.exam_at)) : '—'),
              r.booklet ? h('a', { href: `#/practice?booklet=${r.booklet}` }, `חוברת ${r.booklet}`) : '—',
            ])));
        }),
        h('div', { class: 'note note-muted' },
          'המקור הרשמי הוא אתר מועצת שמאי המקרקעין, ומועדים עשויים להשתנות. ',
          h('a', { href: meta.exam_dates_source_url || SOURCE, target: '_blank', rel: 'noopener' }, 'ההודעה הרשמית'),
          ' · ',
          h('a', { href: REGISTER_URL, target: '_blank', rel: 'noopener' }, 'מערכת ההרשמה'),
          meta.exam_dates_checked_on ? ` · עודכן כאן לאחרונה: ${fmt(meta.exam_dates_checked_on)}` : ''),
        isAdmin && editor(dates, meta, () => Data.examDates().then(() => location.reload())));
    }).catch((err) => fill(root, note('warn', err.message)));

    return root;
  }

  /** טופס למנהל: הוספת מועד, מחיקה, ועדכון תאריך הבדיקה האחרונה */
  function editor(dates, meta, reload) {
    const f = {};
    const field = (name, label, type = 'text', value = '') => {
      f[name] = h('input', { type, value });
      return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-control' }, f[name]));
    };
    const msg = h('div', { class: 'auth-error' });

    const add = async () => {
      const row = {
        session: f.session.value.trim(),
        subject: f.subject.value.trim(),
        exam_at: f.date.value ? `${f.date.value}T${f.time.value || '11:00'}:00+03:00` : null,
        apply_by: f.apply_by.value || null,
        booklet: f.booklet.value ? Number(f.booklet.value) : null,
        source_url: f.source.value.trim(),
        sort_order: dates.length,
      };
      if (!row.session || !row.subject || !row.exam_at) return (msg.textContent = 'צריך מועד (למשל "מועד ראשון 2027"), שם בחינה ותאריך.');
      row.id = `${row.session}|${row.subject}`.replace(/\s+/g, '-');
      msg.textContent = '';
      try {
        await Data.saveExamDate(row);
        await Data.saveMeta('exam_dates_checked_on', new Date().toISOString().slice(0, 10));
        reload();
      } catch (err) { msg.textContent = err.message; }
    };

    const markChecked = async () => {
      try { await Data.saveMeta('exam_dates_checked_on', new Date().toISOString().slice(0, 10)); reload(); }
      catch (err) { msg.textContent = err.message; }
    };

    return h('details', { class: 'panel admin-box' },
      h('summary', {}, 'ניהול מועדים (מנהל בלבד)'),
      h('p', { class: 'muted' }, 'אחרי שמתפרסמת הודעה חדשה באתר המועצה, מוסיפים כאן את המועדים. כל שורה = בחינה אחת.'),
      h('div', { class: 'grid-2' },
        field('session', 'מועד', 'text', dates.length ? dates[dates.length - 1].session : 'מועד ראשון 2027'),
        field('subject', 'שם הבחינה'),
        field('date', 'תאריך הבחינה', 'date'),
        field('time', 'שעה', 'time', '11:00'),
        field('apply_by', 'מועד אחרון להגשת בקשה', 'date'),
        field('booklet', 'מספר חוברת (לא חובה)', 'number'),
        field('source', 'קישור להודעה', 'url', meta.exam_dates_source_url || SOURCE)),
      msg,
      h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: add }, 'הוספת מועד'),
        h('button', { type: 'button', class: 'btn', onclick: markChecked }, 'סימון "נבדק היום"')),
      dates.length > 0 && h('details', { class: 'more' },
        h('summary', {}, 'מחיקת מועדים'),
        h('div', { class: 'rows' }, dates.map((d) => h('div', { class: 'row-actions' },
          h('span', {}, `${d.session} · ${d.subject} · ${fmt(d.exam_at)}`),
          h('button', {
            type: 'button', class: 'link-btn danger',
            onclick: async () => { if (confirm('למחוק את המועד?')) { await Data.deleteExamDate(d.id); reload(); } },
          }, 'מחיקה'))))));
  }

  Portal.register({
    id: 'exams',
    group: 'study',
    icon: '📅',
    title: 'מועדי בחינות',
    description: 'מועדי הבחינות של מועצת שמאי המקרקעין, המועד האחרון להגשת בקשה להיבחן, וספירה לאחור.',
    render,
    // כרטיס מצב שמוצג בראש דף הבית
    homeWidget: () => Data.examDates().then(({ dates, meta }) => summaryCard(dates, meta)),
  });
})();
