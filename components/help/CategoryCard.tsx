import Link from 'next/link'

interface ArticleNav {
  slug: string
  title: string
  description: string
}

interface Props {
  slug: string
  name: string
  articles: ArticleNav[]
}

const CATEGORY_COLORS: Record<string, string> = {
  'primeros-pasos': 'bg-emerald-500',
  'auditorias': 'bg-blue-500',
  'analytics': 'bg-violet-500',
  'usuarios': 'bg-amber-500',
  'mejores-practicas': 'bg-rose-500',
}

export default function CategoryCard({ slug, name, articles }: Props) {
  const dotColor = CATEGORY_COLORS[slug] ?? 'bg-gray-400'

  return (
    <div id={slug} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
        <h2 className="text-base font-semibold text-[#0C1F44]">{name}</h2>
        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {articles.length} {articles.length === 1 ? 'artículo' : 'artículos'}
        </span>
      </div>

      {articles.length === 0 ? (
        <p className="text-sm text-gray-400">Próximamente</p>
      ) : (
        <ul className="space-y-3">
          {articles.map(article => (
            <li key={article.slug}>
              <Link href={`/help/${article.slug}`} className="group flex items-start gap-2">
                <span className="mt-0.5 text-gray-300 group-hover:text-blue-500 transition-colors text-sm leading-5">
                  →
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                    {article.title}
                  </p>
                  {article.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {article.description}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}