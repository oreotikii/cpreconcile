import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import config from './config';
import logger from './utils/logger';
import reconciliationRoutes from './routes/reconciliation.routes';
import syncRoutes from './routes/sync.routes';
import healthRoutes from './routes/health.routes';

const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/sync', syncRoutes);

// API documentation endpoint
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'CPReconcile',
    version: '1.0.0',
    description: 'Backend reconciliation system for Shopify, Razorpay, and Easyecom',
    endpoints: {
      health: '/api/health',
      status: '/api/health/status',
      reconciliation: {
        run: 'POST /api/reconciliation/run',
        report: 'GET /api/reconciliation/report/:runId?',
        logs: 'GET /api/reconciliation/logs',
      },
      sync: {
        shopify: 'POST /api/sync/shopify',
        razorpay: 'POST /api/sync/razorpay',
        easyecom: 'POST /api/sync/easyecom',
        all: 'POST /api/sync/all',
      },
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'An error occurred',
  });
});

export default app;
