import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { CATEGORY_NAMES } from './help-categories'

export { CATEGORY_NAMES }

const HELP_DIR = path.join(process.cwd(), 'content/help')

export interface ArticleFrontmatter {
  title: string
  description: string
  category: string
  order: number
  tags: string[]
  related: string[]
  lastUpdated: string
}

export interface Article {
  slug: string
  frontmatter: ArticleFrontmatter
  content: string
}

export interface Category {
  slug: string
  name: string
  articles: Article[]
}

export function getArticle(slug: string): Article | null {
  if (!fs.existsSync(HELP_DIR)) return null

  const dirs = fs.readdirSync(HELP_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const dir of dirs) {
    const filePath = path.join(HELP_DIR, dir, `${slug}.md`)
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { data, content } = matter(raw)
      return {
        slug,
        frontmatter: data as ArticleFrontmatter,
        content,
      }
    }
  }

  return null
}

export function getAllArticles(): Article[] {
  if (!fs.existsSync(HELP_DIR)) return []

  const articles: Article[] = []

  const dirs = fs.readdirSync(HELP_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const dir of dirs) {
    const dirPath = path.join(HELP_DIR, dir)
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const slug = file.replace(/\.md$/, '')
      const raw = fs.readFileSync(path.join(dirPath, file), 'utf-8')
      const { data, content } = matter(raw)
      articles.push({
        slug,
        frontmatter: data as ArticleFrontmatter,
        content,
      })
    }
  }

  return articles
}

export function getCategories(): Category[] {
  const articles = getAllArticles()

  return Object.entries(CATEGORY_NAMES).map(([slug, name]) => ({
    slug,
    name,
    articles: articles
      .filter(a => a.frontmatter.category === slug)
      .sort((a, b) => a.frontmatter.order - b.frontmatter.order),
  }))
}