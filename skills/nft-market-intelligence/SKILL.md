---
name: nft-market-intelligence
description: Use when analyzing NFT collections, evaluating floor prices and volume trends, assessing rarity and trait distribution, detecting wash trading, monitoring whale wallets for NFT activity, evaluating mint mechanics and royalty structures, or researching NFT marketplace dynamics. Activate whenever the user mentions NFTs, floor price, rarity, minting, OpenSea, Blur, collection analysis, trait sniping, or any NFT-related market research.
---

# NFT Market Intelligence

> **Core Principle:** In NFT markets, liquidity is everything. A high floor price means nothing if no one is buying.

## Analysis Framework

### Collection Health Score

Rate every collection across 5 dimensions (each 1-10):

| Dimension | Weight | Key Metrics |
|-----------|--------|-------------|
| **Liquidity** | 30% | Daily volume, unique buyers/sellers ratio, listing rate |
| **Price Stability** | 25% | Floor price trend (7d/30d), volatility, support levels |
| **Community** | 20% | Holder distribution, diamond hand %, social sentiment |
| **Utility** | 15% | Roadmap delivery, staking rewards, token gating |
| **Team** | 10% | Doxxed status, track record, treasury management |

### Market Microstructure

1. **Floor Dynamics**
   - Floor price vs median sale price (gap = thin floor)
   - Listing wall depth (how many NFTs within 10% of floor?)
   - Time on market for floor listings
   - Sweep frequency (whale buying activity)

2. **Volume Analysis**
   - Organic volume vs wash trading (self-trades, circular flows)
   - Buyer/seller concentration (top 10 wallets %)
   - Cross-marketplace volume split (Blur vs OpenSea vs others)
   - Volume trend: increasing, stable, declining

3. **Holder Analysis**
   - Unique holders / total supply = distribution
   - Top 10 holder concentration %
   - Diamond hands (held > 90 days) %
   - Paper hands (sold within 7 days of purchase) %

### Wash Trading Detection

Red flags for artificial volume:
- Same wallet buys and sells within short timeframes
- Circular trading between a small cluster of wallets
- Volume spikes without corresponding unique buyer increase
- Sales consistently at or near listing price (no negotiation)
- Abnormally high royalty-free marketplace usage

### Rarity Analysis

1. **Trait rarity**: % of collection with each trait
2. **Statistical rarity score**: Product of inverse trait frequencies
3. **Trait floor premium**: Floor price for specific traits vs collection floor
4. **Rarity correlation with price**: Do rare items actually sell higher?

## Output Format

```
Collection: [Name]
Health Score: 7.2/10
Verdict: [Strong Hold / Accumulate / Watch / Avoid]

Floor: Ξ0.45 (↑12% 7d)
Volume: Ξ23 daily (↓8% vs 30d avg)
Holders: 4,521 unique (67% diamond hands)
Wash Trade Risk: Low (8% estimated wash volume)

Strengths:
- Strong holder conviction (low listing rate 4%)
- Active development (3 roadmap milestones delivered)

Risks:
- Top 5 wallets hold 18% of supply
- Volume declining — may indicate distribution phase

Recommendation: Hold existing positions. Set alerts at Ξ0.38
(support) and Ξ0.52 (resistance). Not a good entry at current floor.
```
