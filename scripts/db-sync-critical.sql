-- Idempotent production schema patches (drizzle-kit push is interactive on VPS).
-- Safe to re-run on every deploy.

-- categories
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS category_group text NOT NULL DEFAULT 'food';
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS available_from text;
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS available_to text;

-- menu_items
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS discounted_price numeric(10, 2);
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS preview_360_url text;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS ingredients text;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS allergens text;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS calories integer;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS protein integer;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS carbs integer;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS prep_time integer;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS prep_method text;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS chef_recommended boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS customization_options jsonb NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS spice_level integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS dietary_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS order_count integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]';
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS addons jsonb NOT NULL DEFAULT '[]';

-- tables_map
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS table_type text NOT NULL DEFAULT '4_seater';
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS table_category text NOT NULL DEFAULT 'restaurant';
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS current_guest_count integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS occupied_since timestamptz;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS color_code text;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS merged_into integer;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS current_waiter_name text;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS current_order_id integer;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS current_customer_name text;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS area_id integer;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS position_x integer;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS position_y integer;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS reserved_until timestamptz;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS reservation_id integer;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS locked_by text;

-- restaurants
ALTER TABLE IF EXISTS restaurants ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'restaurant';
ALTER TABLE IF EXISTS restaurants ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE IF EXISTS restaurants ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';

-- guest_users (CREATE before ALTER)
CREATE TABLE IF NOT EXISTS guest_users (
  id serial PRIMARY KEY,
  phone text UNIQUE,
  email text UNIQUE,
  password_hash text,
  name text,
  avatar text,
  tier text NOT NULL DEFAULT 'silver',
  language text NOT NULL DEFAULT 'en',
  timezone text DEFAULT 'Asia/Kolkata',
  is_guest boolean NOT NULL DEFAULT false,
  login_provider text NOT NULL DEFAULT 'otp',
  device_info jsonb DEFAULT '{}',
  wallet_balance text NOT NULL DEFAULT '0',
  cashback_balance text NOT NULL DEFAULT '0',
  wallet_buckets jsonb NOT NULL DEFAULT '{"main":"0","cashback":"0","refund":"0","reward":"0","gift":"0","membership":"0"}',
  loyalty_points text NOT NULL DEFAULT '0',
  birthday text,
  anniversary text,
  rewards_meta jsonb NOT NULL DEFAULT '{"diningCredits":0,"birthdayClaimedYear":null,"anniversaryClaimedYear":null}',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS guest_users ADD COLUMN IF NOT EXISTS wallet_buckets jsonb NOT NULL DEFAULT '{"main":"0","cashback":"0","refund":"0","reward":"0","gift":"0","membership":"0"}';
ALTER TABLE IF EXISTS guest_users ADD COLUMN IF NOT EXISTS rewards_meta jsonb NOT NULL DEFAULT '{"diningCredits":0,"birthdayClaimedYear":null,"anniversaryClaimedYear":null}';
ALTER TABLE IF EXISTS guest_users ADD COLUMN IF NOT EXISTS login_provider text NOT NULL DEFAULT 'otp';
ALTER TABLE IF EXISTS guest_users ADD COLUMN IF NOT EXISTS device_info jsonb DEFAULT '{}';

CREATE TABLE IF NOT EXISTS menu_views (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'qr',
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guest_sessions (
  id serial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  share_code text,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE CASCADE,
  session_type text NOT NULL DEFAULT 'personal',
  table_id integer,
  table_name text,
  room_number text,
  section_name text,
  entry_method text,
  service_mode text,
  language text NOT NULL DEFAULT 'en',
  timezone text DEFAULT 'Asia/Kolkata',
  branch_id integer,
  cart_snapshot jsonb NOT NULL DEFAULT '[]',
  device_ids jsonb NOT NULL DEFAULT '[]',
  member_count integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  description text,
  discount_percent numeric(5, 2),
  discount_amount numeric(10, 2),
  trigger_type text NOT NULL DEFAULT 'manual',
  start_date text,
  end_date text,
  is_active boolean NOT NULL DEFAULT true,
  target_segment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric(10, 2) NOT NULL,
  min_order_amount numeric(10, 2) DEFAULT '0',
  max_discount numeric(10, 2),
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  date text NOT NULL,
  time text NOT NULL,
  guest_count integer NOT NULL DEFAULT 2,
  table_id integer,
  zone text,
  reservation_type text NOT NULL DEFAULT 'table',
  deposit_amount numeric(10, 2) DEFAULT '0',
  deposit_status text NOT NULL DEFAULT 'none',
  booking_token text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  special_request text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id serial PRIMARY KEY,
  guest_user_id integer NOT NULL REFERENCES guest_users(id) ON DELETE CASCADE,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL,
  type text NOT NULL,
  wallet_type text NOT NULL DEFAULT 'main',
  amount numeric(10, 2) NOT NULL,
  balance_after numeric(10, 2) NOT NULL,
  description text,
  reference_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Restaurant CRM + ops tables (dashboard, inventory, finance, procurement, etc.)
CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  total_orders integer NOT NULL DEFAULT 0,
  total_spend numeric(10, 2) NOT NULL DEFAULT '0',
  loyalty_points integer NOT NULL DEFAULT 0,
  last_visit timestamptz,
  segment text NOT NULL DEFAULT 'new',
  birthday text,
  anniversary text,
  preferences jsonb DEFAULT '{}',
  favorite_items jsonb DEFAULT '[]',
  wallet_balance numeric(10, 2) DEFAULT '0',
  is_vip boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'raw_material',
  unit text NOT NULL DEFAULT 'kg',
  current_stock numeric(10, 3) NOT NULL DEFAULT '0',
  min_stock numeric(10, 3) NOT NULL DEFAULT '0',
  max_stock numeric(10, 3) NOT NULL DEFAULT '0',
  cost_per_unit numeric(10, 2) NOT NULL DEFAULT '0',
  supplier text,
  expiry_date timestamptz,
  batch_number text,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  action text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  severity text NOT NULL DEFAULT 'info',
  performed_by text NOT NULL,
  role text,
  ip_address text,
  device_info text,
  details jsonb NOT NULL DEFAULT '{}',
  resource_type text,
  resource_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  gst_number text,
  category text NOT NULL DEFAULT 'general',
  rating integer NOT NULL DEFAULT 5,
  payment_terms text NOT NULL DEFAULT 'immediate',
  credit_limit numeric(10, 2) NOT NULL DEFAULT '0',
  outstanding_balance numeric(10, 2) NOT NULL DEFAULT '0',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id integer REFERENCES suppliers(id),
  supplier_name text NOT NULL,
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(10, 2) NOT NULL DEFAULT '0',
  tax numeric(10, 2) NOT NULL DEFAULT '0',
  total numeric(10, 2) NOT NULL DEFAULT '0',
  expected_delivery timestamptz,
  delivered_at timestamptz,
  notes text,
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  assigned_to text,
  assigned_role text,
  due_date timestamptz,
  completed_at timestamptz,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_schedule text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sop_items (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'service',
  content text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]',
  video_url text,
  assigned_roles jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_shifts (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  staff_role text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_balance numeric(10, 2) NOT NULL DEFAULT '0',
  closing_balance numeric(10, 2),
  expected_balance numeric(10, 2),
  cash_sales numeric(10, 2) NOT NULL DEFAULT '0',
  cash_expenses numeric(10, 2) NOT NULL DEFAULT '0',
  denominations text,
  notes text,
  status text NOT NULL DEFAULT 'open',
  mismatch_alert boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  reference text,
  order_id integer,
  performed_by text,
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_commissions (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id integer,
  staff_name text NOT NULL,
  staff_role text NOT NULL,
  type text NOT NULL DEFAULT 'sales',
  order_id integer,
  amount numeric(10, 2) NOT NULL DEFAULT '0',
  percentage numeric(5, 2),
  description text,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  month text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  sender_role text NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  channel text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipes (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  servings integer NOT NULL DEFAULT 1,
  preparation_time integer NOT NULL DEFAULT 0,
  selling_price numeric(10, 2) NOT NULL DEFAULT '0',
  total_cost numeric(10, 2) NOT NULL DEFAULT '0',
  profit_margin numeric(5, 2) NOT NULL DEFAULT '0',
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id serial PRIMARY KEY,
  recipe_id integer NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  restaurant_id integer NOT NULL,
  ingredient_name text NOT NULL,
  quantity numeric(10, 3) NOT NULL,
  unit text NOT NULL,
  cost_per_unit numeric(10, 2) NOT NULL DEFAULT '0',
  total_cost numeric(10, 2) NOT NULL DEFAULT '0',
  inventory_item_id integer
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id integer NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type text NOT NULL,
  quantity numeric(10, 3) NOT NULL,
  reason text,
  reference text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Platform admin tables (super admin panel)
CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  action text NOT NULL,
  module text NOT NULL,
  target text,
  ip_address text,
  device_info text,
  severity text NOT NULL DEFAULT 'info',
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_settlements (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  cycle text NOT NULL DEFAULT 'weekly',
  gross_sales numeric(12,2) NOT NULL DEFAULT '0',
  commission numeric(12,2) NOT NULL DEFAULT '0',
  refunds numeric(12,2) NOT NULL DEFAULT '0',
  penalties numeric(12,2) NOT NULL DEFAULT '0',
  final_payout numeric(12,2) NOT NULL DEFAULT '0',
  status text NOT NULL DEFAULT 'pending',
  hold_reason text,
  due_date timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_refunds (
  id serial PRIMARY KEY,
  order_id integer REFERENCES orders(id) ON DELETE SET NULL,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name text,
  amount numeric(10,2) NOT NULL,
  reason text,
  refund_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE TABLE IF NOT EXISTS platform_chargebacks (
  id serial PRIMARY KEY,
  order_id integer REFERENCES orders(id) ON DELETE SET NULL,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id text,
  amount numeric(10,2) NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending_response',
  deadline timestamptz,
  filed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS platform_fraud_alerts (
  id serial PRIMARY KEY,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  risk_score integer NOT NULL DEFAULT 50,
  amount numeric(10,2),
  status text NOT NULL DEFAULT 'active',
  ai_signal text,
  details jsonb NOT NULL DEFAULT '{}',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS platform_coupons (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  coupon_type text NOT NULL DEFAULT 'percentage',
  discount numeric(10,2) NOT NULL,
  max_uses integer NOT NULL DEFAULT 1000,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  applicable_vendor_ids jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_commission_rules (
  id serial PRIMARY KEY,
  name text NOT NULL,
  rule_type text NOT NULL DEFAULT 'percentage',
  value numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT '%',
  apply_to text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_taxes (
  id serial PRIMARY KEY,
  name text NOT NULL,
  rate numeric(5,2) NOT NULL,
  tax_type text NOT NULL DEFAULT 'sales_tax',
  region text NOT NULL DEFAULT 'India',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_api_keys (
  id serial PRIMARY KEY,
  name text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  last_used_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_notifications (
  id serial PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_communications (
  id serial PRIMARY KEY,
  comm_type text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  channel text NOT NULL,
  target text NOT NULL DEFAULT 'all',
  recipients integer NOT NULL DEFAULT 0,
  delivery_rate numeric(5,2),
  status text NOT NULL DEFAULT 'delivered',
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_penalties (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reason text NOT NULL,
  amount numeric(10,2) NOT NULL,
  deduct_from text NOT NULL DEFAULT 'wallet',
  notes text,
  applied_by text NOT NULL,
  status text NOT NULL DEFAULT 'applied',
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_tasks (
  id serial PRIMARY KEY,
  title text NOT NULL,
  task_type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  assigned_to text,
  due_date timestamptz,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_announcements (
  id serial PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  announcement_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  target_audience text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_exports (
  id serial PRIMARY KEY,
  module text NOT NULL,
  format text NOT NULL,
  requested_by text NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  size_mb numeric(10,2),
  status text NOT NULL DEFAULT 'completed',
  date_from timestamptz,
  date_to timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_agreements (
  id serial PRIMARY KEY,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  agreement_type text NOT NULL,
  signed_date timestamptz,
  expiry_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_crm_logs (
  id serial PRIMARY KEY,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  log_type text NOT NULL,
  notes text NOT NULL,
  outcome text,
  follow_up_date timestamptz,
  upsell_plan text,
  logged_by text NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT '0',
  currency text NOT NULL DEFAULT 'INR',
  features jsonb NOT NULL DEFAULT '[]',
  feature_toggles jsonb NOT NULL DEFAULT '{}',
  max_branches integer NOT NULL DEFAULT 1,
  max_items integer NOT NULL DEFAULT 50,
  max_staff integer NOT NULL DEFAULT 5,
  max_tables integer NOT NULL DEFAULT 20,
  max_orders_per_month integer,
  trial_days integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_roles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_ip_whitelist (
  id serial PRIMARY KEY,
  address text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_error_logs (
  id serial PRIMARY KEY,
  error_type text NOT NULL,
  message text NOT NULL,
  source text NOT NULL,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL,
  retry_count integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'error',
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Guest ↔ Restaurant integration tables (user panel + restaurant panel) ──

CREATE TABLE IF NOT EXISTS reservations (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  date text NOT NULL,
  time text NOT NULL,
  guest_count integer NOT NULL DEFAULT 2,
  table_id integer,
  zone text,
  reservation_type text NOT NULL DEFAULT 'table',
  deposit_amount numeric(10, 2) DEFAULT '0',
  deposit_status text NOT NULL DEFAULT 'none',
  booking_token text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  special_request text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_entries (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  token_number integer NOT NULL,
  guest_name text NOT NULL,
  guest_phone text,
  party_size integer NOT NULL DEFAULT 1,
  public_token text,
  notify_via text DEFAULT 'app',
  priority text DEFAULT 'normal',
  queue_type text DEFAULT 'dining',
  status text NOT NULL DEFAULT 'waiting',
  table_preference text,
  special_requests text,
  estimated_wait integer NOT NULL DEFAULT 15,
  notified_at timestamptz,
  seated_at timestamptz,
  called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spa_services (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'massage',
  description text,
  duration integer NOT NULL DEFAULT 60,
  price numeric(10, 2) NOT NULL DEFAULT '0',
  therapist text,
  is_bar boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spa_bookings (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  service_id integer REFERENCES spa_services(id),
  service_name text NOT NULL,
  guest_name text NOT NULL,
  guest_phone text,
  guest_email text,
  therapist text,
  scheduled_at timestamptz NOT NULL,
  duration integer NOT NULL DEFAULT 60,
  price numeric(10, 2) NOT NULL DEFAULT '0',
  status text NOT NULL DEFAULT 'booked',
  notes text,
  payment_status text NOT NULL DEFAULT 'pending',
  booking_type text NOT NULL DEFAULT 'single',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  number text NOT NULL,
  type text NOT NULL DEFAULT 'standard',
  floor integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'vacant',
  guest_name text,
  guest_phone text,
  check_in timestamptz,
  check_out timestamptz,
  notes text,
  room_controls jsonb NOT NULL DEFAULT '{"ac":{"on":true,"temp":22,"mode":"cool"},"lights":{"on":true,"brightness":70},"curtains":{"open":60},"tv":{"on":false,"channel":1,"volume":35},"dnd":false,"cleaningStatus":"clean"}',
  is_active text NOT NULL DEFAULT 'true',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_service_requests (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  guest_name text,
  guest_phone text,
  type text NOT NULL DEFAULT 'food',
  status text NOT NULL DEFAULT 'pending',
  items jsonb NOT NULL DEFAULT '[]',
  notes text,
  total numeric(10, 2) NOT NULL DEFAULT '0',
  payment_method text NOT NULL DEFAULT 'room_bill',
  assigned_to text,
  estimated_time integer NOT NULL DEFAULT 30,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications_log (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'push',
  title text NOT NULL,
  message text NOT NULL,
  recipient text,
  recipient_type text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'sent',
  metadata jsonb NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'license',
  description text,
  file_url text,
  file_type text,
  file_size integer,
  expiry_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  uploaded_by text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id serial PRIMARY KEY,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL,
  guest_user_id integer REFERENCES guest_users(id) ON DELETE SET NULL,
  guest_name text,
  guest_phone text,
  channel text NOT NULL DEFAULT 'chat',
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to text,
  sla_deadline timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'cleaning',
  title text NOT NULL,
  description text,
  location text NOT NULL,
  room_number text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  assigned_to text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_interval text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  reported_by text,
  assigned_to text,
  resolved_at timestamptz,
  estimated_cost text,
  actual_cost text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS banquet_events (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  event_type text NOT NULL DEFAULT 'wedding',
  event_date text,
  start_time text,
  end_time text,
  guest_count integer DEFAULT 0,
  venue text,
  contact_name text,
  contact_phone text,
  contact_email text,
  package_name text,
  total_amount numeric(12, 2) DEFAULT '0',
  deposit_amount numeric(12, 2) DEFAULT '0',
  status text NOT NULL DEFAULT 'inquiry',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS table_areas (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- orders columns used by user web + restaurant panel
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'pos';
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS nfc_tag_id text;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS qr_code_id integer;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS guest_count integer NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tip_amount numeric(10, 2) DEFAULT '0';
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) DEFAULT '0';
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

ALTER TABLE IF EXISTS tables_map ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- reservations columns for guest + restaurant panel
ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS reservation_type text NOT NULL DEFAULT 'table';
ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS deposit_amount numeric(10, 2) DEFAULT '0';
ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'none';
ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS booking_token text;
ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS special_request text;

-- customers / qr_codes columns used by dashboard + CRM
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS segment text NOT NULL DEFAULT 'new';
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS total_spend numeric(10, 2) NOT NULL DEFAULT '0';
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS last_visit timestamptz;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS birthday text;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS anniversary text;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}';
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS favorite_items jsonb DEFAULT '[]';
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS wallet_balance numeric(10, 2) DEFAULT '0';
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS qr_codes ADD COLUMN IF NOT EXISTS scans integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS qr_codes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- support_tickets columns for superadmin panel
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS guest_user_id integer REFERENCES guest_users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS guest_phone text;
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'chat';
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS sla_deadline timestamptz;
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE IF EXISTS support_tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── Legacy table schema migration (early VPS deploy used different columns) ──

DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'quantity'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'current_stock'
  ) THEN
    DROP TABLE IF EXISTS inventory_transactions CASCADE;
    DROP TABLE IF EXISTS inventory_items CASCADE;
  END IF;
END $migrate$;

CREATE TABLE IF NOT EXISTS inventory_items (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'raw_material',
  unit text NOT NULL DEFAULT 'kg',
  current_stock numeric(10, 3) NOT NULL DEFAULT '0',
  min_stock numeric(10, 3) NOT NULL DEFAULT '0',
  max_stock numeric(10, 3) NOT NULL DEFAULT '0',
  cost_per_unit numeric(10, 2) NOT NULL DEFAULT '0',
  supplier text,
  expiry_date timestamptz,
  batch_number text,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  item_id integer NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type text NOT NULL,
  quantity numeric(10, 3) NOT NULL,
  reason text,
  reference text,
  performed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_shifts' AND column_name = 'opening_float'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_shifts' AND column_name = 'staff_name'
  ) THEN
    DROP TABLE IF EXISTS cash_shifts CASCADE;
  END IF;
END $migrate$;

CREATE TABLE IF NOT EXISTS cash_shifts (
  id serial PRIMARY KEY,
  restaurant_id integer NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  staff_role text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_balance numeric(10, 2) NOT NULL DEFAULT '0',
  closing_balance numeric(10, 2),
  expected_balance numeric(10, 2),
  cash_sales numeric(10, 2) NOT NULL DEFAULT '0',
  cash_expenses numeric(10, 2) NOT NULL DEFAULT '0',
  denominations text,
  notes text,
  status text NOT NULL DEFAULT 'open',
  mismatch_alert boolean NOT NULL DEFAULT false
);

DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'support_tickets'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name = 'message'
  ) THEN
    DROP TABLE IF EXISTS support_messages CASCADE;
    DROP TABLE IF EXISTS support_tickets CASCADE;
  END IF;
END $migrate$;

CREATE TABLE IF NOT EXISTS support_tickets (
  id serial PRIMARY KEY,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL,
  guest_user_id integer REFERENCES guest_users(id) ON DELETE SET NULL,
  guest_name text,
  guest_phone text,
  channel text NOT NULL DEFAULT 'chat',
  subject text,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to text,
  sla_deadline timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- wallet_transactions: repair legacy tables missing guest_user_id (production VPS)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'guest_user_id'
  ) THEN
    IF (SELECT COUNT(*)::bigint FROM wallet_transactions) = 0 THEN
      DROP TABLE wallet_transactions;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id serial PRIMARY KEY,
  guest_user_id integer NOT NULL REFERENCES guest_users(id) ON DELETE CASCADE,
  restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL,
  type text NOT NULL,
  wallet_type text NOT NULL DEFAULT 'main',
  amount numeric(10, 2) NOT NULL,
  balance_after numeric(10, 2) NOT NULL,
  description text,
  reference_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS guest_user_id integer REFERENCES guest_users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS restaurant_id integer REFERENCES restaurants(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS wallet_type text NOT NULL DEFAULT 'main';
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS amount numeric(10, 2);
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS balance_after numeric(10, 2);
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS reference_id text;
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
