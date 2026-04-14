import { NextRequest, NextResponse } from 'next/server'
import { promises as dns } from 'dns'

interface HealthRecords {
  spf?: string
  dkim?: string
  dmarc?: string
}

async function resolveTxtSafe(host: string): Promise<string[][]> {
  try {
    return await dns.resolveTxt(host)
  } catch {
    return []
  }
}

function flatten(records: string[][]): string[] {
  return records.map((r) => r.join(''))
}

export async function POST(req: NextRequest) {
  let domain = ''
  try {
    const body = await req.json()
    domain = String(body?.domain || '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
  }

  // SPF is on the root domain as a TXT starting with v=spf1
  const rootTxt = flatten(await resolveTxtSafe(domain))
  const spfRecord = rootTxt.find((r) => r.toLowerCase().startsWith('v=spf1'))

  // DMARC: TXT at _dmarc.<domain>
  const dmarcTxt = flatten(await resolveTxtSafe(`_dmarc.${domain}`))
  const dmarcRecord = dmarcTxt.find((r) => r.toLowerCase().startsWith('v=dmarc1'))

  // DKIM: try common selectors
  const dkimSelectors = ['default', 'google', 'selector1', 'selector2', 'mail', 'k1', 's1', 's2']
  let dkimRecord: string | undefined
  let dkimSelector: string | undefined
  for (const sel of dkimSelectors) {
    const txt = flatten(await resolveTxtSafe(`${sel}._domainkey.${domain}`))
    const found = txt.find((r) => r.toLowerCase().includes('v=dkim1') || r.toLowerCase().includes('p='))
    if (found) {
      dkimRecord = found
      dkimSelector = sel
      break
    }
  }

  const records: HealthRecords = {
    spf: spfRecord,
    dkim: dkimRecord,
    dmarc: dmarcRecord,
  }

  return NextResponse.json({
    domain,
    spf: Boolean(spfRecord),
    dkim: Boolean(dkimRecord),
    dmarc: Boolean(dmarcRecord),
    dkimSelector,
    records,
  })
}
