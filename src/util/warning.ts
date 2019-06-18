interface WarningOptions {
    /** warn only one time (or at nth time) pre instance, defaults to true */
    once: boolean | number
    /** only run in dev, defaults to false */
    dev: boolean
    /** default warn function */
    fn: (stack: string) => void
}
/**
 * @internal
 */
export function warning(_: Partial<WarningOptions> = {}) {
    const { dev, once, fn } = { ..._, ...({ dev: false, once: true, fn: () => {} } as WarningOptions) }
    if (dev) if (process.env.NODE_ENV !== 'development') return { warn(f = fn) {}, ignored: true }
    const [_0, _1, _2, ...lines] = (new Error().stack || '').split('\n')
    const stack = lines.join('\n')
    let warned = 0
    return {
        ignored: false,
        stack,
        warn(f = fn) {
            if (this.ignored) return
            if (warned && once) return
            if (typeof once === 'number' && warned <= once) return
            warned++
            f(stack)
        },
    }
}
