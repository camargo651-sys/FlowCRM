'use client'
import { useWidgets } from './WidgetManager'
import WidgetManager from './WidgetManager'

interface DashboardWidgetsProps {
  kpis: React.ReactNode
  ai: React.ReactNode
  modules: React.ReactNode
  actions: React.ReactNode
}

export default function DashboardWidgets({ kpis, ai, modules, actions }: DashboardWidgetsProps) {
  const { config, toggle, isVisible } = useWidgets()

  return (
    <>
      <div className="flex justify-end mb-4 -mt-2">
        <WidgetManager config={config} toggle={toggle} />
      </div>

      {isVisible('kpis') && kpis}
      {isVisible('ai') && ai}
      {isVisible('modules') && modules}
      {isVisible('actions') && actions}
    </>
  )
}
