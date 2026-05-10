import { getCategories } from '@/lib/help'
import HelpLayout from '@/components/help/HelpLayout'

export default function HelpRootLayout({ children }: { children: React.ReactNode }) {
  const categories = getCategories()

  const categoryNav = categories.map(cat => ({
    slug: cat.slug,
    name: cat.name,
    articles: cat.articles.map(a => ({
      slug: a.slug,
      title: a.frontmatter.title,
    })),
  }))

  return <HelpLayout categories={categoryNav}>{children}</HelpLayout>
}