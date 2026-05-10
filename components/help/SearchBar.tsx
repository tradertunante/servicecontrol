'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'
import { CATEGORY_NAMES } from '@/lib/help-categories'
import type { SearchEntry } from '@/lib/search-index'

let indexCache: SearchEntry[] | null = null

async function loadIndex(): Promise<SearchEntry[]> {
  if (indexCache) return indexCache
  const res = await fetch('/help/search-index.json')
  if (!res.ok) return []
  indexCache = (await res.json()) as SearchEntry[]
  return indexCache
}

function buildFuse(data: SearchEntry[]) {
  return new Fuse(data, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'description', weight: 2 },
      { name: 'tags', weight: 2 },
      { name: 'content', weight: 1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
  })
}

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchEntry[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fuseRef = useRef<Fuse<SearchEntry> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    const data = await loadIndex()
    if (!fuseRef.current) fuseRef.current = buildFuse(data)
    const hits = fuseRef.current.search(q, { limit: 6 }).map(r => r.item)
    setResults(hits)
    setOpen(hits.length > 0)
    setActiveIndex(-1)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      setResults([])
      setOpen(false)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      navigate(results[activeIndex].slug)
    } else if (e.key === 'Enter' && query.trim()) {
      e.preventDefault()
      router.push(`/help/search?q=${encodeURIComponent(query.trim())}`)
      close()
    }
  }

  const navigate = (slug: string) => {
    router.push(`/help/${slug}`)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const close = () => {
    setOpen(false)
    setActiveIndex(-1)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapperRef} className="relative mb-4">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar..."
          aria-label="Buscar en el centro de ayuda"
          className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg placeholder-gray-400 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
        />
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          {results.map((entry, i) => (
            <li
              key={entry.slug}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => navigate(entry.slug)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex flex-col px-3 py-2.5 cursor-pointer transition-colors ${
                i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-sm font-medium text-gray-800 truncate">
                {entry.title}
              </span>
              <span className="text-xs text-gray-400 mt-0.5">
                {CATEGORY_NAMES[entry.category] ?? entry.category}
              </span>
            </li>
          ))}
          {query.trim() && (
            <li
              onMouseDown={() => {
                router.push(`/help/search?q=${encodeURIComponent(query.trim())}`)
                close()
              }}
              className="px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 cursor-pointer border-t border-gray-100 transition-colors"
            >
              Ver todos los resultados para &ldquo;{query}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  )
}