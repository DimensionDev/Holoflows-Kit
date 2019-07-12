import { Watcher } from '../Watcher'
import { LiveSelector } from '../LiveSelector'
/**
 * A watcher based on MutationObserver
 *
 * @example
 * ```ts
 * new MutationObserverWatcher(ls)
 *     .useForeach(node => {
 *         console.log(node)
 *     })
 *     .startWatch()
 * ```
 */
export class MutationObserverWatcher<
    T,
    Before extends Element = HTMLSpanElement,
    After extends Element = HTMLSpanElement,
    SingleMode extends boolean = false
> extends Watcher<T, Before, After, SingleMode> {
    constructor(
        /** LiveSelector that this object holds */
        protected liveSelector: LiveSelector<T, SingleMode>,
        /**
         * If you know the element is always inside of a node, set this option.
         * This may improve performance.
         */
        private consistentWatchRoot: Node = document.body,
    ) {
        super(liveSelector)
        setTimeout(this._warning_forget_watch_.warn, 5000)
    }

    /** Observe whole document change */
    private observer: MutationObserver = new MutationObserver((mutations, observer) => {
        this.requestIdleCallback(this.scheduleWatcherCheck)
    })
    /**
     * {@inheritdoc Watcher.startWatch}
     */
    startWatch(options?: MutationObserverInit) {
        super.startWatch()
        this.isWatching = true
        const option = {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true,
            ...options,
        }
        const watch = (root?: Node) => {
            this.observer.observe(root || document.body, option)
            this.scheduleWatcherCheck()
        }
        if (document.readyState !== 'complete' && this.consistentWatchRoot === null) {
            document.addEventListener('load', () => watch())
        } else watch(this.consistentWatchRoot)
        return this
    }
    /**
     * {@inheritdoc Watcher.stopWatch}
     */
    stopWatch() {
        super.stopWatch()
        this.observer.disconnect()
    }
    /**
     * {@inheritdoc Watcher.enableSingleMode}
     */
    enableSingleMode: () => MutationObserverWatcher<T, Before, After, true> = this._enableSingleMode as any
}
