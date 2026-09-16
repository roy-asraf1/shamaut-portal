/*
 * הזדהות: כניסה עם שם משתמש, הרשמה, שחזור סיסמה, והמתנה לאישור מנהל.
 * הפורטל עצמו נטען רק למשתמש מאושר (Auth.init(onApproved)).
 */
(function () {
  const { h, fill } = UI;
  const cfg = window.PORTAL_CONFIG || {};
  const client = cfg.supabaseUrl && cfg.supabaseKey
    ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey)
    : null;

  const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,30}$/u;
  const MIN_PASSWORD = 8;

  let onApproved = () => {};
  let recovering = false;

  const Auth = {
    client,
    profile: null,

    async init(callback) {
      onApproved = callback;
      if (!client) return screen(configMissing());

      client.auth.onAuthStateChange((event) => {
        // קישור שחזור סיסמה מהמייל
        if (event === 'PASSWORD_RECOVERY') {
          recovering = true;
          setTimeout(() => screen(resetPassword()), 0);
        }
      });

      const { data } = await client.auth.getSession();
      if (recovering) return;
      if (data.session) await enter(data.session.user);
      else screen(login());
    },

    async signOut() {
      await client.auth.signOut();
      location.hash = '';
      location.reload();
    },
  };

  // ---------------------------------------------------------------------------

  async function enter(user) {
    const { data: profile, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error || !profile) return screen(message('לא הצלחנו לטעון את החשבון', 'נסו להתחבר מחדש.', true));
    Auth.profile = profile;

    if (profile.status === 'pending') return screen(pending(profile));
    if (profile.status === 'rejected') return screen(message('הבקשה לא אושרה', 'החשבון לא אושר לכניסה לפורטל. לפרטים פנו למנהל הפורטל.', true));

    document.getElementById('auth').hidden = true;
    document.getElementById('app').hidden = false;
    onApproved(profile);
  }

  function screen(content) {
    const root = document.getElementById('auth');
    document.getElementById('app').hidden = true;
    root.hidden = false;
    fill(root, h('div', { class: 'auth-card' },
      h('div', { class: 'auth-brand' }, 'פורטל שמאי מקרקעין'),
      content));
    const first = root.querySelector('input');
    if (first) first.focus();
  }

  /** טופס עם שדות, כפתור שליחה והודעת שגיאה */
  function form({ title, subtitle, fields, submit, onSubmit, footer }) {
    const err = h('div', { class: 'auth-error', role: 'alert' });
    const btn = h('button', { type: 'submit', class: 'btn btn-primary' }, submit);
    const inputs = {};
    const el = h('form', { class: 'auth-form', novalidate: true },
      h('h1', {}, title),
      subtitle && h('p', { class: 'auth-sub' }, subtitle),
      fields.map((f) => {
        const input = h('input', { name: f.name, type: f.type || 'text', autocomplete: f.autocomplete, dir: f.dir, required: true });
        inputs[f.name] = input;
        return h('label', { class: 'field' },
          h('span', { class: 'field-label' }, f.label),
          h('span', { class: 'field-control' }, input),
          f.hint && h('span', { class: 'field-hint' }, f.hint));
      }),
      err, btn, footer && h('div', { class: 'auth-footer' }, footer));

    el.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const values = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]));
      btn.disabled = true;
      try {
        const problem = await onSubmit(values);
        if (problem) err.textContent = problem;
      } catch (ex) {
        console.error(ex);
        err.textContent = 'אירעה שגיאה. נסו שוב.';
      } finally {
        btn.disabled = false;
      }
    });
    return el;
  }

  const link = (text, onClick) => h('button', { type: 'button', class: 'link-btn', onclick: onClick }, text);

  function login() {
    return form({
      title: 'כניסה',
      fields: [
        { name: 'username', label: 'שם משתמש', autocomplete: 'username', dir: 'ltr' },
        { name: 'password', label: 'סיסמה', type: 'password', autocomplete: 'current-password', dir: 'ltr' },
      ],
      submit: 'כניסה',
      async onSubmit({ username, password }) {
        if (!username.trim() || !password) return 'יש למלא שם משתמש וסיסמה.';
        let session;
        if (username.includes('@')) {
          const { data, error } = await client.auth.signInWithPassword({ email: username.trim(), password });
          if (error) return error.status === 429 ? 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.' : 'שם משתמש או סיסמה שגויים.';
          session = data.session;
        } else {
          const res = await fetch(cfg.supabaseUrl + '/functions/v1/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseKey },
            body: JSON.stringify({ username: username.trim(), password }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.status === 429) return 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.';
          if (!res.ok) return 'שם משתמש או סיסמה שגויים.';
          const { data, error } = await client.auth.setSession(body);
          if (error) return 'לא הצלחנו להתחבר. נסו שוב.';
          session = data.session;
        }
        await enter(session.user);
      },
      footer: [
        h('div', {}, 'אין לך חשבון? ', link('הרשמה', () => screen(register()))),
        h('div', {}, link('שכחתי סיסמה', () => screen(forgot()))),
      ],
    });
  }

  function register() {
    return form({
      title: 'הרשמה',
      subtitle: 'לאחר ההרשמה החשבון ימתין לאישור מנהל הפורטל.',
      fields: [
        { name: 'full_name', label: 'שם מלא', autocomplete: 'name' },
        { name: 'username', label: 'שם משתמש', autocomplete: 'username', dir: 'ltr', hint: '3–30 תווים: אותיות, ספרות, נקודה, מקף או קו תחתון' },
        { name: 'email', label: 'מייל', type: 'email', autocomplete: 'email', dir: 'ltr', hint: 'משמש לשחזור סיסמה בלבד' },
        { name: 'password', label: 'סיסמה', type: 'password', autocomplete: 'new-password', dir: 'ltr', hint: `לפחות ${MIN_PASSWORD} תווים` },
        { name: 'confirm', label: 'אימות סיסמה', type: 'password', autocomplete: 'new-password', dir: 'ltr' },
      ],
      submit: 'הרשמה',
      async onSubmit({ full_name, username, email, password, confirm }) {
        username = username.trim();
        email = email.trim();
        if (!full_name.trim()) return 'יש למלא שם מלא.';
        if (!USERNAME_RE.test(username)) return 'שם המשתמש צריך להכיל 3–30 אותיות, ספרות, נקודה, מקף או קו תחתון.';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'כתובת המייל אינה תקינה.';
        if (password.length < MIN_PASSWORD) return `הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD} תווים.`;
        if (password !== confirm) return 'הסיסמאות אינן תואמות.';

        const { data: available } = await client.rpc('username_available', { p_username: username });
        if (available === false) return 'שם המשתמש תפוס. בחרו שם אחר.';

        const { data, error } = await client.auth.signUp({
          email, password,
          options: { data: { username, full_name: full_name.trim() }, emailRedirectTo: location.origin + location.pathname },
        });
        if (error) {
          if (/already registered|already exists/i.test(error.message)) return 'המייל הזה כבר רשום. נסו להתחבר או לשחזר סיסמה.';
          if (error.status === 429) return 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.';
          if (/password/i.test(error.message)) return 'הסיסמה חלשה מדי. בחרו סיסמה ארוכה או מגוונת יותר.';
          return 'ההרשמה נכשלה. ייתכן ששם המשתמש תפוס — נסו שם אחר.';
        }
        if (data.session) return enter(data.user);
        screen(message('נרשמת בהצלחה', 'שלחנו מייל לאימות הכתובת. לאחר האימות, החשבון ימתין לאישור מנהל.'));
      },
      footer: h('div', {}, 'כבר רשום? ', link('כניסה', () => screen(login()))),
    });
  }

  function forgot() {
    return form({
      title: 'שחזור סיסמה',
      subtitle: 'נשלח קישור לאיפוס הסיסמה למייל שאיתו נרשמתם.',
      fields: [{ name: 'email', label: 'מייל', type: 'email', autocomplete: 'email', dir: 'ltr' }],
      submit: 'שליחת קישור',
      async onSubmit({ email }) {
        if (!email.trim()) return 'יש למלא מייל.';
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
        if (error && error.status === 429) return 'נשלחו יותר מדי בקשות. נסו שוב מאוחר יותר.';
        screen(message('בדקו את תיבת המייל', 'אם המייל רשום בפורטל, נשלח אליו קישור לאיפוס הסיסמה.'));
      },
      footer: link('חזרה לכניסה', () => screen(login())),
    });
  }

  function resetPassword() {
    return form({
      title: 'בחירת סיסמה חדשה',
      fields: [
        { name: 'password', label: 'סיסמה חדשה', type: 'password', autocomplete: 'new-password', dir: 'ltr', hint: `לפחות ${MIN_PASSWORD} תווים` },
        { name: 'confirm', label: 'אימות סיסמה', type: 'password', autocomplete: 'new-password', dir: 'ltr' },
      ],
      submit: 'שמירה',
      async onSubmit({ password, confirm }) {
        if (password.length < MIN_PASSWORD) return `הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD} תווים.`;
        if (password !== confirm) return 'הסיסמאות אינן תואמות.';
        const { data, error } = await client.auth.updateUser({ password });
        if (error) return 'שמירת הסיסמה נכשלה. ייתכן שהקישור פג תוקף — בקשו קישור חדש.';
        recovering = false;
        history.replaceState(null, '', location.pathname);
        await enter(data.user);
      },
    });
  }

  function pending(profile) {
    return h('div', { class: 'auth-form' },
      h('h1', {}, 'החשבון ממתין לאישור'),
      h('p', { class: 'auth-sub' }, `שלום ${profile.full_name || profile.username}, ההרשמה התקבלה. מנהל הפורטל יאשר את החשבון בקרוב, ואז תוכלו להיכנס.`),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: async () => {
        const { data } = await client.auth.getUser();
        if (data.user) enter(data.user);
      } }, 'בדיקה מחדש'),
      h('div', { class: 'auth-footer' }, link('יציאה', Auth.signOut)));
  }

  function message(title, text, withSignOut) {
    return h('div', { class: 'auth-form' },
      h('h1', {}, title),
      h('p', { class: 'auth-sub' }, text),
      h('div', { class: 'auth-footer' }, withSignOut ? link('יציאה', Auth.signOut) : link('חזרה לכניסה', () => screen(login()))));
  }

  function configMissing() {
    return message('הפורטל עדיין לא מחובר לשרת', 'חסרים פרטי החיבור ל-Supabase בקובץ js/config.js.');
  }

  window.Auth = Auth;
})();
