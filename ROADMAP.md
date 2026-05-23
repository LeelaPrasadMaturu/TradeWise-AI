# TradeWise AI - Roadmap

## Currently Implemented ✅

- Trade logging with emotion detection (FinBERT)
- CSV import (Zerodha, generic brokers)
- Behavioral pattern detection (15 patterns)
- Discipline score & pre-trade checklist
- Post-trade AI analysis (Gemini)
- Weekly insights & email reports
- Personalized quizzes & flashcards
- **Real-Time Trading Coach** (proactive alerts + pre-market briefings)

---

## Phase 1: Make It Usable (Priority: Critical)

| Feature | Why It Matters |
|---------|----------------|
| **Web Dashboard** | API-only is unusable. Traders need UI to log trades and view insights |
| **Mobile App** | Traders trade on mobile. Instant logging captures real emotional state |
| **Zerodha API Integration** | Manual entry kills journals. Auto-import = 10x adoption |

---

## Phase 2: Visual & Analytics (Priority: High)

| Feature | Why It Matters |
|---------|----------------|
| **Trade Screenshots** | Charts show what numbers can't. Visual playbook of setups |
| **P&L Calendar** | Daily green/red view. Reveals day-of-week patterns instantly |
| **Performance Attribution** | "Where's my edge?" - by symbol, time, setup, emotional state |

---

## Phase 3: AI Coaching (Priority: Medium)

| Feature | Why It Matters |
|---------|----------------|
| **AI Coach Chatbot** | Ask "Why did I lose last week?" - personalized answers from YOUR data |
| **Playbook Builder** | Define setups, track win rates by setup type |
| **Adaptive Rule Suggestions** | AI detects patterns, suggests rules you should add |

---

## Phase 4: Professional Features (Priority: Low)

| Feature | Why It Matters |
|---------|----------------|
| **Tax Reporting** | ITR-ready P&L. Saves hours during tax season |
| **Multi-Broker Support** | Upstox, Groww, Angel One APIs |
| **Accountability Partners** | Share discipline scores. Social pressure improves compliance |

---

## Technical Priorities

- [ ] Redis caching for analytics queries
- [ ] Test coverage for discipline system
- [ ] Kubernetes deployment with auto-scaling
- [ ] Security hardening (2FA, encryption at rest)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Trades logged per user/week | > 15 |
| Rule compliance rate | +10% over 3 months |
| Win rate improvement | +5% over 6 months |
| Monthly churn | < 5% |

---

## The Moat

What makes TradeWise different:

1. **Pre-trade intervention** - Block bad trades before they happen
2. **Behavioral psychology** - Not just P&L, but WHY you lose
3. **Personalized AI** - Insights from YOUR mistakes, not generic advice

---

*Focus: Indian retail traders first, then global expansion.*
