import { publicClient } from './baseClient.js'
import { manyMeEscrowAbi } from '../../../../shared/abis/ManyMeEscrow.js'
import { config } from '../../config.js'
import type { SessionOrchestrator } from '../orchestrator/sessionOrchestrator.js'

export class EventWatcher {
  private orchestrator: SessionOrchestrator
  private unwatchFn?: () => void
  private pollInterval?: ReturnType<typeof setInterval>

  constructor(orchestrator: SessionOrchestrator) {
    this.orchestrator = orchestrator
  }

  start() {
    if (!config.escrowAddress) {
      console.log('[EventWatcher] No escrow address configured, skipping watch')
      return
    }
    console.log('[EventWatcher] Starting event watch on', config.escrowAddress)
    this.startPolling()
  }

  private startPolling() {
    let lastBlock = 0n
    this.pollInterval = setInterval(async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber()
        if (lastBlock === 0n) {
          lastBlock = currentBlock - 10n
        }

        const logs = await publicClient.getContractEvents({
          address: config.escrowAddress as `0x${string}`,
          abi: manyMeEscrowAbi,
          fromBlock: lastBlock + 1n,
          toBlock: currentBlock,
        })

        for (const log of logs) {
          await this.handleEvent(log)
        }
        lastBlock = currentBlock
      } catch (_e) {
        // RPC errors expected when contract not yet deployed
      }
    }, 5000)
  }

  private async handleEvent(log: any) {
    switch (log.eventName) {
      case 'SessionCreated':
        await this.orchestrator.onSessionCreated(log.args)
        break
      case 'ProofTimeout':
        await this.orchestrator.onProofTimeout(log.args)
        break
      case 'SessionStopped':
        await this.orchestrator.onSessionStopped(log.args)
        break
    }
  }

  stop() {
    this.unwatchFn?.()
    if (this.pollInterval) clearInterval(this.pollInterval)
  }
}
