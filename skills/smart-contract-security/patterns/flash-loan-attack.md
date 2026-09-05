# Flash Loan Attack Analysis

## Overview

Flash loans allow borrowing unlimited capital with zero collateral within a single transaction. This enables price manipulation attacks that were previously capital-prohibitive.

## Attack Pattern Taxonomy

### 1. Oracle Manipulation

**Mechanism**: Manipulate an on-chain price oracle within the flash loan transaction.

```
1. Flash borrow $100M USDC
2. Swap USDC → TOKEN on DEX (crashes TOKEN price on that DEX)
3. Protocol reads manipulated spot price from DEX
4. Attacker liquidates positions / borrows at wrong price
5. Reverse the swap
6. Repay flash loan + profit
```

**Vulnerable if**: Protocol uses `getReserves()` spot price instead of TWAP.

**Detection**: Check all price feeds — are they single-block readings?

### 2. Governance Manipulation

**Mechanism**: Flash borrow governance tokens to pass proposals.

```
1. Flash borrow governance tokens
2. Create and vote on malicious proposal
3. If snapshot is in same block, vote passes
4. Repay tokens
```

**Vulnerable if**: Voting power is checked at current block, not a past snapshot.

### 3. Reentrancy via Callback

**Mechanism**: Flash loan providers call back to borrower, enabling reentrancy.

```
1. Request flash loan
2. Lender sends tokens and calls borrower's callback
3. Inside callback, re-enter vulnerable protocol
4. Exploit state inconsistency
5. Repay flash loan
```

### 4. Liquidity Pool Manipulation

**Mechanism**: Temporarily drain pool liquidity to manipulate share prices.

```
1. Flash borrow LP tokens or underlying assets
2. Remove liquidity (manipulates pool ratios)
3. Interact with protocol that prices based on pool state
4. Re-add liquidity
5. Repay flash loan
```

## Detection Checklist

| Check | What to Look For |
|-------|-----------------|
| Price source | Spot price from single DEX = vulnerable |
| Time-weighting | No TWAP or too-short TWAP window |
| Callback safety | Any external callback without reentrancy guard |
| Governance snapshots | Voting power at current block vs past block |
| Share price calculation | Uses `balanceOf(this)` which can be manipulated |
| Composability assumptions | Protocol assumes it's the only user of a pool |

## Mitigation Patterns

1. **TWAP oracles** — Use time-weighted average prices (30 min+ window)
2. **Chainlink feeds** — Off-chain price feeds resistant to single-tx manipulation
3. **Snapshot-based governance** — Vote with balance at a past block
4. **Delayed actions** — Critical operations require multi-block confirmation
5. **Flash loan guards** — Detect and revert if called within a flash loan callback
