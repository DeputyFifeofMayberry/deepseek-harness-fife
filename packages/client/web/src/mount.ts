/**
 * Application mount through a dependency fiber, so replacing `uiRenderer`
 * remounts the application. Shared by `AppWebEntry` and the test carrier.
 * @module @deepseek-ai/dsh-client-web/src/mount
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ClientEntries } from '@deepseek-ai/dsh-client-modules/client'
import { BootPage } from './boot-page.ts'

/**
 * Mount the UI renderer into `container` through a dependency fiber on
 * `uiRenderer`: the mount effect installs when the service is provided and
 * reinstalls when it is replaced. Reconciliation shows the framework-free loading or failure page;
 * the application mounts only after all entries settle without failures.
 * @param ctx - booted root Context.
 * @param container - application mount point.
 * @param entries - Module reconciliation state; rendering stops synchronously before plugin teardown.
 * @returns Resolves once the dependency fiber exists; rendering waits for both the renderer service
 * and successful reconciliation. Context disposal removes the page and its subscription.
 */
export async function mountClient(ctx: Context, container: HTMLElement, entries: ClientEntries['state']): Promise<void> {
  let render: (() => () => void) | undefined
  let unmount: (() => void) | undefined
  let page: BootPage | undefined
  let disposed = false
  const update = (): void => {
    if (disposed) return
    const state = entries.getSnapshot()
    if (render !== undefined && !state.syncing && state.failures.length === 0) {
      if (unmount === undefined) {
        page?.dispose()
        page = undefined
        unmount = render()
      }
      return
    }
    unmount?.()
    unmount = undefined
    page?.dispose()
    page = new BootPage(container)
    if (state.failures.length > 0) page.fail(state.failures.map(failure => `${failure.id}: ${failure.message}`).join('\n'))
  }
  ctx.effect(() => {
    const unsubscribe = entries.subscribe(update)
    return () => {
      disposed = true
      unsubscribe()
      unmount?.()
      unmount = undefined
      page?.dispose()
    }
  }, 'web boot: reconciliation presentation')
  const mounted = ctx.inject(['uiRenderer'], (scope) => {
    scope.effect(() => {
      render = () => scope.uiRenderer.mount(container)
      update()
      return () => { render = undefined; update() }
    }, 'web boot: application mount')
  })
  await mounted
}
