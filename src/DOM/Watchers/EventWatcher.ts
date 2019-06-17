import { Watcher } from '../Watcher'

/**
 * A Watcher based on event handlers.
 *
 * @example
 * ```ts
 * const e = new EventWatcher(ls)
 * document.addEventListener('event', e.eventListener)
 * ```
 */
export class EventWatcher<
    T,
    Before extends Element = HTMLSpanElement,
    After extends Element = HTMLSpanElement,
    SingleMode extends boolean = false
> extends Watcher<T, Before, After, SingleMode> {
    /** Limit computation by rAF */
    private rICLock = false
    /**
     * Use this function as event listener to invoke watcher.
     */
    public eventListener = () => {
        this.requestIdleCallback(
            deadline => {
                if (this.rICLock) return
                this.rICLock = true
                this.watcherCallback(deadline)
                this.rICLock = false
            },
            { timeout: 500 },
        )
    }
    protected watching = true
    startWatch() {
        this.watching = true
        return this
    }
    enableSingleMode(): EventWatcher<T, Before, After, true> {
        this._enableSingleMode()
        return this as any
    }
}
