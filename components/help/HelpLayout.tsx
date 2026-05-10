'use client'

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

export default function HelpLayout({ categories, children }: Props) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Link href="/" className="font-semibold text-[#0C1F44] text-base">
            ServiceControl
          </Link>
          <span className="text-gray-300 select-none">/</span>
          <Link href="/help" className="text-sm text-gray-500 hover:text-[#0C1F44] transition-colors">
            Centro de ayuda
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8 items-start">
          <aside className="w-60 shrink-0">
            <nav className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sticky top-8">
              <SearchBar />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                Categorías
              </p>
              <ul className="space-y-0.5">
                {categories.map(cat => (
                  <li key={cat.slug}>
                    <Link
                      href={`/help#${cat.slug}`}
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
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}