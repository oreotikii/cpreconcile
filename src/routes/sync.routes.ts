import { Router, Request, Response } from 'express';
import shopifyService from '../services/shopify.service';
import razorpayService from '../services/razorpay.service';
import easyecomService from '../services/easyecom.service';
import logger from '../utils/logger';
import config from '../config';

const router = Router();

/**
 * POST /api/sync/shopify
 * Manually sync Shopify orders
 */
router.post('/shopify', async (req: Request, res: Response) => {
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

    const count = await shopifyService.syncOrders(start, end);

    res.json({
      success: true,
      count,
      message: `Synced ${count} Shopify orders`,
    });
  } catch (error: any) {
    logger.error('Shopify sync failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sync/razorpay
 * Manually sync Razorpay payments
 */
router.post('/razorpay', async (req: Request, res: Response) => {
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

    const count = await razorpayService.syncPayments(start, end);

    res.json({
      success: true,
      count,
      message: `Synced ${count} Razorpay payments`,
    });
  } catch (error: any) {
    logger.error('Razorpay sync failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sync/easyecom
 * Manually sync Easyecom orders
 */
router.post('/easyecom', async (req: Request, res: Response) => {
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

    const count = await easyecomService.syncOrders(start, end);

    res.json({
      success: true,
      count,
      message: `Synced ${count} Easyecom orders`,
    });
  } catch (error: any) {
    logger.error('Easyecom sync failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sync/all
 * Sync all platforms
 */
router.post('/all', async (req: Request, res: Response) => {
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

    const [shopifyCount, razorpayCount, easyecomCount] = await Promise.all([
      shopifyService.syncOrders(start, end),
      razorpayService.syncPayments(start, end),
      easyecomService.syncOrders(start, end),
    ]);

    res.json({
      success: true,
      counts: {
        shopify: shopifyCount,
        razorpay: razorpayCount,
        easyecom: easyecomCount,
      },
      message: 'All platforms synced successfully',
    });
  } catch (error: any) {
    logger.error('Sync all failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
