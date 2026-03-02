// src/config/supabase.js
// Cliente Supabase para el servidor.
// Usa la Service Role Key → acceso total, bypassea RLS.
// NUNCA exponer esta key al frontend.

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('\n❌ Error: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el archivo .env\n');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = supabase;
