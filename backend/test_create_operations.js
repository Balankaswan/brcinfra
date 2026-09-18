import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LoadingSlip from './models/LoadingSlip.js';
import Memo from './models/Memo.js';

dotenv.config();

async function testCreateOperations() {
    try {
        console.log('🔍 Testing create operations...\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Test creating a loading slip
        console.log('📝 Testing Loading Slip creation...');
        const testSlipData = {
            slip_number: 'LS-TEST-' + Date.now(),
            date: new Date(),
            party: 'TEST PARTY',
            vehicle_no: 'TEST-1234',
            from_location: 'Test From',
            to_location: 'Test To',
            material: 'Test Material',
            dimension: '10x10',
            weight: 100,
            supplier: 'TEST SUPPLIER',
            freight: 10000,
            advance: 2000,
            rto: 500,
            total_freight: 10500,
            narration: 'Test loading slip'
        };

        console.log('Creating loading slip with data:', testSlipData.slip_number);
        const loadingSlip = new LoadingSlip(testSlipData);
        await loadingSlip.save();
        console.log('✅ Loading slip created successfully!');
        console.log('   ID:', loadingSlip._id);
        console.log('   Slip Number:', loadingSlip.slip_number);

        // Verify it was saved
        const savedSlip = await LoadingSlip.findById(loadingSlip._id);
        if (savedSlip) {
            console.log('✅ Loading slip verified in database');
        } else {
            console.log('❌ Loading slip NOT found in database after save!');
        }

        // Test creating a memo
        console.log('\n📝 Testing Memo creation...');
        const testMemoData = {
            memo_number: 'MO-TEST-' + Date.now(),
            loading_slip_id: loadingSlip._id,
            date: new Date(),
            supplier: 'TEST SUPPLIER',
            freight: 10000,
            commission: 400,
            mamool: 100,
            detention: 0,
            extra: 0,
            rto: 500,
            deduction: 0,
            narration: 'Test memo'
        };

        console.log('Creating memo with data:', testMemoData.memo_number);
        console.log('Loading slip reference:', testMemoData.loading_slip_id);
        const memo = new Memo(testMemoData);
        await memo.save();
        console.log('✅ Memo created successfully!');
        console.log('   ID:', memo._id);
        console.log('   Memo Number:', memo.memo_number);
        console.log('   Net Amount:', memo.net_amount);

        // Verify it was saved
        const savedMemo = await Memo.findById(memo._id);
        if (savedMemo) {
            console.log('✅ Memo verified in database');
        } else {
            console.log('❌ Memo NOT found in database after save!');
        }

        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        await LoadingSlip.findByIdAndDelete(loadingSlip._id);
        await Memo.findByIdAndDelete(memo._id);
        console.log('✅ Test data cleaned up');

        console.log('\n✅ All create operations working correctly!');

    } catch (error) {
        console.error('\n❌ Create operation test failed!');
        console.error('Error:', error.message);
        console.error('Full error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

testCreateOperations();
