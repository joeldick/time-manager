#!/usr/bin/env node

/**
 * CLI tool to manage Time Manager configuration in Firestore
 * Usage:
 *   npm run manage-config -- add-kid child1
 *   npm run manage-config -- remove-kid child1
 *   npm run manage-config -- add-email user@example.com
 *   npm run manage-config -- remove-email user@example.com
 *   npm run manage-config -- list
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
  path.join(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Error: Firebase service account file not found at ${serviceAccountPath}`);
  console.error('Please download it from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const serviceAccountText = fs.readFileSync(serviceAccountPath, 'utf-8');
const serviceAccount = JSON.parse(serviceAccountText);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const configRef = db.collection('config').doc('app');

const commands = {
  async addKid(name) {
    const config = await configRef.get();
    const data = config.data() || {};
    const kids = data.kids || [];
    
    if (kids.includes(name)) {
      console.log(`✗ Child "${name}" already exists`);
      return;
    }
    
    kids.push(name);
    await configRef.set({ ...data, kids }, { merge: true });
    console.log(`✓ Added child "${name}"`);
  },

  async removeKid(name) {
    const config = await configRef.get();
    const data = config.data() || {};
    const kids = data.kids || [];
    
    if (!kids.includes(name)) {
      console.log(`✗ Child "${name}" not found`);
      return;
    }
    
    const updated = kids.filter(k => k !== name);
    await configRef.set({ ...data, kids: updated }, { merge: true });
    console.log(`✓ Removed child "${name}"`);
  },

  async addEmail(email) {
    const config = await configRef.get();
    const data = config.data() || {};
    const allowedEmails = data.allowedEmails || [];
    
    if (allowedEmails.includes(email)) {
      console.log(`✗ Email "${email}" already authorized`);
      return;
    }
    
    allowedEmails.push(email);
    await configRef.set({ ...data, allowedEmails }, { merge: true });
    console.log(`✓ Added authorized email "${email}"`);
  },

  async removeEmail(email) {
    const config = await configRef.get();
    const data = config.data() || {};
    const allowedEmails = data.allowedEmails || [];
    
    if (!allowedEmails.includes(email)) {
      console.log(`✗ Email "${email}" not found`);
      return;
    }
    
    const updated = allowedEmails.filter(e => e !== email);
    await configRef.set({ ...data, allowedEmails: updated }, { merge: true });
    console.log(`✓ Removed email "${email}"`);
  },

  async list() {
    const config = await configRef.get();
    const data = config.data() || {};
    
    console.log('\n=== Current Configuration ===\n');
    
    if (data.kids && data.kids.length > 0) {
      console.log('Children:');
      data.kids.forEach((kid, i) => {
        console.log(`  ${i + 1}. ${kid}`);
      });
    } else {
      console.log('Children: (none)');
    }
    
    console.log('');
    
    if (data.allowedEmails && data.allowedEmails.length > 0) {
      console.log('Authorized Emails:');
      data.allowedEmails.forEach((email, i) => {
        console.log(`  ${i + 1}. ${email}`);
      });
    } else {
      console.log('Authorized Emails: (none)');
    }
    
    console.log('');
  },

  async init() {
    const config = await configRef.get();
    if (config.exists) {
      console.log('Configuration already exists in Firestore');
      await this.list();
      return;
    }
    
    const initialConfig = {
      kids: ['child1', 'child2', 'child3'],
      allowedEmails: ['user@example.com'],
      lastUpdated: new Date().toISOString()
    };
    
    await configRef.set(initialConfig);
    console.log('✓ Initialized default configuration');
    await this.list();
  }
};

async function main() {
  const [, , command, arg] = process.argv;
  
  try {
    if (!command) {
      console.log('Usage: npm run manage-config -- <command> [arg]');
      console.log('\nCommands:');
      console.log('  init                      Initialize default configuration');
      console.log('  list                      List all configuration');
      console.log('  add-kid <name>            Add a child');
      console.log('  remove-kid <name>         Remove a child');
      console.log('  add-email <email>         Add authorized email');
      console.log('  remove-email <email>      Remove authorized email');
      process.exit(0);
    }
    
    const cmdName = command.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    
    if (!commands[cmdName]) {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
    
    if (['addKid', 'removeKid', 'addEmail', 'removeEmail'].includes(cmdName)) {
      if (!arg) {
        console.error(`${command} requires an argument`);
        process.exit(1);
      }
      await commands[cmdName](arg);
    } else {
      await commands[cmdName]();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
