/* תרגול שאלות רב-ברירה מהחוברות, עם שמירת התקדמות אישית */
(function () {
  const { h, fill, note, select, segmented, table, richText } = UI;
  const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

  function render(params) {
    const root = h('div', { class: 'stack' }, h('div', { class: 'loading' }, 'טוען…'));
    Data.booklets()
      .then((booklets) => {
        if (!booklets.length) return fill(root, note('info', 'עדיין לא הועלו שאלות.'));
        setup(root, booklets, params);
      })
      .catch((err) => fill(root, note('warn', err.message)));
    return root;
  }

  function setup(root, booklets, params) {
    const state = {
      booklet: Number(params.booklet) || booklets[0].number,
      chapter: params.chapter || 'all',
      filter: 'all',
      random: false,
      questions: [],
      last: new Map(),
    };

    const statsEl = h('div', { class: 'stack' });
    const sessionEl = h('div');
    const controls = h('div', { class: 'panel practice-controls' });

    const currentBooklet = () => booklets.find((b) => b.number === state.booklet);

    function renderControls() {
      const b = currentBooklet();
      const bookletSel = select({
        label: 'חוברת', value: state.booklet,
        options: booklets.map((x) => [x.number, `${x.number}. ${x.title}`]),
        onChange: () => { state.booklet = Number(bookletSel.value); state.chapter = 'all'; load(); },
      });
      const chapterSel = select({
        label: 'פרק', value: state.chapter,
        options: [['all', 'כל הפרקים'], ...b.chapters.filter((c) => c.questionCount).map((c) => [c.number, `${c.number}. ${c.title} (${c.questionCount})`])],
        onChange: () => { state.chapter = chapterSel.value; renderControls(); },
      });
      const filterSeg = segmented({
        value: state.filter,
        options: [['all', 'כל השאלות'], ['unanswered', 'שלא עניתי'], ['wrong', 'שטעיתי']],
        onChange: (v) => { state.filter = v; renderControls(); },
      });
      const pool = selection();
      fill(controls,
        h('div', { class: 'grid-2' }, bookletSel.el, chapterSel.el),
        h('div', { class: 'field-label' }, 'אילו שאלות'), filterSeg.el,
        h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: state.random, onchange: (e) => { state.random = e.target.checked; } }),
          'סדר אקראי'),
        h('div', { class: 'row-actions' },
          h('button', { type: 'button', class: 'btn btn-primary', disabled: !pool.length, onclick: start },
            pool.length ? `התחלת תרגול (${pool.length} שאלות)` : 'אין שאלות מתאימות')));
    }

    function selection() {
      return state.questions.filter((q) =>
        (state.chapter === 'all' || q.chapter === Number(state.chapter)) &&
        (state.filter === 'all' ||
          (state.filter === 'unanswered' && !state.last.has(q.id)) ||
          (state.filter === 'wrong' && state.last.get(q.id) === false)));
    }

    function renderStats() {
      const b = currentBooklet();
      const rows = b.chapters.filter((c) => c.questionCount).map((c) => {
        const qs = state.questions.filter((q) => q.chapter === c.number);
        const answered = qs.filter((q) => state.last.has(q.id)).length;
        const correct = qs.filter((q) => state.last.get(q.id) === true).length;
        return [
          h('a', { href: '#', onclick: (e) => { e.preventDefault(); state.chapter = String(c.number); renderControls(); controls.scrollIntoView({ behavior: 'smooth' }); } },
            `${c.number}. ${c.title}`, c.kind === 'exam' ? ' 📝' : ''),
          `${answered} / ${qs.length}`,
          answered ? h('span', { class: 'score ' + scoreClass(correct / answered) }, Math.round((100 * correct) / answered) + '%') : '—',
        ];
      });
      const total = state.questions.length;
      const answered = state.questions.filter((q) => state.last.has(q.id)).length;
      const correct = state.questions.filter((q) => state.last.get(q.id) === true).length;

      fill(statsEl,
        h('div', { class: 'stat-row' },
          stat('נענו', `${answered} / ${total}`),
          stat('תשובות נכונות', answered ? Math.round((100 * correct) / answered) + '%' : '—'),
          stat('לחזרה (טעויות)', String(answered - correct))),
        h('details', { class: 'more' },
          h('summary', {}, 'התקדמות לפי פרק'),
          table(['פרק', 'נענו', 'הצלחה'], rows),
          answered > 0 && h('button', { type: 'button', class: 'link-btn danger', onclick: resetProgress }, 'איפוס ההתקדמות בחוברת הזו')));
    }

    async function resetProgress() {
      if (!confirm('למחוק את כל התשובות שלך בחוברת הזו?')) return;
      try { await Data.resetAttempts(state.booklet); await load(); } catch (err) { alert(err.message); }
    }

    async function load() {
      fill(sessionEl);
      fill(statsEl, h('div', { class: 'loading' }, 'טוען שאלות…'));
      try {
        [state.questions, state.last] = await Promise.all([Data.questions(state.booklet), Data.lastAttempts(state.booklet)]);
      } catch (err) {
        return fill(statsEl, note('warn', err.message));
      }
      renderControls();
      renderStats();
    }

    function start() {
      let pool = selection();
      if (state.random) pool = shuffle(pool.slice());
      controls.hidden = true;
      statsEl.hidden = true;
      runSession(sessionEl, pool, currentBooklet(), state.last, () => {
        controls.hidden = false;
        statsEl.hidden = false;
        fill(sessionEl);
        renderControls();
        renderStats();
      });
    }

    fill(root, statsEl, controls, sessionEl);
    load();
  }

  /** סבב תרגול: שאלה אחר שאלה, משוב מיידי והסבר */
  function runSession(el, pool, booklet, last, onExit) {
    let index = 0;
    let answeredCount = 0;
    let correctCount = 0;
    const wrongIds = [];

    function show() {
      if (index >= pool.length) return summary();
      const q = pool[index];
      const chapter = booklet.chapters.find((c) => c.number === q.chapter);
      const feedback = h('div', { class: 'stack' });
      const nextBtn = h('button', { type: 'button', class: 'btn btn-primary', hidden: true, onclick: () => { index++; show(); } },
        index + 1 < pool.length ? 'לשאלה הבאה' : 'לסיכום');

      const optionButtons = q.options.map((text, i) => h('button', {
        type: 'button', class: 'option',
        onclick: () => answer(i),
      }, h('span', { class: 'option-letter' }, LETTERS[i]), h('span', { class: 'option-text' }, richText(text))));

      async function answer(i) {
        optionButtons.forEach((b) => { b.disabled = true; });
        const isCorrect = i === q.correct;
        answeredCount++;
        optionButtons[q.correct].classList.add('correct');
        if (!isCorrect) optionButtons[i].classList.add('wrong');
        if (isCorrect) correctCount++; else wrongIds.push(q.id);
        last.set(q.id, isCorrect);

        fill(feedback,
          note(isCorrect ? 'good' : 'warn', isCorrect ? 'נכון!' : `לא נכון. התשובה הנכונה: (${LETTERS[q.correct]})`),
          q.explanation && h('div', { class: 'explanation' }, h('div', { class: 'field-label' }, 'הסבר'), h('div', {}, richText(q.explanation))));
        nextBtn.hidden = false;
        nextBtn.focus();

        try { await Data.recordAttempt(q.id, i); } catch (err) { feedback.append(note('muted', 'התשובה לא נשמרה: ' + err.message)); }
      }

      fill(el, h('div', { class: 'panel question' },
        h('div', { class: 'question-top' },
          h('span', { class: 'muted' }, `שאלה ${index + 1} מתוך ${pool.length}`),
          h('button', { type: 'button', class: 'link-btn', onclick: summary }, 'סיום התרגול')),
        h('div', { class: 'progress' }, h('div', { style: `width:${(100 * index) / pool.length}%` })),
        h('div', { class: 'chip' }, `חוברת ${booklet.number} · ${chapter ? chapter.title : 'פרק ' + q.chapter} · שאלה ${q.number}`),
        q.needs_review && note('muted', 'ייתכן שחסר בשאלה איור או נוסחה — אם משהו לא ברור, בדקו בחוברת.'),
        h('div', { class: 'question-text' }, richText(q.text)),
        h('div', { class: 'options' }, optionButtons),
        feedback,
        h('div', { class: 'row-actions' }, nextBtn)));
      el.scrollIntoView({ block: 'start' });
    }

    function summary() {
      const answered = answeredCount;
      fill(el, h('div', { class: 'panel stack' },
        h('h2', {}, 'סיכום התרגול'),
        h('div', { class: 'stat-row' },
          stat('נענו', `${answered} / ${pool.length}`),
          stat('נכונות', String(correctCount)),
          stat('הצלחה', answered ? Math.round((100 * correctCount) / answered) + '%' : '—')),
        h('div', { class: 'row-actions' },
          wrongIds.length > 0 && h('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
            const again = pool.filter((q) => wrongIds.includes(q.id));
            runSession(el, again, booklet, last, onExit);
          } }, `תרגול חוזר של ${wrongIds.length} הטעויות`),
          h('button', { type: 'button', class: 'btn', onclick: onExit }, 'חזרה לבחירת שאלות'))));
    }

    show();
  }

  const stat = (label, value) => h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-label' }, label));
  const scoreClass = (ratio) => (ratio >= 0.8 ? 'good' : ratio >= 0.6 ? 'mid' : 'low');

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  Portal.register({
    id: 'practice',
    group: 'study',
    icon: '✍️',
    title: 'תרגול שאלות',
    description: 'שאלות רב-ברירה בסגנון הבחינה מכל החוברות, עם הסבר מלא לכל תשובה ומעקב אחרי ההתקדמות שלך.',
    render,
  });
})();
