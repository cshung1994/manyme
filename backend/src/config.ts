export const config = {
  port: parseInt(process.env.PORT || '3001'),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  platformWallet: process.env.PLATFORM_WALLET || '0x0000000000000000000000000000000000000000',
  platformFeeRate: BigInt(process.env.PLATFORM_FEE_RATE || '300'),
  baseRpc: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
  baseWs: process.env.BASE_WS_URL || '',
  escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS || '',
  usdcAddress: process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  // Dev-only escape hatch: credit deposits without on-chain verification
  allowUnverifiedDeposits: process.env.ALLOW_UNVERIFIED_DEPOSITS === 'true',
  // x402: mock mode accepts any X-Payment header; real mode verifies/settles
  // via the facilitator. Defaults to mock until explicitly disabled.
  x402Mock: process.env.X402_MOCK !== 'false',
  x402FacilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  platformOperatorKey: process.env.PLATFORM_OPERATOR_KEY || '',
}
