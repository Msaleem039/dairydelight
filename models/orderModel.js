import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    userId:{type:String, required: false}, // Optional for guest orders (cash on delivery)
    items:{type:Array, required: true},
    amount:{type:Number, required: true},
    address:{type:Object, required: true},
    status:{type:String, enum:['pending','confirmed','shipped','delivered','cancelled'], default:'pending'},
    date:{type:Date, default:Date.now()},
    payment:{type:Boolean, default:false},
})

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema)

export default orderModel;
