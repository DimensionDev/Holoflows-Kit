import * as React from 'jsx-jsonml-devtools-renderer'
import { LiveSelector } from '../DOM/LiveSelector'
export class LiveSelectorDevtoolsEnhancer implements React.CustomObjectFormatter {
    hasBody(obj: unknown) {
        if (obj instanceof LiveSelector) return true
        return false
    }
    body(obj: LiveSelector<any, any>) {
        const priv = LiveSelectorDevtoolsEnhancer.getPrivateItems(obj)
        return (
            <div>
                {this.displayInitialElements(obj)}
                {this.displaySelectorChain(obj)}
                <br />
                <span variant={['bigint']}>Actions:</span>
                <div onClick={() => console.log(priv.stack)}>👀 See who created this LiveSelector</div>
                <div onClick={() => console.log(obj.evaluate())}>🧮 Evaluate this LiveSelector</div>
            </div>
        )
    }
    header(obj: unknown) {
        if (!(obj instanceof LiveSelector)) return null
        return (
            <div>
                LiveSelector{' '}
                <code variant={['fade']}>
                    {LiveSelectorDevtoolsEnhancer.getPrivateItems(obj).single ? ' (SingleMode)' : null}
                </code>
            </div>
        )
    }
    displayInitialElements(obj: LiveSelector<unknown, boolean>) {
        const maxDisplayItems = 7
        const priv = LiveSelectorDevtoolsEnhancer.getPrivateItems(obj)
        const jsx: JSX.Element[] = []
        for (const i in priv.initialElements) {
            const index = parseInt(i)
            const _ = priv.initialElements[i]
            if (index === maxDisplayItems && priv.initialElements.length > maxDisplayItems) {
                jsx.push(<span style={{ opacity: 0.7 }}>and {priv.initialElements.length - maxDisplayItems} more</span>)
                break
            }
            jsx.push(
                <span>
                    <object object={_} />
                    {index === priv.initialElements.length - 1 ? '' : <span style={{ opacity: 0.7 }}>, </span>}
                </span>,
            )
        }
        return (
            <span>
                <span>[</span>
                {jsx}
                <span>]</span>
                <span style={{ marginLeft: '0.5em', opacity: 0.7, fontStyle: 'italic' }}>
                    (initial elements
                    {priv.initialElements.length > maxDisplayItems ? <object object={priv.initialElements} /> : ''})
                </span>
            </span>
        )
    }
    displaySelectorChain(obj: LiveSelector<any, any>) {
        const priv = LiveSelectorDevtoolsEnhancer.getPrivateItems(obj)
        return (
            <table style={{ marginLeft: '1em' }}>
                {priv.selectorChain.map(chain => (
                    <tr>
                        <td>|</td>
                        <td variant={['propertyName']}>{chain.type}</td>
                        <td>
                            {Array.isArray(chain.param) ? (
                                chain.param.map((paramI, index, params) => (
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
    static getPrivateItems(
        obj: LiveSelector<any, any>,
    ): {
        single: boolean
        initialElements: unknown[]
        stack: string
        selectorChain: { type: string; param: unknown }[]
    } {
        return {
            // @ts-ignore
            single: obj.isSingleMode,
            // @ts-ignore
            initialElements: obj.initialElements,
            // @ts-ignore
            stack: obj.stack,
            // @ts-ignore
            selectorChain: obj.selectorChain,
        }
    }
}
