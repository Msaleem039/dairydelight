import cors from 'cors';

// Development-friendly CORS: allow all origins, keep credentials support.
// You can tighten this later for production.
const corsOptions = {
  origin: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204,
};

export default cors(corsOptions);
