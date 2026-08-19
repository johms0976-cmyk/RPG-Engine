import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A relative base means the built site works wherever it is served from —
// user page, project page (/RPG-Engine/), a /docs folder, or file://.
// BASE_PATH can still override it if you ever need an absolute base.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "./",

  build: {
    /* ============================================================
       ONE CHUNK WAS THE WRONG NUMBER OF CHUNKS.

       The build was 661KB of JavaScript in a single file, 225KB
       gzipped, and Vite warned about it correctly. The moment that
       costs is the one that matters most: six phones pulling the
       whole thing off a laptop's wifi in the first thirty seconds
       of a session, while everybody is watching.

       Almost none of it is needed by any given tab. A phone never
       runs the Warden deck. A Warden's laptop never runs the join
       flow. A table playing Ypsilon 14 has no use for any other
       module's rooms, items, NPCs and audio, and modules are the
       part of this codebase that grows without bound.

       Three boundaries, in order of how much they save:

         module-*   each module its own chunk. The one a table
                    isn't playing should not be in the main bundle.
         map        Map2 is 550 lines of SVG machinery plus the map
                    model, and none of it is needed to reach the
                    join screen.
         vendor     React and friends change once a quarter, so
                    keeping them separate means a rebuild does not
                    re-download them.

       The desk/handset split is done differently — with dynamic
       `import()` in main.jsx — because which of the two a tab is
       depends on a probe that only answers at runtime.
       ============================================================ */
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            const mod = id.match(/src\/modules\/([^/]+)\//);
            // `_template` is tiny and `modules/index.js` is what
            // *lists* the modules, so both stay with the entry.
            if (mod && mod[1] !== "_template") return `module-${mod[1]}`;
            if (/src\/(ui\/Map2|ui\/ImageMap|core\/mapModel)/.test(id)) return "map";
            return undefined;
          }
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/node_modules\/qrcode\//.test(id)) return "vendor-qr";
          return undefined;
        },
      },
    },

    /* The warning stays on, at a threshold that means something.
       Silencing it is how a bundle gets back to 661KB. */
    chunkSizeWarningLimit: 400,
  },
});
