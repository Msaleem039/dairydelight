import userModel from "../models/userModel.js";
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import validator from 'validator'

//login user
const loginUser = async (req,res) =>{
    const {email, password} = req.body;
    try {
        const user = await userModel.findOne({email});

        if(!user){
           return res.json({success:false, message:'User does not exist'}) 
        }

        const isMatch = await bcrypt.compare(password,user.password)

        if(!isMatch){
            return res.json({success:false, message:'Invalid credentials'})
        }

        const token = createToken(user._id);
        res.json({success:true, token, role:user.role})
    } catch (error) {
        console.log(error)
        res.json({success:false, message: error.message || 'Error'})
    }
}

const createToken = (id) =>{
    // Fallback value so login/register still work even if env var is missing
    const secret = process.env.JWT_SECRET || 'dev_fallback_jwt_secret_change_me';
    return jwt.sign({id}, secret);
}

//register user
const registerUser = async (req, res) =>{
    const {name,password,email,role} = req.body;
    try {

        // checking is user already exists
        const exists = await userModel.findOne({email});
        if(exists){
            return res.json({success:false, message:'User already exists'})
        }

        //validating email format and strong password
        if(!validator.isEmail(email)){
            return res.json({success:false, message:'Please enter a valid email'})
        }

        if(password.length<8){
            return res.json({success:false, message:'Please enter a strong password'})
        }

        // Validate role if provided
        if(role && !['admin','user'].includes(role)){
            return res.json({success:false, message:'Invalid role. Role must be admin or user'})
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password,salt);

        const newUser = new userModel({
            name:name,
            email:email,
            password:hashedPassword,
            role:role || 'user'
        })

      const user =  await newUser.save()
      const token = createToken(user._id)
      res.json({success:true, token, role:user.role})

    } catch (error) {
        console.log(error)
        res.json({success:false, message: error.message || 'Error'})
    }
}

export {loginUser, registerUser}