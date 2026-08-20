import React, { useEffect, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

/* THE FONTS, FROM DISK.

   These are the two faces theme.css asks for, shipped as npm
   packages and emitted into the build. They were already in
   package.json and were never imported, so the app was quietly
   depending on a <link> to fonts.googleapis.com in index.html —
   redundant when the files are right here, and the one thing that
   blocks first paint on a table with no uplink. */
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "@fontsource-variable/jetbrains-mono";

/* THE TWO HALVES, SPLIT.

   A phone and a Warden's laptop share almost no code above the
   engine, and six phones pulling one 660KB chunk off a laptop's
   wifi at the start of a session is the worst possible moment for
   it. `App` is the desk; `ClientShell` is the handset. Each tab
   loads one of them, and Vite emits them as separate chunks
   because these imports are dynamic. */
const App = lazy(() => import("./App.jsx"));
const ClientShell = lazy(() => import("./net/ClientShell.jsx"));

/* Makes the offline promise literal: once loaded, the engine stays
   loaded. Declines to register on dev, on plain http, and in tabs
   that are part of a live table — see src/pwa.js. */
import { registerServiceWorker } from "./pwa.js";

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
  return (
    /* Nothing but a black screen for the fraction of a second the
       chunk takes: the boot notice in index.html is what a *failed*
       load looks like and the two must not be confused. */
    <Suspense fallback={null}>
      {role === "client" ? <ClientShell /> : <App />}
    </Suspense>
  );
}

createRoot(document.getElementById("root")).render(<Boot />);

registerServiceWorker();
