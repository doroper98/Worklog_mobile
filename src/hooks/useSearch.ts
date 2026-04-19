import { useState, useEffect, useCallback, useRef } from 'react'

import { SearchIndex } from '@/services/SearchIndex'
import type { SearchResult } from '@/services/SearchIndex'

interface UseSearchResult {
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  categoryFilter: string | undefined
  setCategoryFilter: (cat: string | undefined) => void
  indexReady: boolean
  indexBuilding: boolean
}

export function useSearch(): UseSearchResult {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [indexReady, setIndexReady] = useState(SearchIndex.isReady)
  const [indexBuilding, setIndexBuilding] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Build index on mount if not ready
  useEffect(() => {
    if (!SearchIndex.isReady && !SearchIndex.isBuilding) {
      setIndexBuilding(true)
      SearchIndex.build()
        .then(() => {
          setIndexReady(true)
          setIndexBuilding(false)
        })
        .catch(() => {
          setIndexBuilding(false)
        })
    } else if (SearchIndex.isReady) {
      setIndexReady(true)
    }
  }, [])

  // Debounced search
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
  }, [query, categoryFilter, indexReady])

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
  }
}
