/**
 * Notion integration — query databases via Notion API.
 */

interface NotionPage {
  id: string
  properties: Record<string, unknown>
  url: string
  created_time: string
  last_edited_time: string
}

interface NotionResult {
  success: boolean
  pages?: NotionPage[]
  has_more?: boolean
  next_cursor?: string | null
  error?: string
}

export async function queryNotionDatabase(
  apiKey: string,
  databaseId: string,
  startCursor?: string,
): Promise<NotionResult> {
  try {
    const body: Record<string, unknown> = { page_size: 100 }
    if (startCursor) {
      body.start_cursor = startCursor
    }

    const res = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Notion API ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      success: true,
      pages: data.results,
      has_more: data.has_more,
      next_cursor: data.next_cursor,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error querying Notion database',
    }
  }
}
