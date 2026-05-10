import type { Metadata } from 'next'
import { getCategories } from '@/lib/help'
import CategoryCard from '@/components/help/CategoryCard'

export const metadata: Metadata = {
  title: 'Centro de ayuda | ServiceControl',
  description: 'Encuentra respuestas a tus preguntas sobre ServiceControl.',
}

export default function HelpPage() {
  const categories = getCategories()

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0C1F44] mb-2">Centro de ayuda</h1>
        <p className="text-gray-500 text-sm sm:text-base">Todo lo que necesitas saber sobre ServiceControl.</p>
      </div>

      <div className="grid gap-4 sm:gap-6">
        {categories.map(cat => (
          <CategoryCard
            key={cat.slug}
            slug={cat.slug}
            name={cat.name}
            articles={cat.articles.map(a => ({
              slug: a.slug,
              title: a.frontmatter.title,
              description: a.frontmatter.description,
            }))}
          />
        ))}
      </div>
    </div>
  )
}