import type firebase from 'firebase'
import { PluginInstance, MagnetarPlugin, WhereClause, OrderByClause, Limit } from '@magnetarjs/core'
import { insertActionFactory } from './actions/insert'
import { writeActionFactory } from './actions/mergeAssignReplace'
import { deletePropActionFactory } from './actions/deleteProp'
import { deleteActionFactory } from './actions/delete'
import { getActionFactory } from './actions/get'
import { streamActionFactory } from './actions/stream'
import { revertActionFactory } from './actions/revert'
import { batchSyncFactory } from './helpers/batchSync'

type Firestore = firebase.firestore.Firestore

// there are two interfaces to be defined & exported by each plugin: `StoreOptions` and `StoreModuleConfig`
// for this plugin we use:
// - FirestorePluginOptions
// - FirestoreModuleConfig

export interface FirestorePluginOptions {
  /**
   * This is required to make sure there are not two instances of Firestore running which can cause issues.
   */
  firestoreInstance: Firestore
  /**
   * When this is true, the "modulePath" will be used as firestorePath to sync the data to. Eg. `collection('todos')` will sync data to `todos` on firestore. When this is false (default) the firestorePath must be provided like so: `collection('todos', { firestorePath: 'myTodos' })`
   */
  useModulePathsForFirestore?: boolean
  /**
   * Defaults to 1000ms. The amount of milliseconds before an action is synced to Firestore. Every time a consecutive action is triggered the debounce will reset.
   */
  syncDebounceMs?: number
  /**
   * Logs extra information in the developer console every time it interacts with the server.
   *
   * Be sure to disable this on production!
   */
  debug?: boolean
}
export interface FirestoreModuleConfig {
  firestorePath?: string
  where?: WhereClause[]
  orderBy?: OrderByClause[]
  limit?: Limit
}

function firestorePluginOptionsWithDefaults(
  firestorePluginOptions: FirestorePluginOptions
): Required<FirestorePluginOptions> {
  return {
    syncDebounceMs: 1000,
    useModulePathsForFirestore: false,
    debug: false,
    ...firestorePluginOptions,
  }
}

// a Vue Sync plugin is a single function that returns a `PluginInstance`
// the plugin implements the logic for all actions that a can be called from a Vue Sync module instance
// each action must have the proper for both collection and doc type modules
export const CreatePlugin: MagnetarPlugin<FirestorePluginOptions> = (
  firestorePluginOptions: FirestorePluginOptions
): PluginInstance => {
  const pluginOptions = firestorePluginOptionsWithDefaults(firestorePluginOptions)

  const batchSync = batchSyncFactory(pluginOptions)

  // the plugin must try to implement logic for every `ActionName`
  const get = getActionFactory(pluginOptions)
  const stream = streamActionFactory(pluginOptions)
  const insert = insertActionFactory(batchSync, pluginOptions)
  const _merge = writeActionFactory(batchSync, pluginOptions, 'merge')
  const assign = writeActionFactory(batchSync, pluginOptions, 'assign')
  const replace = writeActionFactory(batchSync, pluginOptions, 'replace')
  const deleteProp = deletePropActionFactory(batchSync, pluginOptions)
  const _delete = deleteActionFactory(batchSync, pluginOptions)

  const actions = {
    get,
    stream,
    insert,
    merge: _merge,
    assign,
    replace,
    deleteProp,
    delete: _delete,
  }
  const revert = revertActionFactory(actions, pluginOptions)

  // the plugin function must return a `PluginInstance`
  const instance: PluginInstance = {
    revert,
    actions,
  }
  return instance
}
