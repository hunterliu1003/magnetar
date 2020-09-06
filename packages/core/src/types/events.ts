import { O } from 'ts-toolbelt'
import { ActionName } from './actions'
import {} from './atoms'
import { GetResponse, StreamResponse, DoOnStream, DoOnGet } from './plugins'

// events
export type EventName = 'before' | 'success' | 'error' | 'revert'

type EventSharedPayload = {
  /**
   * write actions: Record<string, any> | Record<string, any>[]
   * delete actions: Record<string, any> | Record<string, any>[] | string | string[]
   * read actions: Record<string, any> | void
   */
  payload: Record<string, any> | Record<string, any>[] | void | string | string[]
  actionName: ActionName
  storeName: string
  /**
   * stream actions: void // streams cannot be aborted in an event
   * others: () => void
   */
  abort: () => void
}

type EventPayloadPropResult = {
  result: void | string | GetResponse | DoOnGet | StreamResponse | DoOnStream
}

export type EventFnBefore = (args: EventSharedPayload) => void | Promise<void>

export type EventFnSuccess = (
  args: O.Merge<EventSharedPayload, EventPayloadPropResult>
) => void | Promise<void>

export type EventFnError = (
  args: O.Merge<EventSharedPayload, { error: any }>
) => void | Promise<void>

export type EventFnRevert = (
  args: O.Merge<O.Omit<EventSharedPayload, 'abort'>, EventPayloadPropResult>
) => void | Promise<void>

export type EventFn = EventFnBefore | EventFnSuccess | EventFnError | EventFnRevert

export type EventNameFnMap = {
  before?: EventFnBefore
  success?: EventFnSuccess
  error?: EventFnError
  revert?: EventFnRevert
}

export type EventNameFnsMap = {
  before: EventFnBefore[]
  success: EventFnSuccess[]
  error: EventFnError[]
  revert: EventFnRevert[]
}

export function getEventNameFnsMap(...onMaps: (EventNameFnMap | void)[]): EventNameFnsMap {
  const _onMaps = onMaps.filter(Boolean) as EventNameFnMap[]
  const result: EventNameFnsMap = {
    before: _onMaps.flatMap((on) => on.before ?? []),
    success: _onMaps.flatMap((on) => on.success ?? []),
    error: _onMaps.flatMap((on) => on.error ?? []),
    revert: _onMaps.flatMap((on) => on.revert ?? []),
  }
  return result
}
