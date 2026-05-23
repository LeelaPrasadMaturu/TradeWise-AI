# TradeWise AI - Frontend Dashboard

A professional trading dashboard built with Next.js 14, shadcn/ui, and Tailwind CSS.

## Features

- **Dashboard**: Overview with stats, briefing, recent trades, and coaching alerts
- **Trade Management**: List, filter, search, and paginate trades
- **Trade Journal**: Quick trade entry with emotion tracking and checklist
- **P&L Calendar**: Visual heatmap of daily trading performance
- **Behavioral Analytics**: Score, pattern detection, and equity curve
- **Discipline Tracking**: Rules management and compliance monitoring
- **Settings**: Capital, checklist, and import configuration

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Components**: shadcn/ui + Radix primitives
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation
- **Auth**: JWT in cookies

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set your backend API URL:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser.

## Project Structure

```
frontend/
├── app/
│   ├── (auth)/           # Login & register pages
│   ├── (dashboard)/      # Protected dashboard pages
│   │   ├── analytics/
│   │   ├── calendar/
│   │   ├── discipline/
│   │   ├── journal/
│   │   ├── settings/
│   │   └── trades/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/               # shadcn components
│   ├── dashboard/        # Dashboard-specific components
│   ├── trades/           # Trade management components
│   ├── calendar/         # Calendar components
│   ├── analytics/        # Analytics components
│   └── discipline/       # Discipline components
├── lib/
│   ├── api.ts            # API client
│   ├── auth.ts           # Auth utilities
│   └── utils.ts          # Helper functions
├── hooks/                # Custom React hooks
└── types/                # TypeScript types
```

## Design System

The dashboard uses a dark trader theme:

- **Background**: Deep navy (#0f172a)
- **Cards**: Slate (#1e293b)
- **Accent**: Cyan/Teal (#0ea5e9)
- **Profit**: Green (#22c55e)
- **Loss**: Red (#ef4444)
- **Warning**: Amber (#f59e0b)

### Typography

- **UI**: Inter
- **Numbers**: JetBrains Mono (tabular-nums)

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Connecting to Backend

Ensure the TradeWise AI backend is running on port 3000. The frontend expects these API endpoints:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/trades` - List trades
- `POST /api/trades` - Create trade
- `GET /api/trades/stats` - Trade statistics
- `GET /api/behavioral/patterns` - Behavioral analysis
- `GET /api/discipline/score` - Discipline score
- `GET /api/rules` - Trading rules
- `GET /api/coach/briefing` - Daily briefing
- `GET /api/coach/alerts` - Coaching alerts
- `POST /api/import/csv` - CSV import

See the backend README for full API documentation.
