# WhatsApp Sender

WhatsApp campaign sender application for business communication.

## Migration to Cloudflare D1

This project has been migrated from Supabase to Cloudflare D1 for database storage. The main advantages include:

- Persistent database that doesn't shut down due to inactivity
- Simplified operations with SQLite compatible API
- Integration with Cloudflare Workers
- Free tier that's generous for most use cases

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Cloudflare account (for D1 database in production)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server configuration
PORT=3000
NODE_ENV=development

# Secret keys
JWT_SECRET=your_jwt_secret_key_here

# Database configuration 
DEV_DB_PATH=wa_sender.db

# OpenAI API Key (optional, for AI message generation)
OPENAI_API_KEY=your_openai_api_key_here
```

### Database Setup

#### Development (Local SQLite)

For local development, the application uses SQLite. To set up:

1. Initialize the local database:

```bash
npm install
npm run db:local
```

2. Run the migrations to create tables:

```bash
sqlite3 wa_sender.db < db/schema.sql
```

3. Start the development server:

```bash
npm run dev
```

#### Production (Cloudflare D1)

For production, you'll use Cloudflare D1. To set up:

1. Log in to Cloudflare with Wrangler:

```bash
npx wrangler login
```

2. Create a D1 database:

```bash
npm run db:create
```

3. Copy the database ID from the output and update it in the `wrangler.toml` file.

4. Run the schema migrations:

```bash
npm run db:migrate
```

5. Deploy to Cloudflare Workers (requires additional configuration for Workers setup).

## Docker Setup

This application can be run with Docker:

```bash
docker-compose build
docker-compose up -d
```

## API Documentation

The API follows REST principles and has endpoints for:

- Authentication (login/register)
- Campaign management (CRUD operations)
- Recipient management
- WhatsApp messaging

## License

MIT 