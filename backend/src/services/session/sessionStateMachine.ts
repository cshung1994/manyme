export type SessionState = 'created' | 'active' | 'paused' | 'stopped' | 'failed'

// Valid transitions
const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  created:  ['active', 'stopped'],
  active:   ['paused', 'stopped', 'failed'],
  paused:   ['active', 'stopped'],
  stopped:  [],
  failed:   [],
}

export function canTransition(from: SessionState, to: SessionState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// States where per-second billing accrues
export const BILLING_STATES: Set<SessionState> = new Set(['active'])

// States where proof heartbeat runs
export const PROOF_STATES: Set<SessionState> = new Set(['active'])

// Human-readable transition descriptions (for logging)
export const TRANSITION_LABELS: Partial<Record<string, string>> = {
  'created->active':  'Session started',
  'active->paused':   'Session paused',
  'paused->active':   'Session resumed',
  'active->stopped':  'Session stopped',
  'paused->stopped':  'Session stopped while paused',
  'active->failed':   'Session failed',
  'created->stopped': 'Session cancelled',
}
