import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllArticles, getArticle, CATEGORY_NAMES } from '@/lib/help'
import ArticlePage from '@/components/help/ArticlePage'

interface Props {
  params: { slug: string }
}

export function generateStaticParams() {
  const articles = getAllArticles()
  return articles.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticle(params.slug)
  if (!article) return {}
  return {
    title: `${article.frontmatter.title} | Centro de ayuda | ServiceControl`,
    description: article.frontmatter.description,
  }
}

export default function ArticleRoute({ params }: Props) {
  const article = getArticle(params.slug)
  if (!article) notFound()

  const allArticles = getAllArticles()

  const relatedArticles = (article.frontmatter.related ?? [])
    .map(slug => allArticles.find(a => a.slug === slug))
    .filter((a): a is NonNullable<typeof a> => a != null)
    .map(a => ({
      slug: a.slug,
      title: a.frontmatter.title,
      description: a.frontmatter.description,
    }))

  const categoryName =
    CATEGORY_NAMES[article.frontmatter.category] ?? article.frontmatter.category

  return (
    <ArticlePage
      title={article.frontmatter.title}
      description={article.frontmatter.description}
      category={article.frontmatter.category}
      categoryName={categoryName}
      lastUpdated={article.frontmatter.lastUpdated}
      tags={article.frontmatter.tags ?? []}
      content={article.content}
      relatedArticles={relatedArticles}
    />
  )
}