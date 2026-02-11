const express = require('express');
const router = express.Router();
const { requestWithdrawal, getWithdrawals, updateWithdrawalStatus, getWalletBalance } = require('../controllers/withdrawalController');
const auth = require('../middleware/auth');

// Request a withdrawal (Any authenticated user with a Shop?) -> Actually logic checks for Shop ownership
router.post('/', auth, requestWithdrawal);
router.get('/balance', auth, getWalletBalance);

// Get withdrawals (Admin sees all, Seller sees own)
router.get('/', auth, getWithdrawals);

router.patch('/:id/status', auth, updateWithdrawalStatus);

module.exports = router;
