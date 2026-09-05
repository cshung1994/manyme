# DEX ABIs — Uniswap V3/V4 and Algebra CLAMM

Quick reference for concentrated liquidity pools. All topic0 hashes are keccak256 of canonical event signatures.

## Contents
- [Uniswap V3 Pool Events](#uniswap-v3-pool-events)
- [Uniswap V3 Pool State Interface](#uniswap-v3-pool-state-interface)
- [Uniswap V4 Pool State](#uniswap-v4-pool-state)
- [Uniswap V3 NonfungiblePositionManager](#uniswap-v3-nonfungiblepositionmanager)
- [Uniswap V3 Quoter (V2)](#uniswap-v3-quoter-v2)
- [Algebra CLAMM — Delta vs Uniswap V3](#algebra-clamm--delta-vs-uniswap-v3)

---

## Uniswap V3 Pool Events

### All Events

| Event | Signature | topic0 |
|-------|-----------|--------|
| Initialize | `Initialize(uint160,int24)` | `0x98636036cb66a9c19a37435efc1e90142190214e8abeb821bdba3f2990dd4c95` |
| Swap | `Swap(address,address,int256,int256,uint160,uint128,int24)` | `0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67` |
| Mint | `Mint(address,address,int24,int24,uint128,uint256,uint256)` | `0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde` |
| Burn | `Burn(address,int24,int24,uint128,uint256,uint256)` | `0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c` |
| Collect | `Collect(address,address,int24,int24,uint128,uint128)` | `0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0` |
| Flash | `Flash(address,address,uint256,uint256,uint256,uint256)` | `0xbdbdb71d7860376ba52b25a5028beea23581364a40522f6bcfb86bb1f2dca633` |
| IncreaseObservationCardinalityNext | `IncreaseObservationCardinalityNext(uint16,uint16)` | `0xac49e518f90a358f652e4400164f05a5d8f7e35e7747279bc3ba9f9b2d236282` |
| SetFeeProtocol | `SetFeeProtocol(uint8,uint8,uint8,uint8)` | `0x973d8d92bb299f4af6ce49b52a8adb85ae46b9f214c4c4fc06ac77401237b133` |
| CollectProtocol | `CollectProtocol(address,address,uint128,uint128)` | `0x596b573906218d3411850b26a6b437d6c4522fdb43d2d2386263f86d50b8b151` |

### Full Solidity Signatures

```solidity
event Initialize(uint160 sqrtPriceX96, int24 tick);
```
Emitted exactly once when the pool is first initialized via `initialize()`. Sets the starting price.

```solidity
event Swap(
    address indexed sender,
    address indexed recipient,
    int256 amount0,
    int256 amount1,
    uint160 sqrtPriceX96,
    uint128 liquidity,
    int24 tick
);
```
- `amount0` and `amount1` are **signed**: negative = tokens leaving the pool (sent to recipient), positive = tokens entering the pool.
- `sqrtPriceX96`, `liquidity`, `tick` = pool state **after** the swap.

```solidity
event Mint(
    address sender,
    address indexed owner,
    int24 indexed tickLower,
    int24 indexed tickUpper,
    uint128 amount,
    uint256 amount0,
    uint256 amount1
);
```
- `sender` (NOT indexed) = address that called `mint()` (usually a router/position manager).
- `owner` (indexed) = address that owns the liquidity position.
- `amount` = liquidity units added.
- `amount0`, `amount1` = actual tokens deposited.

```solidity
event Burn(
    address indexed owner,
    int24 indexed tickLower,
    int24 indexed tickUpper,
    uint128 amount,
    uint256 amount0,
    uint256 amount1
);
```
- Removes liquidity. Tokens are NOT transferred here — they accumulate as `tokensOwed` and must be collected via `collect()`.

```solidity
event Collect(
    address indexed owner,
    address recipient,
    int24 indexed tickLower,
    int24 indexed tickUpper,
    uint128 amount0,
    uint128 amount1
);
```
- Collects accumulated fees + tokens from a burned position.

```solidity
event Flash(
    address indexed sender,
    address indexed recipient,
    uint256 amount0,
    uint256 amount1,
    uint256 paid0,
    uint256 paid1
);
```
- `amount0/1` = borrowed amounts, `paid0/1` = amounts repaid (must be >= borrowed + fee).

```solidity
event IncreaseObservationCardinalityNext(
    uint16 observationCardinalityNextOld,
    uint16 observationCardinalityNextNew
);
```

```solidity
event SetFeeProtocol(
    uint8 feeProtocol0Old,
    uint8 feeProtocol1Old,
    uint8 feeProtocol0New,
    uint8 feeProtocol1New
);
```

```solidity
event CollectProtocol(
    address indexed sender,
    address indexed recipient,
    uint128 amount0,
    uint128 amount1
);
```

---

## Uniswap V3 Pool State Interface

### `slot0()`

```solidity
function slot0() external view returns (
    uint160 sqrtPriceX96,
    int24 tick,
    uint16 observationIndex,
    uint16 observationCardinality,
    uint16 observationCardinalityNext,
    uint8 feeProtocol,
    bool unlocked
);
```
Selector: `0x3850c7bd`

Returns 7 fields packed into the first storage slot. This is the most frequently read function on any V3 pool.

- `sqrtPriceX96` = sqrt(token1/token0) * 2^96. To get the human-readable price: `price = (sqrtPriceX96 / 2^96)^2`, then adjust for decimals.
- `tick` = current tick index corresponding to sqrtPriceX96.
- `feeProtocol` = packed protocol fee (lower 4 bits = token0, upper 4 bits = token1).
- `unlocked` = reentrancy guard (true = unlocked, false = currently executing).

### `liquidity()`

```solidity
function liquidity() external view returns (uint128);
```
Selector: `0x1a686502`

Returns **in-range liquidity only** — the sum of liquidity from positions whose range includes the current tick. This is NOT the total liquidity in the pool. Positions out of range do not contribute.

### `ticks(int24)`

```solidity
function ticks(int24 tick) external view returns (
    uint128 liquidityGross,
    int128 liquidityNet,
    uint256 feeGrowthOutside0X128,
    uint256 feeGrowthOutside1X128,
    int56 tickCumulativeOutside,
    uint160 secondsPerLiquidityOutsideX128,
    uint32 secondsOutside,
    bool initialized
);
```
Selector: `0xf30dba93`

- `liquidityGross` = total liquidity referencing this tick (for garbage collection — if 0, tick can be cleared).
- `liquidityNet` = net liquidity change when crossing this tick (positive = entering, negative = leaving).
- `feeGrowthOutside*` = fee accumulator values on the "other side" of the tick, used for fee calculations.

### `tickBitmap(int16)`

```solidity
function tickBitmap(int16 wordPosition) external view returns (uint256);
```
Selector: `0x5339c296`

Each word stores 256 boolean flags indicating which ticks in that range are initialized. Used for efficient next-initialized-tick lookup during swaps.

### `positions(bytes32)`

```solidity
function positions(bytes32 key) external view returns (
    uint128 liquidity,
    uint256 feeGrowthInside0LastX128,
    uint256 feeGrowthInside1LastX128,
    uint128 tokensOwed0,
    uint128 tokensOwed1
);
```
Selector: `0x514ea4bf`

Position key = `keccak256(abi.encodePacked(owner, tickLower, tickUpper))`

- `liquidity` = liquidity units in this position.
- `feeGrowthInside*LastX128` = snapshot of fee growth at last interaction (used to compute uncollected fees).
- `tokensOwed*` = accumulated tokens from burns and fee collections not yet claimed.

### Global Fee Accumulators

```solidity
function feeGrowthGlobal0X128() external view returns (uint256);
function feeGrowthGlobal1X128() external view returns (uint256);
```
Selectors: `0xf3058399` / `0x46141319`

Cumulative per-unit-of-liquidity fee counters in Q128.128 fixed-point format. These only increase. To compute fees earned by a position, subtract the position's `feeGrowthInside*LastX128` from the current inside growth (computed from global and outside values).

### `observations(uint256)`

```solidity
function observations(uint256 index) external view returns (
    uint32 blockTimestamp,
    int56 tickCumulative,
    uint160 secondsPerLiquidityCumulativeX128,
    bool initialized
);
```
Selector: `0x252c09d7`

Oracle observation array. Stores cumulative tick and seconds-per-liquidity values for TWAP calculations.

---

## Uniswap V4 Pool State

Uniswap V4 uses a **singleton PoolManager** architecture — all pools live in one contract, eliminating per-pool deployment costs.

### `slot0` — 4 Fields Only

Unlike V3's 7-field slot0, V4 stores only 4 fields:

| Field | Type | Description |
|-------|------|-------------|
| `sqrtPriceX96` | `uint160` | Same encoding as V3 |
| `tick` | `int24` | Current tick |
| `protocolFee` | `uint24` | Protocol fee (replaces V3's uint8 packed format) |
| `lpFee` | `uint24` | LP fee (dynamic fees possible via hooks) |

Oracle-related fields (`observationIndex`, `observationCardinality`, `observationCardinalityNext`) and `unlocked` have been removed from slot0. Oracles are implemented via hooks in V4.

### Singleton PoolManager

All V4 pools are managed by a single `PoolManager` contract. Pool identity is determined by a `PoolKey`:

```solidity
struct PoolKey {
    Currency currency0;
    Currency currency1;
    uint24 fee;
    int24 tickSpacing;
    IHooks hooks;
}
```

PoolId = `keccak256(abi.encode(PoolKey))`

### StateLibrary Pattern

V4 exposes pool state through the `StateLibrary` which provides external view functions that read directly from the PoolManager's storage:

```solidity
// Reading V4 pool state via StateLibrary
StateLibrary.getSlot0(poolManager, poolId);
StateLibrary.getLiquidity(poolManager, poolId);
StateLibrary.getTickInfo(poolManager, poolId, tick);
StateLibrary.getPosition(poolManager, poolId, owner, tickLower, tickUpper, salt);
```

### `extsload` for Direct Storage

V4's PoolManager exposes `extsload(bytes32 slot)` for gas-efficient direct storage reads. This allows reading arbitrary storage slots without going through view functions — useful for MEV searchers and advanced analytics:

```solidity
function extsload(bytes32 slot) external view returns (bytes32);
function extsload(bytes32 startSlot, uint256 nSlots) external view returns (bytes32[] memory);
```

---

## Uniswap V3 NonfungiblePositionManager

Address (Ethereum mainnet): `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`

The NonfungiblePositionManager wraps V3 pool positions as ERC-721 NFTs. Each NFT represents a unique liquidity position.

### `positions(uint256 tokenId)`

```solidity
function positions(uint256 tokenId) external view returns (
    uint96 nonce,
    address operator,
    address token0,
    address token1,
    uint24 fee,
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity,
    uint256 feeGrowthInside0LastX128,
    uint256 feeGrowthInside1LastX128,
    uint128 tokensOwed0,
    uint128 tokensOwed1
);
```
Selector: `0x99fbab88`

Returns 12 fields describing the full position state:

| Field | Type | Description |
|-------|------|-------------|
| `nonce` | `uint96` | Permit nonce (for gasless approvals) |
| `operator` | `address` | Approved operator for this specific NFT |
| `token0` | `address` | Pool's token0 |
| `token1` | `address` | Pool's token1 |
| `fee` | `uint24` | Pool fee tier (500, 3000, 10000) |
| `tickLower` | `int24` | Lower tick boundary |
| `tickUpper` | `int24` | Upper tick boundary |
| `liquidity` | `uint128` | Liquidity units in position |
| `feeGrowthInside0LastX128` | `uint256` | Fee growth snapshot for token0 |
| `feeGrowthInside1LastX128` | `uint256` | Fee growth snapshot for token1 |
| `tokensOwed0` | `uint128` | Uncollected token0 (from fees + burns) |
| `tokensOwed1` | `uint128` | Uncollected token1 (from fees + burns) |

### Enumerating Positions by Owner

Since the NonfungiblePositionManager is an ERC-721:

```solidity
function balanceOf(address owner) external view returns (uint256);
function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256 tokenId);
```

To enumerate all positions for an address:
1. Call `balanceOf(owner)` to get total count.
2. Loop `tokenOfOwnerByIndex(owner, i)` for `i` in `[0, count)` to get each tokenId.
3. Call `positions(tokenId)` for each to get position details.

---

## Uniswap V3 Quoter (V2)

Address (Ethereum mainnet): `0x61fFE014bA17989E743c5F6cB21bF9697530B21` (QuoterV2)

The Quoter simulates swaps off-chain to return expected amounts. It **intentionally reverts** — you must use `eth_call` (or `callStatic` in ethers.js). Never send a transaction to the Quoter.

### `quoteExactInputSingle`

```solidity
function quoteExactInputSingle(
    QuoteExactInputSingleParams memory params
) external returns (
    uint256 amountOut,
    uint160 sqrtPriceX96After,
    uint32 initializedTicksCrossed,
    uint256 gasEstimate
);

struct QuoteExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint24 fee;
    uint160 sqrtPriceLimitX96;  // 0 = no limit
}
```

### `quoteExactInput`

```solidity
function quoteExactInput(
    bytes memory path,
    uint256 amountIn
) external returns (
    uint256 amountOut,
    uint160[] memory sqrtPriceX96AfterList,
    uint32[] memory initializedTicksCrossedList,
    uint256 gasEstimate
);
```

### `quoteExactOutputSingle`

```solidity
function quoteExactOutputSingle(
    QuoteExactOutputSingleParams memory params
) external returns (
    uint256 amountIn,
    uint160 sqrtPriceX96After,
    uint32 initializedTicksCrossed,
    uint256 gasEstimate
);

struct QuoteExactOutputSingleParams {
    address tokenIn;
    address tokenOut;
    uint256 amount;
    uint24 fee;
    uint160 sqrtPriceLimitX96;  // 0 = no limit
}
```

### `quoteExactOutput`

```solidity
function quoteExactOutput(
    bytes memory path,
    uint256 amountOut
) external returns (
    uint256 amountIn,
    uint160[] memory sqrtPriceX96AfterList,
    uint32[] memory initializedTicksCrossedList,
    uint256 gasEstimate
);
```

### Multi-hop Path Encoding

Paths are tightly packed bytes: `[tokenA (20 bytes), fee_AB (3 bytes), tokenB (20 bytes), fee_BC (3 bytes), tokenC (20 bytes)]`

Example — USDC -> WETH -> DAI:
```
0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  // USDC
0x000bb8                                        // fee 3000 (0.3%)
0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2    // WETH
0x0001f4                                        // fee 500 (0.05%)
0x6B175474E89094C44Da98b954EedeAC495271d0F    // DAI
```

For `quoteExactOutput`, the path is **reversed**: `[tokenOut, fee, ..., tokenIn]`.

### Critical Usage Note

The Quoter intentionally reverts after computing results. You **must** call it via `eth_call` (static call):

```javascript
// ethers.js
const result = await quoter.callStatic.quoteExactInputSingle(params);

// viem
const result = await publicClient.simulateContract({
    address: quoterAddress,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [params],
});
```

Sending an actual transaction to the Quoter will waste gas and revert.

---

## Algebra CLAMM — Delta vs Uniswap V3

Algebra is a modular concentrated liquidity AMM used by Camelot (Arbitrum), QuickSwap (Polygon), and Katana (Ronin). It shares Uniswap V3's concentrated liquidity math (`price = 1.0001^tick`) but differs in architecture and some ABIs.

### Architecture Difference

- **Uniswap V3:** Monolithic pool — all logic (swapping, liquidity, fees) in one contract.
- **Algebra Integral:** Modular — immutable Core + tailored Plugins (dynamic fees, limit orders, farming). Pool contract is lighter; extensions via external plugin calls.

### Event Compatibility — topic0 Hashes

**Pool events share identical topic0 hashes with Uniswap V3.** The canonical event signatures use the same parameter types in the same order. Parameter names (`bottomTick` vs `tickLower`) do not affect the keccak256 hash — only the event name and parameter types matter.

| Event | Canonical Signature | topic0 | V3 Compatible? |
|-------|-------------------|--------|----------------|
| Mint | `Mint(address,address,int24,int24,uint128,uint256,uint256)` | `0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde` | ✅ Same |
| Burn | `Burn(address,int24,int24,uint128,uint256,uint256)` | `0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c` | ✅ Same |
| Swap | `Swap(address,address,int256,int256,uint160,uint128,int24)` | `0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67` | ✅ Same |

> **Field naming differs in the ABI:** Algebra uses `bottomTick`/`topTick` where V3 uses `tickLower`/`tickUpper`, and `price` where V3 uses `sqrtPriceX96`. When decoding with a typed ABI, use the protocol-specific field names. When filtering by topic0, V3 and Algebra events are interchangeable.

*Source: `IAlgebraPoolEvents.sol` in `cryptoalgebra/Algebra` (integral-v1.2.2)*

### Pool State: `globalState()` Replaces `slot0()`

Algebra does NOT have `slot0()`. Pool state is exposed via `globalState()`:

```solidity
function globalState() external view returns (
    uint160 price,          // equivalent to sqrtPriceX96
    int24 tick,             // current tick
    uint16 lastFee,         // last applied fee (1e-6 units, dynamic)
    uint8 pluginConfig,     // bitmask for active plugins
    uint16 communityFee,    // protocol fee
    bool unlocked           // reentrancy lock
);
```
Selector: `0xe76c01e4`

| V3 `slot0()` Field | Algebra `globalState()` Equivalent |
|--------------------|------------------------------------|
| `sqrtPriceX96` | `price` |
| `tick` | `tick` |
| `observationIndex` | _(removed — oracles handled via plugins)_ |
| `observationCardinality` | _(removed)_ |
| `observationCardinalityNext` | _(removed)_ |
| `feeProtocol` | `communityFee` |
| `unlocked` | `unlocked` |
| _(N/A)_ | `lastFee` (dynamic, plugin-managed) |
| _(N/A)_ | `pluginConfig` (plugin activation bitmask) |

### NonfungiblePositionManager: `positions()` Differences

Algebra's NPM `positions(uint256)` returns a **different struct** than V3:

| Field | V3 Type | Algebra Type | Note |
|-------|---------|-------------|------|
| nonce | `uint96` | `uint88` | Different width |
| operator | `address` | `address` | Same |
| token0 | `address` | `address` | Same |
| token1 | `address` | `address` | Same |
| fee | `uint24` | _(absent)_ | Algebra uses dynamic fees, no fixed tier |
| deployer | _(absent)_ | `address` | Algebra-specific: pool factory identifier |
| tickLower | `int24` | `int24` | Same (NPM uses `tickLower`, not `bottomTick`) |
| tickUpper | `int24` | `int24` | Same |
| liquidity | `uint128` | `uint128` | Same |
| feeGrowthInside0LastX128 | `uint256` | `uint256` | Same |
| feeGrowthInside1LastX128 | `uint256` | `uint256` | Same |
| tokensOwed0 | `uint128` | `uint128` | Same |
| tokensOwed1 | `uint128` | `uint128` | Same |

> **Selector differs from V3.** Do not assume `0x99fbab88` works for Algebra NPM. The struct layout change means a different ABI encoding and different selector. Verify from the deployed contract.

*Source: `INonfungiblePositionManager.sol` in `cryptoalgebra/Algebra`*

### Tick Spacing

V3 fixes tick spacing per fee tier (e.g., 0.3% = 60). Algebra allows **configurable tick spacing per pool**, set at creation via `AlgebraFactory`. Query `tickSpacing()` on the pool contract to get the value.

### Detection: V3 vs Algebra Pool

1. Call `globalState()` (selector `0xe76c01e4`) — success = Algebra pool
2. Call `slot0()` (selector `0x3850c7bd`) — success = Uniswap V3 pool
3. Alternatively, check the factory address against known factories per chain

---
