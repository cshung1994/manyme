'use client'
import { useState, useEffect, useRef } from 'react'
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useSignMessage } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { fetchBalance, depositFunds } from '@/lib/agents-api'
import { signAction } from '@/lib/sign-action'
import { getNetworkConfig } from '@/lib/networks'

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const DEPOSIT_PRESETS = [5, 10, 20, 50]

export default function SettingsPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { usdcAddress: USDC_ADDRESS, escrowAddress: ESCROW_ADDRESS, label: networkLabel, explorerUrl } = getNetworkConfig(chainId)  // eslint-disable-line
  const { signMessageAsync } = useSignMessage()
  const [depositAmount, setDepositAmount] = useState('10')
  const [displayName, setDisplayName] = useState('')
  const [saved, setSaved] = useState(false)
  const [depositing, setDepositing] = useState(false)
  const depositingRef = useRef(depositing)
  depositingRef.current = depositing
  const depositAmountRef = useRef(depositAmount)
  depositAmountRef.current = depositAmount
  const [depositSuccess, setDepositSuccess] = useState(false)
  const [platformBalance, setPlatformBalance] = useState<{ balance: number; total_deposited: number; total_spent: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const escrowConfigured = ESCROW_ADDRESS !== '0x0000000000000000000000000000000000000000'

  useEffect(() => {
    setDisplayName(localStorage.getItem('manyme_display_name') || '')
  }, [])

  useEffect(() => {
    if (!address) return
    fetchBalance(address).then(setPlatformBalance).catch((e: any) => setError(e.message || 'Failed to fetch balance'))
  }, [address])

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()
  const { isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Handle wallet rejection / tx errors
  useEffect(() => {
    if (!writeError) return
    setDepositing(false)
    const msg = writeError.message?.split('\n')[0] || 'Transaction failed'
    setError(msg.includes('rejected') ? 'Transaction rejected by user.' : msg)
  }, [writeError])

  // Handle tx confirmed: sync backend balance with the on-chain tx hash
  useEffect(() => {
    if (!txSuccess || !depositingRef.current || !address || !txHash) return
    const amount = Math.round(Number(depositAmountRef.current) * 1_000_000)
    signAction(signMessageAsync, address, 'deposit')
      .then(auth => depositFunds(amount, auth, txHash))
      .then(result => {
        setPlatformBalance(result)
        setDepositSuccess(true)
        refetchBalance()
        setTimeout(() => setDepositSuccess(false), 3000)
      })
      .catch((e: any) => {
        const msg = (e.message || 'Failed to sync balance').split('\n')[0]
        setError(msg)
      })
      .finally(() => setDepositing(false))
  }, [txSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDeposit() {
    if (!address || !escrowConfigured) return
    setDepositing(true)
    writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [ESCROW_ADDRESS, parseUnits(depositAmount, 6)],
    })
  }

  function saveProfile() {
    localStorage.setItem('manyme_display_name', displayName)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const usdcBalance = balance ? Number(formatUnits(balance as bigint, 6)) : 0
  const platformAvailable = platformBalance ? platformBalance.balance / 1_000_000 : 0
  const isLoading = isPending || depositing

  const step1Done = platformBalance !== null && platformBalance.balance > 0

  return (
    <div className="bg-background min-h-screen text-text-primary">
      <div className="max-w-[1920px] mx-auto px-24 pt-24 pb-32">
        <div className="max-w-2xl mx-auto space-y-16">
          <div>
            <h1 className="font-display font-bold text-[5rem] leading-[0.95] tracking-tight mb-6">Settings</h1>
            <p className="text-text-secondary text-lg mb-8">Account & balance management</p>
          </div>

          {error && (
            <div className="flex items-center justify-between border border-error/30 bg-error/5 px-6 py-3 mb-8">
              <p className="text-error text-sm">{error}</p>
              <button type="button" onClick={() => setError(null)} className="text-error hover:text-text-primary text-sm transition-colors">&times;</button>
            </div>
          )}

          {isConnected && (
            <section className="border border-border-subtle">
              <div className="bg-surface-dim px-8 py-4 border-b border-border-subtle">
                <p className="text-xs text-text-secondary uppercase tracking-widest">Funding flow</p>
              </div>
              <div className="flex flex-col">
                <div className={`flex items-start gap-8 px-8 py-6 border-b border-border-subtle ${step1Done ? 'opacity-100' : 'opacity-70'}`}>
                  <span className={`font-display italic text-2xl ${step1Done ? 'text-accent' : 'text-text-tertiary'}`}>
                    {step1Done ? '✓' : '01'}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl mb-1">Deposit</h3>
                    <p className="text-sm text-text-secondary">Send USDC on-chain to fund your platform balance</p>
                  </div>
                </div>

                <div className={`flex items-start gap-8 px-8 py-6 ${step1Done ? 'opacity-100' : 'opacity-40'}`}>
                  <span className={`font-display italic text-2xl ${step1Done ? 'text-accent' : 'text-text-tertiary'}`}>
                    {step1Done ? '✓' : '02'}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl mb-1">Run Skills</h3>
                    <p className="text-sm text-text-secondary">Charged from platform balance</p>
                  </div>
                </div>
              </div>

              {!step1Done && (
                <div className="px-8 py-4 border-t border-border-subtle bg-surface-dim">
                  <p className="text-xs text-text-secondary uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">info</span>
                    Deposit USDC to fund your platform balance
                  </p>
                </div>
              )}
              {step1Done && (
                <div className="px-8 py-4 border-t border-border-subtle bg-surface-dim">
                  <p className="text-xs text-accent uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    All set. You can start running Skills.
                  </p>
                </div>
              )}
            </section>
          )}

          {isConnected && (
            <section>
              <h2 className="font-display text-3xl mb-6">Balance Overview</h2>
              <div className="grid grid-cols-2 border border-border-subtle">
                <div className="p-8 border-r border-border-subtle bg-surface flex flex-col justify-between">
                  <p className="text-text-secondary text-xs uppercase tracking-widest mb-4">Wallet USDC</p>
                  <div>
                    <p className="font-display text-4xl text-text-primary mb-2">
                      {usdcBalance.toFixed(2)}
                    </p>
                    <p className="text-xs text-text-tertiary">On-chain holdings</p>
                  </div>
                </div>
                <div className="p-8 bg-surface flex flex-col justify-between border-b-2 border-b-accent">
                  <p className="text-accent text-xs uppercase tracking-widest mb-4">Platform Balance</p>
                  <div>
                    <p className="font-display text-4xl text-accent mb-2">
                      {platformAvailable.toFixed(4)}
                    </p>
                    <p className="text-xs text-text-tertiary">Available for Skills</p>
                  </div>
                </div>
              </div>

              {platformBalance && (
                <div className="grid grid-cols-2 border-x border-b border-border-subtle bg-surface-dim">
                  <div className="px-8 py-4 border-r border-border-subtle flex justify-between items-center text-sm">
                    <span className="text-text-secondary">Total deposited</span>
                    <span className="font-mono text-text-primary">${(platformBalance.total_deposited / 1_000_000).toFixed(4)}</span>
                  </div>
                  <div className="px-8 py-4 flex justify-between items-center text-sm">
                    <span className="text-text-secondary">Total spent</span>
                    <span className="font-mono text-text-primary">${(platformBalance.total_spent / 1_000_000).toFixed(4)}</span>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className={`border transition-opacity ${
            !isConnected ? 'opacity-50 border-border-subtle' : 'border-accent'
          }`}>
            <div className="bg-surface-dim px-8 py-6 border-b border-border-subtle flex items-center gap-4">
              <span className={`font-display italic text-2xl ${step1Done ? 'text-accent' : 'text-text-tertiary'}`}>
                {step1Done ? '✓' : '01'}
              </span>
              <div>
                <h2 className="font-display text-2xl">Deposit funds to platform</h2>
                <p className="text-sm text-text-secondary mt-1">Sends USDC on-chain to the escrow — your platform balance is credited after the transaction confirms</p>
              </div>
            </div>

            <div className="p-8">
              {!isConnected ? (
                <p className="text-text-secondary text-sm">Connect your wallet to continue</p>
              ) : !escrowConfigured ? (
                <p className="text-text-secondary text-sm">Deposits are temporarily unavailable — the escrow contract is not yet deployed on {networkLabel}.</p>
              ) : (
                <div className="space-y-8">
                  <div>
                    <div className="block text-xs text-text-secondary uppercase tracking-widest mb-4">Select Amount</div>
                    <div className="flex gap-2 flex-wrap">
                      {DEPOSIT_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDepositAmount(String(preset))}
                          className={`px-6 py-3 text-sm font-sans uppercase tracking-widest border transition-colors ${
                            depositAmount === String(preset)
                              ? 'border-accent text-accent'
                              : 'border-border-strong text-text-secondary hover:text-text-primary hover:border-text-tertiary'
                          }`}
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="deposit-amount" className="block text-xs text-text-secondary uppercase tracking-widest mb-4">Custom Amount</label>
                    <div className="flex gap-4 items-stretch">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
                        <input
                          id="deposit-amount"
                          type="number"
                          value={depositAmount}
                          onChange={e => setDepositAmount(e.target.value)}
                          min="1"
                          className="w-full bg-surface-dim border border-border-subtle pl-8 pr-16 py-4 text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none transition-colors"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-secondary uppercase tracking-widest">USDC</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeposit}
                        disabled={isLoading || !depositAmount || Number(depositAmount) <= 0}
                        className="bg-text-primary text-surface-elevated font-bold uppercase tracking-widest px-8 py-4 hover:bg-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isLoading ? 'Depositing...' : depositSuccess ? 'Deposited ✓' : 'Deposit'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm pt-4 border-t border-border-subtle">
                    <span className="text-text-secondary uppercase tracking-widest text-xs">Platform balance:</span>
                    <span className={`font-mono ${step1Done ? 'text-accent' : 'text-text-tertiary'}`}>
                      ${platformAvailable.toFixed(4)} USDC
                    </span>
                  </div>

                  <div className="bg-surface-dim border border-border-subtle p-6 space-y-3 text-xs">
                    <div className="flex justify-between border-b border-border-subtle pb-2">
                      <span className="text-text-secondary uppercase tracking-widest">USDC Contract</span>
                      <span className="font-mono text-text-tertiary">{USDC_ADDRESS.slice(0, 10)}...{USDC_ADDRESS.slice(-6)}</span>
                    </div>
                    <div className="flex justify-between border-b border-border-subtle pb-2">
                      <span className="text-text-secondary uppercase tracking-widest">Escrow Contract</span>
                      <span className="font-mono text-text-tertiary">{ESCROW_ADDRESS.slice(0, 10)}...{ESCROW_ADDRESS.slice(-6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary uppercase tracking-widest">Network</span>
                      <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-text-tertiary hover:text-accent transition-colors">{networkLabel} ({chainId})</a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="border border-border-subtle">
            <div className="bg-surface-dim px-8 py-6 border-b border-border-subtle">
              <h2 className="font-display text-2xl">Profile</h2>
            </div>

            <div className="p-8 space-y-8">
              <div>
                <label htmlFor="display-name" className="block text-xs text-text-secondary uppercase tracking-widest mb-2">Display name</label>
                <input
                  id="display-name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full bg-surface-dim border border-border-subtle px-4 py-4 text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none transition-colors"
                />
              </div>
              <div>
                <div className="block text-xs text-text-secondary uppercase tracking-widest mb-2">Wallet address</div>
                <div className="bg-surface-dim border border-border-subtle px-4 py-4 text-text-tertiary font-mono text-sm break-all">
                  {address || 'No wallet connected'}
                </div>
              </div>
              <button
                type="button"
                onClick={saveProfile}
                className="bg-text-primary text-surface-elevated font-bold uppercase tracking-widest px-8 py-4 hover:bg-text-secondary transition-colors text-sm"
              >
                {saved ? 'Saved ✓' : 'Save Profile'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
