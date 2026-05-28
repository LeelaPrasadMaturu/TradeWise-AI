export interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface EmotionAnalysis {
  detected: 'positive' | 'negative' | 'neutral';
  confidence?: number;
  source?: string;
}

export interface PostTradeReview {
  mistake?: string;
  planFollowed?: boolean;
  movedStopLoss?: boolean;
  lesson?: string;
}

export interface EarlyExitData {
  exitedBeforeTarget?: boolean;
  exitedInProfit?: boolean;
  targetWasReachable?: boolean;
  percentToTarget?: number;
  exitReason?: 'fear' | 'impatience' | 'news' | 'time_constraint' | 'changed_view' | 'partial_profit' | 'other';
  priceAfterExit?: number;
  maxPriceAfterExit?: number;
  targetHitAfterExit?: boolean;
  missedProfitAmount?: number;
}

export interface StopLossMovement {
  fromPrice: number;
  toPrice: number;
  movedAt: string;
  direction: 'tightened' | 'widened' | 'breakeven';
  reason?: string;
}

export interface Trade {
  _id: string;
  user: string;
  symbol: string;
  assetType?: string;
  direction: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  // Stop-loss movement tracking
  originalStopLoss?: number;
  movedStopLoss?: boolean;
  movedStopLossDown?: boolean;
  stopLossMovementReason?: string;
  stopLossMovements?: StopLossMovement[];
  // Early exit tracking
  earlyExit?: EarlyExitData;
  positionValue?: number;
  tradeDate: string;
  entryTime?: string;
  exitTime?: string;
  reason?: string;
  exitReason?: string;
  tags: string[];
  result?: 'win' | 'loss' | 'breakeven' | 'open';
  profitLoss?: number;
  notes?: string;
  preTradeEmotion?: string;
  emotionAnalysis?: EmotionAnalysis;
  exitEmotionAnalysis?: EmotionAnalysis;
  postTradeReview?: PostTradeReview;
  postTradeAnalysis?: {
    summary: string;
    recommendations: string[];
    risksObserved: string[];
    generatedAt: string;
  };
  disciplineScore?: number;
  rulesViolated?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfitLoss: number;
  avgProfitLoss: number;
  avgWin: number;
  avgLoss: number;
  profitFactor?: number;
  byTag?: Record<string, {
    count: number;
    wins: number;
    winRate: number;
    totalPnL: number;
  }>;
}

export interface TradingRule {
  _id: string;
  user: string;
  name: string;
  description?: string;
  ruleType: string;
  action: 'warn' | 'block';
  params: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface DisciplineScore {
  overallScore: number;
  totalTrades: number;
  compliantTrades: number;
  period: string;
  byRule?: Array<{
    ruleName: string;
    ruleType: string;
    complianceRate: number;
    violations: number;
  }>;
  correlation?: {
    winRateWhenCompliant: number;
    winRateWhenViolating: number;
    insight: string;
  };
}

export interface BehavioralPattern {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message?: string;
  insight?: string;
  recommendation?: string;
  costEstimate?: {
    directCost: number;
    opportunityCost: number;
    totalEstimatedCost: number;
  };
  affectedTrades?: string[];
  [key: string]: unknown;
}

export interface BehavioralAnalysis {
  behavioralScore: number;
  tradingStyle: string;
  styleConfidence: number;
  tradeCount: number;
  patternsDetected: BehavioralPattern[];
  positivePatterns: Array<{
    type: string;
    message: string;
  }>;
  baseline: {
    tradingStyle: string;
    avgDailyTradeCount: number;
    baselineWinRate: number;
    avgPositionSize: number;
    avgHoldDurationMinutes: number;
    bestPerformingHours: number[];
    worstPerformingHours: number[];
  };
  recommendations: Array<{
    priority: string;
    category: string;
    recommendation: string;
    basedOn: string;
  }>;
}

export interface CoachingAlert {
  type: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  message: string;
  data?: Record<string, unknown>;
}

export interface PreMarketBriefing {
  generatedAt: string;
  greeting: string;
  yesterdaySummary: {
    tradeCount: number;
    wins: number;
    losses: number;
    winRate: number;
    pnl: number;
    pnlFormatted: string;
    message: string;
  };
  rulesViolated?: {
    count: number;
    rules: string[];
    message: string;
  };
  dayOfWeekWarning?: {
    dayName: string;
    winRate: number;
    warning: string;
  };
  bestHours?: {
    hours: Array<{ hour: number; winRate: number }>;
    message: string;
  };
  focusAreas: string[];
  tradingStyle: string;
  motivationalMessage: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  error?: string;
  status?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ChecklistItem {
  _id: string;
  question: string;
  required: boolean;
  action: 'warn' | 'block';
}

export interface UserTradingConfig {
  capital: number;
  capitalUpdatedAt?: string;
  checklistEnabled: boolean;
  blockOnFailure: boolean;
  requireEmotionalCheck: boolean;
  allowedEmotions: string[];
  blockedEmotions: string[];
  customChecklistItems: ChecklistItem[];
}

// Tax Report Types
export interface TradeSummary {
  _id: string;
  symbol: string;
  direction: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  charges: number;
  netPnl: number;
  result: string;
  exchange?: string;
  segment: string;
  instrumentType: string;
  optionType?: string;
  strikePrice?: number;
  gainType?: string;
}

export interface TaxCategory {
  trades: TradeSummary[];
  totalPnL: number;
  totalCharges: number;
  netPnL: number;
  tradeCount: number;
  wins?: number;
  losses?: number;
  turnover?: number;
}

export interface TaxReport {
  financialYear: string;
  generatedAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  equity: {
    stcg: TaxCategory;
    ltcg: TaxCategory;
  };
  fno: {
    futures: TaxCategory;
    options: TaxCategory;
    totalTurnover: number;
    totalNetPnL: number;
    totalCharges: number;
    tradeCount: number;
  };
  summary: {
    totalPnL: number;
    totalCharges: number;
    netPnL: number;
    totalTradeCount: number;
    equityTradeCount: number;
    fnoTradeCount: number;
  };
  byMonth: Record<string, { pnl: number; charges: number; trades: number }>;
  topSymbols: Array<{
    symbol: string;
    pnl: number;
    charges: number;
    trades: number;
    segment: string;
    instrumentType: string;
  }>;
}

// Flashback Warning Types
export interface FlashbackWarning {
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  detail?: string;
  data?: Record<string, unknown>;
  recentTrades?: Array<{
    date: string;
    pnl: number;
    reason?: string;
  }>;
}

// Game Plan Types
export interface GamePlanItem {
  reason?: string;
  type?: string;
  message: string;
  detail?: string;
  data?: Record<string, unknown>;
}

export interface GamePlan {
  avoid: GamePlanItem[];
  focus: GamePlanItem[];
  rules: Array<{
    type: string;
    message: string;
    rules?: string[];
  }>;
  warnings?: FlashbackWarning[];
}

// Edge Analysis Types
export interface EdgeStats {
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | string;
  expectancy: number;
  largestWin: number;
  largestLoss: number;
}

export interface HourStats extends EdgeStats {
  hour: number;
  label: string;
}

export interface DayStats extends EdgeStats {
  day: number;
  dayName: string;
}

export interface SymbolStats extends EdgeStats {
  symbol: string;
}

export interface SetupStats extends EdgeStats {
  setup: string;
}

export interface EmotionStats extends EdgeStats {
  emotion: string;
}

export interface EdgeAnalysis {
  periodDays: number;
  totalTrades: number;
  overall: EdgeStats;
  byHour: {
    all: HourStats[];
    best: HourStats[];
    worst: HourStats[];
    recommendation: string;
  };
  byDayOfWeek: {
    all: DayStats[];
    best: DayStats[];
    worst: DayStats[];
    recommendation: string;
  };
  bySymbol: {
    all: SymbolStats[];
    mostProfitable: SymbolStats[];
    leastProfitable: SymbolStats[];
    recommendation: string;
  };
  bySetup: {
    all: SetupStats[];
    bestSetups: SetupStats[];
    worstSetups: SetupStats[];
    untaggedStats: EdgeStats | null;
    recommendation: string;
  };
  byEmotion: {
    all: EmotionStats[];
    bestEmotions: EmotionStats[];
    worstEmotions: EmotionStats[];
    recommendation: string;
  };
  byDirection: {
    long: EdgeStats | null;
    short: EdgeStats | null;
    recommendation: string;
  };
  bySession: {
    all: Array<EdgeStats & { session: string; timeRange: string }>;
    best: EdgeStats & { session: string } | null;
    worst: EdgeStats & { session: string } | null;
    recommendation: string;
  };
  edgeSummary: {
    overallPnL: number;
    overallPnLFormatted: string;
    expectancy: number;
    profitFactor: number | string;
    winRate: number;
    strengths: string[];
    weaknesses: string[];
    primaryEdge: string;
    focusArea: string;
  };
}

// Time-in-Trade Alert Types
export interface TimeAlert {
  tradeId: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  entryTime: string;
  holdMinutes: number;
  avgHoldMinutes: number;
  exceedsByMinutes: number;
  exceedsByPercent: number;
  severity: 'warning' | 'high' | 'critical';
  unrealizedPnL: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  message: string;
}

export interface TimeAlertResponse {
  alerts: TimeAlert[];
  tradingStyle: string;
  avgHoldMinutes: number;
  alertThresholdMinutes: number;
  totalOpenTrades: number;
  overheldCount: number;
}

export interface HoldTimeAnalysis {
  periodDays: number;
  totalTrades: number;
  winners: {
    count: number;
    avgMinutes: number;
    medianMinutes: number;
    minMinutes: number;
    maxMinutes: number;
  } | null;
  losers: {
    count: number;
    avgMinutes: number;
    medianMinutes: number;
    minMinutes: number;
    maxMinutes: number;
  } | null;
  lossAversionRatio: number | null;
  lossAversionMessage: string;
  recommendation: string;
}

// Playbook Types
export interface SetupMatchCriteria {
  keywords: string[];
  symbols: string[];
  direction: 'long' | 'short' | 'both';
  validHours?: {
    start: number;
    end: number;
  };
  tags: string[];
}

export interface SetupRules {
  requireStopLoss?: boolean;
  requireTakeProfit?: boolean;
  minRiskReward?: number;
  maxPositionPercent?: number;
}

export interface SetupChecklist {
  question: string;
  required: boolean;
}

export interface PlaybookSetup {
  _id: string;
  name: string;
  description?: string;
  matchCriteria: SetupMatchCriteria;
  rules: SetupRules;
  checklist: SetupChecklist[];
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    breakeven: number;
    totalPnL: number;
    avgPnL: number;
    avgWin: number;
    avgLoss: number;
    winRate: number;
    profitFactor: number;
    lastUpdated: string;
  };
  enabled: boolean;
  color: string;
  icon: string;
  order: number;
}

export interface Playbook {
  _id: string;
  user: string;
  name: string;
  description?: string;
  setups: PlaybookSetup[];
  settings: {
    autoTagEnabled: boolean;
    requireSetupMatch: boolean;
    trackUnmatchedTrades: boolean;
  };
  unmatchedStats: {
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnL: number;
    winRate: number;
  };
}

export interface SetupComparison {
  setups: Array<{
    id: string;
    name: string;
    color: string;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnL: number;
    avgPnL: number;
    profitFactor: number;
  }>;
  summary: {
    totalSetups: number;
    profitableSetups: number;
    unprofitableSetups: number;
    totalTrades: number;
    totalPnL: number;
    bestSetup: { name: string; winRate: number } | null;
    worstSetup: { name: string; winRate: number } | null;
  };
  recommendation: string;
}

// Weekly Insights Types
export interface WeeklyInsightsStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  openTrades: number;
  totalProfitLoss: number;
  avgProfitLoss: number;
  bestTrade: number;
  worstTrade: number;
  winRate: number;
}

export interface WeeklyInsights {
  period: {
    startDate: string;
    endDate: string;
  };
  statistics: WeeklyInsightsStats;
  emotionAnalysis: Record<string, number>;
  tagAnalysis: Record<string, number>;
  behavioralAnalysis?: {
    behavioralScore: number;
    tradingStyle: string;
    styleConfidence: number;
    patternsDetected: BehavioralPattern[];
    positivePatterns: Array<{ type: string; message: string }>;
    recommendations: Array<{
      priority: string;
      category: string;
      recommendation: string;
      basedOn: string;
    }>;
    baseline?: BehavioralAnalysis['baseline'];
  };
  tradesAnalyzed: number;
  aiInsights: string;
  generatedAt: string;
}

// Indiscipline Analysis Types
export interface StopLossAnalysis {
  periodDays: number;
  summary: {
    totalTrades: number;
    tradesWithStopLoss: number;
    stopLossUsageRate: number;
    tradesMovedStopLoss: number;
    tradesMovedStopLossDown: number;
    percentMovedDown: number;
  };
  impact: {
    lossesFromMovedSL: number;
    totalExtraLoss: number;
    averageExtraLoss: number;
    potentialSavings: number;
  };
  winRateComparison: {
    normalWinRate: number;
    movedSLDownWinRate: number;
    difference: number;
    insight: string;
  };
  commonReasons: Array<{ reason: string; count: number }>;
  recentExamples: Array<{
    tradeId: string;
    symbol: string;
    date: string;
    result: string;
    profitLoss: number;
    extraRisk: number;
    reason: string;
    originalSL: number;
    finalSL: number;
    exitPrice: number;
  }>;
  recommendations: Array<{
    priority: string;
    type: string;
    message: string;
    action: string;
  }>;
}

export interface EarlyExitAnalysis {
  periodDays: number;
  summary: {
    totalTradesWithTarget: number;
    earlyExitCount: number;
    profitableEarlyExits: number;
    earlyExitRate: number;
    avgPercentToTarget: number;
  };
  impact: {
    totalMissedProfit: number;
    avgMissedPerTrade: number;
    potentialExtraProfit: number;
  };
  profitComparison: {
    fullTargetAvgProfit: number;
    earlyExitAvgProfit: number;
    difference: number;
    insight: string;
  };
  exitReasons: Array<{ reason: string; count: number; label: string }>;
  recentExamples: Array<{
    tradeId: string;
    symbol: string;
    date: string;
    actualProfit: number;
    potentialProfit: number;
    missedProfit: number;
    percentAchieved: number;
    exitReason: string;
    targetHitAfterExit: boolean;
  }>;
  recommendations: Array<{
    priority: string;
    type: string;
    message: string;
    action: string;
  }>;
}

export interface IndisciplineAnalysis {
  periodDays: number;
  stopLossMovements: StopLossAnalysis;
  earlyExits: EarlyExitAnalysis;
  combinedImpact: {
    totalIndisciplineCost: number;
    breakdownText: string;
    primaryIssue: string;
  };
  topRecommendations: Array<{
    priority: string;
    type: string;
    message: string;
    action: string;
  }>;
}
