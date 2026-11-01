import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const adminAuth = async (req, res, next) => {
    // Support both 'token' header and 'Authorization: Bearer <token>'
    let token = req.headers.token;
    if (!token && req.headers.authorization) {
        // Extract token from "Bearer <token>"
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'forbidden', message: 'Not Authorized, login again' });
    }

    try {
        const token_decode = jwt.verify(token, process.env.JWT_SECRET || 'dev_fallback_jwt_secret_change_me');
        const user = await userModel.findById(token_decode.id);
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'forbidden', message: 'User not found' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'forbidden', message: 'Access denied. Admin role required' });
        }

        req.body = req.body || {};
        req.body.userId = token_decode.id;
        next();
    } catch (error) {
        console.log(error);
        res.status(401).json({ success: false, error: 'forbidden', message: 'Error' });
    }
};

export default adminAuth;

