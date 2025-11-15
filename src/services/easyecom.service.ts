import axios, { AxiosInstance } from 'axios';
import config from '../config';
import logger from '../utils/logger';
import prisma from '../utils/database';

export interface EasyecomOrderData {
  order_id: string;
  reference_number: string;
  marketplace_order_id: string;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export class EasyecomService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.easyecom.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.easyecom.apiKey,
        'x-api-email': config.easyecom.email,
      },
    });
  }

  private getAuthHeaders(): any {
    return {
      'x-api-key': config.easyecom.apiKey,
      'x-api-email': config.easyecom.email,
    };
  }

  async fetchOrders(params: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<EasyecomOrderData[]> {
    try {
      const queryParams: any = {
        limit: params.limit || 100,
        offset: params.offset || 0,
      };

      if (params.startDate) {
        queryParams.start_date = params.startDate;
      }

      if (params.endDate) {
        queryParams.end_date = params.endDate;
      }

      logger.info('Easyecom API Request:', {
        url: '/orders/V2/getOrders',
        headers: {
          'x-api-key': config.easyecom.apiKey ? '***' + config.easyecom.apiKey.slice(-4) : 'missing',
          'x-api-email': config.easyecom.email || 'missing',
        },
        params: queryParams,
      });

      const response = await this.client.get('/orders/V2/getOrders', {
        headers: this.getAuthHeaders(),
        params: queryParams,
      });

      const orders = response.data.data || [];
      logger.info(`Fetched ${orders.length} orders from Easyecom`);
      return orders;
    } catch (error: any) {
      logger.error('Error fetching Easyecom orders:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      });

      if (error.response?.status === 401) {
        logger.error('Authentication failed. Please verify:');
        logger.error('1. EASYECOM_API_KEY is set correctly in .env');
        logger.error('2. EASYECOM_EMAIL matches your registered Easyecom email');
        logger.error('3. API credentials are active in your Easyecom account');
      }

      throw error;
    }
  }

  async fetchOrderById(orderId: string): Promise<EasyecomOrderData | null> {
    try {
      const response = await this.client.get(`/orders/V2/getOrderDetails`, {
        headers: this.getAuthHeaders(),
        params: { order_id: orderId },
      });

      return response.data.data || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error(`Error fetching Easyecom order ${orderId}:`, error.message);
      throw error;
    }
  }

  async syncOrders(startDate: Date, endDate: Date): Promise<number> {
    try {
      logger.info(`Syncing Easyecom orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      let allOrders: EasyecomOrderData[] = [];
      let offset = 0;
      const limit = 100;

      // Easyecom API has pagination
      while (true) {
        const orders = await this.fetchOrders({
          startDate: startDateStr,
          endDate: endDateStr,
          limit,
          offset,
        });

        if (orders.length === 0) {
          break;
        }

        allOrders = allOrders.concat(orders);
        offset += limit;

        // If we got fewer results than requested, we've reached the end
        if (orders.length < limit) {
          break;
        }
      }

      let syncedCount = 0;

      for (const order of allOrders) {
        await this.saveOrder(order);
        syncedCount++;
      }

      logger.info(`Synced ${syncedCount} Easyecom orders`);
      return syncedCount;
    } catch (error: any) {
      logger.error('Error syncing Easyecom orders:', error.message);
      throw error;
    }
  }

  async saveOrder(orderData: EasyecomOrderData): Promise<void> {
    try {
      await prisma.easyecomOrder.upsert({
        where: {
          easyecomOrderId: orderData.order_id,
        },
        update: {
          referenceNumber: orderData.reference_number,
          marketplaceOrderId: orderData.marketplace_order_id,
          totalAmount: parseFloat(orderData.total_amount.toString()),
          currency: orderData.currency || 'INR',
          status: orderData.status,
          paymentStatus: orderData.payment_status,
          createdAt: new Date(orderData.created_at),
          rawData: JSON.stringify(orderData),
        },
        create: {
          easyecomOrderId: orderData.order_id,
          referenceNumber: orderData.reference_number,
          marketplaceOrderId: orderData.marketplace_order_id,
          totalAmount: parseFloat(orderData.total_amount.toString()),
          currency: orderData.currency || 'INR',
          status: orderData.status,
          paymentStatus: orderData.payment_status,
          createdAt: new Date(orderData.created_at),
          rawData: JSON.stringify(orderData),
        },
      });
    } catch (error: any) {
      logger.error(`Error saving Easyecom order ${orderData.order_id}:`, error.message);
      throw error;
    }
  }

  async getLocalOrders(startDate: Date, endDate: Date): Promise<any[]> {
    return await prisma.easyecomOrder.findMany({
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

export default new EasyecomService();
