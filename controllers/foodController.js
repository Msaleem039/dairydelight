import foodModel from '../models/foodModel.js'
import cloudinary from '../middleware/cloudinary.js'

//add food item

const addFood = async (req,res) =>{
    try {
        if (!req.cloudinaryResult) {
            return res.json({ success: false, message: 'Image upload failed' });
        }

        const food = new foodModel({
            name: req.body.name,
            description: req.body.description,
            price: req.body.price,
            category: req.body.category,
            image: req.cloudinaryResult.secure_url // Store Cloudinary URL
        })

        await food.save();
        res.json({success:true, message:'Food Added'})
    } catch (error) {
        console.log(error)
        res.json({success:false, message:'Error'})
    }
}

// All food list

const listFood = async (req,res) =>{
    try {
        const foods = await foodModel.find({});
        res.json({success:true,data:foods})
    } catch (error) {
        console.log(error)
        res.json({success:false, message:'Error'})
    }
}

// remove food item

const removeFood = async (req,res)=>{
    try {
        const food = await foodModel.findById(req.body.id);
        
        if (food && food.image) {
            try {
                // Extract public_id from Cloudinary URL
                // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/cheese/filename.jpg
                // public_id should be: cheese/filename
                const match = food.image.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
                if (match && match[1]) {
                    const publicId = match[1];
                    // Delete from Cloudinary
                    await cloudinary.uploader.destroy(publicId);
                }
            } catch (cloudinaryError) {
                console.log('Error deleting from Cloudinary:', cloudinaryError);
                // Continue with database deletion even if Cloudinary deletion fails
            }
        }

        await foodModel.findByIdAndDelete(req.body.id)
        res.json({success:true, message:'Food Removed'})
    } catch (error) {
        console.log(error)
        res.json({success:false, message:'Error'})
    }
}

export {addFood, listFood, removeFood}