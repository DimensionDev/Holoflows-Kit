import * as React from 'jsx-jsonml-devtools-renderer'
import { DOMProxy, LiveSelector } from '..'
type State = { refreshed: boolean }
const x = () => ({ refreshed: false } as State)
export class DOMProxyDevtoolsEnhancer implements React.CustomObjectFormatter {
    static allDOMProxy = new WeakMap<DOMProxy<any, any, any>, any[]>()
    isDOMProxy(obj: unknown): obj is DOMProxy<any, any, any> {
        return DOMProxyDevtoolsEnhancer.allDOMProxy.has(obj as any)
    }
    hasBody(obj: unknown) {
        if (this.isDOMProxy(obj) && obj.destroyed === false) {
            if (obj.destroyed) return false
            const [state] = React.useState(obj, x)
            if (state.refreshed) return false
            return true
        }
        return false
    }
    showObject(name: JSX.Element, obj: any, obj2?: any, obj3?: any) {
        return (
            <tr>
                <td variant={['propertyName']}>{name}</td>
                <td>{obj}</td>
                {obj2 !== undefined ? <td>{obj2}</td> : null}
                {obj3 !== undefined ? <td>{obj3}</td> : null}
            </tr>
        )
    }
    decorateShadow(obj: ShadowRoot) {
        return <span>{`#shadow-root (${obj.mode})`}</span>
    }
    body(obj: DOMProxy<Node, Element, Element>, clearState: boolean) {
        const [state, setState, render] = React.useState(obj, x)
        if (clearState) setState({ refreshed: false })

        const before = obj.has('before') ? this.showObject('::before', obj.before) : null
        const beforeShadow = obj.has('beforeShadow')
            ? this.showObject('::before', obj.beforeShadow, '', this.decorateShadow(obj.beforeShadow))
            : null
        const after = obj.has('after') ? this.showObject('::after', obj.after) : null
        const afterShadow = obj.has('afterShadow')
            ? this.showObject('::after', obj.afterShadow, '', this.decorateShadow(obj.afterShadow))
            : null
        return (
            <div>
                <table>
                    <tr>
                        <td></td>
                        <td variant={['propertyPreviewName']}>Element</td>
                        <td></td>
                        <td variant={['propertyPreviewName']}>Real Current</td>
                    </tr>
                    {this.showObject('current', obj.current, '->', obj.realCurrent)}
                    {before}
                    {beforeShadow}
                    {after}
                    {afterShadow}
                </table>
                <br />
                <span>
                    Changes on the <span variant={['propertyName']}>current</span> Proxy
                    <object object={DOMProxyDevtoolsEnhancer.allDOMProxy.get(obj)!} />
                </span>
                <div
                    onClick={() => {
                        setState({ refreshed: true })
                        render()
                    }}>
                    Refresh
                </div>
            </div>
        )
    }
    header(obj: unknown) {
        if (!this.isDOMProxy(obj)) return null
        const [state] = React.useState(obj, x)
        return (
            <div>
                DOMProxy{obj.destroyed ? <span variant={['string']}> (destroyed)</span> : null}
                {state.refreshed ? this.body(obj, true) : null}
            </div>
        )
    }
    displaySelectorChain(obj: LiveSelector<any, any>) {
        // @ts-ignore
        const priv = LiveSelectorDevtoolsEnhancer.getPrivateItems(obj)
        return (
            <table style={{ marginLeft: '1em' }}>
                {priv.selectorChain.map((chain: any) => (
                    <tr>
                        <td>|</td>
                        <td variant={['propertyName']}>{chain.type}</td>
                        <td>
                            {Array.isArray(chain.param) ? (
                                chain.param.map((paramI: any, index: any, params: any) => (
                                    <span>
                                        <object object={paramI} />
                                        {index === params.length - 1 ? '' : <span style={{ opacity: 0.7 }}>, </span>}
                                    </span>
                                ))
                            ) : (
                                <object object={chain.param} />
                            )}
                        </td>
                    </tr>
                ))}
            </table>
        )
    }
}
