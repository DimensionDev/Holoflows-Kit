import { Watcher } from '../Watcher'
import { LiveSelector } from '../LiveSelector'
/**
 * A watcher based on MutationObserver
 */
export class MutationObserverWatcher<T> extends Watcher<T> {
    constructor(
        protected liveSelector: LiveSelector<T>,
        /** The element that won't change during the whole watching lifetime. This may improve performance. */
        private consistentWatchRoot: Node = document.body,
    ) {
        super(liveSelector)
    }

    /** Observe whole document change */
    private observer: MutationObserver = new MutationObserver(this.onMutation.bind(this))

    /** Limit onMutation computation by rAF */
    private rAFLock = false
    private callback = () => {
        if (this.rAFLock) return
        this.rAFLock = true
        this.watcherCallback()
        this.rAFLock = false
    }
    private onMutation(mutations: MutationRecord[], observer: MutationObserver) {
        requestAnimationFrame(this.callback)
    }
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
}
