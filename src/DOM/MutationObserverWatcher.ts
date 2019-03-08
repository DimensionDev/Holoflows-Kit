import { Watcher } from './Watcher'
import { LiveSelector } from './LiveSelector'

export class MutationObserverWatcher<T> extends Watcher<T> {
    constructor(
        protected liveSelector: LiveSelector<T>,
        /** The element that won't change during the whole watching lifetime. This may improve performance. */
        private consistentWatchRoot: Element | Document = document.body,
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
    }
    private onMutation(mutations: MutationRecord[], observer: MutationObserver) {
        requestAnimationFrame(this.callback)
        this.rAFLock = false
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
        this.observer.observe(this.consistentWatchRoot, option)
        this.watcherCallback()
        return this
    }
    stopWatch() {
        this.watching = false
        this.observer.disconnect()
    }
}
