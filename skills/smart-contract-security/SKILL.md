---
name: smart-contract-security
description: Use when auditing smart contracts for vulnerabilities, reviewing Solidity/Vyper code for security issues, checking access control patterns, analyzing upgrade mechanisms, evaluating reentrancy risks, inspecting token approval flows, or assessing protocol-level attack surfaces. Activate this skill whenever the user mentions audit, vulnerability, exploit, security review, access control, reentrancy, flash loan attack, or contract risk — even if they don't explicitly say "security audit".
---

# Smart Contract Security Auditor

> **Core Principle:** Assume every contract is vulnerable until proven otherwise. Systematic coverage beats intuition.

## Audit Methodology

Every audit follows a 4-phase process with mandatory checklists. No phase may be skipped.

### Phase 1: Reconnaissance

1. **Identify contract type** — Token, DEX, Lending, Vault, Governor, Proxy, Custom
2. **Map the attack surface** — External functions, state-changing calls, token flows, admin capabilities
3. **Determine upgrade pattern** — Immutable, UUPS, Transparent Proxy, Diamond, Beacon
4. **Catalog dependencies** — OpenZeppelin version, custom libraries, oracle integrations

### Phase 2: Static Analysis

Review code line-by-line against the vulnerability taxonomy:

| Category | Check | Severity if Found |
|----------|-------|-------------------|
| Reentrancy | External calls before state updates | Critical |
| Access Control | Missing modifiers on sensitive functions | Critical |
| Integer Overflow | Unchecked arithmetic (pre-0.8.0) | High |
| Flash Loan | Price manipulation via single-block | Critical |
| Oracle Manipulation | Spot price reliance without TWAP | High |
| Front-running | Transaction ordering dependence | Medium |
| Denial of Service | Unbounded loops, block gas limit | Medium |
| Centralization | Single admin key, no timelock | High |
| Token Approval | Unlimited allowance patterns | Medium |
| Rounding Errors | Division before multiplication | Medium |

### Phase 3: Dynamic Analysis

1. **Trace fund flows** — Map every path tokens can enter and exit
2. **Identify invariants** — What must always be true? (e.g., totalSupply == sum of balances)
3. **Test edge cases** — Zero amounts, max uint256, empty arrays, self-referencing
4. **Simulate attacks** — Flash loan, sandwich, governance takeover, oracle manipulation

### Phase 4: Report

For each finding:
- **Severity**: Critical / High / Medium / Low / Informational
- **Location**: Contract, function, line range
- **Description**: What the vulnerability is
- **Impact**: What an attacker could achieve
- **Proof of Concept**: Step-by-step exploitation
- **Recommendation**: Specific fix with code suggestion

## Severity Definitions

| Level | Impact | Likelihood |
|-------|--------|------------|
| Critical | Loss of funds, protocol takeover | Exploitable now |
| High | Significant fund risk or DoS | Requires specific conditions |
| Medium | Limited fund risk, degraded functionality | Edge case or requires insider |
| Low | Best practice violation, minor inefficiency | Unlikely exploitation |
| Info | Gas optimization, code style, documentation | No security impact |
