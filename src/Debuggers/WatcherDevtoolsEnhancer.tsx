import * as React from 'jsx-jsonml-devtools-renderer'
import { Watcher } from '../DOM/Watcher'
import { LiveSelectorDevtoolsEnhancer } from './LiveSelectorDevtoolsEnhancer'

type AnyWatcher = Watcher<any, any, any, any>
type Everything = {
    hooks: unknown
    DOMProxy: unknown
    value: unknown
}
interface State {
    refreshed: boolean
    everything: Map<unknown, Everything>
    new: Map<unknown, unknown>
    removed: Map<unknown, unknown>
}
const WatcherMapNotReady = Symbol('Not available now (WatcherMapNotReady)')
const initState = (obj: AnyWatcher): State => {
    const everythingMap = new Map<unknown, Everything>()
    const newMap = new Map<unknown, unknown>([[WatcherMapNotReady, 0]])
    const removedMap = new Map<unknown, unknown>([[WatcherMapNotReady, 0]])

    const priv = WatcherDevtoolsEnhancer.prototype.getPrivateItems(obj)
    const find = priv.findNodeFromListByKey(priv.lastNodeList, priv.lastKeyList)
    priv.lastKeyList.forEach(key => {
        everythingMap.set(key, {
            value: find(key),
            DOMProxy: priv.lastDOMProxyMap.get(key),
            hooks: priv.lastCallbackMap.get(key),
        })
    })
    obj.addListener('onIteration', iter => {
        const priv = WatcherDevtoolsEnhancer.prototype.getPrivateItems(obj)
        everythingMap.clear()
        newMap.clear()
        removedMap.clear()
        Array.from(iter.current.entries()).forEach(([key, value]) => {
            everythingMap.set(key, {
                value,
                DOMProxy: priv.lastDOMProxyMap.get(key),
                hooks: priv.lastCallbackMap.get(key),
            })
        })
        iter.new.forEach((v, k) => newMap.set(v, k))
        iter.removed.forEach((v, k) => removedMap.set(v, k))
    })
    return {
        refreshed: false,
        everything: everythingMap,
        new: newMap,
        removed: removedMap,
    }
}
export class WatcherDevtoolsEnhancer implements React.CustomObjectFormatter {
    header(obj: unknown) {
        if (obj instanceof Watcher) {
            const [state] = React.useState<State, AnyWatcher>(obj, initState)
            const watcher = this.getPrivateItems(obj)
            const ls = LiveSelectorDevtoolsEnhancer.getPrivateItems(watcher.liveSelector)
            return (
                <span>
                    {obj.constructor.name}
                    <code variant={['fade']}>{ls.single ? ' (SingleMode)' : null}</code>
                    <code variant={['bigint']}>{watcher.isWatching ? ' Running' : ' Not running'}</code>
                    {state.refreshed ? this.body(obj) : null}
                </span>
            )
        }
        return null
    }
    hasBody(obj: unknown): obj is AnyWatcher {
        if (obj instanceof Watcher) {
            const [state, setState] = React.useState<State, AnyWatcher>(obj, initState)
            if (state.refreshed === true) {
                setState({ refreshed: false })
                return false
            }
            return true
        }
        return false
    }
    body(obj: AnyWatcher) {
        const [state, setState, forceRender] = React.useState<State, AnyWatcher>(obj, initState)
        const priv = this.getPrivateItems(obj)
        const test = Symbol('used to test equality')
        const valueTag = 'Values'
        const removeTag = 'Removed in the last check'
        const newTag = 'New in the last check'
        const refresh = () => {
            setState({ refreshed: true })
            forceRender()
        }
        function isNil(x: any): boolean {
            if (x === null || x === undefined) return false
            return true
        }
        return (
            <div>
                <span variant={['fade']}>Last values:</span>
                <table>
                    {this.dataDisplayRow(valueTag, state.everything)}
                    {state.removed.has(WatcherMapNotReady) ? null : this.dataDisplayRow(removeTag, state.removed)}
                    {state.new.has(WatcherMapNotReady) ? null : this.dataDisplayRow(newTag, state.new)}
                </table>
                <br />
                <span variant={['fade']}>Other:</span>
                <table>
                    {this.optionsRow('LiveSelector', priv.liveSelector, () => false)}
                    {this.optionsRow(
                        'ConsistentWatchRoot',
                        priv.consistentWatchRoot,
                        x => x === document.body || isNil(x),
                    )}
                    {this.optionsRow('DomProxyOptions', priv.domProxyOption, x => Object.keys(x).length === 0)}
                    {this.optionsRow('KeyComparer', priv.keyComparer, x => x(test, test))}
                    {this.optionsRow('ValueComparer', priv.valueComparer, x => x(test, test))}
                    {this.optionsRow('MapNodeToKey', priv.mapNodeToKey, x => x(test, 0, []) === test)}
                    {this.optionsRow('FirstDOMProxy', obj.firstDOMProxy, x => true)}
                    {this.optionsRow('stopWatchOnDisconnected', priv.stopWatchOnDisconnected, isNil)}
                </table>
                <br />
                <div variant={['bigint']}>Actions:</div>
                <div onClick={() => console.log(priv.stack)}>👀 See who created this Watcher</div>
                <div onClick={refresh}>🔃 Refresh the data</div>
                <div
                    onClick={() => {
                        // @ts-ignore
                        obj.watcherChecker()
                        setTimeout(refresh, 50)
                    }}>
                    🔨 Manually run the watcher's checker
                </div>
            </div>
        )
    }
    optionsRow<T>(name: string, object: T, isEmpty: (obj: T) => boolean) {
        try {
            if (isEmpty(object)) return null
        } catch {}
        return (
            <tr>
                <td variant={['propertyName']}>{name}</td>
                <td>
                    <object object={object} />
                </td>
            </tr>
        )
    }
    dataDisplayRow<T>(name: string, object: T) {
        return (
            <tr>
                <td style={{ float: 'right' }} variant={['propertyName']}>
                    {name}
                </td>
                <td>
                    <object object={object} />
                </td>
            </tr>
        )
    }
    getPrivateItems(obj: AnyWatcher) {
        return {
            // @ts-ignore
            liveSelector: obj.liveSelector,
            // @ts-ignore
            isWatching: obj.isWatching,
            // @ts-ignore
            consistentWatchRoot: obj.consistentWatchRoot,
            // @ts-ignore
            domProxyOption: obj.domProxyOption,
            // @ts-ignore
            keyComparer: obj.keyComparer,
            // @ts-ignore
            valueComparer: obj.valueComparer,
            // @ts-ignore
            mapNodeToKey: obj.mapNodeToKey,
            // @ts-ignore
            lastCallbackMap: obj.lastCallbackMap,
            // @ts-ignore
            lastDOMProxyMap: obj.lastDOMProxyMap,
            // @ts-ignore
            lastKeyList: obj.lastKeyList,
            // @ts-ignore
            lastNodeList: obj.lastNodeList,
            // @ts-ignore
            liveSelector: obj.liveSelector,

            // @ts-ignore
            singleModeHasLastValue: obj.singleModeHasLastValue,
            // @ts-ignore
            singleModeLastValue: obj.singleModeLastValue,
            // @ts-ignore
            singleModeCallback: obj.singleModeCallback,
            // @ts-ignore
            stack: obj.stack,
            // @ts-ignore
            findNodeFromListByKey: obj.findNodeFromListByKey,
            // @ts-ignore
            stopWatchOnDisconnected: obj.stopWatchOnDisconnected,
        }
    }
}
