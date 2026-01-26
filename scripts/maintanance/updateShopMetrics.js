require('dotenv').config();
const mongoose = require('mongoose');
const Shop = require('../../src/models/Shop');
const Product = require('../../src/models/Product');

const updateShopMetrics = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');
    
    const shops = await Shop.find({});
    console.log(`Found ${shops.length} shops to update`);
    
    for (const shop of shops) {
      const totalProducts = await Product.countDocuments({ shop: shop._id });
      
      shop.metrics.totalProducts = totalProducts;
      await shop.save();
      
      console.log(`Updated shop ${shop.name}: ${totalProducts} products`);
    }
    
    console.log('All shop metrics updated successfully');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

updateShopMetrics();