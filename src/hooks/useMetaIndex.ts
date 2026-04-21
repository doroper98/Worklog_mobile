import { useState, useEffect, useCallback } from 'react'
import { MetaIndexService } from '@/services/MetaIndexService'
import type { MetaIndexEntry } from '@/services/MetaIndexService'

/** Load meta-index and provide lookup by slateId */
export function useMetaIndex() {
  const [ingestedIds, setIngestedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    return MetaIndexService.getIngestedSlateIds()
      .then(setIngestedIds)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { void load() }, [load])

  return {
    /** Whether a slate has been ingested */
    isIngested: (slateId: string) => ingestedIds.has(slateId),
    loading,
    /** Find meta-index entry by slateId */
    findEntry: (slateId: string) => MetaIndexService.findBySlateId(slateId),
    /** Re-fetch meta-index */
    refresh: load,
  }
}

export type { MetaIndexEntry }
