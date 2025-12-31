-- ==========================================
-- 🛠️  VPS FRESH RESET SCRIPT (NEW DB & USER)
-- ==========================================
-- Directions:
-- 1. Login to VPS: ssh root@69.28.88.246
-- 2. Open Postgres as Superuser: sudo -u postgres psql
-- 3. Copy & Paste this WHOLE file.
-- ==========================================

-- 1️⃣  CREATE NEW SECURE USER
-- We use a specific, new user for safety.
DROP USER IF EXISTS chai_deployer;
CREATE USER chai_deployer WITH PASSWORD 'ChaiMaster_2025_Secure';

-- 2️⃣  CREATE NEW DATABASE
-- We create a v2 database to avoid conflicts with the old one.
DROP DATABASE IF EXISTS chai_production_v2;
CREATE DATABASE chai_production_v2 OWNER chai_deployer;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE chai_production_v2 TO chai_deployer;

-- 3️⃣  CONNECT TO NEW DATABASE
\c chai_production_v2

-- 4️⃣  INSTALL EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 5️⃣  APPLY SCHEMA (Everything needed for the app)

-- Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stores (Multi-tenancy)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    currency_symbol VARCHAR(10) DEFAULT '₹',
    upi_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    office VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
);

-- Logs (Orders)
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    timestamp BIGINT NOT NULL,
    count INTEGER NOT NULL,
    product_type VARCHAR(50) DEFAULT 'chai',
    price_at_time DECIMAL(10, 2)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    month_str VARCHAR(7) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    paid_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
    status VARCHAR(50) DEFAULT 'completed'
);

-- Global Settings (Legacy support, though Stores table is preferred)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL
);

-- Insert Default Global Settings (Fallback)
INSERT INTO settings (id, data) VALUES (1, '{
    "pricePerChai": 10,
    "pricePerCoffee": 20,
    "currencySymbol": "₹",
    "shopName": "My Chai Shop",
    "enableNotifications": false,
    "soundEnabled": true,
    "products": [
        { "id": "chai", "name": "Chai", "price": 10, "color": "#d97706", "icon": "☕" },
        { "id": "coffee", "name": "Coffee", "price": 20, "color": "#451a03", "icon": "☕" }
    ]
}') ON CONFLICT (id) DO NOTHING;

-- Grant ownership of all tables to the new user "chai_deployer"
-- (Just in case they were created by postgres superuser)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chai_deployer;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chai_deployer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO chai_deployer;

-- ==========================================
-- ✅ DONE!
-- NOW UPDATE YOUR .ENV FILE ON VPS:
-- DATABASE_URL=postgresql://chai_deployer:ChaiMaster_2025_Secure@localhost:5432/chai_production_v2
-- ==========================================
