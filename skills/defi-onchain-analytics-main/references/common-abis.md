# Common DeFi ABIs — Objective Router

Load only the ABI reference that matches the current analytical objective.

## Which file to load

1. **`references/abis-core-tokens-vaults.md`**
   - Load when decoding token/vault events and selectors:
     - ERC-20 / ERC-721 / ERC-1155 transfers and approvals
     - ERC-4626 deposit/withdraw and conversion/preview methods
   - Trigger keywords: `token`, `holder`, `transfer`, `approval`, `vault`, `ERC-4626`, `share price`

2. **`references/abis-dex-v3-v4-clamm.md`**
   - Load when analyzing concentrated liquidity DEX state and swaps:
     - Uniswap V3 events/state (`slot0`, `ticks`, `positions`)
     - Uniswap V4 singleton/StateLibrary
     - V3 NonfungiblePositionManager and QuoterV2
     - Algebra CLAMM deltas (`globalState` vs `slot0`)
   - Trigger keywords: `Uniswap`, `V3`, `V4`, `CLAMM`, `Algebra`, `pool`, `tick`, `liquidity`, `LP`, `quoter`

3. **`references/abis-proxy-and-multicall.md`**
   - Load when resolving proxy implementations or batching reads:
     - EIP-1967 implementation/beacon/admin slots
     - Multicall3 aggregate patterns/selectors
   - Trigger keywords: `proxy`, `EIP-1967`, `implementation slot`, `beacon`, `UUPS`, `transparent proxy`, `multicall`

## Loading guidance

- Start with one file based on objective.
- Load additional files only if scope expands (for example, DEX flow + proxy resolution).
- Do not load all ABI references by default.
