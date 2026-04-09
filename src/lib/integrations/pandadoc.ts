/**
 * PandaDoc integration — create documents for e-signature.
 */

interface PandaDocRecipient {
  email: string
  name: string
}

interface PandaDocResult {
  success: boolean
  id?: string
  status?: string
  error?: string
}

export async function createDocument(
  apiKey: string,
  name: string,
  recipients: PandaDocRecipient[],
): Promise<PandaDocResult> {
  try {
    const res = await fetch('https://api.pandadoc.com/public/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        recipients: recipients.map((r, i) => ({
          email: r.email,
          first_name: r.name.split(' ')[0] || r.name,
          last_name: r.name.split(' ').slice(1).join(' ') || '',
          role: i === 0 ? 'signer' : 'signer',
        })),
        parse_form_fields: false,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `PandaDoc API ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      success: true,
      id: data.id,
      status: data.status,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error creating PandaDoc document',
    }
  }
}
