import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const BACKUP_DIR = path.join(__dirname, 'backups');

async function backupDatabase() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const specificBackupDir = path.join(BACKUP_DIR, `backup-${timestamp}`);
        fs.mkdirSync(specificBackupDir);

        const collections = await mongoose.connection.db.listCollections().toArray();

        console.log(`📦 Found ${collections.length} collections to backup.`);

        for (const collection of collections) {
            const name = collection.name;
            console.log(`   Detailed backup for: ${name}...`);

            const data = await mongoose.connection.db.collection(name).find({}).toArray();

            const filePath = path.join(specificBackupDir, `${name}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`   ✅ Saved ${data.length} documents to ${name}.json`);
        }

        console.log(`\n🎉 Backup completed successfully in: ${specificBackupDir}`);

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ Backup Failed:', error);
        process.exit(1);
    }
}

backupDatabase();
