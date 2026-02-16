import mongoose from "mongoose";

export const connectDB = async () =>{
    await mongoose.connect('mongodb+srv://sk8901894_db_user:58lF98HlgWGxNCCO@cluster0.6ykangy.mongodb.net/?appName=Cluster0').then(()=>{
       console.log('DB connected') ;
    })
}