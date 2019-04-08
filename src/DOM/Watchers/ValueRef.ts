type Fn<T> = (newVal: T, oldVal: T) => void
export class ValueRef<T> {
    /** Get current value of a ValueRef */
    get value() {
        return this._value
    }
    /** Set current value of a ValueRef */
    set value(newVal: T) {
        const oldVal = this._value
        this._value = newVal
        for (const fn of this.watcher.keys()) {
            try {
                fn(newVal, oldVal)
            } catch (e) {
                console.error(e)
            }
        }
    }
    /** All watchers */
    private watcher = new Map<Fn<T>, boolean>()
    constructor(private _value: T) {}
    /**
     * Add a listener. This will return a remover.
     * Use it like: useEffect(() => ref.addListener(() => {...}))
     */
    addListener(fn: Fn<T>) {
        this.watcher.set(fn, true)
        return () => this.removeListener(fn)
    }
    /**
     * Remove a listener
     */
    removeListener(fn: Fn<T>) {
        this.watcher.delete(fn)
    }
    /**
     * Remove all listeners
     */
    removeAllListener() {
        this.watcher = new Map()
    }
}
