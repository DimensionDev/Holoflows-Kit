import { Watcher } from '../Watcher'
/**
 * A watcher based on time interval.
 */
export class IntervalWatcher<T> extends Watcher<T> {
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
        this.watching = false
        if (this.timer) clearInterval(this.timer)
    }
}
