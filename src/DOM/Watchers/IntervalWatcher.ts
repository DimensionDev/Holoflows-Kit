import { Watcher } from '../Watcher'
/**
 * A watcher based on time interval.
 */
export class IntervalWatcher<
    T,
    Before extends Element = HTMLSpanElement,
    After extends Element = HTMLSpanElement,
    SingleMode extends boolean = false
> extends Watcher<T, Before, After, SingleMode> {
    private timer: NodeJS.Timer | undefined
    /** Start to watch the LiveSelector at a interval(ms). */
    startWatch(interval: number) {
        this.stopWatch()
        this.watching = true
        this.watcherCallback()
        this.timer = setInterval(() => this.watcherCallback(), interval)
        return this
    }
    stopWatch() {
        super.stopWatch()
        if (this.timer) clearInterval(this.timer)
    }
    enableSingleMode(): IntervalWatcher<T, Before, After, true> {
        this._enableSingleMode()
        return this as any
    }
}
