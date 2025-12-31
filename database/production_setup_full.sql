-- ==========================================
-- 🚀  VPS PRODUCTION DATABASE SETUP SCRIPT
-- ==========================================
-- Directions:
-- 1. Login to your VPS: ssh root@69.28.88.246
-- 2. Open Postgres: sudo -u postgres psql
-- 3. Copy and Paste ALL the commands below
-- ==========================================

-- 1️⃣  SETUP USER AND DATABASE
-- Set password to match your .env (postgres:postgres)
ALTER USER postgres WITH PASSWORD 'postgres';

-- Create the database (ignoring error if exists)
-- DROP DATABASE IF EXISTS chaiapp_production; -- ⚠️ UNCOMMENT TO RESET COMPLETELY
SELECT 'CREATE DATABASE chaiapp_production'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'chaiapp_production')\gexec

-- Connect to the database
\c chaiapp_production

-- 2️⃣  INSTALL EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3️⃣  CREATE BASE SCHEMA (from schema.sql)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    office VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    timestamp BIGINT NOT NULL,
    count INTEGER NOT NULL,
    product_type VARCHAR(50) DEFAULT 'chai'
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    month_str VARCHAR(7) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    paid_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL
);

-- Insert default settings
INSERT INTO settings (id, data) VALUES (1, '{
    "pricePerChai": 10,
    "pricePerCoffee": 20,
    "currencySymbol": "₹",
    "shopName": "My Chai Shop",
    "enableNotifications": false,
    "soundEnabled": true,
    "products": [
        { "id": "chai", "name": "Chai", "price": 10, "color": "#d97706", "icon": "☕" },
        { "id": "coffee", "name": "Coffee", "price": 20, "color": "#451a03", "icon": "☕" },
        { "id": "bread", "name": "Bread", "price": 15, "color": "#f59e0b", "icon": "🍞" }
    ]
}') ON CONFLICT (id) DO NOTHING;

-- 4️⃣  CREATE AUTH SCHEMA (from auth_schema.sql)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    currency_symbol VARCHAR(10) DEFAULT '₹',
    upi_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_settings (
    store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    price_per_chai DECIMAL(10, 2) DEFAULT 10.00,
    price_per_coffee DECIMAL(10, 2) DEFAULT 15.00,
    shop_name VARCHAR(255),
    enable_notifications BOOLEAN DEFAULT false,
    sound_enabled BOOLEAN DEFAULT true,
    last_notification_date VARCHAR(50)
);

-- Link customers to stores (Essential for multi-tenancy)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'store_id') THEN
        ALTER TABLE customers ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5️⃣  UPDATE USERS FOR PASSWORD LOGIN (from password_schema.sql)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email);

-- Final Check
\dt
