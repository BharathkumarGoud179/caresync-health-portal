const Message = require('../models/Message');
const User = require('../models/User');
const { hasDoctorAccess } = require('../utils/accessControl');

// @desc    Get chat message history with a specific user
// @route   GET /api/chat/:userId
exports.getChatHistory = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;

    const targetUser = await User.findById(targetUserId).select('name role specialization hospital');
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Access check: If one is doctor and one is patient, verify connection
    const doctorId = req.user.role === 'doctor' ? currentUserId : targetUserId;
    const patientId = req.user.role === 'patient' ? currentUserId : targetUserId;

    const hasAccess = await hasDoctorAccess(patientId, doctorId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Chat disabled: You can only communicate once a connection request is accepted.'
      });
    }

    // Fetch messages between these two users
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: targetUserId },
        { sender: targetUserId, recipient: currentUserId }
      ]
    }).sort({ createdAt: 1 }).limit(100);

    // Mark messages sent to me as read
    await Message.updateMany(
      { sender: targetUserId, recipient: currentUserId, read: false },
      { read: true }
    );

    res.status(200).json({
      success: true,
      targetUser,
      messages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send a message (REST fallback if socket not connected)
// @route   POST /api/chat/:userId
exports.sendMessage = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text cannot be empty.' });
    }

    const doctorId = req.user.role === 'doctor' ? currentUserId : targetUserId;
    const patientId = req.user.role === 'patient' ? currentUserId : targetUserId;

    const hasAccess = await hasDoctorAccess(patientId, doctorId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Cannot send message: Doctor and patient must have an accepted connection.'
      });
    }

    const message = await Message.create({
      sender: currentUserId,
      recipient: targetUserId,
      text: text.trim()
    });

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
