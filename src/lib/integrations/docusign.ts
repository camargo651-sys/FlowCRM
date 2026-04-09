/**
 * DocuSign integration — create envelopes for e-signature.
 */

interface DocuSignDocument {
  name: string
  base64: string
}

interface DocuSignResult {
  success: boolean
  envelope_id?: string
  signing_url?: string
  error?: string
}

export async function createEnvelope(
  accessToken: string,
  accountId: string,
  document: DocuSignDocument,
  signerEmail: string,
  signerName: string,
): Promise<DocuSignResult> {
  try {
    const envelopeBody = {
      emailSubject: `Please sign: ${document.name}`,
      documents: [
        {
          documentBase64: document.base64,
          name: document.name,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: signerEmail,
            name: signerName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [
                { documentId: '1', pageNumber: '1', xPosition: '200', yPosition: '600' },
              ],
            },
          },
        ],
      },
      status: 'sent',
    }

    const res = await fetch(
      `https://demo.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelopeBody),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `DocuSign API ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      success: true,
      envelope_id: data.envelopeId,
      signing_url: data.uri,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error creating DocuSign envelope',
    }
  }
}
