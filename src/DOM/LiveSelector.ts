type RecordType<T extends string, F> = { type: T; param: F }
/**
 * Define all possible recordable operations.
 */
interface SelectorChainType {
    getElementsByClassName: RecordType<'getElementsByClassName', string>
    getElementsByTagName: RecordType<'getElementsByTagName', string>
    getElementById: RecordType<'getElementById', string>
    querySelector: RecordType<'querySelector', string>
    closest: RecordType<'closest', string | number>
    querySelectorAll: RecordType<'querySelectorAll', string>
    filter: RecordType<'filter', (element: any, index: number, array: any[]) => boolean>
    map: RecordType<'map', (element: any) => any>
    concat: RecordType<'concat', LiveSelector<any>>
    reverse: RecordType<'reverse', undefined>
    slice: RecordType<'slice', [number | undefined, number | undefined]>
    sort: RecordType<'sort', (a: any, b: any) => number>
    flat: RecordType<'flat', undefined>
    nth: RecordType<'nth', number>
    replace: RecordType<'replace', (array: any[]) => any[]>
}
type Keys = SelectorChainType[keyof SelectorChainType]['type']
type Params = { [key in keyof SelectorChainType]: SelectorChainType[key]['param'] }
/**
 * Create a live selector that can continuously select the element you want
 *
 * call `#evaluateOnce` to evaluate the element. Falsy will be ignored.
 */
export class LiveSelector<T> {
    private generateMethod = <Key extends Keys>(type: Key) => (param: Params[Key]): LiveSelector<any> => {
        this.selectorChain.push({ type: type as any, param: param as any })
        return this as LiveSelector<any>
    }
    private readonly selectorChain: (SelectorChainType[keyof SelectorChainType])[] = []
    /**
     * @return a new LiveSelector with same action
     */
    clone() {
        const ls = new LiveSelector<T>()
        ls.selectorChain.push(...this.selectorChain)
        return ls
    }
    //#region Add elements
    /**
     * Select the first element that is a descendant of node that matches selectors.
     *
     * @example ```ts
     * ls.querySelector('div#root')```
     */
    querySelector<K extends keyof HTMLElementTagNameMap>(selector: K): LiveSelector<HTMLElementTagNameMap[K]>
    querySelector<K extends keyof SVGElementTagNameMap>(selector: K): LiveSelector<SVGElementTagNameMap[K]>
    querySelector<E extends Element = Element>(selector: string): LiveSelector<E>
    querySelector<T>(selector: string): LiveSelector<T> {
        return this.generateMethod('querySelector')(selector)
    }
    /**
     * Select all element descendants of node that match selectors.
     *
     * @param selector Selector
     * @example ```ts
     * ls.querySelector('div > div')```
     */
    querySelectorAll<K extends keyof HTMLElementTagNameMap>(selector: K): LiveSelector<HTMLElementTagNameMap[K]>
    querySelectorAll<K extends keyof SVGElementTagNameMap>(selector: K): LiveSelector<SVGElementTagNameMap[K]>
    querySelectorAll<E extends Element = Element>(selector: string): LiveSelector<E>
    querySelectorAll<T>(selector: string): LiveSelector<T> {
        return this.generateMethod('querySelectorAll')(selector)
    }
    /**
     * Select all element base on the current result.
     * @param className Class name
     * @example ```ts
     * ls.getElementsByClassName('a').getElementsByClassName('b')
     * // Equal to ls.querySelectorAll('.a .b')```
     */
    getElementsByClassName<T extends Element = Element>(className: string): LiveSelector<T>
    getElementsByClassName<T>(className: string): LiveSelector<T> {
        return this.generateMethod('getElementsByClassName')(className)
    }
    /**
     * Select all element base on the current result.
     * @param tag Tag name
     * @example ```ts
     * ls.getElementsByTagName('a').getElementsByTagName('b')
     * // Equal to ls.querySelectorAll('a b')```
     */
    getElementsByTagName<K extends keyof HTMLElementTagNameMap>(tag: K): LiveSelector<HTMLElementTagNameMap[K]>
    getElementsByTagName<K extends keyof SVGElementTagNameMap>(tag: K): LiveSelector<SVGElementTagNameMap[K]>
    getElementsByTagName<E extends Element = Element>(tag: string): LiveSelector<E>
    getElementsByTagName<T>(tag: string): LiveSelector<T> {
        return this.generateMethod('getElementsByTagName')(tag)
    }
    /**
     * Select element by ID.
     * @param id id
     * @example ```ts
     * ls.getElementById('a')
     * // Equal to ls.querySelector('#a')```
     */
    getElementById<E extends Element = Element>(id: string): LiveSelector<E>
    getElementById<T>(id: string): LiveSelector<T> {
        return this.generateMethod('getElementById')(id)
    }
    /**
     * Reversely select element in the parent
     *
     * ! Experimental API
     *
     * @example ```ts
     * ls.closest('div')
     * ls.closest(2) // parentElement.parentElement
     * ```
     */
    unstable_closest<K extends keyof HTMLElementTagNameMap>(selectors: K): LiveSelector<HTMLElementTagNameMap[K]>
    unstable_closest<K extends keyof SVGElementTagNameMap>(selectors: K): LiveSelector<SVGElementTagNameMap[K]>
    unstable_closest<E extends Element = Element>(selectors: string): LiveSelector<E>
    unstable_closest<T>(selectors: string | number): LiveSelector<T> {
        return this.generateMethod('closest')(selectors)
    }
    //#endregion

    //#region Modify
    /**
     * Select the elements of a LiveSelector that meet the condition specified in a callback function.
     *
     * @example ```ts
     * ls.filter(x => x.innerText.match('hello'))```
     */
    filter: (<S extends T = T>(f: (value: T, index: number, array: T[]) => value is S) => LiveSelector<S>) &
        ((f: (value: T, index: number, array: T[]) => any) => LiveSelector<NonNullable<T>>) = this.generateMethod(
        'filter',
    )
    /**
     * Calls a defined callback function on each element of a LiveSelector, and continues with the results.
     *
     * @example ```ts
     * ls.map(x => x.parentElement)```
     */
    map: <NextType>(callbackfn: (element: T) => NextType) => LiveSelector<NonNullable<NextType>> = this.generateMethod(
        'map',
    )
    /**
     * Combines two LiveSelector.
     * @param item Additional LiveSelector to combine.
     *
     * @example ```ts
     * ls.concat(new LiveSelector().querySelector('#root'))```
     */
    concat: <NextType>(newEle: LiveSelector<NextType>) => LiveSelector<T | NextType> = this.generateMethod('concat')
    /**
     * Reverses the elements in an Array.
     *
     * @example ```ts
     * ls.reverse()```
     */
    reverse(): LiveSelector<T> {
        return this.generateMethod('reverse')(undefined)
    }
    /**
     * Returns a section of an array.
     * @param start The beginning of the specified portion of the array.
     * @param end The end of the specified portion of the array.
     *
     * @example ```ts
     * ls.slice(2, 4)```
     */
    slice: (start?: number, end?: number) => LiveSelector<T> = (a, b) => this.generateMethod('slice')([a, b])
    /**
     * Sorts an array.
     * @param compareFn The name of the function used to determine the order of the elements. If omitted, the elements are sorted in ascending, ASCII character order.
     *
     * @example ```ts
     * ls.sort((a, b) => a.innerText.length - b.innerText.length)```
     */
    sort: (compareFn?: (a: T, b: T) => number) => LiveSelector<T> = this.generateMethod('sort')
    /**
     * Flat T[][] to T[]
     *
     * @example ```ts
     * ls.flat()```
     */
    flat(): LiveSelector<T extends ArrayLike<infer U> ? U : never> {
        return this.generateMethod('flat')(undefined)
    }
    /**
     * Select only nth element
     *
     * @example ```ts
     * ls.nth(-1)```
     */
    nth(n: number): LiveSelector<T> {
        return this.generateMethod('nth')(n)
    }
    /**
     * Replace the whole array.
     *
     * @example ```typescript
     * liveselector.replace(x => lodash.dropRight(x, 2))```
     *
     * @param f returns new array.
     */
    replace: <NextType>(f: (arr: T[]) => NextType[]) => LiveSelector<NextType> = this.generateMethod('replace')
    //#endregion

    //#region Build
    /**
     * Evaluate selector expression
     */
    evaluateOnce(): T[] {
        let arr: (T | Element)[] = []
        function isElementArray(x: any[]): x is Element[] {
            // Do a simple check
            return x[0] instanceof Element
        }
        function nonNull<T>(x: T | null | undefined): x is T {
            return x !== null && x !== undefined
        }
        for (const op of this.selectorChain) {
            switch (op.type) {
                case 'getElementById':
                    const e = document.getElementById(op.param)
                    e && arr.push(e)
                    break
                case 'querySelector':
                    if (arr.length === 0) {
                        const e = document.querySelector(op.param)
                        e && arr.push(e)
                    } else if (isElementArray(arr)) arr = arr.map(e => e.querySelector(op.param)).filter(nonNull)
                    else throw new TypeError('Call querySelector on non-Element item!')
                    break
                case 'getElementsByTagName':
                case 'getElementsByClassName':
                case 'querySelectorAll':
                    type F = (x: string) => NodeListOf<Element> | HTMLCollectionOf<Element>
                    if (arr.length === 0) {
                        const e = (document[op.type] as F)(op.param)
                        arr.push(...e)
                    } else if (isElementArray(arr)) {
                        let newArr: Element[] = []
                        for (const e of arr) {
                            newArr = newArr.concat(Array.from((e[op.type] as F)(op.param)))
                        }
                        arr = newArr.filter(nonNull)
                    } else throw new TypeError(`Call ${op.type} on non-Element item!`)
                    break
                case 'closest':
                    console.warn('LiveSelector#closet is a experimental API. Be careful with it')
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
                case 'slice':
                    const [start, end] = op.param
                    arr = arr.slice(start, end)
                    break
                case 'sort':
                    arr = arr.sort(op.param)
                    break
                case 'nth':
                    const x = op.param >= 0 ? op.param : arr.length - op.param
                    arr = [arr[x]]
                    break
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
        return arr.filter(x => x) as T[]
    }
    //#endregion
}
