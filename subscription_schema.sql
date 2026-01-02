
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Subscription Plans
CREATE TYPE plan_type AS ENUM ('free', 'monthly', 'yearly', 'lifetime');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'past_due');


CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    plan_type plan_type NOT NULL DEFAULT 'free',
    status subscription_status NOT NULL DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    provider VARCHAR(50), -- 'stripe', 'razorpay'
    subscription_id VARCHAR(255), -- External ID from provider
    customer_limit INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist (idempotent)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_limit INTEGER DEFAULT 10;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);


-- Payment History for Subscriptions
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES subscriptions(id),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    provider VARCHAR(50), 
    payment_id VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
