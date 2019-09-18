/**
 * This file is published under the MIT License
 */
export abstract class DevToolsEnhancer {
    static register(self: DevToolsEnhancer) {
        const fmt = new Set(Reflect.get(globalThis, 'devtoolsFormatters') || [])
        fmt.add(self)
        Reflect.set(globalThis, 'devtoolsFormatters', Array.from(fmt))
    }
    abstract hasBody(inspecting: object, config: any): boolean
    abstract header(inspecting: object, config: any): JSX.Element | null
    abstract body(inspecting: object, config: any): JSX.Element | null
}
