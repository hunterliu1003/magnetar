import { isFullString } from 'is-what'
import { FirestoreModuleConfig, FirestorePluginOptions } from '../CreatePlugin'
import { isCollectionModule } from '@vue-sync/core'
import { throwIfInvalidFirestorePath } from './throwFns'

export function getFirestoreDocPath (
  [collectionPath, docId]: [string, string],
  firestoreModuleConfig: FirestoreModuleConfig,
  firestorePluginOptions: FirestorePluginOptions
): string {
  let documentPath: string
  // if firestorePath is set on the module level, always return this
  const { firestorePath } = firestoreModuleConfig
  if (isFullString(firestorePath)) {
    documentPath = isCollectionModule(firestorePath)
      ? [firestorePath, docId].join('/')
      : firestorePath
  } else {
    // else, return the modulePath only if this option is enabled in the global firestorePluginOptions
    const { useModulePathsForFirestore } = firestorePluginOptions
    const modulePath = [collectionPath, docId].join('/')
    documentPath = useModulePathsForFirestore ? modulePath : firestorePath
  }
  throwIfInvalidFirestorePath(documentPath, 'doc')
  return documentPath
}
