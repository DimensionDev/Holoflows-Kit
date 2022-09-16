/**
 */
export interface Deadline {
    didTimeout: boolean
    timeRemaining(): number
}
/**
 * @param fn - function to execute
 * @param timeout - timeout
 */
export function requestIdleCallback(fn: (t: Deadline) => void, timeout?: { timeout: number }) {
    if ('requestIdleCallback' in window) {
        return (window as any).requestIdleCallback(fn)
    }
    const start = Date.now()
    return setTimeout(() => {
        fn({
            didTimeout: false,
            timeRemaining: function () {
                return Math.max(0, 50 - (Date.now() - start))
            },
        })
    }, 1)
}
