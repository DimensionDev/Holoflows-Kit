export type Contexts = 'background' | 'content' | 'unknown'
/**
 * Get current running context.
 * - background: background script
 * - content: content script
 * - unknown: unknown context
 */
export function GetContext(): Contexts {
    if (typeof location === 'undefined') return 'unknown'
    if (location.protocol === 'chrome-extension:') return 'background'
    return 'content'
}
/**
 * Make sure this file only run in (for Typescript user: but you can still export types) wanted context
 * @param context Wanted context or contexts
 * @param name name to throw
 */
export function OnlyRunInContext(context: Contexts | Contexts[], name: string) {
    const ctx = GetContext()
    if (Array.isArray(context) ? context.indexOf(ctx) === -1 : context !== ctx)
        throw new TypeError(`${name} run in the wrong context. (Wanted ${context}, actually ${ctx})`)
}
