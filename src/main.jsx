import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ClientShell from "./net/ClientShell.jsx";

/* ============================================================
   Which of the three things is this tab?

     ?mode=host   the PC — runs the real engine, is the authority
     ?mode=solo   force single-player, ignore any table
     (nothing)    ask the server. If /net/info answers we are on a
                  table server, so this is somebody's phone. If it
                  doesn't — GitHub Pages, a file on disk, vite dev —
                  fall back to the ordinary single-player app.

   Probing rather than assuming is what lets one build serve both
   the public static deploy and the table server unchanged.
   ============================================================ */

const mode = new URLSearchParams(location.search).get("mode");

function Boot() {
  const [role, setRole] = useState(mode === "host" || mode === "solo" ? "solo" : null);

  useEffect(() => {
    if (role) return;
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 1500);
    fetch("/net/info", { signal: stop.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setRole("client"))
      .catch(() => setRole("solo"))
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); stop.abort(); };
  }, [role]);

  if (!role) return null;
  return role === "client" ? <ClientShell /> : <App />;
}

createRoot(document.getElementById("root")).render(<Boot />);
