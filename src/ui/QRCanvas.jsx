/* ============================================================
   QR — loaded on demand.

   The encoder is about 50KB and is only needed the moment
   somebody hands a character over or invites a remote player,
   so it is imported lazily rather than carried in the main
   bundle for the whole session.

   ------------------------------------------------------------
   ERROR CORRECTION IS A SETTING BECAUSE THE TWO USES DIFFER

   A character handoff is one phone held up to another phone,
   twenty centimetres apart in good light. "L" is right there:
   it spends the least of the code's capacity on redundancy, so
   a large payload stays in a lower version with fatter modules.

   A remote invite is read off a SHARED SCREEN on a video call.
   Between the Warden's monitor and the player's phone camera
   there is a screen capture, a video encoder that treats fine
   high-contrast detail as noise worth spending no bits on, a
   network, and a decoder. Modules get smeared into their
   neighbours. "Q" spends a quarter of the capacity on being
   able to reconstruct that, and it is the difference between a
   code that reads first time and one that never reads at all.

   The payload is small enough now — a link of about 170
   characters — that the extra redundancy costs one version.
   ============================================================ */
import React, { useEffect, useRef, useState } from "react";

export default function QRCanvas({
  text,
  size = 240,
  alt = "QR code",
  level = "L",
  quiet = 1,
}) {
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
          margin: quiet,
          errorCorrectionLevel: level,
          color: { dark: "#000000", light: "#ffffff" },
        });
      })
      .then(() => live && setState("ready"))
      .catch(() => live && setState("failed"));
    return () => { live = false; };
  }, [text, size, level, quiet]);

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
      <canvas ref={ref} aria-label={alt} style={{
        width: size, height: size, background: "#fff", padding: 8,
        display: state === "ready" ? "block" : "none",
      }} />
      {state === "loading" && <p style={{ opacity: 0.6 }}>Building the code…</p>}
      {state === "failed" && (
        <p className="sig sig-dis">
          Couldn't build a code — the payload may be too large. Copy the text instead.
        </p>
      )}
    </div>
  );
}
