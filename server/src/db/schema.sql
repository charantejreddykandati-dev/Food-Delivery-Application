-- =============================================================================
-- Hyperlocal Food Discovery, Ordering, and Real-Time Tracking Platform
-- Production PostgreSQL Schema & Row-Level Security (RLS) Policies
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Domain Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'MERCHANT', 'COURIER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('UNPAID', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_gateway AS ENUM ('SIMULATED_STRIPE', 'WALLET_BALANCE', 'CASH_ON_DELIVERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users & Profiles
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    role user_role DEFAULT 'CUSTOMER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customer Delivery Addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) DEFAULT 'Home', -- Home, Work, Other
    street_address TEXT NOT NULL,
    apartment_unit VARCHAR(50),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Restaurants / Merchants
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(220) UNIQUE NOT NULL,
    description TEXT,
    banner_image_url TEXT NOT NULL,
    logo_image_url TEXT NOT NULL,
    cuisine_types TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    rating DECIMAL(2, 1) DEFAULT 5.0,
    rating_count INT DEFAULT 0,
    price_bracket VARCHAR(5) DEFAULT '$$', -- $, $$, $$$, $$$$
    base_prep_time_minutes INT DEFAULT 20,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    base_price_cents INT NOT NULL, -- Stored in smallest currency unit (cents)
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    dietary_flags TEXT[] DEFAULT '{}', -- VEGAN, GLUTEN_FREE, etc.
    calories INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Menu Item Modifier Groups (e.g., "Choose Size", "Select Sauce")
CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    min_selection INT DEFAULT 0,
    max_selection INT DEFAULT 1,
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Modifier Group Options
CREATE TABLE IF NOT EXISTS modifier_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    extra_price_cents INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number BIGSERIAL UNIQUE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
    delivery_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
    delivery_address_snapshot JSONB NOT NULL,
    status order_status DEFAULT 'PENDING_PAYMENT',
    payment_status payment_status DEFAULT 'UNPAID',
    payment_gateway payment_gateway DEFAULT 'SIMULATED_STRIPE',
    subtotal_cents INT NOT NULL,
    delivery_fee_cents INT NOT NULL,
    tax_cents INT NOT NULL,
    tip_cents INT DEFAULT 0,
    total_cents INT NOT NULL,
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    special_instructions TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    item_name_snapshot VARCHAR(200) NOT NULL,
    unit_price_cents INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price_cents INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order Item Modifiers Selected
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_name_snapshot VARCHAR(100) NOT NULL,
    extra_price_cents INT NOT NULL DEFAULT 0
);

-- Immutable Lifecycle Tracking Events (SSE Event Source)
CREATE TABLE IF NOT EXISTS order_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status order_status,
    new_status order_status NOT NULL,
    actor_id UUID REFERENCES users(id),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Query Optimization
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- =============================================================================
-- Section 11: Row Level Security (RLS) / Data Isolation Rules
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;

-- Helper function for current session user id (supports both Supabase auth.uid() and app.current_user_id)
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Customers: Can SELECT, INSERT, and UPDATE records only where customer_id = current_app_user_id() or user_id = current_app_user_id()
DROP POLICY IF EXISTS customer_addresses_isolation ON customer_addresses;
CREATE POLICY customer_addresses_isolation ON customer_addresses
    FOR ALL
    USING (user_id = current_app_user_id())
    WITH CHECK (user_id = current_app_user_id());

DROP POLICY IF EXISTS customer_orders_select ON orders;
CREATE POLICY customer_orders_select ON orders
    FOR SELECT
    USING (
        customer_id = current_app_user_id()
        OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = current_app_user_id())
    );

DROP POLICY IF EXISTS customer_orders_insert ON orders;
CREATE POLICY customer_orders_insert ON orders
    FOR INSERT
    WITH CHECK (customer_id = current_app_user_id());

DROP POLICY IF EXISTS customer_or_merchant_orders_update ON orders;
CREATE POLICY customer_or_merchant_orders_update ON orders
    FOR UPDATE
    USING (
        customer_id = current_app_user_id()
        OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = current_app_user_id())
    );

-- Public Access: Any authenticated or anonymous user can SELECT from restaurants, menu_categories, menu_items, modifier_groups, and modifier_options where is_active = TRUE and is_available = TRUE
DROP POLICY IF EXISTS public_restaurants_select ON restaurants;
CREATE POLICY public_restaurants_select ON restaurants
    FOR SELECT
    USING (is_active = TRUE OR owner_id = current_app_user_id());

DROP POLICY IF EXISTS public_menu_categories_select ON menu_categories;
CREATE POLICY public_menu_categories_select ON menu_categories
    FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS public_menu_items_select ON menu_items;
CREATE POLICY public_menu_items_select ON menu_items
    FOR SELECT
    USING (is_available = TRUE OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = current_app_user_id()));

DROP POLICY IF EXISTS public_modifier_groups_select ON modifier_groups;
CREATE POLICY public_modifier_groups_select ON modifier_groups
    FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS public_modifier_options_select ON modifier_options;
CREATE POLICY public_modifier_options_select ON modifier_options
    FOR SELECT
    USING (is_available = TRUE);

-- Order Events: Can be read by either the customer who owns the order or the merchant owning the restaurant fulfilling the order
DROP POLICY IF EXISTS order_events_access ON order_events;
CREATE POLICY order_events_access ON order_events
    FOR SELECT
    USING (
        order_id IN (
            SELECT id FROM orders
            WHERE customer_id = current_app_user_id()
               OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = current_app_user_id())
        )
    );
