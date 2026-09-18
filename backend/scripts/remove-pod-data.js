import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Remove POD data from all bills
const removePodData = async () => {
  try {
    console.log('🔄 Starting POD data removal from bills...');
    
    // Get bills collection
    const db = mongoose.connection.db;
    const billsCollection = db.collection('bills');
    
    // Check how many bills have pod_image data
    const billsWithPod = await billsCollection.countDocuments({ pod_image: { $exists: true, $ne: null } });
    console.log(`📊 Found ${billsWithPod} bills with POD data`);
    
    if (billsWithPod === 0) {
      console.log('✅ No POD data found in bills. Nothing to remove.');
      return;
    }
    
    // Calculate storage space being used by POD images
    const sampleBill = await billsCollection.findOne({ pod_image: { $exists: true, $ne: null } });
    if (sampleBill && sampleBill.pod_image) {
      const avgPodSize = Buffer.byteLength(sampleBill.pod_image, 'utf8');
      const totalPodSize = avgPodSize * billsWithPod;
      console.log(`💾 Estimated POD storage usage: ${(totalPodSize / (1024 * 1024)).toFixed(2)} MB`);
    }
    
    // Remove pod_image field from all bills
    const result = await billsCollection.updateMany(
      { pod_image: { $exists: true } },
      { $unset: { pod_image: "" } }
    );
    
    console.log(`✅ Successfully removed POD data from ${result.modifiedCount} bills`);
    
    // Verify removal
    const remainingPodBills = await billsCollection.countDocuments({ pod_image: { $exists: true, $ne: null } });
    console.log(`📊 Bills with POD data remaining: ${remainingPodBills}`);
    
    if (remainingPodBills === 0) {
      console.log('🎉 All POD data successfully removed from bills!');
    }
    
  } catch (error) {
    console.error('❌ Error removing POD data:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await removePodData();
    
    console.log('\n🎯 POD removal completed successfully!');
    console.log('💡 Benefits:');
    console.log('   - Reduced database storage usage');
    console.log('   - Improved query performance');
    console.log('   - Eliminated MongoDB memory limit errors');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();
