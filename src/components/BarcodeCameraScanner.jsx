import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

/**
 * Opens the device camera and decodes barcodes/QR codes live.
 * Calls onDetected(code) once, then stops itself — parent controls re-opening.
 */
export default function BarcodeCameraScanner({ onDetected, onClose }) {
  const regionId = 'barcode-camera-region'
  const scannerRef = useRef(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let cancelled = false
    const qr = new Html5Qrcode(regionId, { verbose: false })
    scannerRef.current = qr

    Html5Qrcode.getCameras()
      .then(cameras => {
        if (cancelled || !cameras || cameras.length === 0) {
          setError('No camera found on this device.')
          setStarting(false)
          return
        }
        // Prefer the back/environment camera on phones
        const back = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1]

        qr.start(
          back.id,
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            // Stop as soon as we get one good read
            qr.stop().then(() => qr.clear()).catch(() => {})
            onDetected(decodedText)
          },
          () => { /* per-frame decode failures are normal, ignore */ }
        )
          .then(() => { if (!cancelled) setStarting(false) })
          .catch(err => {
            if (!cancelled) {
              setError('Could not access the camera — check camera permission for this site.')
              setStarting(false)
            }
          })
      })
      .catch(() => {
        setError('Camera access was blocked or is unavailable. Check your browser permissions.')
        setStarting(false)
      })

    return () => {
      cancelled = true
      const qr = scannerRef.current
      if (qr) {
        qr.stop().then(() => qr.clear()).catch(() => {})
      }
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium text-slate-100">Scan with camera</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>

        {starting && !error && <div className="text-sm text-slate-500 mb-2">Starting camera…</div>}
        {error && <div className="text-bad text-sm mb-2">{error}</div>}

        <div id={regionId} className="rounded-lg overflow-hidden bg-ink" />

        <p className="text-xs text-slate-500 mt-3">
          Point the camera at the barcode. It'll add the product automatically once it reads clearly.
        </p>
      </div>
    </div>
  )
}