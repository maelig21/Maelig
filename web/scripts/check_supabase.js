#!/usr/bin/env node
// Quick Supabase check — reads env from .env.local inline (no dotenv dep)
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
  if (m) env[m[1]] = m[2];
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env vars'); process.exit(1); }

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  console.log('=== SUPABASE URL ===');
  console.log(url);
  console.log('');

  // 1. Check buckets
  console.log('=== STORAGE BUCKETS ===');
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) { console.log('ERROR listing buckets:', bErr.message); }
  else { buckets.forEach(b => console.log(`  - ${b.name} (public: ${b.public}, limit: ${b.file_size_limit}, mimes: ${b.allowed_mime_types?.length || 0})`)); }
  console.log('');

  // 2. Check orgs table
  console.log('=== ORGS TABLE ===');
  const { data: orgs, error: oErr } = await admin.from('orgs').select('id, nom, logo_url').limit(3);
  if (oErr) { console.log('ERROR:', oErr.message); }
  else { console.log(`  ${orgs.length} orgs found:`); orgs.forEach(o => console.log(`    ${o.nom} | logo_url: ${o.logo_url ? 'SET' : 'NULL'}`)); }
  console.log('');

  // 3. Check articles table
  console.log('=== ARTICLES TABLE ===');
  const { count, error: cErr } = await admin.from('articles').select('*', { count: 'exact', head: true });
  if (cErr) { console.log('ERROR:', cErr.message); }
  else { console.log(`  Total articles: ${count}`); }
  const { data: articles, error: aErr } = await admin.from('articles').select('*').limit(3);
  if (aErr) { console.log('ERROR:', aErr.message); }
  else if (articles.length > 0) { console.log('  Sample:', JSON.stringify(articles[0], null, 2)); }
  else { console.log('  No articles found'); }
  console.log('');

  // 4. Try to access assets bucket
  console.log('=== ASSETS BUCKET ===');
  const { data: assetList, error: assetErr } = await admin.storage.from('assets').list();
  if (assetErr) {
    console.log('  ERROR accessing assets bucket:', assetErr.message);
    console.log('  → Bucket likely does NOT exist or has no policies');
  } else {
    console.log(`  Objects: ${assetList.length}`);
    assetList.slice(0, 5).forEach(o => console.log(`    ${o.name}`));
  }

  // 5. Check org-logos in assets (upload target path)
  console.log('\n=== ASSETS/org-logos ===');
  const { data: logoList, error: logoErr } = await admin.storage.from('assets').list('org-logos');
  if (logoErr) {
    console.log('  ERROR:', logoErr.message);
  } else {
    console.log(`  ${logoList.length} org logo dirs`);
    logoList.slice(0, 3).forEach(o => console.log(`    ${o.name}`));
  }

  // 6. Check if audio bucket exists (for voice pipeline)  
  console.log('\n=== AUDIO BUCKET ===');
  const { data: audioList, error: audioErr } = await admin.storage.from('audio').list();
  if (audioErr) {
    console.log('  ERROR:', audioErr.message);
  } else {
    console.log(`  Objects: ${audioList.length}`);
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
