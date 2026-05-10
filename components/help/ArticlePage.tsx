import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import Breadcrumb from './Breadcrumb'
import RelatedArticles from './RelatedArticles'

interface RelatedArticleInfo {
  slug: string
  title: string
  description: string
}

interface Props {
  title: string
  description: string
  category: string
  categoryName: string
  lastUpdated: string
  tags: string[]
  content: string
  relatedArticles: RelatedArticleInfo[]
}

export default function ArticlePage({
  title,
  description,
  category,
  categoryName,
  lastUpdated,
  tags,
  content,
  relatedArticles,
}: Props) {
  return (
    <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
      <Breadcrumb
        items={[
          { label: categoryName, href: `/help#${category}` },
          { label: title },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#0C1F44] mb-3">{title}</h1>
        <p className="text-gray-500 text-base leading-relaxed">{description}</p>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className="text-xs text-gray-400">Actualizado: {lastUpdated}</span>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="help-content">
        <MDXRemote source={content} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
      </div>

      <RelatedArticles articles={relatedArticles} />
    </article>
  )
}