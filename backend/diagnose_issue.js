import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LoadingSlip from './models/LoadingSlip.js';
import Memo from './models/Memo.js';

dotenv.config();

async function diagnose() {
    try {
        console.log('🔍 Starting diagnostic...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Check loading slips count
        const loadingSlipsCount = await LoadingSlip.countDocuments();
        console.log(`📊 Total Loading Slips: ${loadingSlipsCount}`);

        // Get recent loading slips
        const recentSlips = await LoadingSlip.find()
            .sort({ createdAt: -1 })
            .limit(5);

        console.log('\n📋 Recent Loading Slips:');
        recentSlips.forEach(slip => {
            console.log(`  - ${slip.slip_number} (ID: ${slip._id}) - Created: ${slip.createdAt}`);
        });

        // Check memos count
        const memosCount = await Memo.countDocuments();
        console.log(`\n📊 Total Memos: ${memosCount}`);

        // Get recent memos
        const recentMemos = await Memo.find()
            .sort({ createdAt: -1 })
            .limit(5);

        console.log('\n📋 Recent Memos:');
        recentMemos.forEach(memo => {
            console.log(`  - ${memo.memo_number} (ID: ${memo._id}) - Loading Slip ID: ${memo.loading_slip_id} - Created: ${memo.createdAt}`);
        });

        // Check for orphaned loading slips (without valid IDs)
        const slipsWithoutId = await LoadingSlip.find({ _id: { $exists: false } });
        console.log(`\n⚠️  Loading Slips without _id: ${slipsWithoutId.length}`);

        // Check for duplicate memo numbers
        const duplicateMemos = await Memo.aggregate([
            { $group: { _id: '$memo_number', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]);

        if (duplicateMemos.length > 0) {
            console.log('\n⚠️  Duplicate Memo Numbers Found:');
            duplicateMemos.forEach(dup => {
                console.log(`  - ${dup._id}: ${dup.count} occurrences`);
            });
        } else {
            console.log('\n✅ No duplicate memo numbers found');
        }

        // Check for duplicate loading slip numbers
        const duplicateSlips = await LoadingSlip.aggregate([
            { $group: { _id: '$slip_number', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]);

        if (duplicateSlips.length > 0) {
            console.log('\n⚠️  Duplicate Loading Slip Numbers Found:');
            duplicateSlips.forEach(dup => {
                console.log(`  - ${dup._id}: ${dup.count} occurrences`);
            });
        } else {
            console.log('\n✅ No duplicate loading slip numbers found');
        }

        // Check for memos with invalid loading_slip_id references
        const allMemos = await Memo.find();
        let invalidRefs = 0;

        for (const memo of allMemos) {
            if (memo.loading_slip_id) {
                const slipExists = await LoadingSlip.findById(memo.loading_slip_id);
                if (!slipExists) {
                    invalidRefs++;
                    console.log(`\n⚠️  Memo ${memo.memo_number} references non-existent loading slip: ${memo.loading_slip_id}`);
                }
            }
        }

        if (invalidRefs === 0) {
            console.log('\n✅ All memo references are valid');
        } else {
            console.log(`\n⚠️  Found ${invalidRefs} memos with invalid loading slip references`);
        }

        // Check database indexes
        const slipIndexes = await LoadingSlip.collection.getIndexes();
        console.log('\n📑 Loading Slip Indexes:', Object.keys(slipIndexes));

        const memoIndexes = await Memo.collection.getIndexes();
        console.log('📑 Memo Indexes:', Object.keys(memoIndexes));

        console.log('\n✅ Diagnostic complete!');

    } catch (error) {
        console.error('❌ Diagnostic error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

diagnose();
