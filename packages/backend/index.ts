import express from 'express';
import cors from 'cors';
import { runPreBootChecks } from './boot';
import documentRoutes from './routes/documents';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
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