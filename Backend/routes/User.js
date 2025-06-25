const express = require("express");
const { 
    handleUserSignup, 
    handleUserLogin,
    getCurrentUser,
} = require("../controllers/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", handleUserSignup);
router.post("/login", handleUserLogin);
router.get("/me", protect, getCurrentUser);

module.exports = router;