# EventHorizon: Soroban-to-Web2 Automation Platform

EventHorizon is a decentralized "If-This-Then-That" (IFTTT) platform that listens for specific events emitted by Stellar Soroban smart contracts and triggers real-world Web2 actions like webhooks, Discord notifications, or emails.

## 🚀 How it Works

1.  **If This**: A Soroban smart contract emits an event (e.g., `SwapExecuted`, `LiquidityAdded`).
2.  **Then That**: EventHorizon's worker detects the event and triggers a configured action (e.g., POST to a webhook).

## 📂 Project Structure

-   `/backend`: Node.js/Express server and Soroban event poller worker.
-   `/frontend`: Vite/React dashboard for managing triggers.
-   `/contracts/boilerplate`: Boilerplate Soroban Rust contract for testing.
-   `/contracts/token_vesting`: Secure token vesting contract with linear release and cliff.
-   `/contracts/staking`: Reward-based staking contract with early unstake penalties.


## 🛠️ Setup & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB
- Redis (optional, for background job processing - see [REDIS_OPTIONAL.md](backend/REDIS_OPTIONAL.md))
- Rust & Soroban CLI (for contracts)

### Environment Setup
1. Copy `.env.example` to `.env` in both root and subdirectories.
2. Update `SOROBAN_RPC_URL` (e.g., `https://soroban-testnet.stellar.org`).
3. Update `MONGO_URI`.

### Running Locally
```bash
# Install dependencies
npm run install:all

# Start backend
npm run dev:backend

# Start frontend
npm run dev:frontend
```

### API Documentation
- Interactive Swagger UI is available at `/api/docs` when the backend is running.
- Raw OpenAPI JSON is available at `/api/docs/openapi.json`.

### Background Job Processing
EventHorizon uses BullMQ with Redis for reliable background processing of trigger actions:
- **Guaranteed delivery** with automatic retries
- **Concurrency control** for external API calls
- **Job monitoring** via `/api/queue/stats` endpoint
- **Optional**: Works without Redis (falls back to direct execution)
- See [backend/QUEUE_SETUP.md](backend/QUEUE_SETUP.md) for setup instructions
- See [backend/REDIS_OPTIONAL.md](backend/REDIS_OPTIONAL.md) for fallback behavior

## 📦 High-Frequency Event Batching

EventHorizon supports intelligent batching for high-frequency events to improve efficiency and reduce API call overhead:

### Features
- **Window-based batching**: Collect events for a configurable time window (default: 10 seconds)
- **Size-based batching**: Flush batches when reaching a maximum size (default: 50 events)
- **Per-trigger configuration**: Enable/disable batching and customize settings per trigger
- **Error resilience**: Continue processing other events in a batch if one fails (configurable)
- **Array payload format**: Batches are sent as arrays of event payloads

### Configuration
When creating or updating a trigger, include the `batchingConfig` object:

```json
{
  "contractId": "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
  "eventName": "transfer",
  "actionType": "webhook",
  "actionUrl": "https://api.example.com/webhook",
  "batchingConfig": {
    "enabled": true,
    "windowMs": 10000,        // 10 seconds
    "maxBatchSize": 50,       // Max 50 events per batch
    "continueOnError": true   // Continue if one event fails
  }
}
```

### Batch Payload Format
For webhooks, batches are sent as:

```json
{
  "contractId": "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
  "eventName": "transfer",
  "batchPayloads": [
    { "event": "payload1", "ledger": 12345 },
    { "event": "payload2", "ledger": 12346 }
  ],
  "batchSize": 2
}
```

For other action types (Discord, Telegram, Email), each event in the batch is processed individually but grouped for efficiency.

### API Endpoints
- `GET /api/queue/batches/stats` - Get current batch statistics
- `POST /api/queue/batches/flush` - Manually flush all pending batches

### Monitoring
Use the batch stats endpoint to monitor:
- Number of active batches
- Pending flush timers
- Events per batch and batch age

## 🧪 Testing with the Boilerplate Contract
1. Deploy the contract in `/contracts`.
2. Copy the Contract ID.
3. Add a new trigger in the dashboard using the Contract ID and event name `test_event`.
4. Invoke the `trigger_event` function on the contract.
5. Watch the backend logs/webhook for the triggered action!
