import { ValueRef } from '../ValueRef'

const symb = Symbol()
const symb2 = Symbol()
test('keep the same value', () => {
    const ref = new ValueRef(symb)
    expect(ref.value).toBe(symb)
})
test('call the listener', done => {
    const ref = new ValueRef<any>(symb)
    ref.addListener((newVal, oldVal) => {
        expect(oldVal).toBe(symb)
        expect(newVal).toBe(symb2)
        done()
    })
    ref.value = symb2
})
test("do nothing when value isn't changed", done => {
    const ref = new ValueRef<any>(symb)
    ref.addListener(() => {
        done.fail()
    })
    ref.value = symb
    done()
})
test('isEqual should work', done => {
    const ref = new ValueRef({ a: 1 }, (a, b) => JSON.stringify(a) === JSON.stringify(b))
    ref.addListener(() => done.fail())
    ref.value = { a: 1 }
    done()
})
test('remove the listener', done => {
    const ref = new ValueRef<any>(symb)
    const f = () => done.fail()
    ref.addListener(f)
    ref.removeListener(f)
    ref.value = symb2
    done()
})
test('remove all the listener', done => {
    const ref = new ValueRef<any>(symb)
    ref.addListener(() => done.fail())
    ref.removeAllListener()
    ref.value = Math.random()
    done()
})
