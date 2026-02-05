import orderModel from './../models/orderModel.js';
import userModel from './../models/userModel.js';

// Placing user order for frontend (Cash on Delivery)
const placeOrder = async (req, res) => {
    try {
        // Validate required fields
        if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.json({ success: false, message: 'Items are required and must be an array' });
        }
        if (!req.body.amount || typeof req.body.amount !== 'number') {
            return res.json({ success: false, message: 'Amount is required and must be a number' });
        }
        if (!req.body.address || typeof req.body.address !== 'object') {
            return res.json({ success: false, message: 'Address is required and must be an object' });
        }

        // Create order (userId is optional for cash on delivery)
        const newOrder = new orderModel({
            userId: req.body.userId || null, // Optional - can be null for guest orders
            items: req.body.items,
            amount: req.body.amount,
            address: req.body.address,
            status: 'pending',
            payment: false // Cash on delivery - payment will be false initially
        })
        await newOrder.save();
        // Clear user cart only if userId is provided
        if (req.body.userId) {
            try {
                await userModel.findByIdAndUpdate(req.body.userId, { cartData: {} });
            } catch (cartError) {
                console.log('Cart clear error (non-critical):', cartError);
                // Continue even if cart clearing fails
            }
        }

        res.json({ 
            success: true, 
            message: 'Order placed successfully (Cash on Delivery)',
            orderId: newOrder._id
        })
    } catch (error) {
        console.log('Place Order Error:', error);
        res.json({ success: false, message: error.message || 'Error placing order' })
    }
}

const verifyOrder = async (req, res) =>{
    const {orderId, success} = req.body;
    try {
        if(success=='true'){
            await orderModel.findByIdAndUpdate(orderId,{payment:true});
            res.json({success:true, message:"Paid"})
        }else{
            await orderModel.findByIdAndDelete(orderId);
            res.json({success:false, message:"Not Paid"})
        }
    } catch (error) {
        console.log('Error:', error);
        res.json({success:false, message: error.message || "Error"})
    }
}

// user orders for frontend
const userOrders = async (req,res) => {
    try {
        const orders = await orderModel.find({userId:req.body.userId})
        res.json({success:true, data:orders})
    } catch (error) {
        console.log('Error:', error);
        res.json({success:false, message: error.message || "Error"})
    }
}

// listing orders for admin panel - only pending orders
const listOrders = async (req,res) =>{
   try {
    const orders = await orderModel.find({ status: 'pending' })
      .sort({ date: -1 }); // Sort by newest first
    res.json({success:true, data:orders})
   } catch (error) {
        console.log(error)
        res.json({success:false, message:"Error"})  
   } 
}

// api for updating order status
// const updateStatus = async (req, res) =>{
//     try {
//         await orderModel.findByIdAndUpdate(req.body.orderId,{status:req.body.status})
//         res.json({success:true, message:"Status Updated"})
//     } catch (error) {
//         console.log(error)
//         res.json({success:false, message:"Error"})  
//     }
// }
const updateStatus = async (req, res) => {
    try {
      const { orderId, status } = req.body;
  
      await orderModel.findByIdAndUpdate(
        orderId,
        { status },
        { new: true }
      );
  
      res.json({ success: true, message: "Status Updated Successfully" });
    } catch (error) {
      console.log(error);
      res.json({ success: false, message: "Error updating status" });
    }
  };
  
 // listing all processed orders (all orders that are NOT pending)
 const listDeliveredOrders = async (req, res) => {
    try {
      const orders = await orderModel.find({ 
        status: { $ne: 'pending' } // Show all orders that are NOT pending
      })
        .sort({ date: -1 }); // Sort by newest first
  
      res.json({ success: true, data: orders });
    } catch (error) {
      console.log(error);
      res.json({ success: false, message: 'Error fetching processed orders' });
    }
  };
export {placeOrder, verifyOrder, userOrders,listOrders, updateStatus, listDeliveredOrders}