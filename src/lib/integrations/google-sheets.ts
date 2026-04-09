interface SheetConfig {
  spreadsheetId: string
  sheetName: string
  accessToken: string
}

interface SyncResult {
  success: boolean
  updatedRows?: number
  error?: string
}

export async function syncToSheet(
  config: SheetConfig,
  rows: Record<string, string>[],
): Promise<SyncResult> {
  if (rows.length === 0) {
    return { success: true, updatedRows: 0 }
  }

  // Build values array: first row is headers, then data
  const headers = Object.keys(rows[0])
  const values = rows.map(row => headers.map(h => row[h] ?? ''))

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(config.sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: config.sheetName,
        majorDimension: 'ROWS',
        values,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return { success: false, error: `Google Sheets API error ${response.status}: ${err}` }
    }

    const result = await response.json()
    return {
      success: true,
      updatedRows: result.updates?.updatedRows ?? rows.length,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error calling Google Sheets API',
    }
  }
}
