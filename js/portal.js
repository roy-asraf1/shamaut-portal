/*
 * מעטפת הפורטל: רישום כלים, תפריט צד וניתוב לפי hash (#/tool-id?param=value).
 * כלי חדש: קובץ ב-js/tools/ שקורא ל-Portal.register({...}) ותגית script ב-index.html.
 */
(function () {
  const { h, fill } = UI;

  // קבוצות בתפריט. קבוצת חוברת בלי כלים מוצגת כ"בקרוב".
  const GROUPS = [
    { id: 'study', title: 'לימוד ותרגול' },
    { id: 'finance', title: 'חוברת 1 · מימון' },
    { id: 'economics', title: 'חוברת 2 · כלכלה (מיקרו ומקרו)' },
    { id: 'urban', title: 'חוברת 3 · כלכלה עירונית' },
    { id: 'accounting', title: 'חוברת 4 · חשבונאות' },
    { id: 'survey', title: 'חוברת 5 · מדידה ומיפוי' },
    { id: 'engineering', title: 'חוברת 6 · הנדסת בניין' },
    { id: 'planning', title: 'חוברת 7 · תכנון עירוני' },
    { id: 'admin', title: 'ניהול', adminOnly: true },
  ];

  const tools = [];
  let profile = null;

  const isAdmin = () => profile.role === 'admin';
  const visibleGroups = () => GROUPS.filter((g) => !g.adminOnly || isAdmin());
  const visibleTools = () => tools.filter((t) => !t.adminOnly || isAdmin());

  const Portal = {
    /**
     * tool: { id, group, title, description, chapters?, icon, adminOnly?, render(params): HTMLElement }
     * params — פרמטרים מה-hash, למשל #/practice?booklet=1 → { booklet: '1' }
     */
    register(tool) { tools.push(tool); },

    start(userProfile) {
      profile = userProfile;
      document.getElementById('user-name').textContent = profile.full_name || profile.username;
      document.getElementById('logout').addEventListener('click', Auth.signOut);
      document.getElementById('menu-toggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
      window.addEventListener('hashchange', route);
      renderNav();
      route();
    },

    get profile() { return profile; },
  };

  function renderNav() {
    fill(document.getElementById('nav'),
      h('a', { href: '#/', 'data-id': '' }, 'דף הבית'),
      visibleGroups().map((g) => {
        const groupTools = visibleTools().filter((t) => t.group === g.id);
        return h('div', { class: 'nav-group' + (groupTools.length ? '' : ' muted') },
          h('div', { class: 'nav-group-title' }, g.title),
          groupTools.length
            ? groupTools.map((t) => h('a', { href: '#/' + t.id, 'data-id': t.id }, t.icon + ' ' + t.title))
            : h('div', { class: 'nav-soon' }, 'בקרוב'));
      }));
  }

  function route() {
    const [id, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const tool = visibleTools().find((t) => t.id === id);
    const main = document.getElementById('main');
    document.body.classList.remove('nav-open');
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('current', a.dataset.id === (tool ? tool.id : '')));

    if (!tool) {
      document.title = 'פורטל שמאי מקרקעין';
      fill(main, renderHome());
    } else {
      document.title = tool.title + ' · פורטל שמאי מקרקעין';
      fill(main,
        h('header', { class: 'tool-header' },
          h('h1', {}, tool.title),
          h('p', {}, tool.description),
          tool.chapters && h('div', { class: 'chip' }, tool.chapters)),
        tool.render(Object.fromEntries(new URLSearchParams(query))));
    }
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function renderHome() {
    const card = (t) => h('a', { class: 'card', href: '#/' + t.id },
      h('div', { class: 'card-icon' }, t.icon),
      h('div', {},
        h('div', { class: 'card-title' }, t.title),
        h('div', { class: 'card-desc' }, t.description),
        t.chapters && h('div', { class: 'chip' }, t.chapters)));

    return h('div', { class: 'home' },
      h('header', { class: 'tool-header' },
        h('h1', {}, `שלום ${profile.full_name || profile.username}`),
        h('p', {}, 'חוברות לימוד, תרגול שאלות בסגנון הבחינה וכלי חישוב לבחינות המוקדמות של מועצת שמאי המקרקעין.')),
      visibleGroups().map((g) => {
        const groupTools = visibleTools().filter((t) => t.group === g.id);
        return groupTools.length > 0 && h('section', { class: 'home-section' },
          h('h2', {}, g.title),
          h('div', { class: 'cards' }, groupTools.map(card)));
      }));
  }

  window.Portal = Portal;
})();
