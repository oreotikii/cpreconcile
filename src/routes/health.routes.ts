import { Router, Request, Response } from 'express';
import scheduler from '../scheduler';
import prisma from '../utils/database';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      scheduler: scheduler.getStatus(),
    });
  } catch (error: any) {
    logger.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /api/status
 * Get system status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const [shopifyCount, razorpayCount, easyecomCount, reconciliationCount] = await Promise.all([
      prisma.shopifyOrder.count(),
      prisma.razorpayPayment.count(),
      prisma.easyecomOrder.count(),
      prisma.reconciliation.count(),
    ]);

    const latestLog = await prisma.reconciliationLog.findFirst({
      orderBy: { startTime: 'desc' },
    });

    res.json({
      success: true,
      data: {
        records: {
          shopifyOrders: shopifyCount,
          razorpayPayments: razorpayCount,
          easyecomOrders: easyecomCount,
          reconciliations: reconciliationCount,
        },
        scheduler: scheduler.getStatus(),
        latestReconciliation: latestLog,
      },
    });
  } catch (error: any) {
    logger.error('Status check failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
