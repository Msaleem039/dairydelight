import mongoose from "mongoose";



export const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://sk8901894_db_user:58lF98HlgWGxNCCO@cluster0.6ykangy.mongodb.net/dairydelight?appName=Cluster0';
        
        const options = {
            // Connection pool options
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            // Retry options
            retryWrites: true,
            retryReads: true,
        };

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected. Reconnecting...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });

        await mongoose.connect(mongoURI, options);
        console.log('✅ DB connected successfully');
    } catch (error) {
        console.error('❌ DB connection error:', error.message);
        if (error.name === 'MongoServerSelectionError') {
            console.error('⚠️ Could not connect to MongoDB server. Check your connection string and network.');
        }
        // Retry connection after 5 seconds
        setTimeout(() => {
            console.log('🔄 Retrying DB connection...');
            connectDB();
        }, 5000);
    }
}