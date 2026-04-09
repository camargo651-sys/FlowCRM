/**
 * Trello integration — fetch cards from a Trello board.
 */

export interface TrelloCard {
  id: string
  name: string
  desc: string
  url: string
  idList: string
  idBoard: string
  labels: { id: string; name: string; color: string }[]
  due: string | null
  closed: boolean
  dateLastActivity: string
}

interface TrelloResult {
  success: boolean
  cards?: TrelloCard[]
  error?: string
}

export async function fetchTrelloCards(
  apiKey: string,
  token: string,
  boardId: string,
): Promise<TrelloResult> {
  try {
    const params = new URLSearchParams({
      key: apiKey,
      token,
      fields: 'name,desc,url,idList,idBoard,labels,due,closed,dateLastActivity',
    })

    const res = await fetch(
      `https://api.trello.com/1/boards/${boardId}/cards?${params.toString()}`,
    )

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Trello API ${res.status}: ${text}` }
    }

    const data = await res.json()
    return { success: true, cards: data }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching Trello cards',
    }
  }
}
