import prisma from '../utils/database';
import logger from '../utils/logger';
import shopifyService from './shopify.service';
import razorpayService from './razorpay.service';
import easyecomService from './easyecom.service';
import { ReconciliationStatus, ReconciliationStatusType } from '../types/reconciliation.types';

interface MatchResult {
  shopifyOrderId?: string;
  razorpayPaymentId?: string;
  easyecomOrderId?: string;
  matchConfidence: number;
  status: ReconciliationStatusType;
  amountDifference?: number;
  discrepancyNotes?: string;
}

export class ReconciliationService {
  /**
   * Perform full reconciliation for a date range
   */
  async reconcile(startDate: Date, endDate: Date): Promise<string> {
    const runId = `RUN_${Date.now()}`;
    logger.info(`Starting reconciliation run ${runId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    try {
      // Create log entry
      const logEntry = await prisma.reconciliationLog.create({
        data: {
          runId,
          startTime: new Date(),
          status: 'RUNNING',
          recordsProcessed: 0,
          recordsMatched: 0,
          recordsUnmatched: 0,
        },
      });

      // Sync data from all platforms
      logger.info('Syncing data from all platforms...');
      await Promise.all([
        shopifyService.syncOrders(startDate, endDate),
        razorpayService.syncPayments(startDate, endDate),
        easyecomService.syncOrders(startDate, endDate),
      ]);

      // Get all data
      const [shopifyOrders, razorpayPayments, easyecomOrders] = await Promise.all([
        shopifyService.getLocalOrders(startDate, endDate),
        razorpayService.getLocalPayments(startDate, endDate),
        easyecomService.getLocalOrders(startDate, endDate),
      ]);

      logger.info(`Retrieved ${shopifyOrders.length} Shopify orders, ${razorpayPayments.length} Razorpay payments, ${easyecomOrders.length} Easyecom orders`);

      const matches: MatchResult[] = [];
      let matchedCount = 0;
      let unmatchedCount = 0;

      // Match Shopify orders with Razorpay payments and Easyecom orders
      for (const shopifyOrder of shopifyOrders) {
        const match = await this.findMatches(shopifyOrder, razorpayPayments, easyecomOrders);
        matches.push(match);

        if (match.status === ReconciliationStatus.MATCHED) {
          matchedCount++;
        } else {
          unmatchedCount++;
        }
      }

      // Find unmatched Razorpay payments
      const matchedRazorpayIds = new Set(matches.map(m => m.razorpayPaymentId).filter(Boolean));
      for (const payment of razorpayPayments) {
        if (!matchedRazorpayIds.has(payment.id)) {
          matches.push({
            razorpayPaymentId: payment.id,
            matchConfidence: 0,
            status: ReconciliationStatus.UNMATCHED,
            discrepancyNotes: 'No matching Shopify order found',
          });
          unmatchedCount++;
        }
      }

      // Find unmatched Easyecom orders
      const matchedEasyecomIds = new Set(matches.map(m => m.easyecomOrderId).filter(Boolean));
      for (const order of easyecomOrders) {
        if (!matchedEasyecomIds.has(order.id)) {
          matches.push({
            easyecomOrderId: order.id,
            matchConfidence: 0,
            status: ReconciliationStatus.UNMATCHED,
            discrepancyNotes: 'No matching Shopify order found',
          });
          unmatchedCount++;
        }
      }

      // Save all reconciliation records
      for (const match of matches) {
        await this.saveReconciliation(match);
      }

      // Update log entry
      await prisma.reconciliationLog.update({
        where: { id: logEntry.id },
        data: {
          endTime: new Date(),
          status: 'COMPLETED',
          recordsProcessed: matches.length,
          recordsMatched: matchedCount,
          recordsUnmatched: unmatchedCount,
        },
      });

      logger.info(`Reconciliation run ${runId} completed: ${matchedCount} matched, ${unmatchedCount} unmatched`);
      return runId;
    } catch (error: any) {
      logger.error(`Reconciliation run ${runId} failed:`, error.message);

      // Update log with error
      await prisma.reconciliationLog.updateMany({
        where: { runId },
        data: {
          endTime: new Date(),
          status: 'FAILED',
          errors: JSON.stringify({ message: error.message, stack: error.stack }),
        },
      });

      throw error;
    }
  }

  /**
   * Find matching records across platforms
   */
  private async findMatches(
    shopifyOrder: any,
    razorpayPayments: any[],
    easyecomOrders: any[]
  ): Promise<MatchResult> {
    const result: MatchResult = {
      shopifyOrderId: shopifyOrder.id,
      matchConfidence: 0,
      status: ReconciliationStatus.UNMATCHED,
    };

    // Try to match with Razorpay payment
    const razorpayMatch = this.matchRazorpayPayment(shopifyOrder, razorpayPayments);
    if (razorpayMatch.payment) {
      result.razorpayPaymentId = razorpayMatch.payment.id;
      result.matchConfidence += razorpayMatch.confidence;
    }

    // Try to match with Easyecom order
    const easyecomMatch = this.matchEasyecomOrder(shopifyOrder, easyecomOrders);
    if (easyecomMatch.order) {
      result.easyecomOrderId = easyecomMatch.order.id;
      result.matchConfidence += easyecomMatch.confidence;
    }

    // Calculate average confidence if we have matches
    const matchCount = (razorpayMatch.payment ? 1 : 0) + (easyecomMatch.order ? 1 : 0);
    if (matchCount > 0) {
      result.matchConfidence = result.matchConfidence / matchCount;
    }

    // Check for amount discrepancies
    const amounts = [shopifyOrder.totalPrice];
    if (razorpayMatch.payment) {
      amounts.push(razorpayMatch.payment.amount);
    }
    if (easyecomMatch.order) {
      amounts.push(easyecomMatch.order.totalAmount);
    }

    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    const amountDifference = maxAmount - minAmount;

    result.amountDifference = amountDifference;

    // Determine status
    if (result.matchConfidence >= 80 && amountDifference < 1) {
      result.status = ReconciliationStatus.MATCHED;
    } else if (result.matchConfidence >= 50 && amountDifference < 10) {
      result.status = ReconciliationStatus.PARTIAL_MATCH;
      result.discrepancyNotes = `Partial match with ${amountDifference.toFixed(2)} amount difference`;
    } else if (amountDifference >= 10) {
      result.status = ReconciliationStatus.DISCREPANCY;
      result.discrepancyNotes = `Significant amount difference: ${amountDifference.toFixed(2)}`;
    } else {
      result.status = ReconciliationStatus.UNMATCHED;
      result.discrepancyNotes = 'Could not find confident matches';
    }

    return result;
  }

  /**
   * Match Shopify order with Razorpay payment
   */
  private matchRazorpayPayment(
    shopifyOrder: any,
    razorpayPayments: any[]
  ): { payment: any | null; confidence: number } {
    let bestMatch: any = null;
    let bestConfidence = 0;

    for (const payment of razorpayPayments) {
      let confidence = 0;

      // Match by email
      if (shopifyOrder.email && payment.email && shopifyOrder.email.toLowerCase() === payment.email.toLowerCase()) {
        confidence += 40;
      }

      // Match by amount (with 1% tolerance)
      const amountDiff = Math.abs(shopifyOrder.totalPrice - payment.amount);
      const amountTolerance = shopifyOrder.totalPrice * 0.01;
      if (amountDiff <= amountTolerance) {
        confidence += 40;
      }

      // Match by date proximity (within 24 hours)
      const timeDiff = Math.abs(new Date(shopifyOrder.createdAt).getTime() - new Date(payment.createdAt).getTime());
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      if (hoursDiff <= 24) {
        confidence += 20 * (1 - hoursDiff / 24);
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = payment;
      }
    }

    return { payment: bestMatch, confidence: bestConfidence };
  }

  /**
   * Match Shopify order with Easyecom order
   */
  private matchEasyecomOrder(
    shopifyOrder: any,
    easyecomOrders: any[]
  ): { order: any | null; confidence: number } {
    let bestMatch: any = null;
    let bestConfidence = 0;

    for (const easyecomOrder of easyecomOrders) {
      let confidence = 0;

      // Try to match by Shopify order ID in marketplace_order_id
      if (
        easyecomOrder.marketplaceOrderId &&
        (easyecomOrder.marketplaceOrderId === shopifyOrder.shopifyOrderId ||
          easyecomOrder.marketplaceOrderId === shopifyOrder.shopifyOrderNumber)
      ) {
        confidence += 60;
      }

      // Match by amount (with 1% tolerance)
      const amountDiff = Math.abs(shopifyOrder.totalPrice - easyecomOrder.totalAmount);
      const amountTolerance = shopifyOrder.totalPrice * 0.01;
      if (amountDiff <= amountTolerance) {
        confidence += 30;
      }

      // Match by date proximity (within 48 hours for Easyecom as it might sync slower)
      const timeDiff = Math.abs(new Date(shopifyOrder.createdAt).getTime() - new Date(easyecomOrder.createdAt).getTime());
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      if (hoursDiff <= 48) {
        confidence += 10 * (1 - hoursDiff / 48);
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = easyecomOrder;
      }
    }

    return { order: bestMatch, confidence: bestConfidence };
  }

  /**
   * Save reconciliation record
   */
  private async saveReconciliation(match: MatchResult): Promise<void> {
    await prisma.reconciliation.create({
      data: {
        shopifyOrderId: match.shopifyOrderId,
        razorpayPaymentId: match.razorpayPaymentId,
        easyecomOrderId: match.easyecomOrderId,
        status: match.status,
        matchConfidence: match.matchConfidence,
        amountDifference: match.amountDifference,
        discrepancyNotes: match.discrepancyNotes,
      },
    });
  }

  /**
   * Get reconciliation report
   */
  async getReport(runId?: string): Promise<any> {
    const where: any = {};
    if (runId) {
      // Get reconciliations from a specific run
      const log = await prisma.reconciliationLog.findFirst({
        where: { runId },
      });
      if (log) {
        where.reconciledAt = {
          gte: log.startTime,
          lte: log.endTime || new Date(),
        };
      }
    }

    const reconciliations = await prisma.reconciliation.findMany({
      where,
      include: {
        shopifyOrder: true,
        razorpayPayment: true,
        easyecomOrder: true,
      },
      orderBy: {
        reconciledAt: 'desc',
      },
    });

    const summary = {
      total: reconciliations.length,
      matched: reconciliations.filter(r => r.status === ReconciliationStatus.MATCHED).length,
      partialMatch: reconciliations.filter(r => r.status === ReconciliationStatus.PARTIAL_MATCH).length,
      unmatched: reconciliations.filter(r => r.status === ReconciliationStatus.UNMATCHED).length,
      discrepancies: reconciliations.filter(r => r.status === ReconciliationStatus.DISCREPANCY).length,
      underReview: reconciliations.filter(r => r.status === ReconciliationStatus.UNDER_REVIEW).length,
    };

    return {
      summary,
      reconciliations,
    };
  }

  /**
   * Get all reconciliation logs
   */
  async getLogs(limit: number = 50): Promise<any[]> {
    return await prisma.reconciliationLog.findMany({
      orderBy: {
        startTime: 'desc',
      },
      take: limit,
    });
  }
}

export default new ReconciliationService();
