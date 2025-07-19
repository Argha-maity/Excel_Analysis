const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
const mongoose = require('mongoose');

async function listUsers(req, res) {
    try {
        // Only allow admin access
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }

        const users = await User.find({}, '-password -__v');
        res.json(users);
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

async function getUser(req, res) {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

async function deleteUser(req, res) {
    try {
        // 1. Verify authentication
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        // 2. Verify authorization
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        // 3. Validate target user ID
        if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid target user ID' });
        }

        // 4. Convert IDs to strings for safe comparison
        const currentUserId = req.user._id.toString();
        const targetUserId = req.params.id;

        // 5. Prevent self-deletion
        if (currentUserId === targetUserId) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        // 6. Perform deletion
        const deletedUser = await User.findByIdAndDelete(targetUserId);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            message: 'Server error during deletion',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

async function getSystemSettings(req, res) {
    try {
        // Admin check
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }

        let settings = await SystemSettings.findOne();
        if (!settings) {
            // Create default settings if none exist
            settings = await SystemSettings.create({
                maxFileSize: 10, // 10MB default
                allowedFileTypes: ['.xlsx', '.xls', '.csv']
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error getting system settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

async function updateSystemSettings(req, res) {
    try {
        // Admin check
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }

        const { maxFileSize, allowedFileTypes } = req.body;

        // Validate input
        if (!maxFileSize || !allowedFileTypes) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = new SystemSettings();
        }

        settings.maxFileSize = maxFileSize;
        settings.allowedFileTypes = Array.isArray(allowedFileTypes)
            ? allowedFileTypes
            : allowedFileTypes.split(',').map(item => item.trim());

        await settings.save();

        res.json({ message: 'Settings updated successfully', settings });
    } catch (error) {
        console.error('Error updating system settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    listUsers,
    getUser,
    deleteUser,
    getSystemSettings,
    updateSystemSettings,
}