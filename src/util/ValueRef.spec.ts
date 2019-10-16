/**
 * This file test AsyncCall as a JSON RPC client
 */
import { describe, it } from 'mocha'
import assert from 'assert'
import { ValueRef } from './ValueRef'

const symb = 1
const symb2 = 2
describe('ValueRef', () => {
    it('keep the same value', () => {
        const ref = new ValueRef(symb)
        assert(ref.value === symb)
    })
    it('call the listener', done => {
        const ref = new ValueRef(symb)
        ref.addListener((newVal, oldVal) => {
            assert(oldVal === symb)
            assert(newVal === symb2)
            done()
        })
        ref.value = symb2
    })
    it("do nothing when value isn't changed", done => {
        const ref = new ValueRef(symb)
        ref.addListener(() => done('bad call'))
        ref.value = ref.value
        done()
    })
    it('isEqual should work', done => {
        const ref = new ValueRef({ a: 1 }, (a, b) => JSON.stringify(a) === JSON.stringify(b))
        ref.addListener(() => done('bad call'))
        ref.value = { a: 1 }
        done()
    })
    it('remove the listener', done => {
        const ref = new ValueRef(symb)
        const f = () => done('bad call')
        ref.addListener(f)
        ref.removeListener(f)
        ref.value = Math.random()
        done()
    })
    it('remove all the listener', done => {
        const ref = new ValueRef(symb)
        ref.addListener(() => done('bad call'))
        ref.removeAllListener()
        ref.value = Math.random()
        done()
    })
})
