import { useState, useEffect, useCallback, useRef } from 'react'

import { SearchIndex } from '@/services/SearchIndex'
import type { SearchResult, EnrichmentProgress } from '@/services/SearchIndex'

interface UseSearchResult {
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  categoryFilter: string | undefined
  setCategoryFilter: (cat: string | undefined) => void
  indexReady: boolean
  indexBuilding: boolean
  enriching: boolean
  enrichmentProgress: EnrichmentProgress
}

export function useSearch(): UseSearchResult {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [indexReady, setIndexReady] = useState(SearchIndex.isReady)
  const [indexBuilding, setIndexBuilding] = useState(false)
  const [enriching, setEnriching] = useState(SearchIndex.isEnriching)
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress>(
    SearchIndex.enrichmentProgress,
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Build index on mount if not ready
  useEffect(() => {
    if (!SearchIndex.isReady && !SearchIndex.isBuilding) {
      setIndexBuilding(true)
      SearchIndex.build()
        .then(() => {
          setIndexReady(true)
          setIndexBuilding(false)
          setEnriching(SearchIndex.isEnriching)
          setEnrichmentProgress(SearchIndex.enrichmentProgress)
        })
        .catch(() => {
          setIndexBuilding(false)
        })
    } else if (SearchIndex.isReady) {
      setIndexReady(true)
      setEnriching(SearchIndex.isEnriching)
      setEnrichmentProgress(SearchIndex.enrichmentProgress)
    }
  }, [])

  // Poll enrichment progress while running so results can refresh
  useEffect(() => {
    if (!enriching) return
    const interval = setInterval(() => {
      setEnrichmentProgress(SearchIndex.enrichmentProgress)
      if (!SearchIndex.isEnriching) {
        setEnriching(false)
      }
    }, 600)
    return () => clearInterval(interval)
  }, [enriching])

  // Debounced search — re-runs when enrichment makes progress
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim() || !indexReady) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(() => {
      const r = SearchIndex.search(query, categoryFilter)
      setResults(r)
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, categoryFilter, indexReady, enrichmentProgress])

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q)
  }, [])

  const handleSetCategory = useCallback((cat: string | undefined) => {
    setCategoryFilter(cat)
  }, [])

  return {
    query,
    setQuery: handleSetQuery,
    results,
    categoryFilter,
    setCategoryFilter: handleSetCategory,
    indexReady,
    indexBuilding,
    enriching,
    enrichmentProgress,
  }
}
