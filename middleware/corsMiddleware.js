import cors from 'cors';

// CORS configuration: allow localhost (dev) and production domains
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://omasalahub.com',
      'https://www.omasalahub.com',
      'https://dairydelightcheese.com',
      'https://www.dairydelightcheese.com'
    ];
    
    // Allow requests with no origin (like mobile apps, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      // Deny quietly. Throwing here becomes an unhandled 500 on the preflight,
      // which the browser reports as a CORS failure.
      callback(null, false);
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'token', 'x-order-token'],
  credentials: true,
  optionsSuccessStatus: 204,
};

export default cors(corsOptions);
