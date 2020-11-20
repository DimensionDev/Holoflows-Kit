/**
 * All context that possible in when developing a WebExtension
 * @deprecated, remove in 0.9.0
 */
export type Contexts = 'background' | 'content' | 'webpage' | 'unknown' | 'options' | 'debugging'
/**
 * Get current running context.
 * @deprecated Use getExtensionEnvironment(), remove in 0.9.0
 * @remarks
 * - background: background script
 * - content: content script
 * - webpage: a normal webpage
 * - unknown: unknown context
 */
export function GetContext(): Contexts {
    if (typeof location === 'undefined') return 'unknown'
    if (typeof browser !== 'undefined' && browser !== null) {
        const scheme = location.protocol.match('-extension')
        const backgroundURL = browser.extension?.getBackgroundPage?.()?.location?.href
        if (scheme || location.hostname === 'localhost') {
            if (
                backgroundURL === location.href ||
                ['generated', 'background', 'page', '.html'].every((x) => location.pathname.match(x))
            )
                return 'background'
        }
        if (scheme) return 'options'
        if (browser.runtime?.getManifest !== undefined) return 'content'
    }
    if (location.hostname === 'localhost') return 'debugging'
    return 'webpage'
}

/** Current running environment of Web Extension */
export enum Environment {
    /** has browser as a global variable */ HasBrowserAPI = 1 << 1,
    /** URL protocol ends with "-extension:" */ ExtensionProtocol = 1 << 2,
    /** Current running context is Content Script */ ContentScript = 1 << 3,
    // userScript = 1 << 4,
    /** URL is listed in the manifest.background or generated background page */ ManifestBackground = 1 << 6,
    /** URL is listed in the manifest.options_ui */ ManifestOptions = 1 << 7,
    /** URL is listed in the manifest.browser_action */ ManifestBrowserAction = 1 << 8,
    /**
     * URL is listed in the manifest.page_action
     * @deprecated Suggest to define browser_action instead.
     */ ManifestPageAction = 1 << 9,
    /** URL is listed in the manifest.devtools_page */ ManifestDevTools = 1 << 10,
    /** URL is listed in the manifest.sidebar_action. Firefox Only */ ManifestSidebar = 1 << 11,
    /** URL is listed in the manifest.chrome_url_overrides.newtab */ ManifestOverridesNewTab = 1 << 12,
    /** URL is listed in the manifest.chrome_url_overrides.bookmarks */ ManifestOverridesBookmarks = 1 << 13,
    /** URL is listed in the manifest.chrome_url_overrides.history */ ManifestOverridesHistory = 1 << 14,
    // DO NOT USE value that bigger than 1 << 20
}
declare const __holoflows_kit_get_environment_debug__: number
let result: Environment
/**
 * Get the current running environment
 * @remarks You can use the global variable `__holoflows_kit_get_environment_debug__` to overwrite the return value if the current hostname is localhost or 127.0.0.1
 */
export function getEnvironment(): Environment {
    if (result !== undefined) return result
    try {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            const val = __holoflows_kit_get_environment_debug__
            if (val !== undefined) return Number(val)
        }
    } catch {}
    let flag = 0
    // Scheme test
    try {
        const scheme = location.protocol
        if (scheme.endsWith('-extension:')) flag |= Environment.ExtensionProtocol
    } catch {}
    // Browser API test
    if (typeof browser !== 'undefined' && browser !== null) {
        flag |= Environment.HasBrowserAPI
        if (!(flag & Environment.ExtensionProtocol)) flag |= Environment.ContentScript
        else {
            try {
                const manifest = browser.runtime.getManifest()
                const current = location.pathname

                const background =
                    manifest.background?.page || manifest.background_page || '/_generated_background_page.html'
                const options = manifest.options_ui?.page || manifest.options_page

                if (current === normalize(background)) flag |= Environment.ManifestBackground
                // TODO: this property support i18n. What will I get when call browser.runtime.getManifest()?
                if (current === normalize(manifest.browser_action?.default_popup))
                    flag |= Environment.ManifestBrowserAction
                if (current === normalize(manifest.sidebar_action?.default_panel)) flag |= Environment.ManifestSidebar
                if (current === normalize(options)) flag |= Environment.ManifestOptions
                if (current === normalize(manifest.devtools_page)) flag |= Environment.ManifestDevTools
                if (current === normalize(manifest.page_action?.default_popup)) flag |= Environment.ManifestPageAction

                // TODO: this property support i18n.
                const { bookmarks, history, newtab } = manifest.chrome_url_overrides || {}
                if (current === normalize(bookmarks)) flag |= Environment.ManifestOverridesBookmarks
                if (current === normalize(history)) flag |= Environment.ManifestOverridesHistory
                if (current === normalize(newtab)) flag |= Environment.ManifestOverridesNewTab
            } catch {}
        }
    }
    return (result = flag)
    function normalize(x: string | undefined) {
        if (x === undefined) return '_'
        try {
            // on firefox it is a full qualified URL
            return new URL(x).pathname
        } catch {
            // on chrome it is unmodified
            if (x[0] !== '/') return '/' + x
            return x
        }
    }
}

/**
 * Print the Environment bit flag in a human-readable format
 * @param e - Printing environment bit flag
 */
export function printEnvironment(e: Environment = getEnvironment()) {
    const flag: (keyof typeof Environment)[] = []
    if (Environment.ContentScript & e) flag.push('ContentScript')
    if (Environment.ExtensionProtocol & e) flag.push('ExtensionProtocol')
    if (Environment.HasBrowserAPI & e) flag.push('HasBrowserAPI')
    if (Environment.ManifestBackground & e) flag.push('ManifestBackground')
    if (Environment.ManifestDevTools & e) flag.push('ManifestDevTools')
    if (Environment.ManifestOptions & e) flag.push('ManifestOptions')
    if (Environment.ManifestPageAction & e) flag.push('ManifestPageAction')
    if (Environment.ManifestOverridesBookmarks & e) flag.push('ManifestOverridesBookmarks')
    if (Environment.ManifestOverridesHistory & e) flag.push('ManifestOverridesHistory')
    if (Environment.ManifestOverridesNewTab & e) flag.push('ManifestOverridesNewTab')
    if (Environment.ManifestBrowserAction & e) flag.push('ManifestBrowserAction')
    if (Environment.ManifestSidebar & e) flag.push('ManifestSidebar')
    return flag.join('|')
}

/**
 * Make sure this file only run in wanted context
 * @param context - Wanted context or contexts
 * @param name - name to throw
 * @deprecated Remove in 0.9.0, use assertEnvironment
 */
export function OnlyRunInContext(context: Contexts | Contexts[], name: string): void
/**
 * Make sure this file only run in wanted context
 * @param context - Wanted context or contexts
 * @param throws - set to false, OnlyRunInContext will not throws but return a boolean
 * @deprecated Remove in 0.9.0, use isEnvironment
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

/**
 * Assert the current environment satisfy the expectation
 * @param env The expected environment
 */
export function assertEnvironment(env: Environment) {
    if (!isEnvironment(env))
        throw new TypeError(
            `Running in the wrong context, (expected ${printEnvironment(env)}, actually ${printEnvironment()})`,
        )
}
assertEnvironment.oneOf = (...args: Environment[]) => {
    return assertEnvironment(args.reduce((p, c) => p | c))
}
assertEnvironment.allOf = (...args: Environment[]) => {
    return args.map(assertEnvironment)
}

/**
 * Assert the current environment NOT satisfy the rejected flags
 * @param env The rejected environment
 */
export function assertNotEnvironment(env: Environment) {
    if (getEnvironment() & env)
        throw new TypeError(
            `Running in wrong context, (expected not match ${printEnvironment(env)}, actually ${printEnvironment()})`,
        )
}
assertNotEnvironment.oneOf = (...args: Environment[]) => {
    return assertNotEnvironment(args.reduce((p, c) => p | c))
}
assertNotEnvironment.allOf = (...args: Environment[]) => {
    return args.map(assertNotEnvironment)
}
/**
 * Check if the current environment satisfy the expectation
 * @param env The expectation environment
 */
export function isEnvironment(env: Environment) {
    const now = getEnvironment()
    return Boolean(env & now)
}
isEnvironment.oneOf = (...args: Environment[]) => {
    return isEnvironment(args.reduce((p, c) => p | c))
}
isEnvironment.allOf = (...args: Environment[]) => {
    return args.map(isEnvironment)
}
