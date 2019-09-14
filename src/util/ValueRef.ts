/**
 * This file is published by MIT License.
 */
/**
 * A `ref` object with `addListener`
 *
 * @example
 * ```ts
 * const ref = new ValueRef(64)
 * function useRef() {
 *     const [state, setState] = React.useState(ref.value)
 *     React.useEffect(() => ref.addListener(e => setState(e)))
 *     return state
 * }
 * ref.value = 42 // useRef will receive the new value
 * ```
 * @eventProperty
 */
export class ValueRef<T> {
    /** Get current value */
    get value() {
        return this._value
    }
    /** Set current value */
    set value(newVal: T) {
        const oldVal = this._value
        if (newVal === oldVal) return
        this._value = newVal
        for (const fn of this.watcher) {
            try {
                fn(newVal, oldVal)
            } catch (e) {
                console.error(e)
            }
        }
    }
    /** All watchers */
    private watcher = new Set<(newVal: T, oldVal: T) => void>()
    constructor(private _value: T) {}
    /**
     * Add a listener. This will return a remover.
     * @example
     * ```ts
     * React.useEffect(() => ref.addListener(setState))
     * ```
     */
    addListener(fn: (newVal: T, oldVal: T) => void) {
        this.watcher.add(fn)
        return () => this.removeListener(fn)
    }
    /**
     * Remove a listener
     */
    removeListener(fn: (newVal: T, oldVal: T) => void) {
        this.watcher.delete(fn)
    }
    /**
     * Remove all listeners
     */
    removeAllListener() {
        this.watcher = new Set()
    }
}
