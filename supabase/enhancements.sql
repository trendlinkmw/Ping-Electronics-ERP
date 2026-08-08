-- ============================================================================
-- Optional enhancement: keep suppliers.outstanding_balance in sync the same
-- way customers.credit_balance already is. Run once, optional but recommended
-- before you start recording real purchases.
-- ============================================================================

create or replace function sync_supplier_balance()
returns trigger language plpgsql security definer as $$
begin
  if new.supplier_id is not null then
    update suppliers set outstanding_balance =
      (select coalesce(sum(total - amount_paid),0) from purchases where supplier_id = new.supplier_id and payment_status <> 'paid')
      where id = new.supplier_id;
  end if;
  return new;
end;
$$;

create trigger trg_purchase_supplier_balance
  after insert or update on purchases
  for each row execute function sync_supplier_balance();
