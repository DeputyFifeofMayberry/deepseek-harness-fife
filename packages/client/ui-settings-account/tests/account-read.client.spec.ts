/** Narrow account reading projected from the settings snapshot. */
import { describe, expect, it } from 'vitest'
import type { AccountDetails, AccountView } from '@deepseek-ai/dsh-deepseek-account/types'
import { accountReadOf } from '../src/client/account-read.ts'

const links = { usageUrl: 'https://platform.test/usage', topUpUrl: 'https://platform.test/top-up' }
const signedIn: AccountView = { status: 'credential-stored', links, attempt: null }
const signedOut: AccountView = { status: 'signed-out', links, attempt: null }
const wallets = [{ currency: 'USD' as const, balance: '4.20' }]
const balance: AccountDetails['balance'] = { status: 'ready', value: wallets, bonusWallets: [] }

describe('accountReadOf', () => {
  it('reports an unknown account before the first frame', () => {
    expect(accountReadOf({ view: undefined, details: undefined })).toEqual({ status: 'unknown' })
  })

  it('carries sign-in state and Platform links without wallet data', () => {
    expect(accountReadOf({ view: signedOut, details: undefined })).toEqual({ status: 'signed-out', links })
  })

  it('publishes wallets from a ready balance read', () => {
    expect(accountReadOf({ view: signedIn, details: { balance } })).toEqual({
      status: 'signed-in', links, wallets,
    })
  })

  it('marks a failed balance read without inventing wallets', () => {
    expect(accountReadOf({ view: signedIn, details: { balance: { status: 'failed' } } })).toEqual({
      status: 'signed-in', links, balanceFailed: true,
    })
  })
})
