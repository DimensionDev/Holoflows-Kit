import { Watcher } from '../Watcher'
/**
 * A watcher based on time interval.
 *
 * @example
 * ```ts
 * new IntervalWatcher(ls)
 * .useForeach(node => {
 *     console.log(node)
 * })
 * .startWatch(1000)
 * ```
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
        super.startWatch()
        this.timer = setInterval(this.scheduleWatcherCheck, interval)
        return this
    }
    /**
     * {@inheritdoc Watcher.stopWatch}
     */
    stopWatch() {
        super.stopWatch()
        if (this.timer) clearInterval(this.timer)
    }
}
