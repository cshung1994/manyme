# Core ABIs — Tokens and Vaults (ERC-20 / ERC-721 / ERC-1155 / ERC-4626)

Quick reference for on-chain analytics. All topic0 hashes are keccak256 of the canonical event signature (no spaces, no parameter names, no `indexed` keyword).

## Contents
- [ERC-20 Token Standard](#erc-20-token-standard)
- [ERC-721 Non-Fungible Token](#erc-721-non-fungible-token-standard)
- [ERC-1155 Multi Token](#erc-1155-multi-token-standard)
- [ERC-4626 Tokenized Vault](#erc-4626-tokenized-vault-standard)

---

## ERC-20 Token Standard

### Events

| Event | Signature | topic0 |
|-------|-----------|--------|
| Transfer | `Transfer(address,address,uint256)` | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |
| Approval | `Approval(address,address,uint256)` | `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925` |

**Transfer** full Solidity signature:
```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```
- `topics[0]` = topic0 hash
- `topics[1]` = `from` (left-padded to 32 bytes)
- `topics[2]` = `to` (left-padded to 32 bytes)
- `data` = `value` (uint256, 32 bytes)

**Approval** full Solidity signature:
```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```
- `topics[0]` = topic0 hash
- `topics[1]` = `owner`
- `topics[2]` = `spender`
- `data` = `value` (uint256, 32 bytes)

### Functions

| Function | Selector | Returns |
|----------|----------|---------|
| `totalSupply()` | `0x18160ddd` | `uint256` |
| `balanceOf(address)` | `0x70a08231` | `uint256` |
| `transfer(address,uint256)` | `0xa9059cbb` | `bool` |
| `approve(address,uint256)` | `0x095ea7b3` | `bool` |
| `allowance(address,address)` | `0xdd62ed3e` | `uint256` |
| `transferFrom(address,address,uint256)` | `0x23b872dd` | `bool` |

### Extensions (ERC-20 Metadata)

| Function | Selector | Returns |
|----------|----------|---------|
| `name()` | `0x06fdde03` | `string` |
| `symbol()` | `0x95d89b41` | `string` |
| `decimals()` | `0x313ce567` | `uint8` |

### Allowance Race Condition

The standard `approve` function is vulnerable to a race condition: if an owner changes an allowance from N to M, a spender can front-run and spend both N and M. Many tokens implement safer alternatives:

| Function | Selector |
|----------|----------|
| `increaseAllowance(address,uint256)` | `0x39509351` |
| `decreaseAllowance(address,uint256)` | `0xa457c2d7` |

These are NOT part of the ERC-20 standard but are widely adopted (OpenZeppelin). Use `increaseAllowance`/`decreaseAllowance` when available.

---

## ERC-721 Non-Fungible Token Standard

### Events

| Event | Signature | topic0 |
|-------|-----------|--------|
| Transfer | `Transfer(address,address,uint256)` | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |
| Approval | `Approval(address,address,uint256)` | `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925` |
| ApprovalForAll | `ApprovalForAll(address,address,bool)` | `0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31` |

**Transfer** full Solidity signature:
```solidity
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
```

**Approval** full Solidity signature:
```solidity
event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
```

**ApprovalForAll** full Solidity signature:
```solidity
event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
```

### Distinguishing ERC-20 vs ERC-721 Transfer Events

ERC-20 and ERC-721 `Transfer` events share the **same topic0** (`0xddf252...`). They are distinguished by topic count:

| Standard | topics[0] | topics[1] | topics[2] | topics[3] | data |
|----------|-----------|-----------|-----------|-----------|------|
| ERC-20 | topic0 hash | `from` | `to` | *(absent)* | `value` (uint256) |
| ERC-721 | topic0 hash | `from` | `to` | `tokenId` | *(empty)* |

**Rule:** If `topics[3]` exists, it is ERC-721. If `topics[3]` is absent and `data` contains a uint256, it is ERC-20. The same logic applies to `Approval` events.

---

## ERC-1155 Multi Token Standard

### Events

| Event | Signature | topic0 |
|-------|-----------|--------|
| TransferSingle | `TransferSingle(address,address,address,uint256,uint256)` | `0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62` |
| TransferBatch | `TransferBatch(address,address,address,uint256[],uint256[])` | `0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb` |
| URI | `URI(string,uint256)` | `0x6bb7ff708619ba0610cba295a58592e0451dee2622938c8755667688daf3529b` |
| ApprovalForAll | `ApprovalForAll(address,address,bool)` | `0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31` |

**TransferSingle** full Solidity signature:
```solidity
event TransferSingle(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256 id,
    uint256 value
);
```
- `topics[1]` = `operator` (msg.sender who initiated)
- `topics[2]` = `from`
- `topics[3]` = `to`
- `data` = abi.encode(id, value)

**TransferBatch** full Solidity signature:
```solidity
event TransferBatch(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256[] ids,
    uint256[] values
);
```
- `data` = abi.encode(ids, values) — ABI-encoded dynamic arrays

**URI** full Solidity signature:
```solidity
event URI(string value, uint256 indexed id);
```
- `topics[1]` = `id`
- `data` = ABI-encoded string

---

## ERC-4626 Tokenized Vault Standard

ERC-4626 is critical for DeFi protocol analytics. Every yield vault, lending market receipt token, and liquid staking wrapper increasingly adopts this interface.

### Events

| Event | Signature | topic0 |
|-------|-----------|--------|
| Deposit | `Deposit(address,address,uint256,uint256)` | `0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7` |
| Withdraw | `Withdraw(address,address,address,uint256,uint256)` | `0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db` |

**Deposit** full Solidity signature:
```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
```
- `sender` = address that provided the assets
- `owner` = address that received the vault shares
- `data` = abi.encode(assets, shares)

**Withdraw** full Solidity signature:
```solidity
event Withdraw(
    address indexed sender,
    address indexed receiver,
    address indexed owner,
    uint256 assets,
    uint256 shares
);
```
- `sender` = address that initiated the withdrawal
- `receiver` = address that received the assets
- `owner` = address whose shares were burned
- `data` = abi.encode(assets, shares)

### View Functions

| Function | Selector | Returns | Description |
|----------|----------|---------|-------------|
| `asset()` | `0x38d52e0f` | `address` | Underlying asset address |
| `totalAssets()` | `0x01e1d114` | `uint256` | Total assets managed by vault |
| `convertToShares(uint256 assets)` | `0xc6e6f592` | `uint256` | Assets to shares (no fees) |
| `convertToAssets(uint256 shares)` | `0x07a2d13a` | `uint256` | Shares to assets (no fees) |
| `previewDeposit(uint256 assets)` | `0xef8b30f7` | `uint256` | Shares received for deposit (with fees) |
| `previewMint(uint256 shares)` | `0xb3d7f6b9` | `uint256` | Assets needed to mint shares (with fees) |
| `previewWithdraw(uint256 assets)` | `0x0a28a477` | `uint256` | Shares burned to withdraw assets (with fees) |
| `previewRedeem(uint256 shares)` | `0x4cdad506` | `uint256` | Assets received for redeeming shares (with fees) |
| `maxDeposit(address receiver)` | `0x402d267d` | `uint256` | Max assets depositable |
| `maxMint(address receiver)` | `0xc63d75b6` | `uint256` | Max shares mintable |
| `maxWithdraw(address owner)` | `0xce96cb77` | `uint256` | Max assets withdrawable |
| `maxRedeem(address owner)` | `0xd905777e` | `uint256` | Max shares redeemable |

### Rounding Rules (Security-Critical)

ERC-4626 mandates rounding **against the user, in favor of the vault** to prevent rounding exploits:

| Operation | Converts | Rounds | Direction | Rationale |
|-----------|----------|--------|-----------|-----------|
| Deposit | assets -> shares | **DOWN** | User gets fewer shares | Vault retains fractional value |
| Mint | shares -> assets | **UP** | User pays more assets | Vault never undercollateralised |
| Withdraw | assets -> shares | **UP** | User burns more shares | Vault retains fractional value |
| Redeem | shares -> assets | **DOWN** | User gets fewer assets | Vault never undercollateralised |

### `convertTo*` vs `preview*` Distinction

| Function Family | Includes Fees/Slippage | Use Case |
|----------------|----------------------|----------|
| `convertToShares` / `convertToAssets` | **No** — ideal exchange rate only | Display, share price calculation, analytics dashboards |
| `previewDeposit` / `previewMint` / `previewWithdraw` / `previewRedeem` | **Yes** — reflects actual execution cost | Transaction planning, building calldata, MEV analysis |

The difference between `convertTo*` and the corresponding `preview*` function reveals the vault's fee structure and current slippage.

---
