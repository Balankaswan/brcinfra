import fetch from 'node-fetch';

const API_URL = 'http://localhost:5001/api';

async function testAPI() {
    try {
        console.log('🔍 Testing API endpoints...\n');

        // Test 1: Health check
        console.log('1️⃣ Testing health endpoint...');
        const healthResponse = await fetch('http://localhost:5001/health');
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);

        // Test 2: Get loading slips
        console.log('\n2️⃣ Testing GET /api/loading-slips...');
        const getSlipsResponse = await fetch(`${API_URL}/loading-slips?limit=5`);
        const slipsData = await getSlipsResponse.json();
        console.log('✅ GET loading slips:', {
            total: slipsData.total,
            count: slipsData.loadingSlips?.length,
            firstSlip: slipsData.loadingSlips?.[0]?.slip_number
        });

        // Test 3: Create a test loading slip
        console.log('\n3️⃣ Testing POST /api/loading-slips...');
        const testSlipData = {
            slip_number: 'LS-API-TEST-' + Date.now(),
            date: new Date().toISOString(),
            party: 'API TEST PARTY',
            vehicle_no: 'API-TEST-1234',
            from_location: 'API Test From',
            to_location: 'API Test To',
            material: 'API Test Material',
            dimension: '10x10',
            weight: 100,
            supplier: 'API TEST SUPPLIER',
            freight: 10000,
            advance: 2000,
            rto: 500,
            total_freight: 10500,
            narration: 'API Test loading slip'
        };

        const createSlipResponse = await fetch(`${API_URL}/loading-slips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testSlipData)
        });

        if (!createSlipResponse.ok) {
            const errorText = await createSlipResponse.text();
            console.log('❌ Create loading slip failed!');
            console.log('Status:', createSlipResponse.status);
            console.log('Error:', errorText);
        } else {
            const createSlipData = await createSlipResponse.json();
            console.log('✅ Loading slip created via API!');
            console.log('   Slip Number:', createSlipData.loadingSlip?.slip_number);
            console.log('   ID:', createSlipData.loadingSlip?.id);

            const createdSlipId = createSlipData.loadingSlip?.id;

            // Test 4: Create a memo for this loading slip
            console.log('\n4️⃣ Testing POST /api/memos...');
            const testMemoData = {
                memo_number: 'MO-API-TEST-' + Date.now(),
                loading_slip_id: createdSlipId,
                date: new Date().toISOString(),
                supplier: 'API TEST SUPPLIER',
                freight: 10000,
                commission: 400,
                mamool: 100,
                detention: 0,
                extra: 0,
                rto: 500,
                deduction: 0,
                narration: 'API Test memo'
            };

            const createMemoResponse = await fetch(`${API_URL}/memos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testMemoData)
            });

            if (!createMemoResponse.ok) {
                const errorText = await createMemoResponse.text();
                console.log('❌ Create memo failed!');
                console.log('Status:', createMemoResponse.status);
                console.log('Error:', errorText);
            } else {
                const createMemoData = await createMemoResponse.json();
                console.log('✅ Memo created via API!');
                console.log('   Memo Number:', createMemoData.memo?.memo_number);
                console.log('   ID:', createMemoData.memo?.id);

                // Clean up - delete memo
                console.log('\n🧹 Cleaning up test data...');
                await fetch(`${API_URL}/memos/${createMemoData.memo?.id}`, { method: 'DELETE' });
                console.log('   Deleted test memo');
            }

            // Clean up - delete loading slip
            await fetch(`${API_URL}/loading-slips/${createdSlipId}`, { method: 'DELETE' });
            console.log('   Deleted test loading slip');
        }

        console.log('\n✅ API tests complete!');

    } catch (error) {
        console.error('\n❌ API test failed!');
        console.error('Error:', error.message);
        console.error('Full error:', error);
    }
}

testAPI();
