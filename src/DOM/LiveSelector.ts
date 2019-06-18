/**
 * Define all possible recordable operations.
 */
interface SelectorChainType {
    getElementsByClassName: string
    getElementsByTagName: string
    querySelector: string
    closest: string | number
    querySelectorAll: string
    filter: (element: any, index: number, array: any[]) => boolean
    map: (element: any, index: number, array: any[]) => any
    concat: LiveSelector<any, any>
    reverse: undefined
    slice: [number | undefined, number | undefined]
    sort: ((a: any, b: any) => number) | undefined
    flat: undefined
    nth: number
    replace: (array: any[]) => any[]
}
type MapOf<
    Original,
    Type = {
        [T in keyof Original]: {
            type: T
            param: Original[T]
        }
    },
    EachType = Type[keyof Type]
> = EachType
type SelectorChainTypeItem = MapOf<SelectorChainType>

/**
 * Create a live selector that can continuously select the element you want.
 *
 * @remarks
 * Call {@link LiveSelector.evaluateOnce | #evaluateOnce} to evaluate the element. Falsy value will be ignored.
 *
 * @param T - Type of Element that LiveSelector contains
 */
export class LiveSelector<T, SingleMode extends boolean = false> {
    protected readonly stack = new Error().stack
    private singleMode = false
    /**
     * Enable single mode. Only 1 result will be emitted.
     */
    enableSingleMode(): LiveSelector<T, true> {
        this.singleMode = true
        return this as any
    }
    /**
     * Record a method call into {@link LiveSelector.selectorChain}
     */
    private appendSelectorChain = <Key extends keyof SelectorChainType>(type: Key) => (
        param: SelectorChainType[Key],
    ): LiveSelector<any, SingleMode> => {
        this.selectorChain.push({ type: type as any, param: param as any })
        return this as LiveSelector<any, SingleMode>
    }
    /**
     * Records of previous calls on LiveSelector
     */
    private readonly selectorChain: SelectorChainTypeItem[] = []
    /**
     * Clone this LiveSelector and return a new LiveSelector.
     * @returns a new LiveSelector with same action
     * @example
     * ```ts
     * ls.clone()
     * ```
     */
    clone() {
        const ls = new LiveSelector<T, SingleMode>()
        ls.selectorChain.push(...this.selectorChain)
        ls.singleMode = this.singleMode
        return ls
    }
    //#region Add elements
    /**
     * Select the first element that is a descendant of node that matches selectors.
     *
     * @param selector - Selector
     *
     * @example
     * ```ts
     * ls.querySelector('div#root')
     * ```
     */
    querySelector<K extends keyof HTMLElementTagNameMap>(
        selector: K,
    ): LiveSelector<HTMLElementTagNameMap[K], SingleMode>
    querySelector<K extends keyof SVGElementTagNameMap>(selector: K): LiveSelector<SVGElementTagNameMap[K], SingleMode>
    querySelector<E extends Element = Element>(selector: string): LiveSelector<E, SingleMode>
    querySelector<T>(selector: string): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('querySelector')(selector)
    }
    /**
     * Select all element descendants of node that match selectors.
     *
     * @param selector - Selector
     * @example
     * ```ts
     * ls.querySelector('div > div')
     * ```
     */
    querySelectorAll<K extends keyof HTMLElementTagNameMap>(
        selector: K,
    ): LiveSelector<HTMLElementTagNameMap[K], SingleMode>
    querySelectorAll<K extends keyof SVGElementTagNameMap>(
        selector: K,
    ): LiveSelector<SVGElementTagNameMap[K], SingleMode>
    querySelectorAll<E extends Element = Element>(selector: string): LiveSelector<E, SingleMode>
    querySelectorAll<T>(selector: string): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('querySelectorAll')(selector)
    }
    /**
     * Select all element base on the current result.
     * @param className - Class name
     * @example
     * Equal to ls.querySelectorAll('.a .b')
     * ```ts
     * ls.getElementsByClassName('a').getElementsByClassName('b')
     * ```
     */
    getElementsByClassName<T extends Element = Element>(className: string): LiveSelector<T, SingleMode>
    getElementsByClassName<T>(className: string): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('getElementsByClassName')(className)
    }
    /**
     * Select all element base on the current result.
     * @param tag - Tag name
     * @example
     * Equal to ls.querySelectorAll('a b')
     * ```ts
     * ls.getElementsByTagName('a').getElementsByTagName('b')
     * ```
     */
    getElementsByTagName<K extends keyof HTMLElementTagNameMap>(
        tag: K,
    ): LiveSelector<HTMLElementTagNameMap[K], SingleMode>
    getElementsByTagName<K extends keyof SVGElementTagNameMap>(
        tag: K,
    ): LiveSelector<SVGElementTagNameMap[K], SingleMode>
    getElementsByTagName<E extends Element = Element>(tag: string): LiveSelector<E, SingleMode>
    getElementsByTagName<T>(tag: string): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('getElementsByTagName')(tag)
    }
    /**
     * Reversely select element in the parent
     * @example
     * ```ts
     * ls.closest('div')
     * ls.closest(2) // parentElement.parentElement
     * ```
     */
    closest<T>(parentOfNth: number): LiveSelector<T, SingleMode>
    closest<K extends keyof HTMLElementTagNameMap>(selectors: K): LiveSelector<HTMLElementTagNameMap[K], SingleMode>
    closest<K extends keyof SVGElementTagNameMap>(selectors: K): LiveSelector<SVGElementTagNameMap[K], SingleMode>
    closest<E extends Element = Element>(selectors: string): LiveSelector<E, SingleMode>
    closest<T>(selectors: string | number): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('closest')(selectors)
    }
    //#endregion

    //#region Modify
    /**
     * Select the elements of a LiveSelector that meet the condition specified in a callback function.
     *
     * @param f - The filter method
     *
     * @example
     * ```ts
     * ls.filter(x => x.innerText.match('hello'))
     * ```
     */
    filter(f: (value: T, index: number, array: T[]) => any): LiveSelector<NonNullable<T>, SingleMode>
    filter<S extends T = T>(f: (value: T, index: number, array: T[]) => value is S): LiveSelector<S, SingleMode> {
        return this.appendSelectorChain('filter')(f)
    }
    /**
     * Calls a defined callback function on each element of a LiveSelector, and continues with the results.
     *
     * @param callbackfn - Map function
     * @example
     * ```ts
     * ls.map(x => x.parentElement)
     * ```
     */
    map<NextType>(
        callbackfn: (element: T, index: number, array: T[]) => NextType,
    ): LiveSelector<NonNullable<NextType>, SingleMode> {
        return this.appendSelectorChain('map')(callbackfn)
    }
    /**
     * Combines two LiveSelector.
     * @param newEle - Additional LiveSelector to combine.
     * @param NextType - Next type generic for LiveSelector
     *
     * @example
     * ```ts
     * ls.concat(new LiveSelector().querySelector('#root'))
     * ```
     */
    concat<NextType>(newEle: LiveSelector<NextType, SingleMode>): LiveSelector<T | NextType, SingleMode> {
        return this.appendSelectorChain('concat')(newEle)
    }
    /**
     * Reverses the elements in an Array.
     *
     * @example
     * ```ts
     * ls.reverse()
     * ```
     */
    reverse(): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('reverse')(undefined)
    }
    /**
     * Returns a section of an array.
     * @param start - The beginning of the specified portion of the array.
     * @param end - The end of the specified portion of the array.
     *
     * @example
     * ```ts
     * ls.slice(2, 4)
     * ```
     */
    slice(start?: number, end?: number): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('slice')([start, end])
    }
    /**
     * Sorts an array.
     * @param compareFn - The name of the function used to determine the order of the elements. If omitted, the elements are sorted in ascending, ASCII character order.
     *
     * @example
     * ```ts
     * ls.sort((a, b) => a.innerText.length - b.innerText.length)
     * ```
     */
    sort(compareFn?: (a: T, b: T) => number): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('sort')(compareFn)
    }
    /**
     * Flat T[][] to T[]
     *
     * @example
     * ```ts
     * ls.flat()
     * ```
     */
    flat(): LiveSelector<T extends ArrayLike<infer U> ? U : never, SingleMode> {
        return this.appendSelectorChain('flat')(undefined)
    }
    /**
     * Select only nth element
     *
     * @param n - Select only nth element, allow negative number.
     * @example
     * ```ts
     * ls.nth(-1)
     * ```
     */
    nth(n: number): LiveSelector<T, SingleMode> {
        return this.appendSelectorChain('nth')(n)
    }
    /**
     * Replace the whole array.
     *
     * @example
     * ```ts
     * ls.replace(x => lodash.dropRight(x, 2))
     * ```
     *
     * @param f - returns new array.
     */
    replace<NextType>(f: (arr: T[]) => NextType[]): LiveSelector<NextType, SingleMode> {
        return this.appendSelectorChain('replace')(f)
    }
    //#endregion

    //#region Build
    /**
     * Evaluate selector expression
     */
    evaluateOnce(): SingleMode extends true ? T : T[] {
        let arr: (T | Element)[] = []
        function isElementArray(x: any[]): x is Element[] {
            // Do a simple check
            return x[0] instanceof Element
        }
        function nonNull<T>(x: T | null | undefined): x is T {
            return x !== null && x !== undefined
        }
        let previouslyNulled = false
        for (const op of this.selectorChain) {
            // if in single mode, drop other results.
            if (this.singleMode && arr.length > 1) arr = [arr[0]]
            switch (op.type) {
                case 'querySelector': {
                    if (!previouslyNulled) {
                        if (arr.length === 0) {
                            const e = document.querySelector(op.param)
                            if (e) arr.push(e)
                            else previouslyNulled = true
                        } else if (isElementArray(arr)) {
                            arr = arr.map(e => e.querySelector(op.param)).filter(nonNull)
                            if (arr.length === 0) previouslyNulled = true
                        } else throw new TypeError('Call querySelector on non-Element item!')
                    }
                    break
                }
                case 'getElementsByTagName':
                case 'getElementsByClassName':
                case 'querySelectorAll': {
                    if (!previouslyNulled) {
                        type F = (x: string) => NodeListOf<Element> | HTMLCollectionOf<Element>
                        ;[] // Fix editor syntax highlight
                        if (arr.length === 0) {
                            const e = (document[op.type] as F)(op.param)
                            arr.push(...e)
                            if (e.length === 0) previouslyNulled = true
                        } else if (isElementArray(arr)) {
                            let newArr: Element[] = []
                            for (const e of arr) {
                                newArr = newArr.concat(Array.from((e[op.type] as F)(op.param)))
                            }
                            arr = newArr.filter(nonNull)
                            if (arr.length === 0) previouslyNulled = true
                        } else throw new TypeError(`Call ${op.type} on non-Element item!`)
                    }
                    break
                }
                case 'closest':
                    if (arr.length === 0) {
                        break
                    } else if (isElementArray(arr)) {
                        const newArr: Element[] = arr
                        const selector = op.param
                        function findParent(node: Element, y: number): Element | null {
                            if (y < 0) throw new TypeError('Cannot use `.closet` with a negative number')
                            if (y === 0) return node
                            if (!node.parentElement) return null
                            return findParent(node.parentElement, y - 1)
                        }
                        if (typeof selector === 'number') {
                            arr = newArr.map(e => findParent(e, selector)).filter(nonNull)
                        } else {
                            arr = newArr.map(x => x.closest(selector)).filter(nonNull)
                        }
                    } else {
                        throw new TypeError('Cannot use `.closet on non-Element`')
                    }
                    break
                case 'filter':
                    arr = arr.filter(op.param).filter(nonNull)
                    break
                case 'map':
                    arr = arr.map(op.param).filter(nonNull)
                    break
                case 'concat':
                    arr = arr.concat(op.param.evaluateOnce())
                    break
                case 'reverse':
                    arr = arr.reverse()
                    break
                case 'slice': {
                    const [start, end] = op.param
                    arr = arr.slice(start, end)
                    break
                }
                case 'sort':
                    arr = arr.sort(op.param)
                    break
                case 'nth': {
                    const x = op.param >= 0 ? op.param : arr.length - op.param
                    arr = [arr[x]]
                    break
                }
                case 'flat':
                    arr = ([] as typeof arr).concat(...arr)
                    break
                case 'replace':
                    arr = op.param(arr)
                    break
                default:
                    throw new TypeError('Unknown operation type')
            }
        }
        if (this.singleMode) return (arr.filter(nonNull) as T[])[0] as any
        return (arr.filter(nonNull) as T[]) as any
    }
    //#endregion
}
