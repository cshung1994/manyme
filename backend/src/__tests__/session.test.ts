import { test, expect, describe } from 'bun:test'
import {
  canTransition,
  BILLING_STATES,
  PROOF_STATES,
} from '../services/session/sessionStateMachine.js'

describe('sessionStateMachine', () => {
  describe('canTransition – valid transitions return true', () => {
    test('created -> active', () => expect(canTransition('created', 'active')).toBe(true))
    test('created -> stopped', () => expect(canTransition('created', 'stopped')).toBe(true))
    test('active -> paused', () => expect(canTransition('active', 'paused')).toBe(true))
    test('active -> stopped', () => expect(canTransition('active', 'stopped')).toBe(true))
    test('active -> failed', () => expect(canTransition('active', 'failed')).toBe(true))
    test('paused -> active', () => expect(canTransition('paused', 'active')).toBe(true))
    test('paused -> stopped', () => expect(canTransition('paused', 'stopped')).toBe(true))
  })

  describe('canTransition – invalid transitions return false', () => {
    test('created -> paused', () => expect(canTransition('created', 'paused')).toBe(false))
    test('created -> failed', () => expect(canTransition('created', 'failed')).toBe(false))
    test('stopped -> active', () => expect(canTransition('stopped', 'active')).toBe(false))
    test('stopped -> created', () => expect(canTransition('stopped', 'created')).toBe(false))
    test('failed -> active', () => expect(canTransition('failed', 'active')).toBe(false))
    test('failed -> stopped', () => expect(canTransition('failed', 'stopped')).toBe(false))
    test('paused -> failed', () => expect(canTransition('paused', 'failed')).toBe(false))
  })

  test('BILLING_STATES contains only active', () => {
    expect(BILLING_STATES.size).toBe(1)
    expect(BILLING_STATES.has('active')).toBe(true)
    expect(BILLING_STATES.has('paused')).toBe(false)
    expect(BILLING_STATES.has('stopped')).toBe(false)
  })

  test('PROOF_STATES contains only active', () => {
    expect(PROOF_STATES.size).toBe(1)
    expect(PROOF_STATES.has('active')).toBe(true)
    expect(PROOF_STATES.has('created')).toBe(false)
    expect(PROOF_STATES.has('stopped')).toBe(false)
  })
})
