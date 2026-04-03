-- ── Surrogate Insurance ─────────────────────────────────
create table if not exists surrogate_insurance (
  id bigint generated always as identity primary key,
  case_id bigint not null,
  case_type text not null default 'surrogate',
  has_insurance boolean not null default false,
  company text,
  website text,
  portal_login text,
  portal_password text,
  premium_amount numeric(10,2),
  enrolled_autopay boolean not null default false,
  premium_due_day integer, -- day of month (1-31)
  autopay_day integer, -- day of month if enrolled
  status text not null default 'active', -- active, cancelled
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table surrogate_insurance enable row level security;
create policy "surrogate_insurance_all" on surrogate_insurance for all using (true);

-- ── Insurance Payment Log ───────────────────────────────
create table if not exists insurance_payments (
  id bigint generated always as identity primary key,
  insurance_id bigint references surrogate_insurance(id) on delete cascade not null,
  paid_date date not null,
  month_for text not null, -- e.g. '2026-04'
  payment_method text not null, -- portal, website, phone_call, mailed_check
  payment_info text, -- last 4 of CC or check number
  notes text,
  logged_by text,
  created_at timestamptz not null default now()
);

alter table insurance_payments enable row level security;
create policy "insurance_payments_all" on insurance_payments for all using (true);
