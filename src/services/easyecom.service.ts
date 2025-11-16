import axios, { AxiosInstance } from 'axios';
import config from '../config';
import logger from '../utils/logger';
import prisma from '../utils/database';

export interface EasyecomOrderData {
  order_id: number | string;
  invoice_id?: number;
  reference_code?: string;
  marketplace?: string;
  marketplace_id?: number;
  invoice_currency_code?: string;
  order_date?: string;
  queue_status?: number;
  last_update_date?: string;
  total?: number;
  // Legacy fields for compatibility
  reference_number?: string;
  marketplace_order_id?: string;
  total_amount?: number;
  currency?: string;
  status?: string;
  payment_status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

interface AuthResponse {
  data?: {
    companyname?: string;
    token?: {
      jwt_token: string;
      token_type: string;
      expires_in: number;
    };
    [key: string]: any;
  };
  message?: string | null;
  // Legacy support for direct token field
  token?: string;
  access_token?: string;
  expires_in?: number;
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
          // Easyecom returns: { data: { token: { jwt_token: "...", expires_in: ... } } }
          let token = null;
          let expiresIn = 90 * 24 * 60 * 60 * 1000; // Default 90 days in ms

          if (response.data.data?.token?.jwt_token) {
            // Nested structure from /access/token
            token = response.data.data.token.jwt_token;
            if (response.data.data.token.expires_in) {
              expiresIn = response.data.data.token.expires_in * 1000; // Convert seconds to ms
            }
          } else if (response.data.token) {
            // Direct token field
            token = response.data.token;
          } else if (response.data.access_token) {
            // Alternative field name
            token = response.data.access_token;
          }

          if (token) {
            this.authToken = token;
            this.tokenExpiry = new Date(Date.now() + expiresIn);

            logger.info(`✅ Successfully authenticated with Easyecom via ${endpoint}`);
            logger.info(`Token expires at: ${this.tokenExpiry.toISOString()}`);
            logger.info(`Token type: ${response.data.data?.token?.token_type || 'bearer'}`);

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
      const queryParams: any = {};

      // Easyecom requires dates in format: YYYY-MM-DD HH:MM:SS
      if (params.startDate) {
        queryParams.start_date = params.startDate;
      }

      if (params.endDate) {
        queryParams.end_date = params.endDate;
      }

      logger.info('Fetching Easyecom orders:', {
        url: '/orders/V2/getAllOrders',
        params: queryParams,
      });

      const headers = await this.getAuthHeaders();
      const response = await this.client.get('/orders/V2/getAllOrders', {
        headers,
        params: queryParams,
      });

      // Easyecom returns: { code: 200, message: "Successful", data: { orders: [...] } }
      const orders = response.data.data?.orders || response.data.data || [];
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
        const retryParams: any = {};
        if (params.startDate) retryParams.start_date = params.startDate;
        if (params.endDate) retryParams.end_date = params.endDate;

        const response = await this.client.get('/orders/V2/getAllOrders', {
          headers,
          params: retryParams,
        });

        const orders = response.data.data?.orders || response.data.data || [];
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

      // Format dates as: YYYY-MM-DD HH:MM:SS
      const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      // Fetch all orders for the date range
      const orders = await this.fetchOrders({
        startDate: startDateStr,
        endDate: endDateStr,
      });

      let syncedCount = 0;

      for (const order of orders) {
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
      // Map Easyecom fields to our schema
      const referenceNumber = orderData.reference_code || orderData.reference_number || String(orderData.invoice_id || orderData.order_id);
      const marketplaceOrderId = orderData.marketplace_order_id || orderData.marketplace || '';
      const totalAmount = orderData.total || orderData.total_amount || 0;
      const currency = orderData.invoice_currency_code || orderData.currency || 'INR';
      const status = orderData.status || (orderData.queue_status ? `Queue ${orderData.queue_status}` : 'Unknown');
      const paymentStatus = orderData.payment_status || 'Unknown';
      const createdAt = orderData.order_date || orderData.created_at || new Date().toISOString();

      await prisma.easyecomOrder.upsert({
        where: {
          easyecomOrderId: String(orderData.order_id),
        },
        update: {
          referenceNumber,
          marketplaceOrderId,
          totalAmount: parseFloat(totalAmount.toString()),
          currency,
          status,
          paymentStatus,
          createdAt: new Date(createdAt),
          rawData: JSON.stringify(orderData),
        },
        create: {
          easyecomOrderId: String(orderData.order_id),
          referenceNumber,
          marketplaceOrderId,
          totalAmount: parseFloat(totalAmount.toString()),
          currency,
          status,
          paymentStatus,
          createdAt: new Date(createdAt),
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
