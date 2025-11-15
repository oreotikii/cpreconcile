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

interface AuthResponse {
  token?: string;
  access_token?: string;
  expires_in?: number;
  message?: string;
}

export class EasyecomService {
  private client: AxiosInstance;
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.easyecom.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Authenticate with Easyecom API and obtain JWT token
   * Token validity: 90 days
   */
  private async authenticate(): Promise<string> {
    try {
      logger.info('Authenticating with Easyecom API...');

      // Official Easyecom V2.1 token endpoint
      const authEndpoints = [
        '/access/token',
        '/token',
        '/api/token',
      ];

      const authPayload = {
        email: config.easyecom.email,
        password: config.easyecom.password,
        location_key: config.easyecom.locationKey,
      };

      logger.info('Authentication request:', {
        email: config.easyecom.email,
        location_key: config.easyecom.locationKey ? '***' + config.easyecom.locationKey.slice(-4) : 'missing',
        has_api_key: config.easyecom.apiKey ? 'yes' : 'no',
      });

      let lastError: any = null;

      for (const endpoint of authEndpoints) {
        try {
          const response = await this.client.post<AuthResponse>(endpoint, authPayload, {
            headers: {
              'x-api-key': config.easyecom.apiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          // Extract token from response
          const token = response.data.token || response.data.access_token;

          if (token) {
            this.authToken = token;
            // Token is valid for 90 days according to documentation
            this.tokenExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

            logger.info(`✅ Successfully authenticated with Easyecom via ${endpoint}`);
            logger.info(`Token expires at: ${this.tokenExpiry.toISOString()}`);

            return token;
          }
        } catch (error: any) {
          // Only log non-404 errors
          if (error.response?.status !== 404) {
            lastError = error;
            logger.warn(`Auth endpoint ${endpoint} failed:`, {
              status: error.response?.status,
              message: error.response?.data?.message || error.message,
            });
          }
        }
      }

      // If we get here, all endpoints failed
      logger.error('All authentication endpoints failed. Last error:', {
        status: lastError?.response?.status,
        message: lastError?.response?.data?.message || lastError?.message,
        data: lastError?.response?.data,
      });

      throw new Error(
        `Easyecom authentication failed. Please verify:\n` +
        `1. EASYECOM_EMAIL is correct (${config.easyecom.email})\n` +
        `2. EASYECOM_PASSWORD is correct\n` +
        `3. EASYECOM_LOCATION_KEY is correct (get from Location Master page)\n` +
        `4. EASYECOM_API_KEY is set (x-api-key from primary account settings)\n` +
        `5. Your account has API access enabled\n` +
        `Contact Easyecom support at care@easyecom.io for assistance.`
      );
    } catch (error: any) {
      logger.error('Authentication error:', error.message);
      throw error;
    }
  }

  /**
   * Get a valid authentication token, refreshing if necessary
   */
  private async getValidToken(): Promise<string> {
    // Check if we have a valid token
    if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.authToken;
    }

    // Token is missing or expired, authenticate
    logger.info('Token missing or expired, re-authenticating...');
    return await this.authenticate();
  }

  /**
   * Get authorization headers with Bearer token and x-api-key
   * Easyecom V2.1 requires BOTH headers for all API calls
   */
  private async getAuthHeaders(): Promise<any> {
    const token = await this.getValidToken();
    return {
      'Authorization': `Bearer ${token}`,
      'x-api-key': config.easyecom.apiKey,
      'Content-Type': 'application/json',
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

      logger.info('Fetching Easyecom orders:', {
        url: '/orders/V2/getOrders',
        params: queryParams,
      });

      const headers = await this.getAuthHeaders();
      const response = await this.client.get('/orders/V2/getOrders', {
        headers,
        params: queryParams,
      });

      const orders = response.data.data || [];
      logger.info(`✅ Fetched ${orders.length} orders from Easyecom`);
      return orders;
    } catch (error: any) {
      logger.error('Error fetching Easyecom orders:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      // If 401 Unauthorized, clear token and retry once
      if (error.response?.status === 401 && this.authToken) {
        logger.warn('Received 401, clearing token and retrying...');
        this.authToken = null;
        this.tokenExpiry = null;

        // Retry once with fresh token
        const headers = await this.getAuthHeaders();
        const response = await this.client.get('/orders/V2/getOrders', {
          headers,
          params: {
            limit: params.limit || 100,
            offset: params.offset || 0,
            ...(params.startDate && { start_date: params.startDate }),
            ...(params.endDate && { end_date: params.endDate }),
          },
        });

        const orders = response.data.data || [];
        logger.info(`✅ Fetched ${orders.length} orders from Easyecom (retry successful)`);
        return orders;
      }

      throw error;
    }
  }

  async fetchOrderById(orderId: string): Promise<EasyecomOrderData | null> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.client.get(`/orders/V2/getOrderDetails`, {
        headers,
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

      logger.info(`✅ Synced ${syncedCount} Easyecom orders`);
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
