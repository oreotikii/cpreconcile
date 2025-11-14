import axios, { AxiosInstance } from 'axios';
import config from '../config';
import logger from '../utils/logger';
import prisma from '../utils/database';

export interface ShopifyOrderData {
  id: number;
  order_number: number;
  email: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export class ShopifyService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `https://${config.shopify.shopUrl}/admin/api/${config.shopify.apiVersion}`,
      headers: {
        'X-Shopify-Access-Token': config.shopify.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetchOrders(params: {
    createdAtMin?: Date;
    createdAtMax?: Date;
    limit?: number;
    status?: string;
  }): Promise<ShopifyOrderData[]> {
    try {
      const queryParams: any = {
        limit: params.limit || 250,
        status: params.status || 'any',
      };

      if (params.createdAtMin) {
        queryParams.created_at_min = params.createdAtMin.toISOString();
      }

      if (params.createdAtMax) {
        queryParams.created_at_max = params.createdAtMax.toISOString();
      }

      const response = await this.client.get('/orders.json', {
        params: queryParams,
      });

      logger.info(`Fetched ${response.data.orders.length} orders from Shopify`);
      return response.data.orders;
    } catch (error: any) {
      logger.error('Error fetching Shopify orders:', error.message);
      throw error;
    }
  }

  async fetchOrderById(orderId: string): Promise<ShopifyOrderData | null> {
    try {
      const response = await this.client.get(`/orders/${orderId}.json`);
      return response.data.order;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error(`Error fetching Shopify order ${orderId}:`, error.message);
      throw error;
    }
  }

  async syncOrders(startDate: Date, endDate: Date): Promise<number> {
    try {
      logger.info(`Syncing Shopify orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const orders = await this.fetchOrders({
        createdAtMin: startDate,
        createdAtMax: endDate,
      });

      let syncedCount = 0;

      for (const order of orders) {
        await this.saveOrder(order);
        syncedCount++;
      }

      logger.info(`Synced ${syncedCount} Shopify orders`);
      return syncedCount;
    } catch (error: any) {
      logger.error('Error syncing Shopify orders:', error.message);
      throw error;
    }
  }

  async saveOrder(orderData: ShopifyOrderData): Promise<void> {
    try {
      await prisma.shopifyOrder.upsert({
        where: {
          shopifyOrderId: orderData.id.toString(),
        },
        update: {
          shopifyOrderNumber: orderData.order_number.toString(),
          email: orderData.email,
          totalPrice: parseFloat(orderData.total_price),
          currency: orderData.currency,
          financialStatus: orderData.financial_status,
          fulfillmentStatus: orderData.fulfillment_status,
          createdAt: new Date(orderData.created_at),
          rawData: JSON.stringify(orderData),
        },
        create: {
          shopifyOrderId: orderData.id.toString(),
          shopifyOrderNumber: orderData.order_number.toString(),
          email: orderData.email,
          totalPrice: parseFloat(orderData.total_price),
          currency: orderData.currency,
          financialStatus: orderData.financial_status,
          fulfillmentStatus: orderData.fulfillment_status,
          createdAt: new Date(orderData.created_at),
          rawData: JSON.stringify(orderData),
        },
      });
    } catch (error: any) {
      logger.error(`Error saving Shopify order ${orderData.id}:`, error.message);
      throw error;
    }
  }

  async getLocalOrders(startDate: Date, endDate: Date): Promise<any[]> {
    return await prisma.shopifyOrder.findMany({
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

export default new ShopifyService();
