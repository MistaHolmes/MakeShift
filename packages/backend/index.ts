import express from 'express';
import cors from 'cors';
import { runPreBootChecks } from './boot';
import documentRoutes from './routes/documents';

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  'https://makeshift.abhasbehera.in',
  'http://localhost:3000', // For local development
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like server-to-server) or matched origins
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MakeShift Backend is running' });
});

app.use('/api/documents', documentRoutes);

async function startServer() {
  await runPreBootChecks();

  app.listen(port, () => {
    console.log(`[INFO] MakeShift Backend listening on port ${port}`);
  });
}

startServer();