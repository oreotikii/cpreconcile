require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function inspectEasyecomData() {
  try {
    console.log('\n=== Inspecting Easyecom Order Data ===\n');

    // Get a few Easyecom orders to see their structure
    const easyecomOrders = await prisma.easyecomOrder.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Found ${easyecomOrders.length} Easyecom orders\n`);

    easyecomOrders.forEach((order, index) => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━ Order ${index + 1} ━━━━━━━━━━━━━━━━━━━━━`);
      console.log('Easyecom Order ID:', order.easyecomOrderId);
      console.log('Reference Number:', order.referenceNumber);
      console.log('Marketplace Order ID:', order.marketplaceOrderId);
      console.log('Total Amount:', order.totalAmount);
      console.log('Currency:', order.currency);
      console.log('Status:', order.status);
      console.log('Created At:', order.createdAt.toISOString());

      // Parse and display raw data to see full structure
      if (order.rawData) {
        try {
          const raw = JSON.parse(order.rawData);
          console.log('\nRaw Data Keys:', Object.keys(raw));
          console.log('Raw Data Sample:');
          console.log('  order_id:', raw.order_id);
          console.log('  invoice_id:', raw.invoice_id);
          console.log('  reference_code:', raw.reference_code);
          console.log('  marketplace:', raw.marketplace);
          console.log('  marketplace_id:', raw.marketplace_id);
          console.log('  order_date:', raw.order_date);
        } catch (e) {
          console.log('Could not parse rawData');
        }
      }
    });

    // Also get a few Shopify orders for comparison
    console.log('\n\n═════════════════════════════════════════════════════\n');
    console.log('=== Sample Shopify Orders for Comparison ===\n');

    const shopifyOrders = await prisma.shopifyOrder.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    shopifyOrders.forEach((order, index) => {
      console.log(`\nShopify Order ${index + 1}:`);
      console.log('  Shopify Order ID:', order.shopifyOrderId);
      console.log('  Order Number:', order.shopifyOrderNumber);
      console.log('  Email:', order.email);
      console.log('  Amount:', order.totalPrice);
      console.log('  Created At:', order.createdAt.toISOString());
    });

    console.log('\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

inspectEasyecomData();
