import { mapGetOrSet } from 'getorset-anything'
import { isString } from 'is-what'
import { createCollectionWithContext } from './Collection'
import { defaultsGlobalConfig } from './helpers/configHelpers'
import { createDocWithContext } from './Doc'
import { getCollectionPathDocIdEntry } from './helpers/pathHelpers'
import {
  getPathFilterIdentifier,
  PathFilterIdentifier,
  MODULE_IDENTIFIER_SPLIT,
  PathWhereOrderByIdentifier,
  getPathWhereOrderByIdentifier,
} from './helpers/moduleHelpers'
import {
  MagnetarInstance,
  CollectionInstance,
  DocInstance,
  FetchPromises,
  GlobalConfig,
  ModuleConfig,
  WriteLock,
  DocFn,
  CollectionFn,
  FetchMetaData,
} from '@magnetarjs/types'
import { throwIfInvalidModulePath } from './helpers/throwFns'

/** Any of the possible collection paths used so far */
export type CollectionName = string

/**
 * Creates a magnetar instance.
 * @see {@link GlobalConfig}
 * @see {@link MagnetarInstance}
 */
export function Magnetar(magnetarConfig: GlobalConfig): MagnetarInstance {
  /**
   * the passed GlobalConfig is merged onto defaults
   */
  const globalConfig = defaultsGlobalConfig(magnetarConfig)
  /**
   * All collections visited so far, kept to be able to clear all data
   */
  const collectionNames = new Set<string>()
  /**
   * the global storage for WriteLock objects
   * @see {@link WriteLock}
   */
  const writeLockMap: Map<string, WriteLock> = new Map() // apply type upon get/set
  /**
   * the global storage for closeStream functions
   */
  const closeStreamFnMap: Map<PathFilterIdentifier, () => void> = new Map() // apply type upon get/set
  /**
   * the global storage for open stream promises
   */
  const streamingPromiseMap: Map<PathFilterIdentifier, Promise<void> | null> = new Map() // apply type upon get/set
  /**
   * the global storage for fetch promises
   */
  const fetchPromiseMap: Map<PathFilterIdentifier, FetchPromises> = new Map() // apply type upon get/set
  /**
   * the global storage for FetchMetaData
   */
  const fetchMetaMap: Map<PathWhereOrderByIdentifier, FetchMetaData> = new Map()

  /**
   * You can exclude any collection when clearing data
   * @example
   * ```ts
   * magnetar.clearAllData({ exclude: ['users'] })
   * ```
   */
  async function clearAllData(
    /**
     * You can exclude any collection when clearing data
     * @example
     * ```ts
     * magnetar.clearAllData({ exclude: ['users'] })
     * ```
     */
    options?: {
      /**
       * You can exclude any collection when clearing data
       * @example
       * ```ts
       * magnetar.clearAllData({ exclude: ['users'] })
       * ```
       */
      exclude?: CollectionName[]
    }
  ): Promise<void> {
    for (const collectionName of collectionNames) {
      collection(collectionName).data?.clear()
    }
  }

  /** _ to prevent name clash */
  async function _closeAllStreams(): Promise<void> {
    for (const collectionName of collectionNames) {
      collection(collectionName).closeAllStreams()
    }
  }

  function getModuleInstance(
    modulePath: string,
    moduleConfig: ModuleConfig = {},
    moduleType: 'doc' | 'collection',
    docFn: DocFn,
    collectionFn: CollectionFn
  ): CollectionInstance | DocInstance {
    throwIfInvalidModulePath(modulePath, moduleType)

    const [collectionPath, docId] = getCollectionPathDocIdEntry(modulePath)
    collectionNames.add(collectionPath)

    const pathFilterIdentifier = getPathFilterIdentifier(modulePath, moduleConfig)

    // grab (and set) the FetchPromises for this module
    const fetchPromises = mapGetOrSet(
      fetchPromiseMap,
      pathFilterIdentifier,
      (): FetchPromises => new Map()
    )
    // Create the FetchMeta helpers for this module
    const pathWhereOrderByIdentifier = getPathWhereOrderByIdentifier(modulePath, moduleConfig)
    const fetchMeta: { get: () => FetchMetaData; set: (payload: FetchMetaData) => void } = {
      get: () =>
        fetchMetaMap.get(pathWhereOrderByIdentifier) || { reachedEnd: false, cursor: undefined },
      set: (payload: FetchMetaData) => fetchMetaMap.set(pathWhereOrderByIdentifier, payload),
    }

    // grab the stream related functions
    function cacheStream(closeStreamFn: () => void, streamingPromise: Promise<void> | null): void {
      closeStreamFnMap.set(pathFilterIdentifier, closeStreamFn)
      streamingPromiseMap.set(pathFilterIdentifier, streamingPromise)
    }
    function streaming(): Promise<void> | null {
      return streamingPromiseMap.get(pathFilterIdentifier) || null
    }
    function closeStream(): void {
      const closeStreamFn = closeStreamFnMap.get(pathFilterIdentifier)
      if (closeStreamFn) {
        closeStreamFn()
        setTimeout(() => {
          streamingPromiseMap.delete(pathFilterIdentifier)
          closeStreamFnMap.delete(pathFilterIdentifier)
        })
      }
    }
    function closeAllStreams(): void {
      for (const [identifier, closeStreamFn] of closeStreamFnMap) {
        const openStreamPath = identifier.split(MODULE_IDENTIFIER_SPLIT)[0]
        if (openStreamPath === modulePath || openStreamPath.startsWith(modulePath + '/')) {
          closeStreamFn()
        }
      }
    }

    const streamAndFetchPromises = {
      writeLockMap,
      fetchPromises,
      cacheStream,
      streaming,
      closeStream,
      closeAllStreams,
    }

    // then create the module instance
    if (moduleType === 'doc' && isString(docId)) {
      return createDocWithContext(
        [collectionPath, docId],
        moduleConfig,
        globalConfig,
        docFn,
        collectionFn,
        streamAndFetchPromises
      )
    }

    return createCollectionWithContext(
      collectionPath,
      moduleConfig,
      globalConfig,
      docFn,
      collectionFn,
      streamAndFetchPromises,
      fetchMeta
    )
  }

  function collection(modulePath: string, moduleConfig: ModuleConfig = {}): CollectionInstance {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return getModuleInstance(modulePath, moduleConfig, 'collection', doc as DocFn, collection as CollectionFn) as CollectionInstance // prettier-ignore
  }

  function doc(modulePath: string, moduleConfig: ModuleConfig = {}): DocInstance {
    return getModuleInstance(modulePath, moduleConfig, 'doc', doc as DocFn, collection as CollectionFn) as DocInstance // prettier-ignore
  }

  const instance: MagnetarInstance = {
    globalConfig,
    collection: collection as CollectionFn,
    doc: doc as DocFn,
    clearAllData,
    closeAllStreams: _closeAllStreams,
  }
  return instance
}
