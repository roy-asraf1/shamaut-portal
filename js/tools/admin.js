/* ניהול משתמשים: אישור הרשמות, דחייה והרשאות מנהל */
(function () {
  const { h, fill, note, segmented } = UI;

  const STATUS = { pending: 'ממתין', approved: 'מאושר', rejected: 'נדחה' };

  function render() {
    const root = h('div', { class: 'stack' });
    const listEl = h('div');
    let users = [];
    let filter = 'pending';

    const filterSeg = segmented({
      value: filter,
      options: [['pending', 'ממתינים'], ['approved', 'מאושרים'], ['rejected', 'נדחו'], ['all', 'כולם']],
      onChange: (v) => { filter = v; renderList(); },
    });

    async function load() {
      fill(listEl, h('div', { class: 'loading' }, 'טוען משתמשים…'));
      try {
        users = await Data.profiles();
        renderList();
      } catch (err) {
        fill(listEl, note('warn', err.message));
      }
    }

    async function update(user, changes, button) {
      button.disabled = true;
      try {
        Object.assign(user, await Data.updateProfile(user.id, changes));
        renderList();
      } catch (err) {
        button.disabled = false;
        alert(err.message);
      }
    }

    function renderList() {
      const pendingCount = users.filter((u) => u.status === 'pending').length;
      const shown = users.filter((u) => filter === 'all' || u.status === filter);
      const me = Portal.profile.id;
      const date = (s) => new Date(s).toLocaleDateString('he-IL');

      fill(listEl,
        pendingCount > 0 && filter !== 'pending' && note('info', `${pendingCount} משתמשים ממתינים לאישור.`),
        !shown.length
          ? note('muted', filter === 'pending' ? 'אין הרשמות שממתינות לאישור.' : 'אין משתמשים להצגה.')
          : h('div', { class: 'table-wrap' }, h('table', { class: 'users' },
            h('thead', {}, h('tr', {}, ['שם', 'שם משתמש', 'מייל', 'נרשם', 'סטטוס', ''].map((x) => h('th', {}, x)))),
            h('tbody', {}, shown.map((u) => h('tr', {},
              h('td', {}, u.full_name, u.role === 'admin' && h('span', { class: 'chip chip-small' }, 'מנהל')),
              h('td', { dir: 'ltr' }, u.username),
              h('td', { dir: 'ltr' }, u.email),
              h('td', {}, date(u.created_at)),
              h('td', {}, h('span', { class: 'status status-' + u.status }, STATUS[u.status])),
              h('td', { class: 'actions' }, u.id === me ? h('span', { class: 'muted' }, 'את/ה') : [
                u.status !== 'approved' && h('button', { type: 'button', class: 'btn btn-small btn-primary', onclick: (e) => update(u, { status: 'approved' }, e.currentTarget) }, 'אישור'),
                u.status !== 'rejected' && h('button', { type: 'button', class: 'btn btn-small', onclick: (e) => update(u, { status: 'rejected', role: 'student' }, e.currentTarget) }, u.status === 'approved' ? 'חסימה' : 'דחייה'),
                u.status === 'approved' && h('button', { type: 'button', class: 'btn btn-small', onclick: (e) => update(u, { role: u.role === 'admin' ? 'student' : 'admin' }, e.currentTarget) },
                  u.role === 'admin' ? 'הסרת מנהל' : 'הפיכה למנהל'),
              ])))))));
    }

    fill(root, h('div', { class: 'row-actions spread' }, filterSeg.el, h('button', { type: 'button', class: 'btn', onclick: load }, 'רענון')), listEl);
    load();
    return root;
  }

  Portal.register({
    id: 'admin-users',
    group: 'admin',
    adminOnly: true,
    icon: '👥',
    title: 'ניהול משתמשים',
    description: 'אישור הרשמות חדשות, חסימת משתמשים ומתן הרשאות מנהל.',
    render,
  });
})();
