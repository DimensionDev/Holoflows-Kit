import { Watcher } from '../Watcher'
import { LiveSelector } from '../LiveSelector'

/**
 * A Watcher based on event handlers.
 *
 * @example
 * ```ts
 * const e = new EventWatcher(ls).useForeach(node => console.log(node))
 * document.addEventListener('event', e.eventListener)
 * ```
 */
export class EventWatcher<
    T,
    Before extends Element = HTMLSpanElement,
    After extends Element = HTMLSpanElement,
    SingleMode extends boolean = false
> extends Watcher<T, Before, After, SingleMode> {
    constructor(liveSelector: LiveSelector<T, SingleMode>) {
        super(liveSelector)
        this.startWatch()
    }
    /** Limit computation by rIC */
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
    enableSingleMode: () => EventWatcher<T, Before, After, true> = this._enableSingleMode as any
}
