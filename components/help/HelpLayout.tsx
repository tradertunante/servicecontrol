'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SearchBar from './SearchBar'

interface ArticleNav {
  slug: string
  title: string
}

interface CategoryNav {
  slug: string
  name: string
  articles: ArticleNav[]
}

interface Props {
  categories: CategoryNav[]
  children: React.ReactNode
}

function SidebarNav({ categories, pathname, onNavigate }: {
  categories: CategoryNav[]
  pathname: string | null
  onNavigate?: () => void
}) {
  return (
    <>
      <SearchBar />
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
        Categorías
      </p>
      <ul className="space-y-0.5">
        {categories.map(cat => (
          <li key={cat.slug}>
            <Link
              href={`/help#${cat.slug}`}
              onClick={onNavigate}
              className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-700 hover:text-[#0C1F44] hover:bg-gray-50 rounded-lg transition-colors"
            >
              {cat.name}
            </Link>
            {cat.articles.length > 0 && (
              <ul className="mt-0.5 ml-3 space-y-0.5 mb-1">
                {cat.articles.map(article => {
                  const isActive = pathname === `/help/${article.slug}`
                  return (
                    <li key={article.slug}>
                      <Link
                        href={`/help/${article.slug}`}
                        onClick={onNavigate}
                        className={`block px-2 py-1 text-sm rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {article.title}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

export default function HelpLayout({ categories, children }: Props) {
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Link href="/" className="font-semibold text-[#0C1F44] text-sm sm:text-base shrink-0">
            ServiceControl
          </Link>
          <span className="text-gray-300 select-none">/</span>
          <Link href="/help" className="text-sm text-gray-500 hover:text-[#0C1F44] transition-colors truncate">
            Centro de ayuda
          </Link>

          {/* Mobile: toggle categorías */}
          <button
            onClick={() => setMobileNavOpen(v => !v)}
            aria-expanded={mobileNavOpen}
            aria-label="Mostrar categorías"
            className="ml-auto lg:hidden flex items-center gap-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
            Menú
          </button>
        </div>

        {/* Mobile nav drawer (drops below header) */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 pt-4 pb-5 max-h-[70vh] overflow-y-auto shadow-lg">
            <SidebarNav
              categories={categories}
              pathname={pathname}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        )}
      </header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="lg:flex lg:gap-8 lg:items-start">

          {/* Sidebar — desktop only */}
          <aside className="hidden lg:block w-60 shrink-0">
            <nav className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sticky top-20">
              <SidebarNav categories={categories} pathname={pathname} />
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}