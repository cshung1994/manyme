export function buildSignMessage(wallet: string, action: string, resourceId?: string): { message: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000)
  let message = `ManyMe Action\nWallet: ${wallet}\nAction: ${action}\nTimestamp: ${timestamp}`
  if (resourceId) message += `\nResource: ${resourceId}`
  return { message, timestamp }
}

export interface SignedHeaders {
  'x-wallet-address': string
  'x-signature': string
  'x-timestamp': string
}

export async function signAction(
  signMessageAsync: (args: { message: string }) => Promise<string>,
  wallet: string,
  action: string,
  resourceId?: string,
): Promise<SignedHeaders> {
  const { message, timestamp } = buildSignMessage(wallet, action, resourceId)
  const signature = await signMessageAsync({ message })
  return {
    'x-wallet-address': wallet,
    'x-signature': signature,
    'x-timestamp': String(timestamp),
  }
}
