const Order = require('../models/Order');
const notificationService = require('../services/notificationService');
const User = require('../models/User');
const crypto = require('crypto');

/**
 * Handle ZenoPay payment webhook callbacks
 * This endpoint receives payment status updates from ZenoPay SDK
 */
exports.handleZenopayCallback = async (req, res) => {
    try {
        const {
            order_id,
            status,
            payment_status,
            reference,
            amount,
            phone
        } = req.body;

        // Validate required fields
        if (!order_id) {
            console.error('Missing order_id in webhook payload');
            return res.status(400).json({
                success: false,
                message: 'Missing order_id'
            });
        }

        // Find the order by transaction ID
        const order = await Order.findOne({
            'paymentDetails.transactionId': order_id
        }).populate('user shop');

        if (!order) {
            console.error(`Order not found for transaction ID: ${order_id}`);
            return res.status(200).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Determine the status
        const paymentStatusValue = payment_status || status;

        // Map ZenoPay status to your order status
        let newPaymentStatus;
        let newOrderStatus;
        let notificationMessage;

        switch (paymentStatusValue?.toUpperCase()) {
            case 'COMPLETED':
            case 'SUCCESS':
            case 'SUCCESSFUL':
                newPaymentStatus = 'completed';
                newOrderStatus = 'pending';
                notificationMessage = {
                    buyer: `Payment confirmed for order #${order.orderNumber}! Your order is being processed.`,
                    shop: `Payment received for order #${order.orderNumber}. Please prepare the items for shipping.`
                };
                console.log('✅ Payment successful');
                break;

            case 'FAILED':
            case 'FAILURE':
                newPaymentStatus = 'failed';
                newOrderStatus = 'cancelled';
                notificationMessage = {
                    buyer: `Payment failed for order #${order.orderNumber}. Please try again or contact support.`,
                    shop: `Payment failed for order #${order.orderNumber}.`
                };
                console.log('❌ Payment failed');
                break;

            case 'PENDING':
            case 'PROCESSING':
                newPaymentStatus = 'pending';
                newOrderStatus = 'pending_payment';
                notificationMessage = null;
                break;

            default:
                newPaymentStatus = paymentStatusValue?.toLowerCase() || 'unknown';
                newOrderStatus = order.status;
                notificationMessage = null;
        }

        // Update order with payment details
        const previousStatus = order.paymentStatus;
        order.paymentStatus = newPaymentStatus;
        order.status = newOrderStatus;
        order.paymentDetails.status = newPaymentStatus;
        order.paymentDetails.reference = reference || order.paymentDetails.reference;

        if (newPaymentStatus === 'completed') {
            order.paymentDetails.completedAt = new Date();
        }

        // Add callback metadata
        order.paymentDetails.lastCallbackAt = new Date();
        order.paymentDetails.callbackData = {
            status: paymentStatusValue,
            amount,
            phone,
            receivedAt: new Date()
        };

        // Save the updated order
        await order.save();

        console.log(`✅ Order ${order.orderNumber} updated: ${previousStatus} → ${newPaymentStatus}`);

        // Send notifications if status changed to completed or failed
        if (notificationMessage) {
            const notifications = [];

            try {
                // FIXED: Check if order.user is already populated or just an ID
                let buyer = order.user;
                let shopOwner = order.shop;

                // If they're not populated (just IDs), fetch them
                if (!buyer?.username) {
                    buyer = await User.findById(order.user);
                }
                if (!shopOwner?.username) {
                    shopOwner = await User.findById(order.shop);
                }

                // Notify buyer
                if (buyer) {
                    notifications.push(
                        notificationService.createPersistentNotification(
                            buyer._id,
                            notificationMessage.buyer,
                            order._id
                        )
                    );

                    if (buyer.expoPushToken) {
                        notifications.push(
                            notificationService.sendPushNotification(
                                buyer.expoPushToken,
                                notificationMessage.buyer
                            )
                        );
                    }
                }

                // Notify shop owner
                if (shopOwner) {
                    notifications.push(
                        notificationService.createPersistentNotification(
                            shopOwner._id,
                            notificationMessage.shop,
                            order._id
                        )
                    );

                    if (shopOwner.expoPushToken) {
                        notifications.push(
                            notificationService.sendPushNotification(
                                shopOwner.expoPushToken,
                                notificationMessage.shop
                            )
                        );
                    }
                }

                // Execute all notifications concurrently
                await Promise.allSettled(notifications);
                console.log('✅ Notifications sent');
            } catch (notifError) {
                console.error('Error sending notifications:', notifError);
                // Don't fail the webhook because of notification errors
            }
        }

        // Respond with 200 OK
        res.status(200).json({
            success: true,
            message: 'Callback processed successfully',
            order_id: order_id,
            order_number: order.orderNumber,
            payment_status: newPaymentStatus
        });

    } catch (error) {
        console.error('❌ Error processing ZenoPay callback:', error);

        // Still return 200 to prevent ZenoPay from retrying
        res.status(200).json({
            success: false,
            message: 'Callback received but processing failed',
            error: error.message
        });
    }
};

/**
 * Optional: Manual order status check endpoint
 * Use this to manually verify payment status with ZenoPay
 */
exports.checkPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (!order.paymentDetails?.transactionId) {
            return res.status(400).json({
                success: false,
                message: 'No payment transaction found for this order'
            });
        }

        // Call ZenoPay API to check status
        const paymentService = require('../services/paymentService');
        const statusResult = await paymentService.checkPaymentStatus(
            order.paymentDetails.transactionId
        );

        console.log('Payment status check result:', statusResult);

        // Update order if status has changed
        if (statusResult.success) {
            const paymentStatus = statusResult.message?.status?.toUpperCase();

            if (paymentStatus === 'COMPLETED' || paymentStatus === 'SUCCESS') {
                order.paymentStatus = 'completed';
                order.status = 'pending';
                order.paymentDetails.status = 'completed';
                order.paymentDetails.completedAt = new Date();
                await order.save();

                console.log(`✅ Order ${order.orderNumber} updated to completed`);
            }
        }

        res.json({
            success: true,
            data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                paymentStatus: order.paymentStatus,
                orderStatus: order.status,
                zenopayStatus: statusResult
            }
        });

    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Test endpoint to verify webhook is accessible
 */
exports.testWebhook = (req, res) => {
    console.log('Webhook test endpoint hit');
    res.json({
        success: true,
        message: 'Webhook endpoint is accessible',
        timestamp: new Date().toISOString()
    });
};