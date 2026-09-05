# Momentum Analysis

## RSI (Relative Strength Index)

### Standard Interpretation
- **Overbought**: RSI > 70 — Price may pull back
- **Oversold**: RSI < 30 — Price may bounce
- **Neutral zone**: 40-60 — No actionable signal from RSI alone

### Advanced RSI Patterns

**Bullish Divergence** (High probability reversal):
- Price makes lower low
- RSI makes higher low
- Signal: Selling pressure exhausting, potential reversal up
- Confirmation: Wait for price to break above the last swing high

**Bearish Divergence**:
- Price makes higher high
- RSI makes lower high
- Signal: Buying pressure weakening, potential reversal down

**Hidden Divergence** (Trend continuation):
- Bullish hidden: Price higher low + RSI lower low = trend resumes up
- Bearish hidden: Price lower high + RSI higher high = trend resumes down

### RSI Failure Swings
More reliable than standard overbought/oversold:
1. RSI enters overbought/oversold zone
2. Pulls back out of the zone
3. Retests but FAILS to re-enter the zone
4. Breaks the intermediate RSI swing point = confirmed signal

## MACD (Moving Average Convergence Divergence)

### Components
- **MACD Line**: EMA(12) - EMA(26)
- **Signal Line**: EMA(9) of MACD line
- **Histogram**: MACD - Signal (visualizes momentum change)

### Signal Hierarchy (strongest to weakest)
1. **Zero-line crossover** — MACD crossing zero = trend change
2. **Signal line crossover** — MACD crossing signal = momentum shift
3. **Histogram reversal** — Histogram shrinking = momentum decelerating
4. **Divergence** — Same principles as RSI divergence

### Volume Confirmation
A momentum signal without volume is unreliable:
- Rising price + Rising volume = Strong trend
- Rising price + Falling volume = Weak trend (distribution?)
- Falling price + Rising volume = Strong selling
- Falling price + Falling volume = Weak selling (accumulation?)

## Funding Rate Analysis (Perps)

| Funding Rate | Market Condition | Signal |
|-------------|-----------------|--------|
| Very negative (< -0.01%) | Shorts crowded | Potential short squeeze → long bias |
| Slightly negative | Healthy bearish lean | Neutral |
| Neutral (0%) | Balanced market | No signal |
| Slightly positive | Healthy bullish lean | Neutral |
| Very positive (> 0.05%) | Longs overleveraged | Potential long squeeze → short bias |

**Key rule**: Extreme funding = contrarian signal. The crowd is usually wrong at extremes.
