/**
 * This file is published by MIT License.
 */
type Fn<T> = (newVal: T, oldVal: T) => void
/**
 * A `ref` object with `addListener`
 *
 * @example
 * ```ts
 * const ref = new ValueRef(64)
 * function useRef() {
 *     const [state, setState] = React.useState(ref.value)
 *     React.useEffect(() => ref.addListener(setState))
 *     return state
 * }
 * ref.value = 42 // useRef will receive the new value
 * ```
 */
export class ValueRef<T> {
    /** Get current value */
    get value() {
        return this._value
    }
    /** Set current value */
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
     * @example
     * ```ts
     * React.useEffect(() => ref.addListener(setState))
     * ```
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