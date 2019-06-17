import { Watcher } from '../Watcher'
import { LiveSelector } from '../LiveSelector'
/**
 * A watcher based on MutationObserver
 */
export class MutationObserverWatcher<
    T,
    Before extends Element = HTMLSpanElement,
    After extends Element = HTMLSpanElement,
    SingleMode extends boolean = false
> extends Watcher<T, Before, After, SingleMode> {
    constructor(
        protected liveSelector: LiveSelector<T, SingleMode>,
        /** The element that won't change during the whole watching lifetime. This may improve performance. */
        private consistentWatchRoot: Node = document.body,
    ) {
        super(liveSelector)
        this.notifyDeveloperCallStartWatch()
    }

    /** Observe whole document change */
    private observer: MutationObserver = new MutationObserver((mutations, observer) => {
        this.requestIdleCallback(() => {
            if (this.rAFLock) return
            this.rAFLock = true
            this.watcherCallback()
            this.rAFLock = false
        })
    })

    /** Limit onMutation computation by rAF */
    private rAFLock = false
    startWatch(options?: MutationObserverInit) {
        this.stopWatch()
        this.watching = true
        const option = {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true,
            ...options,
        }
        const watch = (root?: Node) => {
            this.observer.observe(root || document.body, option)
            this.watcherCallback()
        }
        if (document.readyState !== 'complete' && this.consistentWatchRoot === null) {
            document.addEventListener('load', () => watch())
        } else watch(this.consistentWatchRoot)
        return this
    }
    stopWatch() {
        super.stopWatch()
        this.observer.disconnect()
    }
    enableSingleMode(): MutationObserverWatcher<T, Before, After, true> {
        super._enableSingleMode()
        return this as any
    }
}
