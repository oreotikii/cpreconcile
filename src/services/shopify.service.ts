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
      const allOrders: ShopifyOrderData[] = [];
      let pageInfo: string | null = null;
      const limit = params.limit || 250; // Shopify max is 250
      let pageCount = 0;

      const baseParams: any = {
        limit,
        status: params.status || 'any',
      };

      if (params.createdAtMin) {
        baseParams.created_at_min = params.createdAtMin.toISOString();
      }

      if (params.createdAtMax) {
        baseParams.created_at_max = params.createdAtMax.toISOString();
      }

      // Fetch all pages using cursor-based pagination
      do {
        pageCount++;
        const queryParams = { ...baseParams };

        // Add page_info for subsequent pages (Shopify uses Link header pagination)
        if (pageInfo) {
          queryParams.page_info = pageInfo;
          // When using page_info, we should not include date filters again
          delete queryParams.created_at_min;
          delete queryParams.created_at_max;
        }

        logger.info(`Fetching Shopify orders page ${pageCount}...`);

        const response = await this.client.get('/orders.json', {
          params: queryParams,
        });

        const orders = response.data.orders || [];
        allOrders.push(...orders);

        logger.info(`Fetched ${orders.length} orders from Shopify (page ${pageCount}, total: ${allOrders.length})`);

        // Extract next page info from Link header
        // Shopify uses Link header with rel="next" for pagination
        const linkHeader = response.headers['link'];
        pageInfo = this.extractNextPageInfo(linkHeader);

        // If we got fewer orders than the limit, we've reached the end
        if (orders.length < limit) {
          pageInfo = null;
        }

      } while (pageInfo);

      logger.info(`Completed fetching ALL Shopify orders: ${allOrders.length} total orders across ${pageCount} pages`);
      return allOrders;
    } catch (error: any) {
      logger.error('Error fetching Shopify orders:', error.message);
      throw error;
    }
  }

  /**
   * Extract next page info from Shopify Link header
   * Link header format: <https://.../orders.json?page_info=xyz>; rel="next"
   */
  private extractNextPageInfo(linkHeader: string | undefined): string | null {
    if (!linkHeader) {
      return null;
    }

    // Parse Link header to find rel="next"
    const links = linkHeader.split(',');
    for (const link of links) {
      if (link.includes('rel="next"')) {
        // Extract page_info parameter from URL
        const match = link.match(/page_info=([^&>]+)/);
        if (match) {
          return match[1];
        }
      }
    }

    return null;
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
