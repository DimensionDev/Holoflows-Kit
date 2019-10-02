/**
 * All context that possible in when developing a WebExtension
 */
export type Contexts = 'background' | 'content' | 'webpage' | 'unknown' | 'options' | 'debugging'
/**
 * Get current running context.
 *
 * @remarks
 * - background: background script
 * - content: content script
 * - webpage: a normal webpage
 * - unknown: unknown context
 */
export function GetContext(): Contexts {
    if (typeof location === 'undefined') return 'unknown'
    if (typeof browser !== 'undefined') {
        if (location.protocol.match('-extension')) {
            const backgroundPage = browser?.extension?.getBackgroundPage?.()
            // @ts-ignore
            const isSameWindow = backgroundPage === globalThis || backgroundPage === window
            const isSameLocation = backgroundPage?.location.href === location.href
            const isSameManifestURL = location.pathname.match(
                browser?.runtime?.getManifest() ?.background?.page ?? '/_generated_background_page.html'
            )
            if (isSameWindow || isSameLocation || isSameManifestURL) {
                return 'background'
            }
            return 'options'
        }
        if (typeof browser?.runtime?.getManifest === 'function') return 'content'
    }
    if (location.hostname === 'localhost') return 'debugging'
    return 'webpage'
}
/**
 * Make sure this file only run in wanted context
 * @param context - Wanted context or contexts
 * @param name - name to throw
 */
export function OnlyRunInContext(context: Contexts | Contexts[], name: string): void
/**
 * Make sure this file only run in wanted context
 * @param context - Wanted context or contexts
 * @param throws - set to false, OnlyRunInContext will not throws but return a boolean
 */
export function OnlyRunInContext(context: Contexts | Contexts[], throws: false): boolean
export function OnlyRunInContext(context: Contexts | Contexts[], name: string | false) {
    const ctx = GetContext()
    if (Array.isArray(context) ? context.indexOf(ctx) === -1 : context !== ctx) {
        if (typeof name === 'string')
            throw new TypeError(`${name} run in the wrong context. (Wanted ${context}, actually ${ctx})`)
        else return false
    }
    return true
}
