/**
 * BRC TRANSPORT - IMMEDIATE DATABASE BACKUP SCRIPT
 * =================================================
 * This script connects to MongoDB Atlas and dumps ALL collections
 * as timestamped JSON files. It is READ-ONLY — nothing is modified.
 * 
 * Usage: node backend/scripts/take_backup_now.js
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI not found in .env file');
    process.exit(1);
}

// Timestamped folder: backup-2025-07-22_22-33-00
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

// Backup destination: backend/backups/backup-TIMESTAMP/
const BACKUP_ROOT = path.join(__dirname, '..', 'backups');
const BACKUP_DIR  = path.join(BACKUP_ROOT, `backup-${timestamp}`);

// Also mirror to root-level backup/json/ folder
const ROOT_JSON_MIRROR = path.join(__dirname, '..', '..', 'backup', 'json');

async function takeBackup() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       BRC TRANSPORT — DATABASE BACKUP NOW        ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🕐 Backup started at: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    console.log(`📂 Destination: ${BACKUP_DIR}`);
    console.log(`🔗 Connecting to MongoDB Atlas...`);
    console.log('');

    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
        });
        console.log('✅ Connected to MongoDB Atlas successfully.');
        console.log('');

        // Ensure directories exist
        [BACKUP_ROOT, BACKUP_DIR, ROOT_JSON_MIRROR].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // List all collections
        const db = mongoose.connection.db;
        const collectionList = await db.listCollections().toArray();

        if (collectionList.length === 0) {
            console.log('⚠️  No collections found in database. Backup empty.');
        } else {
            console.log(`📦 Found ${collectionList.length} collection(s) to back up:`);
            console.log('');
        }

        const manifest = {
            backupDate: now.toISOString(),
            backupDateIST: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
            database: 'brc_transport',
            totalCollections: collectionList.length,
            collections: []
        };

        let totalDocuments = 0;

        for (const col of collectionList) {
            const name = col.name;
            process.stdout.write(`   ⏳ Backing up: ${name.padEnd(35)}`);

            const documents = await db.collection(name).find({}).toArray();
            const json = JSON.stringify(documents, null, 2);
            const docCount = documents.length;

            // Write to timestamped backup folder
            const filePath = path.join(BACKUP_DIR, `${name}.json`);
            fs.writeFileSync(filePath, json, 'utf8');

            // Mirror to root backup/json/ folder (overwrites to keep it fresh)
            const mirrorPath = path.join(ROOT_JSON_MIRROR, `${name}.json`);
            fs.writeFileSync(mirrorPath, json, 'utf8');

            const sizeKB = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(2);
            console.log(`✅  ${docCount} docs  (${sizeKB} KB)`);

            manifest.collections.push({
                name,
                documentCount: docCount,
                sizeKB: parseFloat(sizeKB),
                file: `${name}.json`
            });

            totalDocuments += docCount;
        }

        // Write manifest
        manifest.totalDocuments = totalDocuments;
        const manifestPath = path.join(BACKUP_DIR, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

        console.log('');
        console.log('══════════════════════════════════════════════════');
        console.log('✅  BACKUP COMPLETED SUCCESSFULLY');
        console.log('══════════════════════════════════════════════════');
        console.log(`📁 Location : ${BACKUP_DIR}`);
        console.log(`📄 Files    : ${collectionList.length} JSON files + manifest.json`);
        console.log(`📊 Total    : ${totalDocuments} documents backed up`);
        console.log(`🪞 Mirrored : ${ROOT_JSON_MIRROR}`);
        console.log('');
        console.log('⚠️  DATABASE WAS NOT MODIFIED — READ-ONLY OPERATION');
        console.log('');

        await mongoose.disconnect();
        process.exit(0);

    } catch (err) {
        console.error('');
        console.error('❌ BACKUP FAILED:', err.message);
        console.error('');
        if (err.message.includes('ECONNREFUSED') || err.message.includes('timed out')) {
            console.error('💡 Check your internet connection or MONGODB_URI in backend/.env');
        }
        try { await mongoose.disconnect(); } catch (_) {}
        process.exit(1);
    }
}

takeBackup();
