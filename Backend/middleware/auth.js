const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Authorization header missing or improperly formatted');
        return res.status(401).json({ 
            error: "Authentication required",
            details: "Authorization header missing or malformed"
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (!decoded || !decoded.id) {
            console.error('Decoded token missing expected fields:', decoded);
            return res.status(401).json({ error: "Invalid token payload" });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return res.status(401).json({ error: "Not authorized, token invalid" });
    }
};

module.exports = { protect };
