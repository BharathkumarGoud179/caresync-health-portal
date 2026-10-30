const Notification = require('../models/Notification');

/**
 * Creates and saves a notification to DB, and emits it live via Socket.io
 * @param {Object} params
 * @param {string} params.recipient - User ID of recipient
 * @param {string} [params.sender] - User ID of sender
 * @param {string} params.type - notification type enum
 * @param {string} params.title - Title header
 * @param {string} params.message - Body text
 * @param {string} [params.link] - Action link or tab
 * @param {Object} [params.metadata] - Extra data
 * @param {Object} [params.io] - Socket.io server instance
 */
async function sendNotification({ recipient, sender, type, title, message, link = '', metadata = {}, io = null }) {
  try {
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      title,
      message,
      link,
      metadata
    });

    if (io && recipient) {
      // Emit to recipient's personal socket room
      io.to(recipient.toString()).emit('notification', {
        id: notification._id,
        recipient: notification.recipient,
        sender: notification.sender,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        read: notification.read,
        createdAt: notification.createdAt
      });
    }

    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

module.exports = {
  sendNotification
};
