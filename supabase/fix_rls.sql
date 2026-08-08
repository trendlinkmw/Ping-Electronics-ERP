-- ============================================================================
-- TrendLink RLS tightening patch — run once after the main schema.
-- Fixes: stock_movements / sale_items / purchase_items policies that
-- currently allow ANY authenticated user to write, not just the intended
-- roles. The insert triggers (apply_sale_stock, apply_purchase_stock) are
-- security definer, so they don't need broad table grants to function.
-- ============================================================================

drop policy if exists "write_stock_movements" on stock_movements;
create policy "write_stock_movements" on stock_movements for insert with check (
  has_role('storekeeper') or has_role('manager') or has_role('administrator')
);

drop policy if exists "write_sale_items" on sale_items;
create policy "write_sale_items" on sale_items for insert with check (
  has_role('salesperson') or has_role('cashier') or has_role('manager') or has_role('administrator')
);

drop policy if exists "write_purchase_items" on purchase_items;
create policy "write_purchase_items" on purchase_items for all using (
  has_role('storekeeper') or has_role('manager') or has_role('administrator')
) with check (
  has_role('storekeeper') or has_role('manager') or has_role('administrator')
);
