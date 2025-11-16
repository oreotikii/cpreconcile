import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * Interface for correlated order data
 */
interface CorrelatedOrder {
  shopifyOrder: {
    id: string;
    shopifyOrderId: string;
    shopifyOrderNumber: string;
    email: string | null;
    totalPrice: number;
    currency: string;
    financialStatus: string;
    fulfillmentStatus: string | null;
    createdAt: string;
  };
  easyecomOrder: {
    id: string;
    easyecomOrderId: string;
    referenceNumber: string | null;
    marketplaceOrderId: string | null;
    totalAmount: number;
    currency: string;
    status: string;
    paymentStatus: string | null;
    createdAt: string;
  } | null;
  matchStatus: 'matched' | 'unmatched';
  amountDifference: number;
}

/**
 * GET /api/orders/correlated
 * Fetch correlated Shopify and Easyecom orders
 */
router.get('/correlated', async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const {
      startDate,
      endDate,
      matchStatus,
      minAmountDiff,
      maxAmountDiff,
    } = req.query;

    // Set default date range (last 30 days)
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date();
    if (!startDate) {
      start.setDate(start.getDate() - 30);
    }

    logger.info(`Fetching orders from ${start.toISOString()} to ${end.toISOString()}`);

    // Fetch Shopify orders
    const shopifyOrders = await prisma.shopifyOrder.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch Easyecom orders
    const easyecomOrders = await prisma.easyecomOrder.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Create a map of Easyecom orders for quick lookup
    const easyecomMap = new Map();
    easyecomOrders.forEach(order => {
      if (order.marketplaceOrderId) {
        easyecomMap.set(order.marketplaceOrderId.toLowerCase(), order);
      }
      if (order.referenceNumber) {
        easyecomMap.set(order.referenceNumber.toLowerCase(), order);
        // Extract order number from reference code (e.g., "CPO/43560/25-26" -> "43560")
        const match = order.referenceNumber.match(/CPO\/(\d+)\//);
        if (match && match[1]) {
          easyecomMap.set(match[1], order);
        }
      }
    });

    // Correlate orders
    const correlatedOrders: CorrelatedOrder[] = [];
    const matchedEasyecomIds = new Set<string>();

    shopifyOrders.forEach(shopifyOrder => {
      const shopifyId = shopifyOrder.shopifyOrderId.toString();
      const reference = shopifyOrder.shopifyOrderNumber ? `#${shopifyOrder.shopifyOrderNumber}` : '';

      // Try matching by: Shopify ID, reference with #, reference without #, or just the order number
      const easyecomOrder = easyecomMap.get(shopifyId.toLowerCase()) ||
                           easyecomMap.get(reference.toLowerCase()) ||
                           easyecomMap.get(shopifyOrder.shopifyOrderNumber);

      const amountDiff = easyecomOrder
        ? Math.abs(shopifyOrder.totalPrice - easyecomOrder.totalAmount)
        : 0;

      const correlatedOrder: CorrelatedOrder = {
        shopifyOrder: {
          id: shopifyOrder.id,
          shopifyOrderId: shopifyOrder.shopifyOrderId,
          shopifyOrderNumber: shopifyOrder.shopifyOrderNumber,
          email: shopifyOrder.email,
          totalPrice: shopifyOrder.totalPrice,
          currency: shopifyOrder.currency,
          financialStatus: shopifyOrder.financialStatus,
          fulfillmentStatus: shopifyOrder.fulfillmentStatus,
          createdAt: shopifyOrder.createdAt.toISOString(),
        },
        easyecomOrder: easyecomOrder ? {
          id: easyecomOrder.id,
          easyecomOrderId: easyecomOrder.easyecomOrderId,
          referenceNumber: easyecomOrder.referenceNumber,
          marketplaceOrderId: easyecomOrder.marketplaceOrderId,
          totalAmount: easyecomOrder.totalAmount,
          currency: easyecomOrder.currency,
          status: easyecomOrder.status,
          paymentStatus: easyecomOrder.paymentStatus,
          createdAt: easyecomOrder.createdAt.toISOString(),
        } : null,
        matchStatus: easyecomOrder ? 'matched' : 'unmatched',
        amountDifference: amountDiff,
      };

      if (easyecomOrder) {
        matchedEasyecomIds.add(easyecomOrder.id);
      }

      correlatedOrders.push(correlatedOrder);
    });

    // Add unmatched Easyecom orders
    const unmatchedEasyecom = easyecomOrders.filter(
      order => !matchedEasyecomIds.has(order.id)
    );

    // Filter results based on query parameters
    let filteredOrders = correlatedOrders;

    if (matchStatus) {
      filteredOrders = filteredOrders.filter(
        order => order.matchStatus === matchStatus
      );
    }

    if (minAmountDiff !== undefined) {
      const minDiff = parseFloat(minAmountDiff as string);
      filteredOrders = filteredOrders.filter(
        order => order.amountDifference >= minDiff
      );
    }

    if (maxAmountDiff !== undefined) {
      const maxDiff = parseFloat(maxAmountDiff as string);
      filteredOrders = filteredOrders.filter(
        order => order.amountDifference <= maxDiff
      );
    }

    // Calculate summary statistics
    const totalShopifyAmount = shopifyOrders.reduce(
      (sum, o) => sum + (o.totalPrice || 0),
      0
    );
    const totalEasyecomAmount = easyecomOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0
    );

    const summary = {
      totalShopifyOrders: shopifyOrders.length,
      totalEasyecomOrders: easyecomOrders.length,
      matchedOrders: correlatedOrders.filter(o => o.matchStatus === 'matched').length,
      unmatchedShopifyOrders: correlatedOrders.filter(o => o.matchStatus === 'unmatched').length,
      unmatchedEasyecomOrders: unmatchedEasyecom.length,
      totalShopifyAmount,
      totalEasyecomAmount,
      amountDifference: Math.abs(totalShopifyAmount - totalEasyecomAmount),
    };

    res.json({
      success: true,
      data: {
        orders: filteredOrders,
        unmatchedEasyecom: unmatchedEasyecom.map(order => ({
          id: order.id,
          easyecomOrderId: order.easyecomOrderId,
          referenceNumber: order.referenceNumber,
          marketplaceOrderId: order.marketplaceOrderId,
          totalAmount: order.totalAmount,
          currency: order.currency,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt.toISOString(),
        })),
        summary,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching correlated orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch correlated orders',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/orders/summary
 * Get summary statistics for orders
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const [shopifyCount, easyecomCount, razorpayCount] = await Promise.all([
      prisma.shopifyOrder.count(),
      prisma.easyecomOrder.count(),
      prisma.razorpayPayment.count(),
    ]);

    res.json({
      success: true,
      data: {
        shopifyOrders: shopifyCount,
        easyecomOrders: easyecomCount,
        razorpayPayments: razorpayCount,
      },
    });
  } catch (error) {
    logger.error('Error fetching summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary',
    });
  }
});

export default router;
