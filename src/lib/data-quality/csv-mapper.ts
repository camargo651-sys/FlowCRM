/**
 * Smart CSV → entity field mapping.
 * Heuristics combine header synonyms (ES/EN) with content pattern sniffing.
 */

export type FieldKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'company'
  | 'job_title'
  | 'address'
  | 'website'
  | 'notes'
  | 'tags'
  | 'value'
  | 'stage'
  | 'close_date'
  | 'sku'
  | 'price'
  | 'stock'
  | 'ignore'

export type ColumnMapping = Record<number, FieldKey>

const HEADER_SYNONYMS: Record<Exclude<FieldKey, 'ignore'>, string[]> = {
  name: ['name', 'nombre', 'full_name', 'fullname', 'contact', 'contact_name', 'client', 'cliente', 'razon_social'],
  email: ['email', 'e-mail', 'e_mail', 'mail', 'correo', 'correo_electronico', 'email_address'],
  phone: ['phone', 'telefono', 'teléfono', 'tel', 'mobile', 'movil', 'móvil', 'celular', 'cell', 'whatsapp'],
  company: ['company', 'empresa', 'organization', 'organizacion', 'org', 'account', 'cuenta', 'business'],
  job_title: ['job_title', 'title', 'cargo', 'position', 'puesto', 'role'],
  address: ['address', 'direccion', 'dirección', 'street', 'calle', 'domicilio'],
  website: ['website', 'web', 'url', 'site', 'sitio'],
  notes: ['notes', 'notas', 'comments', 'comentarios', 'observaciones', 'description', 'descripcion'],
  tags: ['tags', 'etiquetas', 'labels', 'categories', 'categorias'],
  value: ['value', 'valor', 'amount', 'monto', 'importe', 'total', 'price', 'precio', 'deal_value'],
  stage: ['stage', 'etapa', 'status', 'estado', 'pipeline_stage', 'phase', 'fase'],
  close_date: ['close_date', 'fecha_cierre', 'closing_date', 'expected_close', 'due_date', 'fecha'],
  sku: ['sku', 'codigo', 'código', 'code', 'ref', 'reference', 'referencia'],
  price: ['price', 'precio', 'unit_price', 'precio_unitario', 'cost', 'costo'],
  stock: ['stock', 'quantity', 'cantidad', 'inventario', 'existencias', 'stock_quantity'],
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s\-()]{5,}$/
const URL_RE = /^https?:\/\//i
const DATE_RE = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/
const NUM_RE = /^-?\d+(\.\d+)?$/

function normalize(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[àáâä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[\s\-]+/g, '_')
}

function headerMatch(header: string): FieldKey | null {
  const norm = normalize(header)
  for (const [field, syns] of Object.entries(HEADER_SYNONYMS)) {
    if (syns.some(s => norm === normalize(s) || norm.includes(normalize(s)))) {
      return field as FieldKey
    }
  }
  return null
}

function contentMatch(values: string[]): FieldKey | null {
  const nonEmpty = values.filter(v => v && v.trim())
  if (nonEmpty.length === 0) return null
  const hits = (re: RegExp) => nonEmpty.filter(v => re.test(v.trim())).length / nonEmpty.length

  if (hits(EMAIL_RE) >= 0.6) return 'email'
  if (hits(URL_RE) >= 0.6) return 'website'
  if (hits(DATE_RE) >= 0.6) return 'close_date'
  if (hits(PHONE_RE) >= 0.6 && !nonEmpty.every(v => NUM_RE.test(v.trim()))) return 'phone'
  if (hits(NUM_RE) >= 0.8) return 'value'
  return null
}

/**
 * Given the CSV headers and a handful of sample rows, return a best-guess
 * mapping of column index → field key. Unknown columns are marked 'ignore'.
 */
export function detectColumns(headers: string[], sampleRows: string[][]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const used = new Set<FieldKey>()

  for (let i = 0; i < headers.length; i++) {
    let guess = headerMatch(headers[i])
    if (!guess || used.has(guess)) {
      const column = sampleRows.map(r => r[i] || '')
      const contentGuess = contentMatch(column)
      if (contentGuess && !used.has(contentGuess)) guess = contentGuess
    }
    if (guess && !used.has(guess)) {
      mapping[i] = guess
      used.add(guess)
    } else {
      mapping[i] = 'ignore'
    }
  }

  return mapping
}

/**
 * Apply a mapping to a raw row → normalized object keyed by field name.
 * Numbers are parsed for value/price/stock, tags split on ';' or ','.
 */
export function transformRow(row: string[], mapping: ColumnMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [idxStr, field] of Object.entries(mapping)) {
    if (field === 'ignore') continue
    const idx = Number(idxStr)
    const raw = (row[idx] ?? '').trim()
    if (!raw) continue

    switch (field) {
      case 'value':
      case 'price': {
        const num = parseFloat(raw.replace(/[^0-9.\-]/g, ''))
        if (!Number.isNaN(num)) out[field] = num
        break
      }
      case 'stock': {
        const n = parseInt(raw.replace(/[^0-9\-]/g, ''), 10)
        if (!Number.isNaN(n)) out[field] = n
        break
      }
      case 'tags': {
        out.tags = raw.split(/[;,]/).map(s => s.trim()).filter(Boolean)
        break
      }
      case 'close_date': {
        const d = new Date(raw)
        if (!Number.isNaN(d.getTime())) out.close_date = d.toISOString()
        break
      }
      default:
        out[field] = raw
    }
  }
  return out
}
