import { Watcher } from '../Watcher'

export class IntervalWatcher<T> extends Watcher<T> {
    private timer: NodeJS.Timer | undefined
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
