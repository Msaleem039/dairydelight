import cors from 'cors';

// CORS configuration: allow localhost (dev) and production domains
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      // Development
      'http://localhost:3000',
      'http://localhost:3001',
      // Production
      'https://dairydelightcheese.com',
      'https://www.dairydelightcheese.com'
    ];
    
    // Allow requests with no origin (like mobile apps, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'token'],
  credentials: true,
  optionsSuccessStatus: 204,
};

export default cors(corsOptions);
