# CPReconcile

A comprehensive backend reconciliation system for Shopify, Razorpay, and Easyecom. This system automatically syncs orders and payments from all three platforms and intelligently matches them to identify discrepancies and ensure accurate financial records.

## Features

- **Multi-Platform Integration**
  - Shopify orders synchronization
  - Razorpay payment gateway integration
  - Easyecom inventory/order management sync

- **Intelligent Reconciliation**
  - Automatic matching based on email, amount, and timestamp
  - Confidence scoring for matches
  - Discrepancy detection and reporting
  - Support for partial matches

- **Automated Scheduling**
  - Configurable cron-based automatic reconciliation
  - Lookback period configuration
  - Batch processing support

- **REST API**
  - Manual reconciliation triggers
  - Platform-specific data syncing
  - Comprehensive reporting endpoints
  - Health and status monitoring

- **Robust Logging**
  - Detailed reconciliation logs
  - Error tracking and reporting
  - Run history with statistics

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Shopify   │     │   Razorpay   │     │  Easyecom   │
└──────┬──────┘     └──────┬───────┘     └──────┬──────┘
       │                   │                     │
       │                   │                     │
       ▼                   ▼                     ▼
┌──────────────────────────────────────────────────────┐
│              CPReconcile System                      │
│                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Shopify   │  │   Razorpay   │  │  Easyecom   │ │
│  │  Service   │  │   Service    │  │   Service   │ │
│  └─────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
│        │                │                  │        │
│        └────────────────┼──────────────────┘        │
│                         ▼                           │
│              ┌──────────────────┐                   │
│              │  Reconciliation  │                   │
│              │     Engine       │                   │
│              └────────┬─────────┘                   │
│                       │                             │
│                       ▼                             │
│              ┌──────────────────┐                   │
│              │    Database      │                   │
│              │   (SQLite/PG)    │                   │
│              └──────────────────┘                   │
└──────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- API credentials for:
  - Shopify (Store URL, Access Token)
  - Razorpay (Key ID, Key Secret)
  - Easyecom (x-api-key, Registered Email)

## API Credentials Setup

### Easyecom API Configuration

Easyecom uses an **x-api authentication system** with two required headers:

1. **x-api-key**: Your unique API key from Easyecom
2. **x-api-email**: Your registered Easyecom account email

**How to get your Easyecom API credentials:**

1. Log in to your Easyecom account
2. Navigate to **Settings** → **API Settings** or **Integrations**
3. Generate or copy your **API Key** (x-api-key)
4. Use your **registered email address** (x-api-email)
5. The API base URL is: `https://api.easyecom.io`

**Important Notes:**
- Both headers are required for all API requests
- The email must match your registered Easyecom account
- Keep your API key secure and never commit it to version control
- Refer to [Easyecom API Documentation](https://api-docs.easyecom.io/) for more details

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cpreconcile
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` file with your credentials:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="file:./dev.db"

# Shopify Configuration
SHOPIFY_SHOP_URL=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
SHOPIFY_API_VERSION=2025-10

# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Easyecom Configuration
EASYECOM_API_URL=https://api.easyecom.io
EASYECOM_API_KEY=your_x_api_key_here
EASYECOM_EMAIL=your_registered_email_here

# Reconciliation Settings
RECONCILIATION_CRON_SCHEDULE=0 */6 * * *
RECONCILIATION_LOOKBACK_DAYS=7
RECONCILIATION_BATCH_SIZE=100
```

5. Generate Prisma client and migrate database:
```bash
npm run db:generate
npm run db:migrate
```

## Usage

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Production Mode

```bash
npm run build
npm start
```

## Dashboard

The system includes a beautiful web-based dashboard for easy visualization and management of reconciliation data.

### Access the Dashboard

Once the server is running, open your browser and navigate to:
```
http://localhost:3000
```

### Dashboard Features

- **Real-time Statistics**: View counts for Shopify orders, Razorpay payments, Easyecom orders, and reconciliations
- **Date Range Selection**: Choose specific date ranges or use lookback days for data operations
- **Platform Sync**: Manually sync data from Shopify, Razorpay, Easyecom, or all platforms at once
- **Run Reconciliation**: Trigger manual reconciliation runs with custom date ranges
- **Reconciliation Results**: View detailed results with:
  - Summary cards showing matched, partial matches, unmatched, and discrepancies
  - Interactive table with confidence scores and detailed information
  - Status badges for easy identification
- **Recent Logs**: View history of recent reconciliation runs with statistics
- **Auto-refresh**: System statistics refresh automatically every 30 seconds
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

### Dashboard Usage Flow

1. **Initial Setup**: Configure your API credentials in `.env` file
2. **Sync Data**: Click "Sync All Platforms" or sync individual platforms
3. **Run Reconciliation**: Set your date range and click "Run Reconciliation"
4. **View Results**: Review matched and unmatched records in the results table
5. **Monitor**: Check recent logs to track reconciliation history

## API Endpoints

### Health & Status

- **GET** `/api/health` - Health check
- **GET** `/api/health/status` - System status and statistics

### Reconciliation

- **POST** `/api/reconciliation/run` - Trigger manual reconciliation
  ```json
  {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "lookbackDays": 7
  }
  ```

- **GET** `/api/reconciliation/report/:runId?` - Get reconciliation report
- **GET** `/api/reconciliation/logs` - Get reconciliation run history

### Data Synchronization

- **POST** `/api/sync/shopify` - Sync Shopify orders
- **POST** `/api/sync/razorpay` - Sync Razorpay payments
- **POST** `/api/sync/easyecom` - Sync Easyecom orders
- **POST** `/api/sync/all` - Sync all platforms

All sync endpoints accept optional parameters:
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "lookbackDays": 7
}
```

## Reconciliation Logic

The system uses intelligent matching algorithms to reconcile records:

### Matching Criteria

1. **Shopify ↔ Razorpay**
   - Email matching (40% weight)
   - Amount matching within 1% tolerance (40% weight)
   - Timestamp proximity within 24 hours (20% weight)

2. **Shopify ↔ Easyecom**
   - Marketplace Order ID matching (60% weight)
   - Amount matching within 1% tolerance (30% weight)
   - Timestamp proximity within 48 hours (10% weight)

### Reconciliation Statuses

- **MATCHED** - Confident match (≥80% confidence, <1 amount difference)
- **PARTIAL_MATCH** - Partial match (≥50% confidence, <10 amount difference)
- **DISCREPANCY** - Significant amount difference (≥10 amount difference)
- **UNMATCHED** - No confident match found
- **UNDER_REVIEW** - Manually flagged for review
- **RESOLVED** - Discrepancy resolved

## Database Schema

The system uses Prisma ORM with the following models:

- `ShopifyOrder` - Shopify order records
- `RazorpayPayment` - Razorpay payment records
- `EasyecomOrder` - Easyecom order records
- `Reconciliation` - Matching results and status
- `ReconciliationLog` - Run history and statistics

## Scheduled Jobs

The system runs automatic reconciliation based on the configured cron schedule:

- Default: Every 6 hours (`0 */6 * * *`)
- Configurable via `RECONCILIATION_CRON_SCHEDULE`
- Automatically looks back N days (configured via `RECONCILIATION_LOOKBACK_DAYS`)

## Logging

Logs are stored in the `logs/` directory:

- `app.log` - All application logs
- `error.log` - Error-specific logs

Log level can be configured via `LOG_LEVEL` environment variable.

## Error Handling

The system includes comprehensive error handling:

- API request retries with exponential backoff
- Graceful degradation for individual platform failures
- Detailed error logging with stack traces
- Transaction rollbacks for data integrity

## Development

### Project Structure

```
cpreconcile/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── config/
│   │   └── index.ts           # Configuration management
│   ├── routes/
│   │   ├── health.routes.ts   # Health endpoints
│   │   ├── reconciliation.routes.ts
│   │   └── sync.routes.ts
│   ├── scheduler/
│   │   └── index.ts           # Cron scheduler
│   ├── services/
│   │   ├── shopify.service.ts
│   │   ├── razorpay.service.ts
│   │   ├── easyecom.service.ts
│   │   └── reconciliation.service.ts
│   ├── utils/
│   │   ├── database.ts        # Prisma client
│   │   └── logger.ts          # Winston logger
│   ├── app.ts                 # Express app
│   └── index.ts               # Entry point
├── .env.example
├── package.json
└── tsconfig.json
```

### Running Database Migrations

```bash
# Create a new migration
npm run db:migrate

# View database in Prisma Studio
npm run db:studio
```

### Linting

```bash
npm run lint
```

## Security Considerations

- Store API credentials securely in environment variables
- Use HTTPS for production deployments
- Implement rate limiting for API endpoints
- Regular security audits of dependencies
- Encrypt sensitive data at rest

## Performance Optimization

- Batch processing for large datasets
- Database indexing on frequently queried fields
- Caching for repeated API calls
- Pagination for large result sets
- Connection pooling for database

## Troubleshooting

### Common Issues

1. **Database connection errors**
   - Ensure `DATABASE_URL` is correctly set
   - Check file permissions for SQLite database

2. **API authentication failures**
   - Verify all API credentials in `.env`
   - Check API token permissions and expiry

3. **Reconciliation not running**
   - Check cron schedule format
   - Verify scheduler is started
   - Review logs for errors

4. **High memory usage**
   - Reduce `RECONCILIATION_BATCH_SIZE`
   - Decrease `RECONCILIATION_LOOKBACK_DAYS`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC

## Support

For issues and questions:
- Check the logs in `logs/` directory
- Review API documentation at `http://localhost:3000/`
- Open an issue on GitHub

## Roadmap

- [ ] Add support for multiple Shopify stores
- [ ] Implement webhook-based real-time reconciliation
- [ ] Add email notifications for discrepancies
- [ ] Create a web dashboard for monitoring
- [ ] Support for more payment gateways
- [ ] Advanced analytics and reporting
- [ ] Export reconciliation reports (CSV, Excel, PDF)
- [ ] Multi-currency support with conversion rates
