import { Watcher } from '../Watcher'

/**
 * To use EventWatcher, do this
 * ```typescript
 * const e = new EventWatcher(...)
 * document.addEventListener('event', e.eventListener)
 * ```
 */
export class EventWatcher<T> extends Watcher<T> {
    /** Limit computation by rAF */
    private rAFLock = false
    private _callback = () => {
        if (this.rAFLock) return
        this.rAFLock = true
        this.watcherCallback()
        this.rAFLock = false
    }
    public eventListener() {
        requestAnimationFrame(this._callback)
    }
    protected watching = true
    startWatch() {
        this.watching = true
        return this
    }
    stopWatch() {
        this.watching = false
    }
}
