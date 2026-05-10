import { cookies } from 'next/headers'
import { getCategories } from '@/lib/help'
import HelpLayout from '@/components/help/HelpLayout'

export default async function HelpRootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const isAuthenticated = !!cookieStore.get('sc-access-token')?.value

  const categories = getCategories()
  const categoryNav = categories.map(cat => ({
    slug: cat.slug,
    name: cat.name,
    articles: cat.articles.map(a => ({
      slug: a.slug,
      title: a.frontmatter.title,
    })),
  }))

  return (
    <HelpLayout
      categories={categoryNav}
      backUrl={isAuthenticated ? '/home' : '/'}
    >
      {children}
    </HelpLayout>
  )
}