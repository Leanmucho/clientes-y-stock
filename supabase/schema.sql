-- ============================================================
-- SCHEMA COMPLETO - Clientes y Stock
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BORRAR TODO (orden inverso por foreign keys)
-- ============================================================
DROP TABLE IF EXISTS team_members    CASCADE;
DROP TABLE IF EXISTS expenses        CASCADE;
DROP TABLE IF EXISTS suppliers       CASCADE;
DROP TABLE IF EXISTS client_payments CASCADE;
DROP TABLE IF EXISTS installments    CASCADE;
DROP TABLE IF EXISTS sale_items      CASCADE;
DROP TABLE IF EXISTS sales           CASCADE;
DROP TABLE IF EXISTS products        CASCADE;
DROP TABLE IF EXISTS categories      CASCADE;
DROP TABLE IF EXISTS clients         CASCADE;
DROP FUNCTION IF EXISTS set_user_id()          CASCADE;
DROP FUNCTION IF EXISTS adjust_stock(INT, INT) CASCADE;

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE clients (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  dni         TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  address     TEXT DEFAULT '',
  reference   TEXT DEFAULT '',
  zone        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock       INT NOT NULL DEFAULT 0,
  min_stock   INT NOT NULL DEFAULT 0,
  image_url   TEXT DEFAULT '',
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales (
  id                    SERIAL PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id             INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_name          TEXT NOT NULL,
  total_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  advance_payment       NUMERIC(12,2) NOT NULL DEFAULT 0,
  installments_count    INT NOT NULL DEFAULT 1,
  installment_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_day           INT NOT NULL DEFAULT 1,
  installment_frequency TEXT NOT NULL DEFAULT 'monthly'
                          CHECK (installment_frequency IN ('weekly', 'biweekly', 'monthly')),
  start_date            DATE,
  delivery_date         DATE,
  notes                 TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id       INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    INT REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE installments (
  id                  SERIAL PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id             INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  installment_number  INT NOT NULL,
  due_date            DATE NOT NULL,
  expected_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_date           DATE,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','partial','paid','overdue')),
  notes               TEXT DEFAULT ''
);

CREATE TABLE client_payments (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  date        DATE NOT NULL,
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE suppliers (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_name  TEXT DEFAULT '',
  phone         TEXT DEFAULT '',
  email         TEXT DEFAULT '',
  address       TEXT DEFAULT '',
  category      TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expenses (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  date            DATE NOT NULL,
  supplier_id     INT REFERENCES suppliers(id) ON DELETE SET NULL,
  payment_method  TEXT DEFAULT 'Efectivo',
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  role             TEXT DEFAULT '',
  phone            TEXT DEFAULT '',
  commission_rate  NUMERIC(5,2) DEFAULT 0,
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDICES
-- ============================================================

CREATE INDEX idx_clients_user         ON clients(user_id);
CREATE INDEX idx_categories_user      ON categories(user_id);
CREATE INDEX idx_products_user        ON products(user_id);
CREATE INDEX idx_products_category    ON products(category_id);
CREATE INDEX idx_sales_user           ON sales(user_id);
CREATE INDEX idx_sales_client         ON sales(client_id);
CREATE INDEX idx_sale_items_sale      ON sale_items(sale_id);
CREATE INDEX idx_installments_sale    ON installments(sale_id);
CREATE INDEX idx_installments_due     ON installments(due_date);
CREATE INDEX idx_installments_user    ON installments(user_id);
CREATE INDEX idx_expenses_user        ON expenses(user_id);
CREATE INDEX idx_expenses_date        ON expenses(date);
CREATE INDEX idx_suppliers_user       ON suppliers(user_id);
CREATE INDEX idx_team_user            ON team_members(user_id);

-- ============================================================
-- TRIGGER: auto-set user_id en cada INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_uid_clients      BEFORE INSERT ON clients         FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_categories   BEFORE INSERT ON categories      FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_products     BEFORE INSERT ON products        FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_sales        BEFORE INSERT ON sales           FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_sale_items   BEFORE INSERT ON sale_items      FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_installments BEFORE INSERT ON installments    FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_payments     BEFORE INSERT ON client_payments FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_suppliers    BEFORE INSERT ON suppliers       FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_expenses     BEFORE INSERT ON expenses        FOR EACH ROW EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trg_uid_team         BEFORE INSERT ON team_members    FOR EACH ROW EXECUTE FUNCTION set_user_id();

-- ============================================================
-- FUNCION: adjust_stock
-- ============================================================

CREATE OR REPLACE FUNCTION adjust_stock(product_id INT, delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = stock + delta
  WHERE id = product_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members    ENABLE ROW LEVEL SECURITY;

ALTER TABLE clients         FORCE ROW LEVEL SECURITY;
ALTER TABLE categories      FORCE ROW LEVEL SECURITY;
ALTER TABLE products        FORCE ROW LEVEL SECURITY;
ALTER TABLE sales           FORCE ROW LEVEL SECURITY;
ALTER TABLE sale_items      FORCE ROW LEVEL SECURITY;
ALTER TABLE installments    FORCE ROW LEVEL SECURITY;
ALTER TABLE client_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE suppliers       FORCE ROW LEVEL SECURITY;
ALTER TABLE expenses        FORCE ROW LEVEL SECURITY;
ALTER TABLE team_members    FORCE ROW LEVEL SECURITY;

CREATE POLICY "own_clients"      ON clients         FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_categories"   ON categories      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_products"     ON products        FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_sales"        ON sales           FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_sale_items"   ON sale_items      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_installments" ON installments    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_payments"     ON client_payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_suppliers"    ON suppliers       FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_expenses"     ON expenses        FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_team"         ON team_members    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- VERIFICACION
-- ============================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
