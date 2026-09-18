import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LoadingSlip from './models/LoadingSlip.js';
import Memo from './models/Memo.js';

dotenv.config();

async function investigateIssue() {
    try {
        console.log('🔍 Investigating the issue in detail...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find the problematic memo
        const problematicMemo = await Memo.findOne({ memo_number: 'MO-6181' });

        if (problematicMemo) {
            console.log('📋 Problematic Memo Details:');
            console.log(JSON.stringify(problematicMemo, null, 2));

            const targetSlipId = problematicMemo.loading_slip_id;
            console.log(`\n🔍 Looking for loading slip with ID: ${targetSlipId}`);

            // Try to find the loading slip
            const loadingSlip = await LoadingSlip.findById(targetSlipId);

            if (!loadingSlip) {
                console.log('❌ Loading slip NOT found in database');

                // Check if there's a loading slip created around the same time
                const memoCreatedAt = new Date(problematicMemo.createdAt);
                const timeWindow = 5 * 60 * 1000; // 5 minutes

                const nearbySlips = await LoadingSlip.find({
                    createdAt: {
                        $gte: new Date(memoCreatedAt.getTime() - timeWindow),
                        $lte: new Date(memoCreatedAt.getTime() + timeWindow)
                    }
                }).sort({ createdAt: -1 });

                console.log(`\n🔍 Loading slips created within 5 minutes of memo:`);
                nearbySlips.forEach(slip => {
                    console.log(`  - ${slip.slip_number} (ID: ${slip._id}) - Created: ${slip.createdAt}`);
                    console.log(`    Supplier: ${slip.supplier}, Party: ${slip.party}`);
                });

                // Check if there's a loading slip with matching supplier
                const matchingSupplierSlips = await LoadingSlip.find({
                    supplier: problematicMemo.supplier,
                    createdAt: {
                        $gte: new Date(memoCreatedAt.getTime() - timeWindow),
                        $lte: new Date(memoCreatedAt.getTime() + timeWindow)
                    }
                });

                if (matchingSupplierSlips.length > 0) {
                    console.log(`\n✅ Found ${matchingSupplierSlips.length} loading slip(s) with matching supplier:`);
                    matchingSupplierSlips.forEach(slip => {
                        console.log(`  - ${slip.slip_number} (ID: ${slip._id})`);

                        // Check if this slip already has a memo
                        Memo.findOne({ loading_slip_id: slip._id }).then(existingMemo => {
                            if (existingMemo) {
                                console.log(`    ⚠️  Already has memo: ${existingMemo.memo_number}`);
                            } else {
                                console.log(`    ✅ No memo attached yet`);
                            }
                        });
                    });
                }
            } else {
                console.log('✅ Loading slip found:');
                console.log(JSON.stringify(loadingSlip, null, 2));
            }
        } else {
            console.log('❓ Memo MO-6181 not found');
        }

        // Wait for async operations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('\n✅ Investigation complete!');

    } catch (error) {
        console.error('❌ Investigation error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

investigateIssue();
