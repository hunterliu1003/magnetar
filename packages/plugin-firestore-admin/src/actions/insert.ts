import { mapGetOrSet } from 'getorset-anything'
import { PluginInsertAction, PluginInsertActionPayload, SyncBatch } from '@magnetarjs/types'
import { isFullString, isNumber } from 'is-what'
import {
  FirestoreModuleConfig,
  getFirestoreDocPath,
  batchSyncFactory,
  BatchSync,
} from '@magnetarjs/utils-firestore'
import { BatchSyncMap, FirestoreAdminPluginOptions } from '../CreatePlugin'
import { createWriteBatch, applySyncBatch } from '../helpers/batchHelpers'

export function insertActionFactory(
  batchSyncMap: BatchSyncMap,
  firestorePluginOptions: Required<FirestoreAdminPluginOptions>
): PluginInsertAction {
  return async function ({
    payload,
    collectionPath,
    docId,
    actionConfig,
    pluginModuleConfig,
  }: PluginInsertActionPayload<FirestoreModuleConfig>): Promise<[string, SyncBatch]> {
    const { db } = firestorePluginOptions
    let _docId = docId
    if (!_docId) {
      // we don't have a _docId, so we need to retrieve it from the payload or generate one
      _docId = isFullString(payload.id)
        ? payload.id
        : isNumber(payload.id)
        ? `${payload.id}`
        : db.collection('random').doc().id
    }
    const documentPath = getFirestoreDocPath(collectionPath, _docId as string, pluginModuleConfig, firestorePluginOptions) // prettier-ignore
    const syncDebounceMs = isNumber(actionConfig.syncDebounceMs)
      ? actionConfig.syncDebounceMs
      : pluginModuleConfig.syncDebounceMs

    const batchSync = mapGetOrSet(
      batchSyncMap,
      collectionPath,
      (): BatchSync => batchSyncFactory(firestorePluginOptions, createWriteBatch, applySyncBatch)
    )

    const result = await batchSync.insert(documentPath, payload, syncDebounceMs)
    return [_docId as string, result]
  }
}
