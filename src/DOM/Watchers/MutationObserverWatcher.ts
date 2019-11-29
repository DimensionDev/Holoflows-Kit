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
        /**
         * Call stopWatch() when the consistentWatchRoot disconnected.
         */
        private stopWatchOnDisconnected = false,
    ) {
        super(liveSelector)
        setTimeout(this._warning_forget_watch_.warn, 5000)
    }

    /** Observe whole document change */
    private observer: MutationObserver = new MutationObserver((mutations, observer) => {
        if (this.consistentWatchRoot.isConnected === false && this.stopWatchOnDisconnected === true) {
            return this.stopWatch()
        }
        this.requestIdleCallback(this.scheduleWatcherCheck)
    })
    /**
     * Start an MutationObserverWatcher.
     *
     * @remarks
     * You must provide a reasonable MutationObserverInit to reduce dom events.
     *
     * https://mdn.io/MutationObserverInit
     */
    startWatch(options: MutationObserverInit) {
        super.startWatch()
        this.isWatching = true
        const watch = (root?: Node) => {
            this.observer.observe(root || document.body, options)
            this.scheduleWatcherCheck()
        }
        if (document.readyState !== 'complete' && this.consistentWatchRoot === null) {
            document.addEventListener('readystatechange', () => document.readyState !== 'complete' && watch())
        } else watch(this.consistentWatchRoot)
        return this
    }
    protected defaultStarterForThen() {
        if (!this.isWatching) this.startWatch({ subtree: true, childList: true, characterData: true })
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
