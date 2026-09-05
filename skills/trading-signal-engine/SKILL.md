---
name: trading-signal-engine
description: Use when analyzing crypto trading opportunities, evaluating technical indicators, assessing market structure, detecting momentum shifts, analyzing order flow patterns, backtesting strategies, or generating buy/sell signals. Activate whenever the user mentions price action, support/resistance, RSI, MACD, volume profile, market making, funding rates, open interest, or any trading-related analysis — even if they don't explicitly ask for "trading signals".
---

# Trading Signal Engine

> **Core Principle:** No signal without context. Every indicator is noise until combined with market structure and volume confirmation.

## Signal Generation Framework

### Layer 1: Market Structure

Before any indicator analysis, establish the macro context:

1. **Trend Identification**
   - Higher highs + higher lows = Uptrend
   - Lower highs + lower lows = Downtrend
   - Overlapping = Range / Consolidation
   - Use multiple timeframes: Weekly → Daily → 4H → 1H

2. **Key Levels**
   - Previous day/week/month high and low
   - Significant swing points with volume confirmation
   - Round numbers (psychological levels)
   - VWAP (Volume Weighted Average Price) as dynamic support/resistance

3. **Regime Detection**
   - Trending: Use momentum indicators (MACD, EMA crossovers)
   - Ranging: Use mean-reversion indicators (RSI extremes, Bollinger Bands)
   - Volatile: Widen stops, reduce size
   - Low volatility: Watch for breakouts, reduce false signal filters

### Layer 2: Technical Indicators

| Indicator | Signal | Confirmation Required |
|-----------|--------|----------------------|
| RSI < 30 | Oversold (potential long) | Must have bullish divergence or support level |
| RSI > 70 | Overbought (potential short) | Must have bearish divergence or resistance level |
| MACD cross up | Bullish momentum shift | Volume increase + above key level |
| MACD cross down | Bearish momentum shift | Volume increase + below key level |
| EMA 20/50 golden cross | Medium-term bullish | Weekly trend must be up |
| Bollinger Band squeeze | Volatility expansion coming | Wait for directional breakout |

### Layer 3: On-Chain Metrics (Crypto-Specific)

| Metric | Bullish | Bearish |
|--------|---------|---------|
| Funding rate | Negative (shorts paying longs) | Extremely positive (longs overleveraged) |
| Open interest | Rising with price = real demand | Rising against price = building squeeze |
| Exchange flows | Net outflow (accumulation) | Net inflow (distribution) |
| Whale transactions | Buying on dips | Selling into strength |
| Stablecoin supply | Increasing on exchanges | Decreasing on exchanges |

### Layer 4: Risk Management

Every signal must include:
- **Entry price** — Specific level, not a range
- **Stop loss** — Based on market structure, not arbitrary %
- **Take profit targets** — At least 2 levels (partial + full exit)
- **Position size** — Based on account risk % and stop distance
- **Risk:Reward ratio** — Minimum 1:2 for trend trades, 1:1.5 for scalps
- **Invalidation** — What makes this signal wrong?

## Output Format

```
Signal: LONG ETH/USDC
Timeframe: 4H
Confidence: 7/10

Entry: $3,245 (retest of broken resistance)
Stop: $3,180 (below swing low)
TP1: $3,380 (previous high) — close 50%
TP2: $3,520 (1.618 extension) — close remaining

Risk: 2% of account
R:R: 1:2.1 / 1:4.2

Thesis: Bullish market structure intact, RSI bouncing from 40
with volume confirmation. Funding negative = shorts crowded.

Invalidation: Close below $3,150 on 4H = trend broken.
```
