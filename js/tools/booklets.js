/* חוברות הלימוד: קריאת ה-PDF ומעבר לתרגול לפי פרק */
(function () {
  const { h, fill, note } = UI;

  function render() {
    const root = h('div', { class: 'stack' }, h('div', { class: 'loading' }, 'טוען חוברות…'));

    Data.booklets().then((booklets) => {
      if (!booklets.length) return fill(root, note('info', 'עדיין לא הועלו חוברות.'));
      fill(root, h('div', { class: 'booklets' }, booklets.map((b) => {
        const total = b.chapters.reduce((s, c) => s + c.questionCount, 0);
        return h('article', { class: 'panel booklet' },
          h('div', { class: 'booklet-head' },
            h('div', { class: 'booklet-num' }, b.number),
            h('div', {},
              h('h2', {}, b.title),
              h('div', { class: 'muted' }, `${b.chapters.length} פרקים · ${total} שאלות תרגול`))),
          h('div', { class: 'booklet-actions' },
            b.file_path && h('button', { type: 'button', class: 'btn btn-primary', onclick: (e) => openPdf(e.currentTarget, b.file_path) }, 'קריאת החוברת'),
            h('a', { class: 'btn', href: `#/practice?booklet=${b.number}` }, 'תרגול שאלות')),
          h('details', { class: 'more' },
            h('summary', {}, 'פרקים'),
            h('ol', { class: 'chapter-list' }, b.chapters.map((c) => h('li', { value: c.number },
              h('span', {}, c.title),
              c.questionCount > 0 && h('a', { href: `#/practice?booklet=${b.number}&chapter=${c.number}` }, `תרגול (${c.questionCount})`))))));
      })));
    }).catch((err) => fill(root, note('warn', err.message)));

    return root;
  }

  async function openPdf(button, path) {
    // חלון נפתח מיד (בתוך הלחיצה) כדי שדפדפנים לא יחסמו אותו כחלון קופץ
    const win = window.open('', '_blank');
    button.disabled = true;
    try {
      const url = await Data.bookletUrl(path);
      if (win) win.location = url;
      else location.href = url;
    } catch (err) {
      if (win) win.close();
      alert(err.message);
    } finally {
      button.disabled = false;
    }
  }

  Portal.register({
    id: 'booklets',
    group: 'study',
    icon: '📘',
    title: 'חוברות לימוד',
    description: 'שש חוברות הלימוד לבחינות המוקדמות: תיאוריה, דוגמאות פתורות ומבחנים מסכמים.',
    render,
  });
})();
