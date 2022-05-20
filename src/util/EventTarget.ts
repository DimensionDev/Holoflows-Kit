import { Emitter, EventListener, once, ValidEventArgs } from '@servie/events'

/** @internal */
export function createEventTarget<T = any>() {
    const emitter = new Emitter<T>()
    const offWeakMap = new Map<PropertyKey, WeakMap<Function, Function>>()
    function getOff(key: PropertyKey) {
        if (offWeakMap.has(key)) return offWeakMap.get(key)!
        const off = new WeakMap<Function, Function>()
        offWeakMap.set(key, off)
        return off
    }

    return {
        has(key: keyof T) {
            return (emitter.$[key]?.size || 0) > 0
        },
        add<K extends keyof T>(event: K, callback: EventListener<T, K>, options?: AddEventListenerOptions) {
            const off = options?.once ? once(emitter, event, callback) : emitter.on(event, callback)

            getOff(event).set(callback, off)
            options?.signal?.addEventListener('abort', off, { once: true })
            return off
        },
        remove<K extends keyof T>(event: K, callback: EventListener<T, K>) {
            getOff(event).get(callback)?.()
        },
        emitter,
        emit<K extends keyof T>(type: K, ...args: ValidEventArgs<T, K>) {
            emitter.emit(type, ...args)
        }
    }
}
