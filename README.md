# Chai Backend

Standalone Express.js backend API for Chai App with Google OAuth authentication and PostgreSQL database.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and secrets

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Backend will run on **http://localhost:3001**

## 📋 Prerequisites

- Node.js >= 20.0.0
- PostgreSQL database
- Google OAuth credentials

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `FRONTEND_URL` | Frontend CORS origin | `http://localhost:5174` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret (32+ chars) | Required |
| `SESSION_SECRET` | Session secret (32+ chars) | Required |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Required |

## 📁 Project Structure

```
chai-backend/
├── src/
│   ├── config/         # Configuration files
│   ├── middleware/     # Express middleware
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic
│   ├── scripts/        # Utility scripts
│   ├── __tests__/      # Test files
│   └── server.ts       # Main server file
├── public/             # Static assets (uploads)
├── *.sql              # Database schemas
└── package.json
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm test` - Run test suite
- `npm run db:migrate` - Run database migrations

## 🔌 API Endpoints

Core endpoints:
- `POST /api/auth/google` - Google OAuth authentication
- `GET /api/customers` - Get customers list
- `POST /api/transactions` - Create transaction
- `GET /api/admin/*` - Admin routes (protected)

## 🔐 CORS Configuration

The backend allows requests from the frontend URL specified in `FRONTEND_URL` environment variable.

**Development:** `http://localhost:5174`  
**Production:** Update to your production frontend URL

## 🗄️ Database Setup

1. Create PostgreSQL database:
   ```bash
   createdb chaiapp_db
   ```

2. Run schema files:
   ```bash
   psql chaiapp_db < schema.sql
   psql chaiapp_db < auth_schema.sql
   psql chaiapp_db < admin_schema.sql
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

## 🚢 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Configuration

1. Set `NODE_ENV=production`
2. Update `FRONTEND_URL` to production frontend URL
3. Use strong secrets for `JWT_SECRET` and `SESSION_SECRET`
4. Configure production database
5. Set up HTTPS/SSL certificates

## 📝 License

Private - Chai App Backend
# chaiapp-backend
