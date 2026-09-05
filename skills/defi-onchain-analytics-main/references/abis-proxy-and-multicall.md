# Infrastructure ABIs — Proxy Storage Slots and Multicall3

Quick reference for proxy resolution and batched read execution via standard slots and multicall patterns.

## Contents
- [EIP-1967 Proxy Storage Slots](#eip-1967-proxy-storage-slots)
- [Multicall3](#multicall3)

---

## EIP-1967 Proxy Storage Slots

Standard storage slots for transparent/UUPS proxies. Read these via `eth_getStorageAt` to find implementation addresses behind proxies.

| Slot | Value | Derivation |
|------|-------|------------|
| Implementation | `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` | `keccak256("eip1967.proxy.implementation") - 1` |
| Beacon | `0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50` | `keccak256("eip1967.proxy.beacon") - 1` |
| Admin | `0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103` | `keccak256("eip1967.proxy.admin") - 1` |

### Usage

```javascript
// Read implementation address behind a proxy
const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const implAddress = await provider.getStorageAt(proxyAddress, implSlot);
// Result is 32 bytes, address is in the last 20 bytes:
// 0x000000000000000000000000{20-byte-address}
```

### Common Proxy Patterns

- **Transparent Proxy (OpenZeppelin):** Admin calls go to proxy logic; all other calls delegatecall to implementation.
- **UUPS (ERC-1822):** Upgrade logic lives in the implementation itself.
- **Beacon Proxy:** Multiple proxies point to a single beacon contract that returns the implementation address. Upgrading the beacon upgrades all proxies simultaneously.

Always check the implementation slot first. If zero, check the beacon slot.

---

## Multicall3

**Address:** `0xcA11bde05977b3631167028862bE2a173976CA11`

Deployed at the same address on all EVM chains (via CREATE2). Batch multiple read calls into a single RPC request.

### `aggregate3`

```solidity
struct Call3 {
    address target;
    bool allowFailure;
    bytes callData;
}

struct Result {
    bool success;
    bytes returnData;
}

function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData);
```
Selector: `0x82ad56cb`

### Usage Pattern

```javascript
// Batch multiple calls in a single RPC request
const multicall = new Contract('0xcA11bde05977b3631167028862bE2a173976CA11', multicall3Abi, provider);

const calls = [
    {
        target: poolAddress,
        allowFailure: false,
        callData: poolInterface.encodeFunctionData('slot0'),
    },
    {
        target: poolAddress,
        allowFailure: false,
        callData: poolInterface.encodeFunctionData('liquidity'),
    },
    {
        target: tokenAddress,
        allowFailure: true,  // allow failure for optional calls
        callData: erc20Interface.encodeFunctionData('symbol'),
    },
];

const results = await multicall.callStatic.aggregate3(calls);
// results[0].returnData -> decode with poolInterface.decodeFunctionResult('slot0', ...)
// results[1].returnData -> decode with poolInterface.decodeFunctionResult('liquidity', ...)
// results[2].success -> check before decoding
```

### Other Useful Functions

| Function | Selector | Description |
|----------|----------|-------------|
| `aggregate3Value(Call3Value[])` | `0x174dea71` | Same as aggregate3 but with per-call ETH value |
| `getBlockNumber()` | `0x42cbb15c` | Returns current block number |
| `getBlockHash(uint256)` | `0xee82ac5e` | Returns block hash |
| `getCurrentBlockTimestamp()` | `0x0f28c97d` | Returns block.timestamp |
| `getEthBalance(address)` | `0x4d2301cc` | Returns ETH balance |
| `getChainId()` | `0x3408e470` | Returns chain ID |
| `getBasefee()` | `0x3e64a696` | Returns block.basefee |

### Best Practices

- Set `allowFailure: true` for calls that might revert (e.g., tokens that don't implement `symbol()`).
- Set `allowFailure: false` for calls that must succeed (reverts the entire batch if any fail).
- Batch size limit is practical, not protocol-imposed — stay under gas limits (~500-1000 calls per batch depending on complexity).
- Multicall3 is a view-compatible function — use `eth_call` for read batches.
