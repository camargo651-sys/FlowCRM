/**
 * Replace all {{variable}} placeholders in a template string with values from data.
 * Any remaining unmatched variables are replaced with an em-dash.
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
  let html = template
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  // Replace any remaining variables with dash
  html = html.replace(/\{\{\w+\}\}/g, '\u2014')
  return html
}
