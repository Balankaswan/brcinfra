import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import LoadingSlip from './models/LoadingSlip.js'; // Assuming model path

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function testWrite() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        const testSlipNumber = `LS-TEST-${Date.now()}`;
        console.log(`📝 Creating test Loading Slip: ${testSlipNumber}`);

        const slip = new LoadingSlip({
            slip_number: testSlipNumber,
            date: new Date(),
            vehicle_no: 'TEST-01',
            party: 'TEST PARTY',
            from_location: 'A',
            to_location: 'B',
            supplier: 'TEST SUPPLIER',
            weight: 10,
            rate: 100,
            freight: 1000,
            total_freight: 1000
        });

        await slip.save();
        console.log('✅ WRITE SUCCESSFUL!');
        console.log('Created ID:', slip._id);

        // Clean up
        await LoadingSlip.findByIdAndDelete(slip._id);
        console.log('🗑️ Test entry deleted.');

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ WRITE FAILED:', error);
        process.exit(1);
    }
}

testWrite();
