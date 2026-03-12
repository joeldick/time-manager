#!/usr/bin/env node

/**
 * Firebase Setup Script
 * Initializes Firestore database and creates default configuration
 * 
 * Usage:
 *   npm run setup-firebase
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log(`
╔════════════════════════════════════════╗
║   Time Manager Firebase Setup          ║
╚════════════════════════════════════════╝
`);

  try {
    // Check for service account
    console.log('🔐 Checking service account...');
    const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
      console.log('\n⚠️  serviceAccountKey.json not found!');
      console.log('   1. Go to Firebase Console > Project Settings > Service Accounts');
      console.log('   2. Click "Generate New Private Key"');
      console.log('   3. Save as serviceAccountKey.json in the project root\n');
      process.exit(1);
    }
    console.log('✓ Service account found');

    // Initialize Firebase Admin
    console.log('\n🔥 Initializing Firebase Admin SDK...');
    const serviceAccountText = fs.readFileSync(serviceAccountPath, 'utf-8');
    const serviceAccount = JSON.parse(serviceAccountText);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✓ Firebase Admin initialized');

    const db = admin.firestore();

    // Check if config already exists
    console.log('\n📚 Setting up Firestore...');
    const configRef = db.collection('config').doc('app');
    const configSnapshot = await configRef.get();

    if (configSnapshot.exists) {
      console.log('ℹ️  Configuration already exists in Firestore');
      const data = configSnapshot.data();
      console.log('\nCurrent configuration:');
      console.log('  Kids:', data.kids || []);
      console.log('  Authorized Emails:', data.allowedEmails || []);
      console.log('\nTo update, use: npm run manage-config -- <command>');
    } else {
      console.log('Creating default configuration...');
      const defaultConfig = {
        kids: ['child1', 'child2', 'child3'],
        allowedEmails: ['user@example.com'],
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      };

      await configRef.set(defaultConfig);
      console.log('✓ Default configuration created');
      console.log('\nDefault configuration:');
      console.log('  Kids:', defaultConfig.kids);
      console.log('  Authorized Emails:', defaultConfig.allowedEmails);
    }

    console.log(`
╔════════════════════════════════════════╗
║   ✓ Setup Complete!                    ║
╚════════════════════════════════════════╝

Next steps:

1. Update configuration:
   npm run manage-config -- add-kid child1
   npm run manage-config -- add-kid child2
   npm run manage-config -- add-email authorized@example.com

2. View current config:
   npm run manage-config -- list

3. Start local development:
   npm run dev

4. Test, then deploy:
   git add -A
   git commit -m "Configure Firestore with initial settings"
   git push

Note: Configuration changes don't require redeployment!
    `);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
