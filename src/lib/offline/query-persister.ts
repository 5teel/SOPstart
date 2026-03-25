import { experimental_createQueryPersister } from '@tanstack/query-persist-client-core'
import { createStore, get, set, del } from 'idb-keyval'

const idbStore = createStore('tanstack-query', 'query-cache')

const _persister = experimental_createQueryPersister({
  storage: {
    getItem: (key: string) => get(key, idbStore),
    setItem: (key: string, value: string) => set(key, value, idbStore),
    removeItem: (key: string) => del(key, idbStore),
  },
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
})

// queryPersister.persisterFn is the QueryPersister function expected by useQuery's persister option
export const queryPersister = _persister.persisterFn
