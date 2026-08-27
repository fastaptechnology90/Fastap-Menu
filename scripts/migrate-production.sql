-- Non-interactive schema updates for production deploy (idempotent)

-- Staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary numeric(10,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS shift text DEFAULT 'morning';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tables_assigned jsonb DEFAULT '[]'::jsonb;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS join_date timestamptz;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS performance_score integer DEFAULT 90;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS weekly_schedule jsonb DEFAULT '{}'::jsonb;

-- Restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS fssai_number text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS open_time text DEFAULT '11:00';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS close_time text DEFAULT '23:00';

-- Users (2FA support)
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret text;

-- Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS anniversary text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS favorite_items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS wallet_balance numeric(10,2) DEFAULT '0';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes text;

-- Reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reservation_type text NOT NULL DEFAULT 'table';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) DEFAULT '0';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS special_request text;

-- Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'pos';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_id integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_count integer NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount numeric(10,2) DEFAULT '0';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT '0';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge numeric(10,2) DEFAULT '0';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_reason text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nfc_tag_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_code_id integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number text;

-- Tables map
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS current_order_id integer;
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS current_customer_name text;
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS area_id integer;
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS position_x integer;
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS position_y integer;
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS reserved_until timestamptz;
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS reservation_id integer;
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE tables_map ADD COLUMN IF NOT EXISTS locked_by text;

-- Table areas
CREATE TABLE IF NOT EXISTS table_areas (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  area_type text NOT NULL DEFAULT 'indoor',
  description text,
  color_code text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  layout_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Banquet events
CREATE TABLE IF NOT EXISTS banquet_events (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'enquiry',
  event_date timestamptz,
  event_time text,
  guest_count integer NOT NULL DEFAULT 0,
  venue text,
  status text NOT NULL DEFAULT 'enquiry',
  advance_paid numeric(10,2) DEFAULT '0',
  total_amount numeric(10,2) DEFAULT '0',
  contact_name text,
  contact_phone text,
  menu text,
  notes text,
  catering boolean DEFAULT true,
  decor boolean DEFAULT false,
  staff_assigned jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
