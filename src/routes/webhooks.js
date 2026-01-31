const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * POST /api/webhooks/zenopay/callback
 * Receives payment status callbacks from ZenoPay
 * 
 * IMPORTANT: This route should NOT have authentication middleware
 * because it's called by ZenoPay's servers, not your users
 */
router.post('/zenopay/callback', webhookController.handleZenopayCallback);

/**
 * GET /api/webhooks/zenopay/test
 * Test endpoint to verify webhook is accessible
 */
router.get('/zenopay/test', webhookController.testWebhook);

/**
 * GET /api/webhooks/orders/:orderId/payment-status
 * Manual endpoint to check payment status
 * Add your auth middleware if needed
 */
router.get('/orders/:orderId/payment-status', webhookController.checkPaymentStatus);

module.exports = router;