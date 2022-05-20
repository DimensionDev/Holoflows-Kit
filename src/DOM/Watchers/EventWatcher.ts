import { Watcher } from '../Watcher'
import type { LiveSelector } from '../LiveSelector'

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
    SingleMode extends boolean = false,
> extends Watcher<T, Before, After, SingleMode> {
    constructor(liveSelector: LiveSelector<T, SingleMode>) {
        super(liveSelector)
        this.startWatch()
    }
    /**
     * Use this function as event listener to invoke watcher.
     */
    public eventListener = () => {
        this.requestIdleCallback(this.scheduleWatcherCheck, { timeout: 500 })
    }
    override startWatch(signal?: AbortSignal) {
        signal?.addEventListener(
            'abort',
            () => {
                this.stopWatch()
            },
            { once: true },
        )
        return this
    }
}
