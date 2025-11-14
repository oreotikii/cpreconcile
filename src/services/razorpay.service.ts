import axios, { AxiosInstance } from 'axios';
import config from '../config';
import logger from '../utils/logger';
import prisma from '../utils/database';

export interface RazorpayPaymentData {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string | null;
  method: string;
  email: string;
  contact: string;
  created_at: number;
  [key: string]: any;
}

export class RazorpayService {
  private client: AxiosInstance;

  constructor() {
    const auth = Buffer.from(
      `${config.razorpay.keyId}:${config.razorpay.keySecret}`
    ).toString('base64');

    this.client = axios.create({
      baseURL: 'https://api.razorpay.com/v1',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetchPayments(params: {
    from?: number;
    to?: number;
    count?: number;
    skip?: number;
  }): Promise<RazorpayPaymentData[]> {
    try {
      const queryParams: any = {
        count: params.count || 100,
        skip: params.skip || 0,
      };

      if (params.from) {
        queryParams.from = params.from;
      }

      if (params.to) {
        queryParams.to = params.to;
      }

      const response = await this.client.get('/payments', {
        params: queryParams,
      });

      logger.info(`Fetched ${response.data.items.length} payments from Razorpay`);
      return response.data.items;
    } catch (error: any) {
      logger.error('Error fetching Razorpay payments:', error.message);
      throw error;
    }
  }

  async fetchPaymentById(paymentId: string): Promise<RazorpayPaymentData | null> {
    try {
      const response = await this.client.get(`/payments/${paymentId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error(`Error fetching Razorpay payment ${paymentId}:`, error.message);
      throw error;
    }
  }

  async fetchOrderPayments(orderId: string): Promise<RazorpayPaymentData[]> {
    try {
      const response = await this.client.get(`/orders/${orderId}/payments`);
      return response.data.items || [];
    } catch (error: any) {
      logger.error(`Error fetching payments for order ${orderId}:`, error.message);
      throw error;
    }
  }

  async syncPayments(startDate: Date, endDate: Date): Promise<number> {
    try {
      logger.info(`Syncing Razorpay payments from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const fromTimestamp = Math.floor(startDate.getTime() / 1000);
      const toTimestamp = Math.floor(endDate.getTime() / 1000);

      let allPayments: RazorpayPaymentData[] = [];
      let skip = 0;
      const count = 100;

      // Razorpay API has pagination
      while (true) {
        const payments = await this.fetchPayments({
          from: fromTimestamp,
          to: toTimestamp,
          count,
          skip,
        });

        if (payments.length === 0) {
          break;
        }

        allPayments = allPayments.concat(payments);
        skip += count;

        // If we got fewer results than requested, we've reached the end
        if (payments.length < count) {
          break;
        }
      }

      let syncedCount = 0;

      for (const payment of allPayments) {
        await this.savePayment(payment);
        syncedCount++;
      }

      logger.info(`Synced ${syncedCount} Razorpay payments`);
      return syncedCount;
    } catch (error: any) {
      logger.error('Error syncing Razorpay payments:', error.message);
      throw error;
    }
  }

  async savePayment(paymentData: RazorpayPaymentData): Promise<void> {
    try {
      await prisma.razorpayPayment.upsert({
        where: {
          razorpayId: paymentData.id,
        },
        update: {
          orderId: paymentData.order_id,
          amount: paymentData.amount / 100, // Razorpay stores amounts in paise
          currency: paymentData.currency,
          status: paymentData.status,
          method: paymentData.method,
          email: paymentData.email,
          contact: paymentData.contact,
          createdAt: new Date(paymentData.created_at * 1000),
          rawData: JSON.stringify(paymentData),
        },
        create: {
          razorpayId: paymentData.id,
          orderId: paymentData.order_id,
          amount: paymentData.amount / 100, // Razorpay stores amounts in paise
          currency: paymentData.currency,
          status: paymentData.status,
          method: paymentData.method,
          email: paymentData.email,
          contact: paymentData.contact,
          createdAt: new Date(paymentData.created_at * 1000),
          rawData: JSON.stringify(paymentData),
        },
      });
    } catch (error: any) {
      logger.error(`Error saving Razorpay payment ${paymentData.id}:`, error.message);
      throw error;
    }
  }

  async getLocalPayments(startDate: Date, endDate: Date): Promise<any[]> {
    return await prisma.razorpayPayment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

export default new RazorpayService();
