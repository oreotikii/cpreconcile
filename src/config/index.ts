import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  database: {
    url: string;
  };
  shopify: {
    shopUrl: string;
    accessToken: string;
    apiVersion: string;
  };
  razorpay: {
    keyId: string;
    keySecret: string;
  };
  easyecom: {
    apiUrl: string;
    apiKey: string;
    email: string;
  };
  reconciliation: {
    cronSchedule: string;
    lookbackDays: number;
    batchSize: number;
  };
  logging: {
    level: string;
    filePath: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
  shopify: {
    shopUrl: process.env.SHOPIFY_SHOP_URL || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
  easyecom: {
    apiUrl: process.env.EASYECOM_API_URL || 'https://api.easyecom.io',
    apiKey: process.env.EASYECOM_API_KEY || '',
    email: process.env.EASYECOM_EMAIL || '',
  },
  reconciliation: {
    cronSchedule: process.env.RECONCILIATION_CRON_SCHEDULE || '0 */6 * * *',
    lookbackDays: parseInt(process.env.RECONCILIATION_LOOKBACK_DAYS || '7', 10),
    batchSize: parseInt(process.env.RECONCILIATION_BATCH_SIZE || '100', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  },
};

export default config;
