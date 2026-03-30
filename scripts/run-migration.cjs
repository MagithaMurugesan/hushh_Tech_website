/**
 * Run a specific migration SQL against Supabase
 * Usage: node scripts/run-migration.cjs
 */

const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}

// Read the migration SQL
const sql = fs.readFileSync('./supabase/migrations/20260116000000_create_hushh_agent_users.sql', 'utf8');

console.log('📦 Reading migration SQL...');
console.log('📡 Connecting to Supabase...');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_KEY
);

async function runMigration() {
  console.log('🚀 Running migration for hushh_agent_users...');
  
  // Check if table already exists
  const { data: existingTable, error: checkError } = await supabase
    .from('hushh_agent_users')
    .select('id')
    .limit(1);
  
  if (!checkError) {
    console.log('✅ Table hushh_agent_users already exists!');
    return;
  }
  
  if (checkError && !checkError.message.includes('does not exist')) {
    console.log('Table check result:', checkError.message);
  }
  
  console.log('❌ Table does not exist. Please run the SQL manually in Supabase Dashboard.');
  console.log('\n📋 Go to: https://supabase.com/dashboard/project/<your-project-ref>/sql');
  console.log('\n📝 Copy and paste this SQL:\n');
  console.log('='.repeat(80));
  console.log(sql);
  console.log('='.repeat(80));
}

runMigration();
