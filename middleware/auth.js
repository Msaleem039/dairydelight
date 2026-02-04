import  jwt  from 'jsonwebtoken';

const authMiddleware = async (req, res, next) =>{
    // Support both 'token' header and 'Authorization: Bearer <token>'
    let token = req.headers.token;
    if (!token && req.headers.authorization) {
        // Extract token from "Bearer <token>"
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    
    if(!token){
        return res.json({success:false, message:'Not Authorized, login again'})
    }

    try {
        const token_decode = jwt.verify(token, process.env.JWT_SECRET || 'dev_fallback_jwt_secret_change_me');
        req.body.userId = token_decode.id;
        next();
    } catch (error) {
        console.log(error)
        res.json({success:false, message:'Error'})
    }
}

export default authMiddleware;