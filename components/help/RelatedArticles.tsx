import Link from 'next/link'

interface RelatedArticle {
  slug: string
  title: string
  description: string
}

interface Props {
  articles: RelatedArticle[]
}

export default function RelatedArticles({ articles }: Props) {
  if (articles.length === 0) return null

  return (
    <section className="mt-12 pt-8 border-t border-gray-100">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Artículos relacionados
      </h2>
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
                  <p className="text-xs text-gray-500 mt-0.5">{article.description}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}