// Demo mode (sample people, leave, tasks and a shared demo password) exists only for local design work.
// A build with the Supabase keys set is a live build: none of the sample data is included in it.
export const IS_DEMO = !(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
