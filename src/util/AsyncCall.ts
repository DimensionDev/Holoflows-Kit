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

export function AsyncCall<OtherSideImplementedFunctions = {}>(
    implementation: object | undefined,
    options: Partial<AsyncCallOptions> = {},
): MakeAllFunctionsAsync<OtherSideImplementedFunctions> {
    return AsyncCall_(implementation, { messageChannel: new MessageCenter(), ...options })
}

export function AsyncGeneratorCall<OtherSideImplementedFunctions = {}>(
    implementation: object | undefined,
    options: Partial<AsyncCallOptions>,
): MakeAllGeneratorFunctionsAsync<OtherSideImplementedFunctions> {
    return AsyncGeneratorCall_(implementation, { messageChannel: new MessageCenter(), ...options })
}

export { AsyncCallOptions, NoSerialization, JSONSerialization, Serialization }
