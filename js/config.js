/*
 * חיבור ל-Supabase. שני הערכים ציבוריים מטבעם (ההרשאות נאכפות במסד הנתונים באמצעות RLS).
 * לעולם לא לשים כאן service_role / secret key.
 */
window.PORTAL_CONFIG = (function () {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local) {
    // סביבת פיתוח: npx supabase start
    return {
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    };
  }
  return {
    supabaseUrl: 'https://fsfmyjpmhidpmijskiut.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZm15anBtaGlkcG1panNraXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjAyMzUsImV4cCI6MjEwNTEzNjIzNX0.Q18MEO2lmKG2P2Dk0EM2cmj0ULqHUh1vMFGlwvyCYH0',
  };
})();
