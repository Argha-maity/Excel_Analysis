const express = require('express');
const router = express.Router();
const {
    listUsers,
    getUser,
    deleteUser,
    getSystemSettings,
    updateSystemSettings,
    updateUser,
} = require('../controllers/admin');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/users', protect, adminOnly, listUsers);
router.get('/users/:id', protect, adminOnly, getUser);
router.delete('/users/:id', protect, adminOnly, deleteUser);
router.get('/settings', protect, adminOnly, getSystemSettings);
router.patch('/settings', protect, adminOnly, updateSystemSettings);
router.put('/users/:id', protect, adminOnly, updateUser);

module.exports = router;