const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to .env.local
const envPath = path.join(__dirname, '../.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ Error: .env.local file not found.');
  process.exit(1);
}

// Read and parse env file lines
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

envContent.split(/\r?\n/).forEach((line) => {
  // Ignore comments and empty lines
  if (line.startsWith('#') || !line.trim()) return;

  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    // Strip quotes if any
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

let dbUrl = env.SUPABASE_DB_URL;
const password = env.SUPABASE_DB_PASSWORD;

if (!dbUrl) {
  console.error('❌ Error: SUPABASE_DB_URL is not set in .env.local.');
  console.error('\nPlease copy the Connection String (URI format) from your Supabase Dashboard:');
  console.error('Settings -> Database -> Connection string -> URI');
  console.error('\nThen, add it to your .env.local:');
  console.error('SUPABASE_DB_URL=postgresql://postgres:[YOUR_PASSWORD]@aws-0-xxxx.pooler.supabase.com:6543/postgres');
  process.exit(1);
}

// Replace password placeholder if present
if (dbUrl.includes('[YOUR_PASSWORD]') || dbUrl.includes('[YOUR_DB_PASSWORD]')) {
  if (!password || password === 'your_db_password_here') {
    console.error('❌ Error: You need to set SUPABASE_DB_PASSWORD in .env.local or replace [YOUR_PASSWORD] directly in your SUPABASE_DB_URL.');
    process.exit(1);
  }
  const encodedPassword = encodeURIComponent(password);
  dbUrl = dbUrl.replace('[YOUR_PASSWORD]', encodedPassword).replace('[YOUR_DB_PASSWORD]', encodedPassword);
}

console.log('🚀 Pushing migrations to remote database...');

try {
  execSync(`npx supabase db push --db-url "${dbUrl}"`, { stdio: 'inherit' });
  console.log('✅ Migrations pushed successfully!');
} catch (error) {
  console.error('❌ Migration push failed.');
  process.exit(1);
}
