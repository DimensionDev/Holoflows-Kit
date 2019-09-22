import { MessageCenter } from '../Extension/MessageCenter'
import {
    AsyncCall as AsyncCall_,
    AsyncCallOptions,
    AsyncGeneratorCall as AsyncGeneratorCall_,
    NoSerialization,
    Serialization,
    JSONSerialization,
    MakeAllFunctionsAsync,
    MakeAllGeneratorFunctionsAsync,
} from 'async-call-rpc'

/**
 * @deprecated use the async-call-rpc package. will remove in 0.7.0
 */
export function AsyncCall<OtherSideImplementedFunctions = {}>(
    implementation: object | undefined,
    options: Partial<AsyncCallOptions> = {},
): MakeAllFunctionsAsync<OtherSideImplementedFunctions> {
    return AsyncCall_(implementation, { messageChannel: new MessageCenter(), ...options })
}

/**
 * @deprecated use the async-call-rpc package. will remove in 0.7.0
 */
export function AsyncGeneratorCall<OtherSideImplementedFunctions = {}>(
    implementation: object | undefined,
    options: Partial<AsyncCallOptions>,
): MakeAllGeneratorFunctionsAsync<OtherSideImplementedFunctions> {
    return AsyncGeneratorCall_(implementation, { messageChannel: new MessageCenter(), ...options })
}
/** @deprecated use the async-call-rpc package. will remove in 0.7.0 */
export { AsyncCallOptions, NoSerialization, JSONSerialization, Serialization }
