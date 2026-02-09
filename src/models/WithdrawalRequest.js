const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    paymentDetails: {
        // Basic snapshot of where the money should go. 
        type: {
            type: String,
            enum: ['bank', 'mobile_money'],
            required: true
        },
        details: {
            accountName: String,
            accountNumber: String,
            bankName: String, // For bank
            phoneNumber: String, // For mobile money
            provider: String // For mobile money (e.g., M-Pesa, Tigo)
        }
    },
    adminNote: {
        type: String
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
