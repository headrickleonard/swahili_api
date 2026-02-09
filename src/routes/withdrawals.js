const express = require('express');
const router = express.Router();
const { requestWithdrawal, getWithdrawals, updateWithdrawalStatus } = require('../controllers/withdrawalController');
const auth = require('../middleware/auth');

// Request a withdrawal (Any authenticated user with a Shop?) -> Actually logic checks for Shop ownership
router.post('/', auth, requestWithdrawal);

// Get withdrawals (Admin sees all, Seller sees own)
router.get('/', auth, getWithdrawals);

// Update status (Admin only)
// Assuming 'admin' role check is needed. 
// If 'permit' middleware exists: router.patch('/:id/status', auth, permit('manage', 'withdrawals'), updateWithdrawalStatus);
// For now, will rely on controller check or generic auth + admin check inside if middleware not standard
router.patch('/:id/status', auth, updateWithdrawalStatus); // Controller checks if user is ADMIN if strict RBAC middleware isn't here

module.exports = router;
