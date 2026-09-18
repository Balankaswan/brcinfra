import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
    try {
        console.log('🔍 Testing MongoDB connection...\n');
        console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found (hidden for security)' : 'NOT FOUND');

        // Try to connect
        console.log('\n📡 Attempting to connect to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Successfully connected to MongoDB!\n');

        // Check connection state
        const state = mongoose.connection.readyState;
        const stateMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        console.log('Connection State:', stateMap[state]);
        console.log('Database Name:', mongoose.connection.name);
        console.log('Host:', mongoose.connection.host);

        // Test write operation
        console.log('\n📝 Testing write operation...');
        const testCollection = mongoose.connection.collection('test_connection');
        const testDoc = {
            test: true,
            timestamp: new Date(),
            message: 'Connection test'
        };

        const writeResult = await testCollection.insertOne(testDoc);
        console.log('✅ Write test successful! Inserted ID:', writeResult.insertedId);

        // Test read operation
        console.log('\n📖 Testing read operation...');
        const readResult = await testCollection.findOne({ _id: writeResult.insertedId });
        console.log('✅ Read test successful!', readResult);

        // Clean up test document
        await testCollection.deleteOne({ _id: writeResult.insertedId });
        console.log('\n🧹 Cleaned up test document');

        // Check collections
        console.log('\n📚 Available collections:');
        const collections = await mongoose.connection.db.listCollections().toArray();
        collections.forEach(col => {
            console.log(`  - ${col.name}`);
        });

        // Check if we can access LoadingSlip and Memo collections
        console.log('\n📊 Checking main collections:');
        const loadingSlipsCount = await mongoose.connection.collection('loadingslips').countDocuments();
        const memosCount = await mongoose.connection.collection('memos').countDocuments();
        console.log(`  - Loading Slips: ${loadingSlipsCount} documents`);
        console.log(`  - Memos: ${memosCount} documents`);

        console.log('\n✅ All connection tests passed!');

    } catch (error) {
        console.error('\n❌ Connection test failed!');
        console.error('Error:', error.message);
        console.error('Full error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

testConnection();
