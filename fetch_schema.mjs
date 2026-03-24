import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zelitdkeegmzhhtjlufc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbGl0ZGtlZWdtemhodGpsdWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2Njc3NzAsImV4cCI6MjA4ODI0Mzc3MH0.H8BuaeE4xP-lnmpHoL5Rp13JyTf-wBjX7FHtw8pif-g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const tables = ['ticket_categorias', 'ticket_subcategorias', 'ticket_acciones', 'ticket_fallas'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table} error:`, error.message);
    } else {
      console.log(`Table ${table} exists! Columns:`, data.length > 0 ? Object.keys(data[0]).join(', ') : 'Empty table');
    }
  }
}
check();
