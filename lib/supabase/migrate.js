#!/usr/bin/env node

// This script runs the SQL migrations on your Supabase database
// Usage: node migrate.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
require('dotenv').config({ path: '.env.local' });

// Get the database URL from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL environment variable is missing');
  console.error('Make sure to create a .env.local file with your Supabase database URL');
  console.error('Example: DATABASE_URL=postgresql://postgres:password@db.example.supabase.co:5432/postgres');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log('Running Supabase migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations.sql');
    const migrationSql = await readFile(migrationPath, 'utf8');
    
    // Create a temporary file with our SQL (to avoid command line escaping issues)
    const tempSqlPath = path.join(__dirname, 'temp_migration.sql');
    fs.writeFileSync(tempSqlPath, migrationSql);
    
    // Run the SQL against the Supabase PostgreSQL database
    try {
      // We're using psql to execute the SQL file
      // Note: You need to have psql client installed for this to work
      execSync(`psql "${databaseUrl}" -f "${tempSqlPath}"`, { stdio: 'inherit' });
      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Error executing migration:');
      console.error('Make sure you have the PostgreSQL client (psql) installed');
      console.error('You can also manually run the SQL script against your Supabase database');
      console.error('The SQL script is located at:', migrationPath);
      throw error;
    } finally {
      // Clean up temporary file
      fs.unlinkSync(tempSqlPath);
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration(); 