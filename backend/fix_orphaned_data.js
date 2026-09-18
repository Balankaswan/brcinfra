import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LoadingSlip from './models/LoadingSlip.js';
import Memo from './models/Memo.js';

dotenv.config();

async function fixOrphanedData() {
    try {
        console.log('🔧 Starting fix for orphaned data...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find the problematic memo
        const problematicMemo = await Memo.findOne({ memo_number: 'MO-6181' });

        if (problematicMemo) {
            console.log('📋 Found problematic memo:');
            console.log(`  - Memo Number: ${problematicMemo.memo_number}`);
            console.log(`  - Memo ID: ${problematicMemo._id}`);
            console.log(`  - Loading Slip ID (reference): ${problematicMemo.loading_slip_id}`);
            console.log(`  - Created: ${problematicMemo.createdAt}`);
            console.log(`  - Supplier: ${problematicMemo.supplier}`);
            console.log(`  - Freight: ${problematicMemo.freight}`);

            // Check if the loading slip exists
            const loadingSlipExists = await LoadingSlip.findById(problematicMemo.loading_slip_id);

            if (!loadingSlipExists) {
                console.log('\n❌ Loading slip does NOT exist in database!');
                console.log('   This memo is orphaned and should be deleted.\n');

                // Ask for confirmation (we'll delete it)
                console.log('🗑️  Deleting orphaned memo MO-6181...');
                await Memo.findByIdAndDelete(problematicMemo._id);
                console.log('✅ Orphaned memo deleted successfully!');
            } else {
                console.log('\n✅ Loading slip exists (this should not happen based on diagnostic)');
            }
        } else {
            console.log('❓ Memo MO-6181 not found');
        }

        // Double-check: Find all memos with invalid references
        console.log('\n🔍 Checking all memos for invalid references...');
        const allMemos = await Memo.find();
        let fixedCount = 0;

        for (const memo of allMemos) {
            if (memo.loading_slip_id) {
                const slipExists = await LoadingSlip.findById(memo.loading_slip_id);
                if (!slipExists) {
                    console.log(`\n⚠️  Found orphaned memo: ${memo.memo_number} (ID: ${memo._id})`);
                    console.log(`   References non-existent loading slip: ${memo.loading_slip_id}`);
                    console.log(`   Deleting orphaned memo...`);
                    await Memo.findByIdAndDelete(memo._id);
                    fixedCount++;
                    console.log(`   ✅ Deleted`);
                }
            }
        }

        console.log(`\n✅ Fixed ${fixedCount} orphaned memo(s)`);

        // Verify the fix
        console.log('\n🔍 Verifying fix...');
        const remainingMemos = await Memo.find();
        let invalidCount = 0;

        for (const memo of remainingMemos) {
            if (memo.loading_slip_id) {
                const slipExists = await LoadingSlip.findById(memo.loading_slip_id);
                if (!slipExists) {
                    invalidCount++;
                }
            }
        }

        if (invalidCount === 0) {
            console.log('✅ All memos now have valid loading slip references!');
        } else {
            console.log(`⚠️  Still found ${invalidCount} invalid references`);
        }

        console.log('\n✅ Fix complete!');

    } catch (error) {
        console.error('❌ Fix error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

fixOrphanedData();
