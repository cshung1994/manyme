# Risk Management Framework

## Position Sizing

### Fixed Fractional Method

```
Position Size = (Account Balance × Risk %) / (Entry Price - Stop Loss Price)
```

**Example**:
- Account: $10,000
- Risk per trade: 2% = $200
- Entry: $3,245
- Stop: $3,180
- Distance: $65

Position size = $200 / $65 = **3.08 ETH**

### Kelly Criterion (Advanced)

```
Kelly % = (Win Rate × Avg Win / Avg Loss - Loss Rate) / (Avg Win / Avg Loss)
```

**Important**: Use Half-Kelly (Kelly/2) for crypto due to fat tails and estimation error.

## Stop Loss Strategies

| Strategy | Best For | Placement |
|----------|---------|-----------|
| Structural | Swing trades | Below last swing low (long) or above last swing high (short) |
| ATR-based | Trending markets | Entry ± 2×ATR(14) |
| Volatility | All markets | Outside Bollinger Band (2σ) of the entry timeframe |
| Time-based | Scalps | Exit if target not hit within N candles |

### Stop Loss Rules
1. **Never widen a stop** — If wrong, accept and move on
2. **Move to breakeven** after first take-profit hit
3. **Trail stops** in trending markets using EMA(20) or swing structure
4. **Account for spread/slippage** — Add 0.1-0.3% buffer to stop

## Portfolio Risk Rules

| Rule | Limit |
|------|-------|
| Max risk per trade | 1-2% of account |
| Max correlated exposure | 5% (e.g., all long ETH ecosystem tokens) |
| Max open positions | 3-5 for active trading |
| Max daily drawdown | 5% → stop trading for the day |
| Max weekly drawdown | 10% → reduce size by 50% |

## Risk:Reward Guidelines

| Trade Type | Min R:R | Why |
|-----------|---------|-----|
| Scalp (5m-1H) | 1:1.5 | High win rate needed, tight stops |
| Swing (4H-Daily) | 1:2 | Balanced approach |
| Position (Weekly+) | 1:3+ | Low frequency, must compensate |

**Rule**: Never take a trade below 1:1 R:R. If you can't find a setup with acceptable R:R, there is no trade.
