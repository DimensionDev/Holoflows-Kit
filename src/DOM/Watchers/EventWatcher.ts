import { Watcher } from '../Watcher'

/**
 * To use EventWatcher, do this
 * ```ts
 * const e = new EventWatcher(...)
 * document.addEventListener('event', e.eventListener)
 * ```
 */
export class EventWatcher<
    T,
    Before extends Element = HTMLSpanElement,
    After extends Element = HTMLSpanElement
> extends Watcher<T, Before, After> {
    /** Limit computation by rAF */
    private rICLock = false
    // private _callback = () => {
    //     if (this.rAFLock) return
    //     this.rAFLock = true
    //     this.watcherCallback()
    //     this.rAFLock = false
    // }
    public eventListener() {
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
}
