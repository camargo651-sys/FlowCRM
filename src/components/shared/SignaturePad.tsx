'use client'
import { useRef, useState, useEffect } from 'react'
import { Eraser } from 'lucide-react'

interface SignaturePadProps {
  onSign: (dataUrl: string) => void
  width?: number
  height?: number
}

export default function SignaturePad({ onSign, width = 400, height = 180 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#151b3a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setDrawing(true)
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const endDraw = () => {
    setDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const confirm = () => {
    if (!hasDrawn || !canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onSign(dataUrl)
  }

  return (
    <div>
      <div className="relative border-2 border-dashed border-surface-200 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width * 2}
          height={height * 2}
          style={{ width, height, touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-surface-300">Draw your signature here</p>
          </div>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-px bg-surface-200" />
      </div>
      <div className="flex items-center justify-between mt-3">
        <button onClick={clear} className="btn-ghost btn-sm text-xs">
          <Eraser className="w-3 h-3" /> Clear
        </button>
        <button onClick={confirm} disabled={!hasDrawn}
          className="btn-primary btn-sm">
          Confirm signature
        </button>
      </div>
    </div>
  )
}
