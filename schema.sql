-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers Table
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

-- Chai/Coffee Logs Table
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    timestamp BIGINT NOT NULL,
    count INTEGER NOT NULL,
    product_type VARCHAR(50) DEFAULT 'chai'
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    month_str VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    amount DECIMAL(10, 2) NOT NULL,
    paid_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- Settings Table (Store as JSON or single row)
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
