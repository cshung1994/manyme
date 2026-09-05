# Access Control Audit

## Methodology

### Step 1: Map All Privileged Functions

Enumerate every function with access restrictions:

| Modifier / Pattern | What to Check |
|-------------------|---------------|
| `onlyOwner` | Single point of failure — is owner an EOA or multisig? |
| `onlyRole(ROLE)` | Who holds this role? Can it be revoked? |
| `require(msg.sender == admin)` | Inline check — easy to miss in review |
| `initializer` | Can be called more than once? (UUPS proxy risk) |
| No modifier on state-changing function | **Missing access control** — Critical finding |

### Step 2: Ownership Analysis

1. **Who is the owner?** — Check `owner()` return value on-chain
2. **Is it a multisig?** — Check if address is a Gnosis Safe or similar
3. **Timelock?** — Are admin actions delayed? What's the delay period?
4. **Renounced?** — Has ownership been renounced? (`owner() == address(0)`)

### Step 3: Role Hierarchy

For AccessControl-based systems:
```
DEFAULT_ADMIN_ROLE
├── MINTER_ROLE
├── PAUSER_ROLE
├── UPGRADER_ROLE
└── OPERATOR_ROLE
```

Check:
- Can DEFAULT_ADMIN grant any role to themselves?
- Can roles be revoked?
- Is there a role that can drain funds?
- Are role assignments behind a timelock?

### Step 4: Proxy Admin Risks

| Proxy Type | Admin Can | Risk |
|-----------|-----------|------|
| Transparent | Upgrade implementation, change admin | Full protocol control |
| UUPS | Upgrade if authorized | Implementation must include upgrade logic |
| Beacon | Update all proxies at once | Single point of failure for all instances |

**Critical check**: Can the proxy admin upgrade to a malicious implementation that drains all funds?

### Step 5: Emergency Functions

| Function | Risk Level | Mitigation |
|----------|-----------|------------|
| `pause()` | Medium | Timelock + multisig |
| `setFeeRecipient()` | High | Timelock |
| `emergencyWithdraw()` | Critical | Multi-party approval |
| `upgradeToAndCall()` | Critical | Timelock + governance vote |
| `setOracle()` | Critical | Timelock + validation |

## Red Flags

- Single EOA as owner with no timelock
- `selfdestruct` capability in implementation
- Uninitialized proxy (anyone can call `initialize()`)
- Admin can set fees to 100%
- No event emissions on privileged actions
