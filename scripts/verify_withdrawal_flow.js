const mongoose = require('mongoose');
const User = require('../src/models/User').User;
const Shop = require('../src/models/Shop');
const Order = require('../src/models/Order');
const WithdrawalRequest = require('../src/models/WithdrawalRequest');
const { requestWithdrawal, updateWithdrawalStatus } = require('../src/controllers/withdrawalController');
const connectDB = require('../src/config/db');
require('dotenv').config();

// Mocks
const mockReq = (body = {}, user = {}, params = {}, query = {}) => ({
    body,
    user,
    params,
    query
});

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

async function verifyFlow() {
    try {
        // Connect DB using shared config
        await connectDB();
        console.log('Connected to DB');

        // 1. Create Data
        // Admin User
        const adminUser = new User({
            username: 'admin_test_' + Date.now(),
            email: 'admin_test_' + Date.now() + '@example.com',
            password: 'hashedpassword',
            userType: 'ADMIN',
            paymentMethods: [{ type: 'mobile_money', isDefault: true, details: { phoneNumber: '0000000000', provider: 'Test' } }] // Satisfy required fields
        });
        // Add required fields if missing in schema validation (from User.js: paymentMethods required?)
        // User.js: paymentMethods is array, required? No, but inside it type is required. 
        // Wait, User.js line 112: paymentMethods: [{ type: ... required: true }]
        // But the array itself is not required?
        // Let's safecheck.

        await adminUser.save();

        // Seller User
        const sellerUser = new User({
            username: 'seller_test_' + Date.now(),
            email: 'seller_test_' + Date.now() + '@example.com',
            password: 'hashedpassword',
            userType: 'SELLER'
        });
        await sellerUser.save();

        // Shop
        const shop = new Shop({
            name: 'Test Shop ' + Date.now(),
            owner: sellerUser._id,
            description: 'Test Description',
            status: 'active',
            address: {
                street: '123 Test St',
                city: 'Test City',
                country: 'Test Country'
            },
            contactInfo: {
                email: 'test@shop.com',
                phone: '1234567890'
            },
            wallet: { currentBalance: 0, lockedBalance: 0 }
        });
        await shop.save();

        console.log(`Created Seller: ${sellerUser._id}, Shop: ${shop._id}`);

        // 2. Simulate Order Delivery to Credit Wallet
        // Simulate what orderController does
        console.log('--- Simulating Order Delivery ---');
        shop.wallet.currentBalance += 50000;
        await shop.save();
        console.log(`Shop Balance: ${shop.wallet.currentBalance}`);

        // 3. Request Withdrawal
        console.log('--- Requesting Withdrawal (10000) ---');
        const req = mockReq(
            {
                amount: 10000,
                paymentDetails: { type: 'mobile_money', details: { phoneNumber: '0712345678', provider: 'Tigo' } }
            },
            { _id: sellerUser._id, userType: 'SELLER' }
        );
        const res = mockRes();

        await requestWithdrawal(req, res);

        if (res.data.success) {
            console.log('Withdrawal Requested Successfully');
            // console.log(JSON.stringify(res.data, null, 2));
        } else {
            console.error('Withdrawal Request Failed:', res.data.errors);
            process.exit(1);
        }

        // Verify Balances
        const updatedShop = await Shop.findById(shop._id);
        console.log(`Shop Balance: ${updatedShop.wallet.currentBalance} (Expected 40000)`);
        console.log(`Locked Balance: ${updatedShop.wallet.lockedBalance} (Expected 10000)`);

        if (updatedShop.wallet.currentBalance !== 40000 || updatedShop.wallet.lockedBalance !== 10000) {
            console.error('Balance verification failed!');
            process.exit(1);
        }

        // 4. Admin Approve
        console.log('--- Admin Approving Withdrawal ---');
        const withdrawalId = res.data.data.withdrawal._id;
        const adminReq = mockReq(
            { status: 'approved', adminNote: 'Verified manually' },
            { _id: adminUser._id, userType: 'ADMIN' },
            { id: withdrawalId }
        );
        const adminRes = mockRes();

        await updateWithdrawalStatus(adminReq, adminRes);

        if (adminRes.data.success) {
            console.log('Withdrawal Approved');
        } else {
            console.error('Approval Failed:', adminRes.data.errors);
            process.exit(1);
        }

        // Verify Final Balances
        const finalShop = await Shop.findById(shop._id);
        console.log(`Final Shop Balance: ${finalShop.wallet.currentBalance} (Expected 40000)`);
        console.log(`Final Locked Balance: ${finalShop.wallet.lockedBalance} (Expected 0)`);

        if (finalShop.wallet.lockedBalance !== 0) {
            console.error('Final Locked Balance should be 0');
            process.exit(1);
        }

        console.log('VERIFICATION SUCCESSFUL');

        // Cleanup
        await User.deleteMany({ email: { $in: [adminUser.email, sellerUser.email] } });
        await Shop.deleteOne({ _id: shop._id });
        await WithdrawalRequest.deleteOne({ _id: withdrawalId });

        mongoose.connection.close();
        process.exit(0);

    } catch (err) {
        console.error('Verification Script Error:', err);
        process.exit(1);
    }
}

verifyFlow();
