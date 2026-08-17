/* ============================================================
   QR — loaded on demand.

   The encoder is about 50KB and is only needed the moment
   somebody hands a character over, so it is imported lazily
   rather than carried in the main bundle for the whole session.
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";

export default function QRCanvas({ text, size = 240, alt = "QR code" }) {
  const ref = useRef(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    import("qrcode")
      .then(({ default: QR }) => {
        if (!live || !ref.current) return;
        return QR.toCanvas(ref.current, text, {
          width: size,
          margin: 1,
          errorCorrectionLevel: "L", // most payload for the space
          color: { dark: "#000000", light: "#ffffff" },
        });
      })
      .then(() => live && setState("ready"))
      .catch(() => live && setState("failed"));
    return () => { live = false; };
  }, [text, size]);

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
      <canvas ref={ref} aria-label={alt} style={{
        width: size, height: size, background: "#fff", padding: 8,
        display: state === "ready" ? "block" : "none",
      }} />
      {state === "loading" && <p style={{ opacity: 0.6 }}>Building the code…</p>}
      {state === "failed" && (
        <p className="sig sig-dis">
          Couldn't build a code — the character may be too large. Save a file instead.
        </p>
      )}
    </div>
  );
}
