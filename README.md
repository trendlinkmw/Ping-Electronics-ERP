# TrendLink ERP — Ping Electronics (v1 prototype)

A working ERP front end wired to your Supabase schema: auth, role-aware navigation,
dashboard KPIs, Products, Sales/POS, Customers, Suppliers, Purchases, and Expenses.

Stack: **React + Vite + Tailwind + Supabase JS**, deployable to **Netlify**, source on **GitHub**.

## 1. Database setup

In the Supabase SQL Editor, run in this order (each once, on a fresh project):

1. Your original schema file (already applied, per your message).
2. `supabase/fix_rls.sql` — tightens three policies that currently let *any*
   logged-in user write stock movements / sale items / purchase items,
   instead of just the intended roles.
3. `supabase/enhancements.sql` — optional, adds a supplier balance trigger
   that mirrors the customer balance trigger already in your schema.

## 2. Local setup

```bash
cd trendlink-erp
npm install
cp .env.example .env   # already pre-filled with your project URL + publishable key
npm run dev
```

Open the printed localhost URL. You'll land on `/login`.

**Create your first account** via "Create account" on the login screen, then in
Supabase go to **Table editor → profiles**, confirm your row exists, and run the
seed block at the bottom of your schema file (uncomment it, put in your email):

```sql
insert into user_roles (user_id, role_id)
select p.id, r.id from profiles p, roles r
where p.email = 'you@example.com' and r.name in ('administrator','ceo','accountant');
```

Sign out and back in — the sidebar will now show every module, since
`administrator` bypasses all role checks in the app.

## 3. What's actually wired up

- **Auth** — Supabase email/password, session persisted, profile + roles
  loaded on login (`src/context/AuthContext.jsx`).
- **Role-aware nav & routes** — `Sidebar.jsx` hides modules the user's roles
  don't cover; `ProtectedRoute.jsx` blocks direct navigation to them too.
- **Dashboard** — today's sales total, active product count, low-stock count,
  recent unpaid invoices — all live queries, no mock data.
- **Products** — add/edit, low-stock badge based on `min_stock`.
- **Sales/POS** — tap-to-add cart, checkout writes one `sales` row + N
  `sale_items` rows; your existing `apply_sale_stock` trigger handles the
  stock decrement and audit log automatically.
- **Purchases** — same pattern in reverse; `apply_purchase_stock` handles
  stock increment.
- **Customers / Suppliers** — list + add, balances shown live (driven by
  your existing `sync_customer_balance` trigger + the new supplier one).
- **Expenses** — categorized entry with month-to-date total.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "TrendLink ERP prototype"
git branch -M main
git remote add origin https://github.com/<you>/trendlink-erp.git
git push -u origin main
```

`.env` is gitignored — your keys won't be committed. That's fine either way
since the publishable key is meant to be public, but keep the habit for when
you eventually use a service_role key in a serverless function.

## 5. Deploy to Netlify

1. Netlify → **Add new site → Import an existing project** → pick the GitHub repo.
2. Build command: `npm run build` · Publish directory: `dist` (already set in `netlify.toml`).
3. **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Netlify rebuilds on every push to `main`.

## 6. What I'd extend first

Roughly in priority order:

1. **Payments module UI.** The `payments` table exists and the customer
   balance trigger reads from it conceptually, but there's no screen yet to
   record a customer paying down credit or you paying a supplier. This is
   the biggest functional gap — partial/credit sales currently have no way
   to get marked paid later.
2. **Receipts.** `sales`/`sale_items` capture everything needed; add a
   print-friendly receipt view (use `companies.receipt_header/footer`,
   already in your schema but unused by the UI).
3. **Stock movement adjustments UI.** The table and RLS policy exist for
   storekeepers to log damage/adjustments, but there's no form for it yet —
   right now the only way to change stock is via Sales, Purchases, or
   directly editing `quantity` on a product (which the UI warns about but
   doesn't prevent).
4. **Reports.** Sales-by-period, profit margins (`selling_price - buying_price`
   × quantity sold), top products — all computable from existing tables,
   just needs query + chart screens.
5. **Barcode scanning on POS.** `products.barcode` is already in the schema;
   wire a barcode input (works with any USB scanner acting as a keyboard) to
   auto-add to cart.
6. **Admin screen for role assignment.** Right now roles are assigned via
   raw SQL — an admin-only UI over `user_roles` would remove that friction
   for onboarding new staff.

## 7. Known limitations of this prototype

- No pagination — Products/Sales/Customers lists load everything at once.
  Fine for early use, will need `.range()` pagination once you have a few
  hundred+ rows.
- No offline/retry handling — a dropped connection mid-checkout will surface
  an error but won't queue the sale for retry.
- Discount is a flat amount on the whole sale, not per-line-item.
