/* גישה לנתונים משותפת לכלים (Supabase). שגיאה נזרקת כ-Error עם הודעה בעברית. */
(function () {
  const db = () => Auth.client;
  let bookletsCache = null;

  function check({ data, error }, what) {
    if (error) {
      console.error(what, error);
      throw new Error('שגיאה בטעינת ' + what);
    }
    return data;
  }

  const Data = {
    /** חוברות עם פרקים ומספר שאלות בכל פרק */
    async booklets() {
      if (bookletsCache) return bookletsCache;
      const [booklets, chapters, questions] = await Promise.all([
        db().from('booklets').select('number, title, file_path').order('number').then((r) => check(r, 'החוברות')),
        db().from('chapters').select('booklet, number, title, kind').order('booklet').order('number').then((r) => check(r, 'הפרקים')),
        db().from('questions').select('booklet, chapter').then((r) => check(r, 'השאלות')),
      ]);
      const counts = {};
      for (const q of questions) counts[q.booklet + ':' + q.chapter] = (counts[q.booklet + ':' + q.chapter] || 0) + 1;
      bookletsCache = booklets.map((b) => ({
        ...b,
        chapters: chapters.filter((c) => c.booklet === b.number).map((c) => ({ ...c, questionCount: counts[b.number + ':' + c.number] || 0 })),
      }));
      return bookletsCache;
    },

    async questions(booklet) {
      return check(await db().from('questions')
        .select('id, booklet, chapter, number, text, options, correct, explanation, needs_review, review_note, sort_order')
        .eq('booklet', booklet).order('chapter').order('sort_order'), 'השאלות');
    },

    /** התשובה האחרונה של המשתמש לכל שאלה בחוברת: Map(question_id → is_correct) */
    async lastAttempts(booklet) {
      const rows = check(await db().from('attempts')
        .select('question_id, is_correct, created_at')
        .like('question_id', `b${booklet}-%`)
        .order('created_at', { ascending: false }), 'התשובות');
      const last = new Map();
      for (const r of rows) if (!last.has(r.question_id)) last.set(r.question_id, r.is_correct);
      return last;
    },

    async recordAttempt(questionId, chosen) {
      return check(await db().from('attempts').insert({ question_id: questionId, chosen }).select('is_correct').single(), 'שמירת התשובה');
    },

    async resetAttempts(booklet) {
      check(await db().from('attempts').delete().like('question_id', `b${booklet}-%`), 'איפוס התשובות');
    },

    /** קישור זמני (שעה) לקובץ חוברת באחסון הפרטי */
    async bookletUrl(path) {
      return check(await db().storage.from('booklets').createSignedUrl(path, 3600), 'קובץ החוברת').signedUrl;
    },

    async profiles() {
      return check(await db().from('profiles').select('*').order('created_at', { ascending: false }), 'המשתמשים');
    },

    async updateProfile(id, changes) {
      return check(await db().from('profiles').update(changes).eq('id', id).select().single(), 'עדכון המשתמש');
    },
  };

  window.Data = Data;
})();
