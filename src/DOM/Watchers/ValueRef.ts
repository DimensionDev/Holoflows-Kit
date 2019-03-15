import { Watcher } from '../Watcher'
import { LiveSelector } from '../LiveSelector'

export class ValueRef<T> extends Watcher<T> {
    get value() {
        return this._value
    }
    set value(v: T) {
        this._value = v
        this.watcherCallback()
    }
    constructor(private _value: T) {
        super(new LiveSelector().replace(() => [this._value]))
    }
    startWatch() {
        this.watching = true
        return this
    }
    stopWatch() {
        this.watching = false
    }
}
