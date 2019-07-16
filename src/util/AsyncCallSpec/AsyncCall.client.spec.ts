/**
 * This file test AsyncCall as a JSON RPC client
 */
import { AsyncCall } from '../AsyncCall'
import { describe, it } from 'mocha'

interface Server {
    f1(): Promise<void>
}
AsyncCall()
describe('Basic test', () => {
    it('should call', async () => {})
})
