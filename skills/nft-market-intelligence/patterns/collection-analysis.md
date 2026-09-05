# Collection Analysis

## Step-by-Step Methodology

### Step 1: Snapshot Current State

Gather baseline data:

| Metric | Source | How to Get |
|--------|--------|-----------|
| Floor price | Marketplace APIs | Current lowest listing |
| Total supply | Contract `totalSupply()` | On-chain read |
| Unique holders | Transfer event replay | Count distinct current owners |
| Listed count | Marketplace APIs | Active listings count |
| 24h / 7d / 30d volume | Marketplace APIs | Aggregated sales data |

### Step 2: Price History Analysis

Build a floor price time series:
1. Collect all sales events (Transfer events with non-zero value)
2. For each day/hour, find the minimum sale price = effective floor
3. Plot floor price, median sale, and average sale over time
4. Identify support levels (price bounced multiple times)
5. Identify resistance levels (price rejected multiple times)

**Floor price decay pattern**: If floor has made 3+ lower lows without recovery, collection is likely in decline.

### Step 3: Supply & Demand Dynamics

**Supply pressure indicators**:
- Listing rate = listed / total supply (>20% = bearish)
- New listings per day trend (increasing = bearish)
- Listing price distribution (clustered at floor = capitulation)

**Demand indicators**:
- Unique buyers per day (increasing = bullish)
- Sweep events (whale buying 5+ at floor = very bullish)
- Bid wall depth (strong bids = price support)
- Time to sell after listing (decreasing = improving demand)

### Step 4: Holder Distribution

```
Tier 1 (1 NFT):       ████████████████  62%
Tier 2 (2-5 NFTs):    ██████            22%
Tier 3 (6-20 NFTs):   ███               11%
Tier 4 (21-100 NFTs): █                  4%
Tier 5 (100+ NFTs):   ▏                  1% ← whale risk
```

**Healthy distribution**: Tier 1 > 50%, Tier 5 < 3%
**Concentrated/risky**: Tier 5 > 10% or single wallet > 5%

### Step 5: Comparative Analysis

Compare against category peers:
- Same category collections (PFP vs Art vs Gaming vs Utility)
- Floor price relative to 30d average
- Volume / market cap ratio (higher = more liquid)
- Social metrics (Twitter followers, Discord members per holder)

## Red Flags Checklist

- [ ] Floor price dropped >50% from ATH with no recovery
- [ ] Daily volume < 1% of market cap consistently
- [ ] Top wallet holds >10% of supply
- [ ] Team wallet actively selling
- [ ] Listing rate >30%
- [ ] No roadmap updates in 60+ days
- [ ] Discord/Twitter engagement declining
