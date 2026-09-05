# Reentrancy Analysis

## Detection Methodology

### Step 1: Identify External Calls

Scan for all external interactions:
- `.call{value:}("")` — Raw ETH transfers
- `.transfer()` / `.send()` — Legacy ETH transfers (2300 gas, generally safe)
- `IERC20.transfer()` / `.safeTransfer()` — Token transfers
- `IContract.someFunction()` — Any cross-contract call
- `Address.functionCall()` — OpenZeppelin low-level calls

### Step 2: Check State Update Order

For each external call found, verify the Checks-Effects-Interactions pattern:

```
✅ Correct (CEI):
  require(balance >= amount);     // Check
  balance -= amount;              // Effect
  token.transfer(to, amount);     // Interaction

❌ Vulnerable:
  require(balance >= amount);     // Check
  token.transfer(to, amount);     // Interaction BEFORE Effect
  balance -= amount;              // Effect (too late!)
```

### Step 3: Cross-Function Reentrancy

Check if any external call can re-enter a DIFFERENT function that reads the same state:

```
function withdraw() {
  uint bal = balances[msg.sender];
  (bool ok,) = msg.sender.call{value: bal}("");  // Attacker re-enters deposit()
  balances[msg.sender] = 0;
}

function deposit() {
  balances[msg.sender] += msg.value;  // Reads stale balances
}
```

### Step 4: Read-Only Reentrancy

Especially dangerous in protocols that expose `view` functions used by other protocols:

1. Protocol A calls external contract during state transition
2. External contract calls Protocol A's `getPrice()` view function
3. View function returns stale intermediate state
4. Protocol B uses this stale price for its own calculations

**Common in**: Curve pools, Balancer vaults, any protocol with callback hooks.

### Step 5: ERC-777 / ERC-1155 Hooks

These token standards have built-in callbacks:
- ERC-777: `tokensReceived()` hook on recipient
- ERC-1155: `onERC1155Received()` hook on recipient

Any contract that receives these tokens without reentrancy guards is potentially vulnerable.

## Mitigation Patterns

| Pattern | Implementation | Gas Cost |
|---------|---------------|----------|
| CEI Pattern | Restructure code order | Free |
| ReentrancyGuard | OpenZeppelin `nonReentrant` modifier | ~20k gas overhead |
| Pull Pattern | Users withdraw instead of protocol pushing | Design change |
