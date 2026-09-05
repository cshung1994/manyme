# CLAMM Vault Analytics

**Minimum tier:** A (CORE) for current state and event-based analysis. B (ARCHIVE) for historical share-price time series via `eth_call` at past block numbers.

> This pattern covers concentrated liquidity automated market maker (CLAMM) vaults — protocols like Steer, Arrakis, Gamma, and Mellow that manage Uniswap V3 / Algebra positions on behalf of depositors. The analytical challenges differ significantly from raw V3 position analysis because vault rebalancing creates event patterns that are easily misinterpreted.

## Contents
- [Rebalance Transaction Decomposition](#rebalance-transaction-decomposition)
- [Principal vs Fee Separation](#principal-vs-fee-separation)
- [Share-Price Time Series](#share-price-time-series)
- [HODL Benchmark Construction](#hodl-benchmark-construction)
- [Concentrated IL vs V2 IL](#concentrated-il-vs-v2-il)
- [Loss-Versus-Rebalancing (LVR)](#loss-versus-rebalancing-lvr)
- [External Reward Integration](#external-reward-integration)
- [Vault Performance Attribution](#vault-performance-attribution)
- [Pitfall Pack](#pitfall-pack)

---

## Rebalance Transaction Decomposition

CLAMM vaults periodically rebalance their positions — removing liquidity from one tick range and adding it to another. A single rebalance transaction emits this event sequence on the underlying pool:

```
Burn(owner, tickLower, tickUpper, amount, amount0, amount1)
  → Collect(owner, recipient, tickLower, tickUpper, amount0, amount1)
    → Mint(sender, owner, newTickLower, newTickUpper, amount, amount0, amount1)
```

**The critical insight:** The `Collect` event during a rebalance contains BOTH principal recovery AND accumulated fees. If you count the full `Collect` amount as fee income, you will massively overstate performance. In a real investigation, this error turned $141 of actual fees into an apparent $1.84M of "fee income."

### Identifying Rebalances

A transaction is a rebalance (not a fee collection) when:
1. Same tx hash contains **both** `Burn` and `Mint` events for the same pool
2. The `owner` address in the pool events matches the vault contract
3. The new Mint position has different tick boundaries than the burned position

Standalone `Collect` events (no Burn/Mint in the same tx) are genuine fee harvests.

---

## Principal vs Fee Separation

The formula for separating real fees from principal recovery within a rebalance transaction:

```
real_fee_token0 = Collect_amount0 - Burn_amount0
real_fee_token1 = Collect_amount1 - Burn_amount1
```

**Per tx hash** — match the Burn and Collect events by their shared `(owner, tickLower, tickUpper)` tuple within the same transaction.

### Step-by-step

1. **Scan all Burn events** for the vault address across the analysis period
2. **For each Burn event**, find the corresponding Collect event in the same tx hash with matching `(owner, tickLower, tickUpper)`
3. **Compute the difference**: `Collect_amount - Burn_amount` for each token
4. **Sum the differences** across all rebalance transactions = total real fees earned
5. **Standalone Collects** (no matching Burn in same tx) are fee-only harvests — count the full amount

### Validation

Cross-check your fee calculation against the vault's fee accounting functions if available:
- Some vaults expose `accruedFees()` or similar view functions
- Compare your event-derived total against the vault's reported total
- Discrepancies indicate missed events or incorrect event matching

---

## Share-Price Time Series

The most reliable way to track vault performance over time:

```
share_price(t) = totalAmounts(t) / totalSupply(t)
```

Where:
- `totalAmounts()` returns the total value of both tokens held by the vault (active positions + idle balance), denominated in the vault's accounting units
- `totalSupply()` is the vault's ERC-20 share token supply

### Building the Time Series

1. **Choose sampling interval**: daily (86400 blocks / block_time) or per-rebalance-event
2. **For each sample point**, make two `eth_call` requests pinned to the sample block:
   - `totalAmounts()` or equivalent (varies by vault implementation — see Interface Recovery)
   - `totalSupply()`
3. **Compute share price** at each block
4. **Handle edge cases**:
   - `totalSupply() == 0` → vault is empty, skip this point
   - Share price drops sharply at a deposit event → this is dilution, not loss. Normalize by tracking share price per share, not total value.

### Why Share-Price > Individual LP Tracking

Tracking individual depositor PnL (deposit amount vs current value) introduces timing bias — each depositor entered at a different share price. Share-price time series captures the vault's aggregate performance independent of deposit/withdrawal timing, making it the standard metric for vault comparison.

---

## HODL Benchmark Construction

The HODL benchmark answers: "Would the depositor have been better off just holding the tokens instead of putting them in the vault?"

### Construction

1. **At entry block `t0`**: Record the vault's token composition
   - `(token0_amount, token1_amount) = totalAmounts(t0)`
   - `ratio = token0_amount / (token0_amount + token1_amount)` (in value terms)

2. **At evaluation block `t1`**: Price both tokens
   - Use the pool's `sqrtPriceX96` to compute the relative price
   - `hodl_value = token0_amount_at_t0 * price0_at_t1 + token1_amount_at_t1 * price1_at_t1`

3. **Compare**:
   - `vault_return = (share_price_t1 / share_price_t0) - 1`
   - `hodl_return = (hodl_value / initial_value) - 1`
   - `strategy_alpha = vault_return - hodl_return`

A negative alpha means the vault underperformed holding. This is common in trending markets due to IL and rebalancing losses.

---

## Concentrated IL vs V2 IL

The standard V2 impermanent loss formula assumes full-range liquidity:

```
IL_v2 = 2 * sqrt(r) / (1 + r) - 1    where r = new_price / old_price
```

**This formula does NOT apply to concentrated liquidity positions.** For CLAMM vaults operating in narrow tick ranges:

### Concentration Amplification

The concentration factor amplifies IL roughly proportional to how narrow the range is relative to full range:

```
amplification ≈ sqrt(P_upper / P_lower) / (sqrt(P_upper / P_lower) - 1)
```

For a typical CLAMM vault with ±5% range around current price, the amplification factor is ~10x. This means:
- V2 IL of -0.5% becomes concentrated IL of -5%
- V2 IL of -2% becomes concentrated IL of -20%

### Practical Implication

When analyzing vault performance, the V2 IL formula systematically understates the actual impermanent loss. Always use the concentrated IL formula or, better yet, compute IL directly from the share-price time series vs HODL benchmark, which captures the actual realized IL including all rebalancing effects.

---

## Loss-Versus-Rebalancing (LVR)

LVR is the cost of rebalancing concentrated positions in trending markets. It represents the adverse selection that occurs when a vault rebalances — buying the appreciating token at a higher price after the market has already moved.

### Mechanism

1. Market price moves from P to P' (trending)
2. Vault's position is now out of range or imbalanced
3. Vault rebalances: sells the token that has appreciated (at the new higher price) to buy the token that has depreciated, then re-enters a position at the new price
4. But the market continues trending → the vault buys high, sells low on the next rebalance

### Estimating LVR from On-Chain Data

LVR is difficult to compute exactly from events alone, but can be estimated:

1. **Sum all rebalance transactions** (identified by Burn + Mint in same tx)
2. **For each rebalance**: compare the effective execution price (implied by Burn/Mint amounts) against the oracle/pool price at the time
3. **Cumulative adverse selection** = sum of (execution_price - market_price) * amount across all rebalances

### Key Insight

LVR compounds over time and is proportional to:
- **Rebalancing frequency** — more rebalances = more LVR
- **Market volatility / trend strength** — trending markets punish rebalancers harder
- **Position concentration** — narrower ranges trigger more frequent rebalances

In strongly trending markets, LVR can dominate performance, making even fee-rich vaults unprofitable before external rewards.

*Reference: [Milionis et al., "Automated Market Making and Loss-Versus-Rebalancing"](https://arxiv.org/abs/2305.14604)*

---

## External Reward Integration

Many CLAMM vaults receive external incentives (Merkl, Angle, Steer rewards, protocol-native tokens) that are not visible in pool events. These rewards are **decision-critical** for performance analysis:

| Source | Data Access | Tier |
|--------|------------|------|
| Merkl (Angle Protocol) | Merkl API: `GET https://api.merkl.xyz/v3/rewards?chainId={id}&user={vault}` | D (off-chain API) |
| Protocol-native rewards | On-chain staking/farming contract events (`Claim`, `Harvest`) | A |
| Token emissions (gauge) | Gauge contract `reward_data()` or `earned(address)` | A |

### Performance With and Without Rewards

Always report both:
```
gross_return = share_price_change (on-chain only)
reward_return = external_rewards_value / initial_deposit_value
net_return = gross_return + reward_return
```

In practice, external rewards frequently flip the sign:
- Gross: -3.65% (IL + LVR exceed fee income)
- Rewards: +13.92% (Merkl KAT incentives)
- Net: +10.27%

Reporting only gross return would lead to a "sell" recommendation when the actual net position is strongly profitable. Flag this as a `⚠️ DECISION-CRITICAL GAP` if reward data is unavailable.

---

## Vault Performance Attribution

Complete performance attribution for a CLAMM vault over period [t0, t1]:

| Component | Calculation | Sign |
|-----------|-------------|------|
| Fee income | Σ(Collect - Burn) per rebalance tx + standalone Collects | + |
| Impermanent loss | share_price_return - hodl_return (approximation) | - |
| LVR | Cumulative rebalance adverse selection | - |
| External rewards | Merkl/farming claims valued at claim-time price | + |
| Gas costs | Σ gas_used * gas_price for all vault rebalance txs | - |
| **Net return** | Fee + IL + LVR + Rewards - Gas | ± |

### Annualization

For comparison across vaults with different time periods:
```
annualized_return = (1 + period_return) ^ (365 / days_in_period) - 1
```

Be careful with short periods — annualizing a 1-week return amplifies noise and produces misleading APYs.

---

## Pitfall Pack

- [ ] **Collect events decomposed into principal vs fees?** The #1 error in vault analysis. If you're counting Collect amounts as fee income without subtracting the corresponding Burn amounts, your fee calculation is wrong by orders of magnitude.
- [ ] **Using V2 IL formula for concentrated positions?** V2 IL formula (`2√r/(1+r) - 1`) only works for full-range. Concentrated positions amplify IL by 10-20x for typical ranges.
- [ ] **External rewards included in performance assessment?** Rewards can flip negative gross returns into strongly positive net returns. For any Due Diligence or Monitoring analysis, reward data is decision-critical.
- [ ] **Share-price calculated correctly during empty vault periods?** `totalSupply() == 0` means the vault has no depositors — skip these blocks to avoid division by zero or meaningless price points.
- [ ] **Multi-LP entry/exit timing bias in PnL?** Individual LP PnL depends on entry timing. Use share-price time series for vault-level performance; individual PnL only for specific depositor analysis.
- [ ] **TVL-weighted vs time-weighted returns distinguished?** These give different answers. Time-weighted (share price) measures strategy quality; TVL-weighted measures total economic impact. Report which you're using.
- [ ] **Function names verified on actual implementation?** `getTotalAmounts()` may have a different selector on your specific vault implementation. Always probe the actual contract (see Phase 1: Interface Recovery).
