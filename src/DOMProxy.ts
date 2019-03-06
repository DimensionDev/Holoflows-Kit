/**
 * DomProxy provide an interface that be stable even dom is changed.
 */
export const DomProxy = function() {
    let destroyed = false

    let virtualBefore: HTMLSpanElement | null = null
    let current: Element = document.createElement('div')
    let virtualAfter: HTMLSpanElement | null = null
    /** All changes applied on the `proxy` */
    let changes: (ActionTypes[keyof ActionTypes])[] = []
    /** Read Traps */
    const readonlyTraps: ProxyHandler<any> = {
        ownKeys: () => {
            changes.push({ type: 'ownKeys', op: undefined })
            if (current) return Object.getOwnPropertyNames(current)
            return []
        },
        get: (t, key, r) => {
            changes.push({ type: 'get', op: key })
            const current_: any = current
            if (current) {
                if (typeof current_[key] === 'function')
                    return new Proxy(current_[key], {
                        apply: (target, thisArg, args) => {
                            changes.push({ type: 'callMethods', op: { name: key, param: args, thisArg } })
                            current_[key](...args)
                        },
                    })
                else if (key === 'style')
                    return new Proxy((current as HTMLElement).style, {
                        set: (t, styleKey, styleValue, r) => {
                            changes.push({ type: 'modifyStyle', op: { name: styleKey, value: styleValue } })
                            current_.style[styleKey] = styleValue
                            return true
                        },
                    })
                return current_[key]
            }
            return undefined
        },
        has: (t, key) => {
            changes.push({ type: 'has', op: key })
            if (current) return key in current
            return false
        },
        getOwnPropertyDescriptor: (t, key) => {
            changes.push({ type: 'getOwnPropertyDescriptor', op: key })
            if (current) {
                return Reflect.getOwnPropertyDescriptor(current, key)
            }
            return {
                configurable: true,
                enumerable: false,
                value: undefined,
                writable: true,
            }
        },
        isExtensible: t => {
            changes.push({ type: 'isExtensible', op: undefined })
            if (current) return Reflect.isExtensible(current)
            return true
        },
        getPrototypeOf: t => {
            changes.push({ type: 'getPrototypeOf', op: undefined })
            if (current) return Reflect.getPrototypeOf(current)
            return {}
        },
    }
    /** Write Traps */
    const modifyTraps: (record: boolean) => ProxyHandler<any> = record => ({
        deleteProperty: (t, key: keyof HTMLElement) => {
            record && changes.push({ type: 'delete', op: key })
            if (current) {
                return Reflect.deleteProperty(current, key)
            }
            return false
        },
        set: (t, key: keyof HTMLElement, value, r) => {
            record && changes.push({ type: 'set', op: [key, value] })
            if (current) {
                return ((current as any)[key] = value)
            }
            return true
        },
        defineProperty: (t, key, attributes) => {
            record && changes.push({ type: 'defineProperty', op: [key, attributes] })
            if (current) {
                return Reflect.defineProperty(current, key, attributes)
            }
            return true
        },
        preventExtensions: t => {
            record && changes.push({ type: 'preventExtensions', op: undefined })
            if (current) return Reflect.preventExtensions(current)
            return true
        },
        setPrototypeOf: (t, prototype) => {
            record && changes.push({ type: 'setPrototypeOf', op: prototype })
            if (current) return Reflect.setPrototypeOf(current, prototype)
            return true
        },
    })
    const modifyTrapsWrite = modifyTraps(true)
    const modifyTrapsNotWrite = modifyTraps(false)
    const proxy = Proxy.revocable({}, { ...readonlyTraps, ...modifyTrapsWrite })
    /** Call before realCurrent change */
    function undoEffects() {
        for (const change of changes) {
            if (change.type !== 'callMethods') continue
            if (change.op.name !== 'addEventListener') continue
            current.removeEventListener(...(change.op.param as [any, any, any]))
        }
    }
    /** Call after realCurrent change */
    function redoEffects() {
        const t = {}
        for (const change of changes) {
            if (change.type === 'setPrototypeOf') modifyTrapsNotWrite.setPrototypeOf(t, change.op)
            else if (change.type === 'preventExtensions') modifyTrapsNotWrite.preventExtensions(t)
            else if (change.type === 'defineProperty') modifyTrapsNotWrite.defineProperty(t, change.op[0], change.op[1])
            else if (change.type === 'set') modifyTrapsNotWrite.set(t, change.op[0], change.op[1], t)
            else if (change.type === 'delete') modifyTrapsNotWrite.deleteProperty(t, change.op)
            else if (change.type === 'callMethods') {
                const replayable: (keyof Element)[] = ['appendChild', 'addEventListener', 'before', 'after']
                const key: keyof Element = change.op.name as any
                if (replayable.indexOf(key) !== -1) {
                    ;(current[key] as any)(...change.op.param)
                }
            } else if (change.type === 'modifyStyle') {
                ;(current as HTMLElement).style[change.op.name as any] = change.op.value
            }
        }
    }
    return {
        /**
         * A `span` element that always located at the before of `realCurrent`
         */
        get before() {
            if (destroyed) return null
            if (!virtualBefore) virtualBefore = document.createElement('span')
            current.before(virtualBefore)
            return virtualBefore
        },
        /**
         * A proxy that always point to `realCurrent`,
         * and if `realCurrent` changes, all action will be forwarded to new `realCurrent`
         */
        get current() {
            if (destroyed) return null
            return proxy.proxy as HTMLSuperSet
        },
        /**
         * A `span` element that always located at the after of `current`
         */
        get after() {
            if (destroyed) return null
            if (!virtualAfter) virtualAfter = document.createElement('span')
            current.after(virtualAfter)
            return virtualAfter
        },
        get realCurrent() {
            if (destroyed) return null
            return current as any
        },
        set realCurrent(node: Element | null | undefined) {
            if (destroyed) throw new TypeError('You can not set current for a destroyed proxy')
            if (node === current) return
            undoEffects()
            if (node === null || node === undefined) {
                current = document.createElement('div')
                if (virtualBefore) virtualBefore.remove()
                if (virtualAfter) virtualAfter.remove()
            } else {
                current = node
                if (virtualAfter) current.after(virtualAfter)
                if (virtualBefore) current.before(virtualBefore)
                redoEffects()
            }
        },
        destroy() {
            destroyed = true
            proxy.revoke()
            if (virtualBefore) virtualBefore.remove()
            if (virtualAfter) virtualAfter.remove()
            virtualBefore = null
            virtualAfter = null
            current = null
        },
    }
}
export type DomProxy = ReturnType<typeof DomProxy>
//#region HTMLSuperSet
type HTMLSuperSet = HTMLElement &
    HTMLAnchorElement &
    HTMLAppletElement &
    HTMLAreaElement &
    HTMLAudioElement &
    HTMLBaseElement &
    HTMLBaseFontElement &
    HTMLQuoteElement &
    HTMLBodyElement &
    HTMLBRElement &
    HTMLButtonElement &
    HTMLCanvasElement &
    HTMLTableCaptionElement &
    HTMLTableColElement &
    HTMLTableColElement &
    HTMLDataElement &
    HTMLDataListElement &
    HTMLModElement &
    HTMLDetailsElement &
    HTMLDialogElement &
    HTMLDirectoryElement &
    HTMLDivElement &
    HTMLDListElement &
    HTMLEmbedElement &
    HTMLFieldSetElement &
    HTMLFontElement &
    HTMLFormElement &
    HTMLFrameElement &
    HTMLFrameSetElement &
    HTMLHeadingElement &
    HTMLHeadingElement &
    HTMLHeadingElement &
    HTMLHeadingElement &
    HTMLHeadingElement &
    HTMLHeadingElement &
    HTMLHeadElement &
    HTMLHRElement &
    HTMLHtmlElement &
    HTMLIFrameElement &
    HTMLImageElement &
    HTMLInputElement &
    HTMLModElement &
    HTMLLabelElement &
    HTMLLegendElement &
    HTMLLIElement &
    HTMLLinkElement &
    HTMLMapElement &
    HTMLMarqueeElement &
    HTMLMenuElement &
    HTMLMetaElement &
    HTMLMeterElement &
    HTMLObjectElement &
    HTMLOListElement &
    HTMLOptGroupElement &
    HTMLOptionElement &
    HTMLOutputElement &
    HTMLParagraphElement &
    HTMLParamElement &
    HTMLPictureElement &
    HTMLPreElement &
    HTMLProgressElement &
    HTMLQuoteElement &
    HTMLScriptElement &
    HTMLSelectElement &
    HTMLSlotElement &
    HTMLSourceElement &
    HTMLSpanElement &
    HTMLStyleElement &
    HTMLTableElement &
    HTMLTableSectionElement &
    HTMLTableDataCellElement &
    HTMLTemplateElement &
    HTMLTextAreaElement &
    HTMLTableSectionElement &
    HTMLTableHeaderCellElement &
    HTMLTableSectionElement &
    HTMLTimeElement &
    HTMLTitleElement &
    HTMLTableRowElement &
    HTMLTrackElement &
    HTMLUListElement &
    HTMLVideoElement &
    HTMLElement
//#endregion
type Keys = string | number | symbol
type ActionRecord<T extends string, F> = { type: T; op: F }
interface ActionTypes {
    delete: ActionRecord<'delete', Keys>
    set: ActionRecord<'set', [Keys, any]>
    defineProperty: ActionRecord<'defineProperty', [Keys, PropertyDescriptor]>
    preventExtensions: ActionRecord<'preventExtensions', void>
    setPrototypeOf: ActionRecord<'setPrototypeOf', any>
    get: ActionRecord<'get', Keys>
    ownKeys: ActionRecord<'ownKeys', undefined>
    has: ActionRecord<'has', Keys>
    getOwnPropertyDescriptor: ActionRecord<'getOwnPropertyDescriptor', Keys>
    isExtensible: ActionRecord<'isExtensible', undefined>
    getPrototypeOf: ActionRecord<'getPrototypeOf', undefined>
    callMethods: ActionRecord<'callMethods', { name: Keys; param: any[]; thisArg: any }>
    modifyStyle: ActionRecord<'modifyStyle', { name: Keys; value: string }>
}
