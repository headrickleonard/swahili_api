require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../../src/models/User');
const Shop = require('../../src/models/Shop');

const migrateHasShopFlag = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    // Find all shops and get their owner IDs
    console.log('Finding all shops...');
    const shops = await Shop.find({}, 'owner');
    console.log(`Found ${shops.length} shops`);
    
    const ownerIds = shops.map(shop => shop.owner);
    
    // Update all users who own shops but don't have hasShop flag set
    console.log('Updating users...');
    const result = await User.updateMany(
      { _id: { $in: ownerIds }, hasShop: { $ne: true } },
      { $set: { hasShop: true } }
    );
    
    console.log(`Migration complete: ${result.modifiedCount} users updated`);
    console.log(`Total users with shops: ${ownerIds.length}`);
    
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

migrateHasShopFlag();