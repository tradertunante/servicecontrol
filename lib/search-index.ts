import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const HELP_DIR = path.join(process.cwd(), 'content/help')
export const SEARCH_INDEX_PATH = path.join(process.cwd(), 'public/help/search-index.json')

export interface SearchEntry {
  slug: string
  title: string
  description: string
  category: string
  tags: string[]
  content: string
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/^---[\s\S]*?---\n?/m, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildSearchIndex(): SearchEntry[] {
  if (!fs.existsSync(HELP_DIR)) return []

  const entries: SearchEntry[] = []

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

      entries.push({
        slug,
        title: (data.title as string) ?? '',
        description: (data.description as string) ?? '',
        category: (data.category as string) ?? dir,
        tags: (data.tags as string[]) ?? [],
        content: stripMarkdown(content),
      })
    }
  }

  return entries
}

export function writeSearchIndex(): void {
  const entries = buildSearchIndex()
  const outDir = path.dirname(SEARCH_INDEX_PATH)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(SEARCH_INDEX_PATH, JSON.stringify(entries), 'utf-8')
}