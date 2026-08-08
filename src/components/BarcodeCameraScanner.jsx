import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
]

/**
 * Opens the device camera and decodes barcodes/QR codes live.
 * Calls onDetected(code) once, then stops itself — parent controls re-opening.
 */
export default function BarcodeCameraScanner({ onDetected, onClose }) {
  const regionId = 'barcode-camera-region'
  const scannerRef = useRef(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    let cancelled = false
    const qr = new Html5Qrcode(regionId, { formatsToSupport: BARCODE_FORMATS, verbose: false })
    scannerRef.current = qr

    Html5Qrcode.getCameras()
      .then(cameras => {
        if (cancelled || !cameras || cameras.length === 0) {
          setError('No camera found on this device.')
          setStarting(false)
          return
        }
        const back = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1]

        qr.start(
          back.id,
          { fps: 15, qrbox: { width: 280, height: 140 } },
          (decodedText) => {
            qr.stop().then(() => qr.clear()).catch(() => {})
            onDetected(decodedText)
          },
          () => { /* per-frame decode misses are normal, ignore */ }
        )
          .then(() => { if (!cancelled) setStarting(false) })
          .catch(() => {
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

  const submitManual = (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    const qr = scannerRef.current
    if (qr) qr.stop().then(() => qr.clear()).catch(() => {})
    onDetected(manualCode.trim())
  }

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
          Hold the barcode flat, well-lit, filling most of the frame — it can take a few seconds to lock on.
        </p>

        <form onSubmit={submitManual} className="mt-4 pt-3 border-t border-line">
          <label className="label">Or type the number if scanning won't cooperate</label>
          <div className="flex gap-2">
            <input
              className="input font-mono"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="e.g. 6009123456789"
            />
            <button type="submit" className="btn-primary shrink-0">Use</button>
          </div>
        </form>
      </div>
    </div>
  )
}