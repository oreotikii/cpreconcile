require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function viewOrders() {
  try {
    console.log('\n=== Fetching Orders from Database ===\n');

    // Get date range for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    console.log(`Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

    // Fetch Shopify orders
    console.log('Fetching Shopify orders...');
    const shopifyOrders = await prisma.shopifyOrder.findMany({
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

    // Fetch Easyecom orders
    console.log('Fetching Easyecom orders...');
    const easyecomOrders = await prisma.easyecomOrder.findMany({
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

    console.log(`\nFound ${shopifyOrders.length} Shopify orders and ${easyecomOrders.length} Easyecom orders\n`);

    // Create a map of Easyecom orders by marketplace order ID for quick lookup
    const easyecomMap = new Map();
    easyecomOrders.forEach(order => {
      if (order.marketplaceOrderId) {
        easyecomMap.set(order.marketplaceOrderId.toLowerCase(), order);
      }
      // Also map by reference number
      if (order.referenceNumber) {
        easyecomMap.set(order.referenceNumber.toLowerCase(), order);

        // Extract order number from reference code (e.g., "CPO/43560/25-26" -> "43560")
        const match = order.referenceNumber.match(/CPO\/(\d+)\//);
        if (match && match[1]) {
          easyecomMap.set(match[1], order);
        }
      }
    });

    // Correlate and display orders
    console.log('╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                          CORRELATED ORDERS TABLE                                                                  ║');
    console.log('╠═══════════════╦════════════════════╦═══════════════╦════════════════╦═════════════╦═══════════════╦═══════════════════╦══════════════════════════╣');
    console.log('║ Source        ║ Order ID          ║ Reference     ║ Customer Email ║ Amount (₹)  ║ Currency      ║ Status            ║ Date                     ║');
    console.log('╠═══════════════╬════════════════════╬═══════════════╬════════════════╬═════════════╬═══════════════╬═══════════════════╬══════════════════════════╣');

    // Display Shopify orders with Easyecom correlation
    shopifyOrders.forEach(order => {
      const shopifyId = order.shopifyOrderId.toString();
      const reference = order.shopifyOrderNumber ? `#${order.shopifyOrderNumber}` : '-';
      const email = order.email ? order.email.substring(0, 14) : '-';
      const amount = order.totalPrice ? `₹${order.totalPrice.toFixed(2)}` : '-';
      const currency = order.currency || '-';
      const status = order.financialStatus || '-';
      const date = order.createdAt ? order.createdAt.toISOString().split('T')[0] : '-';

      console.log(`║ Shopify       ║ ${shopifyId.padEnd(18)} ║ ${reference.padEnd(13)} ║ ${email.padEnd(14)} ║ ${amount.padEnd(11)} ║ ${currency.padEnd(13)} ║ ${status.padEnd(17)} ║ ${date.padEnd(24)} ║`);

      // Check for correlated Easyecom order
      // Try matching by: Shopify ID, reference with #, reference without #, or just the order number
      const easyecomOrder = easyecomMap.get(shopifyId.toLowerCase()) ||
                           easyecomMap.get(reference.toLowerCase()) ||
                           easyecomMap.get(order.shopifyOrderNumber);
      if (easyecomOrder) {
        const easyId = easyecomOrder.easyecomOrderId.toString();
        const easyRef = easyecomOrder.referenceNumber || '-';
        const easyMarket = easyecomOrder.marketplaceOrderId || '-';
        const easyAmount = easyecomOrder.totalAmount ? `₹${easyecomOrder.totalAmount.toFixed(2)}` : '-';
        const easyCurrency = easyecomOrder.currency || '-';
        const easyStatus = easyecomOrder.status || '-';
        const easyDate = easyecomOrder.createdAt ? easyecomOrder.createdAt.toISOString().split('T')[0] : '-';

        console.log(`║ ↳ Easyecom    ║ ${easyId.padEnd(18)} ║ ${easyRef.padEnd(13)} ║ ${easyMarket.substring(0, 14).padEnd(14)} ║ ${easyAmount.padEnd(11)} ║ ${easyCurrency.padEnd(13)} ║ ${easyStatus.substring(0, 17).padEnd(17)} ║ ${easyDate.padEnd(24)} ║`);
        console.log('╟───────────────╫────────────────────╫───────────────╫────────────────╫─────────────╫───────────────╫───────────────────╫──────────────────────────╢');

        // Mark this Easyecom order as displayed
        easyecomMap.delete(easyecomOrder.easyecomOrderId.toString());
      } else {
        console.log('║ ↳ Easyecom    ║ NOT FOUND         ║ -             ║ -              ║ -           ║ -             ║ -                 ║ -                        ║');
        console.log('╟───────────────╫────────────────────╫───────────────╫────────────────╫─────────────╫───────────────╫───────────────────╫──────────────────────────╢');
      }
    });

    // Display remaining Easyecom orders that weren't matched
    const remainingEasyecom = easyecomOrders.filter(order => {
      // Extract order number from Easyecom reference code
      let easyOrderNum = null;
      if (order.referenceNumber) {
        const match = order.referenceNumber.match(/CPO\/(\d+)\//);
        if (match && match[1]) {
          easyOrderNum = match[1];
        }
      }

      return !shopifyOrders.some(s =>
        s.shopifyOrderId.toString().toLowerCase() === order.marketplaceOrderId?.toLowerCase() ||
        s.shopifyOrderNumber === easyOrderNum
      );
    });

    if (remainingEasyecom.length > 0) {
      console.log('║               ║                    ║               ║                ║             ║               ║                   ║                          ║');
      console.log('║ UNMATCHED EASYECOM ORDERS                                                                                                                        ║');
      console.log('╟───────────────╫────────────────────╫───────────────╫────────────────╫─────────────╫───────────────╫───────────────────╫──────────────────────────╢');

      remainingEasyecom.forEach(order => {
        const easyId = order.easyecomOrderId.toString();
        const easyRef = order.referenceNumber || '-';
        const easyMarket = order.marketplaceOrderId || '-';
        const easyAmount = order.totalAmount ? `₹${order.totalAmount.toFixed(2)}` : '-';
        const easyCurrency = order.currency || '-';
        const easyStatus = order.status || '-';
        const easyDate = order.createdAt ? order.createdAt.toISOString().split('T')[0] : '-';

        console.log(`║ Easyecom      ║ ${easyId.padEnd(18)} ║ ${easyRef.substring(0, 13).padEnd(13)} ║ ${easyMarket.substring(0, 14).padEnd(14)} ║ ${easyAmount.padEnd(11)} ║ ${easyCurrency.padEnd(13)} ║ ${easyStatus.substring(0, 17).padEnd(17)} ║ ${easyDate.padEnd(24)} ║`);
        console.log('╟───────────────╫────────────────────╫───────────────╫────────────────╫─────────────╫───────────────╫───────────────────╫──────────────────────────╢');
      });
    }

    console.log('╚═══════════════╩════════════════════╩═══════════════╩════════════════╩═════════════╩═══════════════╩═══════════════════╩══════════════════════════╝');

    // Summary statistics
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    SUMMARY STATISTICS                     ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║ Total Shopify Orders:        ${shopifyOrders.length.toString().padEnd(28)} ║`);
    console.log(`║ Total Easyecom Orders:       ${easyecomOrders.length.toString().padEnd(28)} ║`);
    console.log(`║ Matched Orders:              ${(shopifyOrders.length - remainingEasyecom.length).toString().padEnd(28)} ║`);
    console.log(`║ Unmatched Easyecom Orders:   ${remainingEasyecom.length.toString().padEnd(28)} ║`);

    const totalShopifyAmount = shopifyOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const totalEasyecomAmount = easyecomOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    console.log(`║ Total Shopify Amount:        ₹${totalShopifyAmount.toFixed(2).padEnd(27)} ║`);
    console.log(`║ Total Easyecom Amount:       ₹${totalEasyecomAmount.toFixed(2).padEnd(27)} ║`);
    console.log('╚═══════════════════════════════════════════════════════════╝');

    console.log('\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

viewOrders();
