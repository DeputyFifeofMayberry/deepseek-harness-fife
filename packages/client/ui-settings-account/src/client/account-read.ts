/**
 * Consumer-facing account read: sign-in state, Platform destinations, and
 * recharge-wallet balances. Other client surfaces read this face instead of
 * opening a second account stream or reaching into the settings snapshot.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-account/account-read
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { AccountDetails, AccountLinks, AccountView, AccountWallet } from '@deepseek-ai/dsh-deepseek-account/types'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/** One surface-facing reading of the account. */
export interface AccountReadSnapshot {
  /** Sign-in lifecycle; `unknown` until the first account frame arrives. */
  readonly status: 'unknown' | 'signed-out' | 'signed-in'
  /** Platform destinations from the latest frame; absent while the account is unknown. */
  readonly links?: AccountLinks
  /** Recharge wallets from the latest successful balance read; absent while loading, failed, or signed out. */
  readonly wallets?: readonly AccountWallet[]
  /** Whether the latest completed balance read failed. */
  readonly balanceFailed?: boolean
}

/** Snapshot fields {@link accountReadOf} derives the consumer reading from. */
export interface AccountReadInput {
  /** Latest account frame, absent before the stream responds. */
  readonly view: AccountView | undefined
  /** Latest profile and balance outcomes, absent while loading. */
  readonly details: Partial<AccountDetails> | undefined
}

/**
 * Project the settings snapshot onto the narrow consumer reading.
 * @param input - latest account frame and detail outcomes.
 * @returns sign-in state, Platform links, and wallet balances.
 */
export function accountReadOf(input: AccountReadInput): AccountReadSnapshot {
  const { view, details } = input
  const balance = details?.balance
  return {
    status: view === undefined ? 'unknown' : view.status === 'credential-stored' ? 'signed-in' : 'signed-out',
    ...(view === undefined ? {} : { links: view.links }),
    ...(balance?.status === 'ready' ? { wallets: balance.value } : {}),
    ...(balance?.status === 'failed' ? { balanceFailed: true } : {}),
  }
}

/** The narrow balance re-read shared by every consumer surface. */
export type AccountBalanceRefresh = () => Promise<void>

/** One published reading plus the on-demand balance refresh behind it. */
export interface AccountReadSource {
  /** Stable reading face, updated whenever the account snapshot publishes. */
  readonly snapshot: HostObservable<AccountReadSnapshot>
  /** Re-read only the recharge wallets; resolves immediately when signed out. */
  readonly refreshBalance: AccountBalanceRefresh
}

/** The `accountRead` service: one account reading shared by client surfaces. */
export class AccountReadService extends Service {
  /** Current narrow reading, updated with the owning account snapshot. */
  readonly snapshot: HostObservable<AccountReadSnapshot>
  /** Re-read only the recharge wallets for a signed-in account. */
  readonly refreshBalance: AccountBalanceRefresh

  /**
   * @param ctx - client plugin context.
   * @param source - the settings owner's published reading and balance refresh.
   */
  constructor(ctx: Context, source: AccountReadSource) {
    super(ctx, 'accountRead')
    this.snapshot = source.snapshot
    this.refreshBalance = source.refreshBalance
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Narrow account reading shared by client surfaces. */
    accountRead: AccountReadService
  }
}
