# Whale Tracking for NFTs

## Whale Identification

### Criteria for "Whale" Classification

| Tier | Holding Value | Behavior |
|------|--------------|----------|
| Mega Whale | > 1000 ETH in NFTs | Market mover, can single-handedly move floors |
| Large Whale | 100-1000 ETH | Significant influence, tracked by analytics platforms |
| Mid Whale | 20-100 ETH | Early signals, often smart money |
| Small Whale | 5-20 ETH | Noise unless clustered behavior observed |

### Identification Methods

1. **Known wallets** — Labeled addresses from Etherscan, Arkham, Nansen
2. **Volume-based** — Wallets with highest historical purchase volume
3. **Collection-specific** — Top holders per collection by count or value
4. **Behavioral** — Wallets that consistently buy before pumps (smart money)

## Tracking Signals

### Accumulation Signals (Bullish)

| Signal | Description | Strength |
|--------|-------------|----------|
| Floor sweep | Whale buys 10+ items at/near floor | Very strong |
| Cross-collection accumulation | Same whale enters 3+ related collections | Strong |
| Bid placement | Whale places bids 10-20% below floor | Moderate (positioning) |
| Long-term hold | Whale hasn't sold despite profit opportunity | Strong conviction signal |

### Distribution Signals (Bearish)

| Signal | Description | Strength |
|--------|-------------|----------|
| Listing spike | Whale lists >50% of holdings | Very strong sell signal |
| Gradual selling | Whale sells 1-2 per day over weeks | Stealth distribution |
| Transfer to exchange | NFTs moved to marketplace-linked wallet | Preparation to sell |
| Collection exit | Whale sells entire position | Strong bearish |

## Smart Money Scoring

Track whale wallets over time and score their historical performance:

```
Score = (Profitable trades / Total trades) × Avg profit multiplier
```

**Top-performing wallets** (score > 2.0) deserve higher signal weight.

**Alert triggers**:
1. Top-10 scored wallet enters a new collection → Research immediately
2. Multiple smart wallets enter same collection within 48h → High conviction signal
3. Smart wallet exits a collection you hold → Review your thesis
