-- ==========================================
-- 🛠️  VPS DATABASE & USER CREATION ONLY
-- ==========================================
-- Directions:
-- 1. Login to VPS: ssh root@69.28.88.246
-- 2. Open Postgres as Superuser: sudo -u postgres psql
-- 3. Run this file.
-- ==========================================

-- 1️⃣  CLEANUP OLD DATABASES
-- ⚠️ WARNING: This will DELETE all data in these databases.
DROP DATABASE IF EXISTS chaiapp_production;
DROP DATABASE IF EXISTS chai_production_v2;

-- 2️⃣  CREATE NEW SECURE USER
DROP USER IF EXISTS chai_deployer;
CREATE USER chai_deployer WITH PASSWORD 'ChaiMaster_2025_Secure';

-- 3️⃣  CREATE NEW DATABASE
CREATE DATABASE chai_production_v2 OWNER chai_deployer;

-- 4️⃣  GRANT PRIVILEGES
-- Give the user full control over this new database
GRANT ALL PRIVILEGES ON DATABASE chai_production_v2 TO chai_deployer;

-- 5️⃣  CONNECT & SETUP EXTENSIONS
\c chai_production_v2
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant schema usage just in case
GRANT ALL ON SCHEMA public TO chai_deployer;

-- ==========================================
-- ✅ DONE!
-- Database: chai_production_v2
-- User:     chai_deployer
-- Pass:     ChaiMaster_2025_Secure
--
-- Now you can restore your backup manually.
-- ==========================================
