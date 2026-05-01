# Financial Tracker — Project Context

> Living document. Update this file whenever significant work is done, new features are added, or decisions are made.  
> Last updated: 2026-05-01 (session 2)

---

## Project Identity

| Field | Value |
|-------|-------|
| **Project Name** | financial-tracker (package: `velzon-ts`) |
| **Version** | 4.3.0 |
| **Owner** | Murtaza (ktradeproduct@gmail.com) |
| **Platform** | Web (desktop-first, responsive) |
| **Type** | Personal Finance Dashboard — Pakistani market focus |
| **Status** | Pre-launch |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18.3.1 + TypeScript 5.3.3 |
| Build Tool | Create React App (react-scripts 5.0.1) |
| Routing | React Router DOM v6 |
| State Management | Redux Toolkit 2.2.8 + react-redux 9.1.2 |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| Secondary Backend | Firebase 10.14.1 (configured, currently commented out) |
| HTTP Client | Axios 1.7.7 with custom APIClient + interceptors |
| UI Library | Reactstrap 9.2.3 (Bootstrap 5.3.3 wrapper) |
| Forms | Formik 2.4.6 + Yup 1.4.0 |
| Charts | ApexCharts 3.54.0, Chart.js 4.4.4, ECharts 5.5.1 |
| Calendar | FullCalendar v6 |
| Tables | TanStack React Table 8.10.7, Grid.js 6.2.0 |
| Date / Time | Moment.js 2.30.1, react-flatpickr 3.10.13 |
| Drag & Drop | @hello-pangea/dnd 17.0.0 |
| Styling | SCSS / Sass + Bootstrap CSS |
| i18n | i18next 23.15.2 (8 languages) |
| Notifications | react-toastify 10.0.5 |
| Node memory | Build runs with `--max-old-space-size=4096` |

---

## Supabase Configuration

- **Project URL:** https://pcwxttlxwfdofeetddmt.supabase.co
- **Client:** `src/lib/supabase.ts`
- **Auth:** Email/password via `src/context/AuthContext.tsx`
- **Tables:** `accounts`, `transactions`, `loans`, `loan_repayments`, `budget_rules`, `bills`, `split_people`, `custom_categories`

---

## Repository Structure

```
financial-tracker/
├── public/                    # Static HTML entry point
├── src/
│   ├── App.tsx                # Root component
│   ├── index.tsx              # Entry point
│   ├── config.ts              # App config
│   ├── i18n.ts                # i18n setup
│   ├── pages/                 # 51 page dirs, 444 TSX files
│   │   ├── Accounts/          # Bank accounts, credit cards, wallets
│   │   ├── Transactions/      # All financial transactions
│   │   ├── CreditCards/       # Credit card bill tracking
│   │   ├── Splits/            # Split expense management
│   │   ├── Loans/             # Loans given and taken
│   │   ├── EMIs/              # EMI tracker
│   │   ├── Goals/             # Savings goals
│   │   ├── Budget/            # Monthly budget rules
│   │   ├── Forecast/          # Financial forecasting
│   │   ├── Recurring/         # Recurring transactions
│   │   ├── FinancialCalendar/ # Calendar view of events
│   │   ├── Settings/          # Categories.tsx
│   │   ├── Authentication/    # Login, Register, ForgotPassword, ResetPassword, Profile
│   │   └── Dashboard*/        # DashboardEcommerce (main) + demo dashboards
│   ├── Components/Common/     # 26 reusable components
│   ├── Layouts/               # Header, Sidebar, Footer, LayoutMenuData
│   ├── Routes/                # allRoutes.tsx (53 routes), index.tsx
│   ├── slices/                # 24 Redux slices (auth, layouts, feature slices)
│   ├── context/               # AuthContext.tsx (Supabase auth)
│   ├── hooks/                 # useCategories.ts
│   ├── lib/                   # supabase.ts, currency.ts
│   ├── helpers/               # api_helper, firebase_helper, url_helper, fakebackend
│   ├── locales/               # en, gr, it, ru, sp, ch, fr, ar JSON files
│   └── assets/                # SCSS, images, fonts
├── .env                       # Supabase URL + anon key
├── .env.production            # DISABLE_ESLINT_PLUGIN, no source maps
├── tsconfig.json              # Target ES5, baseUrl: ./src, strict: true
├── package.json               # Scripts, dependencies
└── CONTEXT.md                 # This file
```

---

## Feature Map

### Core Finance Features (Custom-Built)

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | DashboardEcommerce | Full overview — net worth, budget bars, loans, goals, EMIs, splits, bills, recent tx |
| `/accounts` | Accounts | Bank accounts, credit cards, cash wallets |
| `/transactions` | Transactions | Income / expense / transfer / EMI / loan with splits & recurring |
| `/credit-cards` | CreditCards | Credit card bill tracking, due dates |
| `/splits` | Splits | Split expense management with people tracking |
| `/loans-given` | Loans | Money lent to others, repayment tracking |
| `/loans-taken` | Loans | Money borrowed, repayment tracking |
| `/emis` | EMIs | Equated Monthly Instalments tracker |
| `/goals` | Goals | Financial goals and savings targets |
| `/budget` | Budget | Monthly budget rules and spend limits |
| `/forecast` | Forecast | Financial projections |
| `/recurring` | Recurring | Recurring transaction automation |
| `/financial-calendar` | FinancialCalendar | Calendar view of all financial events |
| `/settings/categories` | Settings/Categories | Custom transaction categories |
| `/profile` | Authentication/user-profile | User profile management |

### Auth Routes (Public)

| Route | Description |
|-------|-------------|
| `/login` | Main login |
| `/register` | User registration |
| `/forgot-password` | Password recovery |
| `/reset-password` | Password reset (token-based via Supabase) |
| `/logout` | Session termination |

---

## Data Models

### accounts
```ts
{
  id: string
  user_id: string
  name: string
  bank_name: string
  type: 'bank_savings' | 'bank_current' | 'credit_card' | 'cash' | 'custom_wallet'
  balance: number
  credit_limit?: number     // credit cards only
  billing_date?: number     // credit cards only
  due_date?: number         // credit cards only
  last_four?: string        // card last 4 digits
  is_archived: boolean
  created_at: timestamp
}
```

### transactions
```ts
{
  id: string
  user_id: string
  account_id: string
  to_account_id?: string    // transfers only
  date: date
  amount: number
  type: 'expense' | 'income' | 'transfer' | 'atm_withdrawal' |
        'reimbursement_received' | 'loan_given' | 'loan_received' |
        'emi_payment' | 'goal_contribution'
  category: string
  note: string
  created_at: timestamp
}
```

### loans
```ts
{
  id: string
  user_id: string
  direction: 'given' | 'taken'
  person_name: string
  principal: number
  date: date
  due_date?: date
  account_id: string
  outstanding: number
  status: 'active' | 'closed'
  notes?: string
}
```

### loan_repayments
```ts
{ id, loan_id, amount, date, transaction_id? }
```

### budget_rules
```ts
{ id, user_id, category, monthly_limit, month }  // month: 'YYYY-MM'
```

### bills (Credit Card)
```ts
{
  id, user_id, account_id,
  due_date: date
  status: 'pending' | 'paid'
  statement_amount: number
  total_paid: number
  month: string
}
```

### split_people
```ts
{ id, user_id, name }
```

### custom_categories
```ts
{ id, user_id, name }
```

### Default Categories (19)
Grocery, Restaurant & Food, Fuel, Utility Bills, Mobile & Internet, Medical, Transport, Shopping, Education, Rent, Salary, Freelance Income, Business Income, Reimbursement, Family, Entertainment, Travel, Office Expense, Other

---

## Authentication

- **Provider:** Supabase Auth (email + password)
- **Context:** `src/context/AuthContext.tsx`
- **Methods:** `signIn`, `signUp`, `signOut`, `resetPassword`
- **Session:** Retrieved via `supabase.auth.getSession()` on load; `onAuthStateChange` listener keeps it live
- **Route protection:** `Routes/AuthProtected` wraps all private routes; unauthenticated users are redirected to `/login`
- **Password reset:** Email with link to `${window.location.origin}/reset-password`

---

## Sidebar / Navigation

File: `src/Layouts/LayoutMenuData.tsx`

**Current Menu Structure:**
- **Dashboard** — `/dashboard`
- **Accounts & Cards** — `/accounts`
- **Transactions** — `/transactions`
- *(header)* **Track**
- **Credit Card Bills** — `/credit-cards`
- **Splits & Recoveries** — `/splits`
- **Loans** — `/loans-given` + `/loans-taken`
- **EMI Tracker** — `/emis`
- *(header)* **Plan**
- **Goals** — `/goals`
- **Budget** — `/budget`
- **Forecast** — `/forecast`
- *(header)* **More**
- **Recurring** — `/recurring`
- **Financial Calendar** — `/financial-calendar`
- **Custom Categories** — `/settings/categories`

> **Note (2026-05-01):** "Notifications" menu item and "Settings" header were removed from LayoutMenuData.tsx (uncommitted change). The `/notification-settings` route is no longer in the sidebar.

---

## Internationalization

- **Supported Languages:** English, Greek, Italian, Russian, Spanish, Chinese, French, Arabic
- **Storage:** `I18N_LANGUAGE` in localStorage
- **Fallback:** English
- **Switcher component:** `src/Components/Common/LanguageDropdown.tsx`

---

## Theming

- Light / Dark mode toggled via Redux layout slice
- Layout variants: Vertical (default), Horizontal, Two-Column
- Sidebar variants configurable
- Theme state persisted via Redux

---

## Pakistani Bank Support

- **Status:** 14 Pakistani bank accounts pre-configured in the accounts dropdown
- **Commit:** `ab57e2d35` — "Pakistani banks dropdown, 14 accounts ready, pre-launch"

---

## Known Issues / Decisions

| Date | Item | Status |
|------|------|--------|
| 2026-05-01 | Notifications menu item + Settings header removed from sidebar | ✅ Committed (`2451f29`) |
| — | Firebase configured but commented out | Intentional — Supabase is primary |
| — | ~40 Velzon template page dirs in `src/pages/` (CRM, Crypto, Ecommerce, etc.) — none routed | Pending cleanup — see Backlog |
| — | 14 `/auth-*` template routes registered in `allRoutes.tsx` but not used in real flow | Pending cleanup |

---

## Work Log

### 2026-05-01 — Session 2
- **Transaction delete with reversal** (`72c896f`) — Trash icon on every row; confirms via modal; reverses account balances, cleans linked `loan_repayments` (restores outstanding), `outing_participants` + `outings` (split links), then deletes the transaction
- **Dashboard full redesign** (`df604b4`) — 5-row layout: position stats, this-month stats (with savings rate), budget progress bars + loans, goals + EMIs + splits-to-recover, bills + accounts + recent transactions. All 9 data sources fetched in parallel. Fixed month-stats accuracy (was capped at 10 transactions).
- **CONTEXT.md updated** this session

### 2026-05-01 — Session 1
- Full project audit performed; CONTEXT.md created
- Removed "Notifications" and "Settings" header from `LayoutMenuData.tsx`
- Updated caniuse-lite browserslist (`3dc8712`)
- All committed in `2451f29`

### Commit History (chronological)
| Hash | Description |
|------|-------------|
| `8f31da67d` | Version 1 complete — auth, accounts, transactions |
| `4aad58c67` | Version 1 complete — auth, accounts, transactions |
| `4a9dbc37b` | Remove node_modules, add proper .gitignore |
| `33c0fbf3f` | Remove node_modules, add proper .gitignore |
| `16647bfcb` | Fix build memory and babel dependency |
| `1d678a547` | Disable CI strict mode for build |
| `f59c3b5eb` | Fix LayoutMenuData useEffect |
| `a68d92914` | Version 4 — Splits, Outings, Loans |
| `1db56988c` | Version 5 — EMI Tracker and Savings Goals |
| `28b782eed` | Version 7 — Budget and Forecast |
| `aa01c1c72` | Version 8 — Custom categories, recurring transactions |
| `68ab84b1a` | Fix credit card bill auto-creation bug |
| `aaf0b0319` | Profile, forgot password, reset password, branding polish |
| `a47de3995` | Financial Calendar, login page polish, branding |
| `ab57e2d35` | Pakistani banks dropdown, 14 accounts ready, pre-launch |

---

## Next Steps / Backlog

> Add items here as they come up during development.

- [ ] **Remove Velzon template page directories** — ~40 dirs in `src/pages/` that are not routed. Removing them will shrink the build significantly and may remove the need for `--max-old-space-size=4096`. Dirs to delete listed in the "Template Cleanup" section below.
- [ ] **Remove template auth routes** from `allRoutes.tsx` — 14 `/auth-*` basic/cover routes not used in the real flow (real flow uses `/login`, `/register`, `/forgot-password`, `/reset-password`, `/logout`)
- [ ] Push to production / finalize launch

---

## Template Cleanup (Pending)

### `src/pages/` directories to delete (none are in `allRoutes.tsx`)

**Unused dashboards:**
`DashboardAnalytics`, `DashboardBlog`, `DashboardCrm`, `DashboardCrypto`, `DashboardJob`, `DashboardNFT`, `DashboardProject`

**Unused feature pages:**
`BaseUi`, `AdvanceUi`, `Forms`, `Tables`, `Charts`, `Calendar`, `Chat`, `Crm`, `Crypto`, `Ecommerce`, `Invoices`, `Jobs`, `Projects`, `Tasks`, `ToDo`, `Maps`, `Icons`, `Widgets`, `Pages`, `Email`, `EmailInbox`, `FileManager`, `NFTMarketplace`, `SupportTickets`

**Unused auth variants** (real auth uses `Authentication/`, not these):
`AuthenticationInner/` — contains Basic/Cover login, signup, lockscreen, 2FA, etc.

### `allRoutes.tsx` routes to remove

All `/auth-*` routes (lines 87–107) — these load `AuthenticationInner` pages that are not part of the real user flow. The real routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/logout`) stay.

Optionally keep: `/pages-maintenance`, `/pages-coming-soon`, `/auth-404-alt`, `/auth-500` (useful for error handling).

---

*Update this file after every session with what changed and what's pending.*
