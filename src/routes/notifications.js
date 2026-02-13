const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Get all notifications for user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id
    }).sort('-createdAt');

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {

    res.status(500).send('Server error');
  }
});

//  bulk mark as read
router.post('/mark-all-read', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id },
      { read: true }
    );

    res.json({
      success: true,
      data: { message: 'All notifications marked as read' },
      errors: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errors: [error.message],
      data: null
    });
  }
});


router.patch('/:notificationId/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: req.params.notificationId,
        recipient: req.user._id // Security check
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        errors: ['Notification not found'],
        data: null
      });
    }

    res.json({
      success: true,
      data: notification,
      errors: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errors: [error.message],
      data: null
    });
  }
});

// Delete a notification
router.delete('/:notificationId', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.notificationId,
      recipient: req.user._id 
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        errors: ['Notification not found'],
        data: null
      });
    }

    res.json({
      success: true,
      data: { message: 'Notification deleted successfully' },
      errors: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errors: [error.message],
      data: null
    });
  }
});


module.exports = router;