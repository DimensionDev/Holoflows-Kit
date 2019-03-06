type RecordType<T extends string, F> = { type: T; param: F }
/**
 * Define all possible recordable operations.
 */
interface SelectorChainType {
    querySelector: RecordType<'querySelector', string>
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
    private generateMethod = <Key extends Keys>(type: Key) => (param: Params[Key]) => {
        this.selectorChain.push({ type: type as any, param: param as any })
        return this as LiveSelector<any>
    }
    private readonly selectorChain: (SelectorChainType[keyof SelectorChainType])[] = []
    //#region Add elements
    /**
     * Select the first element that is a descendant of node that matches selectors.
     *
     * @example ```ts
     * ls.querySelector('div#root')```
     */
    querySelector<K extends keyof HTMLElementTagNameMap>(selectors: K): LiveSelector<HTMLElementTagNameMap[K]>
    querySelector<K extends keyof SVGElementTagNameMap>(selectors: K): LiveSelector<SVGElementTagNameMap[K]>
    querySelector<E extends Element = Element>(selectors: string): LiveSelector<E>
    querySelector<T>(selectors: string): LiveSelector<T> {
        return this.generateMethod('querySelector')(selectors)
    }
    /**
     * Select all element descendants of node that match selectors.
     *
     * @example ```ts
     * ls.querySelector('div > div')```
     */
    querySelectorAll<K extends keyof HTMLElementTagNameMap>(selectors: K): LiveSelector<HTMLElementTagNameMap[K]>
    querySelectorAll<K extends keyof SVGElementTagNameMap>(selectors: K): LiveSelector<SVGElementTagNameMap[K]>
    querySelectorAll<E extends Element = Element>(selectors: string): LiveSelector<E>
    querySelectorAll<T>(selectors: string): LiveSelector<T> {
        return this.generateMethod('querySelectorAll')(selectors)
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
    evaluateOnce() {
        let arr: T[] = []
        for (const op of this.selectorChain) {
            switch (op.type) {
                case 'querySelector':
                    const e = document.querySelector<any>(op.param)
                    e && arr.push(e)
                    break
                case 'querySelectorAll':
                    arr.push(...document.querySelectorAll<any>(op.param))
                    break
                case 'filter':
                    arr = arr.filter(op.param).filter(x => x !== null)
                    break
                case 'map':
                    arr = arr.map(op.param).filter(x => x !== null)
                    break
                case 'concat':
                    arr = arr.concat(op.param.evaluateOnce())
                    break
                case 'reverse':
                    arr = arr.reverse()
                    break
                case 'slice':
                    arr = arr.slice(op.param[0], op.param[1])
                    break
                case 'sort':
                    arr = arr.sort(op.param)
                    break
                case 'nth':
                    const x = op.param >= 0 ? op.param : arr.length - op.param
                    arr = [arr[x]]
                    break
                case 'flat':
                    if (Array.isArray(arr[0])) {
                        const newArr: any[] = []
                        arr.forEach(x => newArr.push(...(x as any)))
                        arr = newArr
                    }
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
