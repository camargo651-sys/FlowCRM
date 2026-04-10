/**
 * Tracktio Brand Icons — custom SVG icon set
 * Consistent 24x24 viewBox, 1.5px stroke, rounded caps
 * Usage: <TracktioIcons.Sales className="w-5 h-5" />
 */

interface IconProps {
  className?: string
  size?: number
}

const defaultProps = { size: 24 }

function Icon({ children, className, size = 24 }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

/** Home — house with signal waves */
function Home(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2" />
    </Icon>
  )
}

/** Sales — rising chart with handshake */
function Sales(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <path d="M3 17l4-4 4 4 4-8 6 6" />
      <circle cx="7" cy="13" r="1.5" fill="currentColor" stroke="none" opacity={0.3} />
      <circle cx="11" cy="17" r="1.5" fill="currentColor" stroke="none" opacity={0.3} />
      <circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none" opacity={0.3} />
      <circle cx="21" cy="15" r="1.5" fill="currentColor" stroke="none" opacity={0.3} />
      <path d="M21 7v4h-4" />
    </Icon>
  )
}

/** Finance — bill/receipt with lines */
function Finance(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <path d="M9 5H7a2 2 0 00-2 2v12l3-2 3 2 3-2 3 2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6m-6 3h4" />
    </Icon>
  )
}

/** Operations — boxes/warehouse */
function Operations(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </Icon>
  )
}

/** People — team/group */
function People(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <circle cx="12" cy="7" r="3" />
      <path d="M5.5 21a6.5 6.5 0 0113 0" />
      <circle cx="19" cy="9" r="2" />
      <path d="M22 21a4 4 0 00-5-3.9" />
      <circle cx="5" cy="9" r="2" />
      <path d="M2 21a4 4 0 015-3.9" />
    </Icon>
  )
}

/** Support — headset/help */
function Support(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <path d="M18 16v-5a6 6 0 00-12 0v5" />
      <path d="M4 15v1a2 2 0 002 2h1m10-3v3a2 2 0 01-2 2h-4a2 2 0 01-2-2v0" />
      <rect x="2" y="13" width="4" height="5" rx="1" />
      <rect x="18" y="13" width="4" height="5" rx="1" />
    </Icon>
  )
}

/** WhatsApp — chat bubble with phone */
function WhatsApp(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      <path d="M9.5 10.5c.3.6.8 1.2 1.4 1.7.6.5 1.3.9 2 1.2l.8-.8a.5.5 0 01.5-.1l1.8.7a.5.5 0 01.3.5v1.5a.5.5 0 01-.5.5A8 8 0 017.8 8a.5.5 0 01.5-.5H9.8a.5.5 0 01.5.3l.7 1.8a.5.5 0 01-.1.5l-.8.8z" fill="currentColor" stroke="none" opacity={0.15} />
    </Icon>
  )
}

/** Analytics — bar chart with lens */
function Analytics(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="17" y="4" width="4" height="17" rx="1" />
      <circle cx="19" cy="4" r="2.5" fill="currentColor" stroke="none" opacity={0.2} />
    </Icon>
  )
}

/** Settings — gear */
function Settings(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </Icon>
  )
}

/** Add/Plus — circle with plus */
function Add(props: IconProps) {
  return (
    <Icon {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="9" strokeDasharray="2 2" />
      <path d="M12 8v8m-4-4h8" />
    </Icon>
  )
}

/** Logo — Tracktio bolt mark */
function Logo(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 24} height={props.size || 24} className={props.className}>
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path d="M13 5l-5 8h4l-1 6 5-8h-4l1-6z" fill="white" />
    </svg>
  )
}

const TracktioIcons = {
  Home,
  Sales,
  Finance,
  Operations,
  People,
  Support,
  WhatsApp,
  Analytics,
  Settings,
  Add,
  Logo,
}

export default TracktioIcons
export { Home, Sales, Finance, Operations, People, Support, WhatsApp, Analytics, Settings, Add, Logo }
