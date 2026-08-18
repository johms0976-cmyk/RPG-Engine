/* ============================================================
   CUE RECORDER — the Warden's own voice, in one hand.

   The private sound cue is the best mechanic in this codebase:
   a noise on one person's handset, appearing in no log, which
   they then have to decide on their own whether to mention. That
   decision is the horror. It is currently limited to five
   synthesised noises.

   Three seconds off the desk microphone is the same mechanic
   with the Warden actually in it. A whisper, a breath, a name.

   The ethos is kept exactly: the clip is held in memory, sent
   once, and dropped. It is never written to disk on either side,
   never added to the feed, never saved with the session, and
   never reaches a second phone. Nothing about it survives the
   moment, which is the entire point — a recording that can be
   replayed to the table later is just a sound effect.
   ============================================================ */
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Btn, Label } from "./kit.jsx";

export const MAX_MS = 3000;

export default function CueRecorder({ peers = [], crew = [], onSend }) {
  const [state, setState] = useState("idle");  // idle | arming | recording | ready | denied
  const [clip, setClip] = useState(null);      // { data, mime }
  const [ms, setMs] = useState(0);
  const rec = useRef(null);
  const chunks = useRef([]);
  const stream = useRef(null);

  // Belt and braces: a live microphone left open after the drawer
  // closes is exactly the thing nobody would notice.
  useEffect(() => () => {
    if (stream.current) stream.current.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) { setState("denied"); return; }
    setState("arming");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const r = new MediaRecorder(s);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => { setClip({ data: reader.result, mime: blob.type }); setState("ready"); };
        reader.readAsDataURL(blob);
        s.getTracks().forEach((t) => t.stop());
        stream.current = null;
      };
      rec.current = r;
      r.start();
      setState("recording");
      setMs(0);
      const t0 = Date.now();
      const tick = setInterval(() => setMs(Date.now() - t0), 100);
      setTimeout(() => {
        clearInterval(tick);
        if (r.state !== "inactive") r.stop();
      }, MAX_MS);
    } catch {
      setState("denied");
    }
  }, []);

  const stop = () => { if (rec.current && rec.current.state !== "inactive") rec.current.stop(); };
  const discard = () => { setClip(null); setState("idle"); };

  const nameFor = (p) => {
    const pc = crew.find((c) => c.id === p.pcId);
    return pc ? pc.name : p.name;
  };

  return (
    <div>
      <Label>YOUR OWN VOICE, ON ONE HANDSET</Label>

      {state === "denied" && (
        <p className="clue-meta" style={{ margin: 0 }}>
          No microphone, or permission refused. The synthesised cues above
          still work and need nothing.
        </p>
      )}

      {(state === "idle" || state === "arming") && state !== "denied" && (
        <div className="btn-row">
          <Btn kind="solid" className="inline small" disabled={state === "arming"} onClick={start}>
            {state === "arming" ? "Asking for the mic…" : "Record three seconds"}
          </Btn>
        </div>
      )}

      {state === "recording" && (
        <div className="btn-row">
          <span className="sig sig-secret cue-rec">● {(ms / 1000).toFixed(1)}s</span>
          <Btn kind="danger" className="inline small" onClick={stop}>Stop</Btn>
        </div>
      )}

      {state === "ready" && clip && (
        <>
          <div className="btn-row" style={{ marginBottom: 6 }}>
            <audio src={clip.data} controls className="cue-play" />
            <Btn kind="ghost" className="inline small" onClick={discard}>Throw it away</Btn>
          </div>
          <div className="btn-row">
            {peers.length === 0
              ? <span className="clue-meta">No phones connected.</span>
              : peers.map((p) => (
                <Btn key={p.clientId} kind="accent" className="inline small"
                  onClick={() => { onSend(p.clientId, clip.data, clip.mime); discard(); }}>
                  → {nameFor(p)}
                </Btn>
              ))}
          </div>
        </>
      )}

      <p className="clue-meta" style={{ margin: "6px 0 0" }}>
        Held in memory, sent once, then gone. It is not saved with the
        session, does not appear in the log, and cannot be played to the
        table afterwards.
      </p>
    </div>
  );
}
