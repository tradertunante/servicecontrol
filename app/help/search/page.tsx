import Link from 'next/link'
import Fuse from 'fuse.js'
import type { Metadata } from 'next'
import { buildSearchIndex } from '@/lib/search-index'
import { CATEGORY_NAMES } from '@/lib/help'
import Breadcrumb from '@/components/help/Breadcrumb'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? ''
  return {
    title: q
      ? `"${q}" — Búsqueda | Centro de ayuda | ServiceControl`
      : 'Búsqueda | Centro de ayuda | ServiceControl',
  }
}

export default async function SearchPage(props: Props) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? '').trim()

  const entries = buildSearchIndex()

  let results = entries
  if (q) {
    const fuse = new Fuse(entries, {
      keys: [
        { name: 'title', weight: 3 },
        { name: 'description', weight: 2 },
        { name: 'tags', weight: 2 },
        { name: 'content', weight: 1 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    })
    results = fuse.search(q).map(r => r.item)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-8">
      <Breadcrumb items={[{ label: q ? `Resultados para "${q}"` : 'Búsqueda' }]} />

      <h1 className="text-2xl font-bold text-[#0C1F44] mb-1">
        {q ? `Resultados para "${q}"` : 'Búsqueda'}
      </h1>
      <p className="text-sm text-gray-400 mb-8">
        {results.length} {results.length === 1 ? 'artículo encontrado' : 'artículos encontrados'}
      </p>

      {results.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 font-medium mb-2">
            No encontramos resultados para &ldquo;{q}&rdquo;
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Prueba con otras palabras o explora las categorías disponibles.
          </p>
          <Link
            href="/help"
            className="inline-block text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Ver todas las categorías
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {results.map(entry => (
            <li key={entry.slug}>
              <Link
                href={`/help/${entry.slug}`}
                className="group block p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {CATEGORY_NAMES[entry.category] ?? entry.category}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors mb-1">
                  {entry.title}
                </p>
                {entry.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{entry.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}