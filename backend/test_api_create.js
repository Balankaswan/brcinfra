import fetch from 'node-fetch';

async function testApiCreate() {
    const url = 'http://localhost:5001/api/loading-slips';
    const payload = {
        slip_number: `LS-TEST-API-${Date.now()}`,
        date: new Date(),
        vehicle_no: 'API-TEST-01',
        party: 'API TEST PARTY',
        from_location: 'A',
        to_location: 'B',
        supplier: 'API TEST SUPPLIER',
        weight: 10,
        rate: 100,
        freight: 1000,
        total_freight: 1000
    };

    console.log('🚀 Sending POST to:', url);
    console.log('Payload:', payload);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response:', data);

    } catch (error) {
        console.error('❌ Request Failed:', error);
    }
}

testApiCreate();
