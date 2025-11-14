import { Router, Request, Response } from 'express';
import reconciliationService from '../services/reconciliation.service';
import logger from '../utils/logger';
import config from '../config';

const router = Router();

/**
 * POST /api/reconciliation/run
 * Manually trigger a reconciliation run
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, lookbackDays } = req.body;

    let start: Date;
    let end: Date = new Date();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const days = lookbackDays || config.reconciliation.lookbackDays;
      start = new Date();
      start.setDate(start.getDate() - days);
    }

    logger.info(`Manual reconciliation triggered from ${start.toISOString()} to ${end.toISOString()}`);

    const runId = await reconciliationService.reconcile(start, end);

    res.json({
      success: true,
      runId,
      message: 'Reconciliation completed successfully',
    });
  } catch (error: any) {
    logger.error('Manual reconciliation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/reconciliation/report/:runId?
 * Get reconciliation report
 */
router.get('/report/:runId?', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const report = await reconciliationService.getReport(runId);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error('Failed to get reconciliation report:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/reconciliation/logs
 * Get reconciliation run logs
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await reconciliationService.getLogs(limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    logger.error('Failed to get reconciliation logs:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
