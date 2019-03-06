type ChainType<T extends string, F> = { type: T; param: F }
interface SelectorChainType {
    querySelector: ChainType<'querySelector', string>
    querySelectorAll: ChainType<'querySelectorAll', string>
    filter: ChainType<'filter', (element: any, index: number, array: any[]) => boolean>
    map: ChainType<'map', (element: any) => any>
    concat: ChainType<'concat', LiveSelector<any>>
    reverse: ChainType<'reverse', undefined>
    slice: ChainType<'slice', [number | undefined, number | undefined]>
    sort: ChainType<'sort', (a: any, b: any) => number>
    flat: ChainType<'flat', undefined>
    first: ChainType<'first', undefined>
    last: ChainType<'last', undefined>
}
type TypeKeys = SelectorChainType[keyof SelectorChainType]['type']
type TypeParams = { [key in keyof SelectorChainType]: SelectorChainType[key]['param'] }
/** Create a live selector that can continuously select the element you want */
export class LiveSelector<T> {
    private generateMethod = <Key extends TypeKeys>(type: Key) => (param: TypeParams[Key]) => {
        this.selectorChain.push({ type: type as any, param: param as any })
        return this as LiveSelector<any>
    }
    private readonly selectorChain: (SelectorChainType[keyof SelectorChainType])[] = []
    //#region Add elements
    /**
     * Select the first element that is a descendant of node that matches selectors.
     */
    querySelector<K extends keyof HTMLElementTagNameMap>(selectors: K): LiveSelector<HTMLElementTagNameMap[K]>
    querySelector<K extends keyof SVGElementTagNameMap>(selectors: K): LiveSelector<SVGElementTagNameMap[K]>
    querySelector<E extends Element = Element>(selectors: string): LiveSelector<E>
    querySelector<T>(selectors: string): LiveSelector<T> {
        return this.generateMethod('querySelector')(selectors)
    }
    /**
     * Select all element descendants of node that match selectors.
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
     */
    filter: //
    (<S extends T = T>(callbackfn: (value: T, index: number, array: T[]) => value is S) => LiveSelector<S>) &
        ((
            callbackfn: (value: T, index: number, array: T[]) => any,
        ) => LiveSelector<NonNullable<T>>) = this.generateMethod('filter')
    /**
     * Calls a defined callback function on each element of a LiveSelector, and continues with the results.
     */
    map: <NextType>(callbackfn: (element: T) => NextType) => LiveSelector<NonNullable<NextType>> = this.generateMethod(
        'map',
    )
    /**
     * Combines two LiveSelector.
     * @param item Additional LiveSelector to combine.
     */
    concat: <NextType>(newEle: LiveSelector<NextType>) => LiveSelector<T | NextType> = this.generateMethod('concat')
    /**
     * Reverses the elements in an Array.
     */
    reverse(): LiveSelector<T> {
        return this.generateMethod('reverse')(undefined)
    }
    /**
     * Returns a section of an array.
     * @param start The beginning of the specified portion of the array.
     * @param end The end of the specified portion of the array.
     */
    slice: (start?: number, end?: number) => LiveSelector<T> = (a, b) => this.generateMethod('slice')([a, b])
    /**
     * Sorts an array.
     * @param compareFn The name of the function used to determine the order of the elements. If omitted, the elements are sorted in ascending, ASCII character order.
     */
    sort: (compareFn?: (a: T, b: T) => number) => LiveSelector<T> = this.generateMethod('sort')
    /**
     * Flat T[][] to T[]
     */
    flat(): LiveSelector<T extends ArrayLike<infer U> ? U : never> {
        return this.generateMethod('flat')(undefined)
    }
    first(): LiveSelector<T> {
        return this.generateMethod('first')(undefined)
    }
    last(): LiveSelector<T> {
        return this.generateMethod('last')(undefined)
    }
    //#endregion

    //#region Build
    evaluateOnce() {
        let arr: T[] = []
        for (const op of this.selectorChain) {
            switch (op.type) {
                case 'querySelector':
                    const e = document.querySelector(op.param) as any
                    e && arr.push(e)
                    break
                case 'querySelectorAll':
                    arr.push(...(document.querySelectorAll(op.param) as any))
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
                case 'first':
                    arr = [arr[0]]
                    break
                case 'last':
                    arr = [arr[arr.length - 1]]
                    break
                case 'flat':
                    const newArr: any[] = []
                    arr.forEach(x => newArr.push(...(x as any)))
                    arr = newArr
                    break
                default:
                    throw new TypeError('Unknown operation type')
            }
        }
        return arr.filter(x => x) as T[]
    }
    //#endregion
}
