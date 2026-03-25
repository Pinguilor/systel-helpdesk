const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envLines = envContent.split('\n');
let url, key;
envLines.forEach(line => {
    if(line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=').slice(1).join('=').trim().replace(/['"]/g, '');
    if(line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=').slice(1).join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.from('tickets').select('*').limit(1);
    if(error) {
        console.error(error);
        return;
    }
    if(data.length > 0) {
        console.log(Object.keys(data[0]));
    } else {
        console.log("No data");
    }
}
run();
