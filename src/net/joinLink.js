/* ============================================================
   THE JOIN LINK — what the QR code actually contains.

   ------------------------------------------------------------
   WHY A LINK AND NOT JUST THE CODE

   A QR holding a bare `RPG2.…` code is only useful to a phone
   that already has this app open on the join screen. The person
   scanning is, by definition, somebody who was not expecting to
   play five seconds ago — they are looking at a shared screen on
   a video call. Telling them "first go to this URL, then find
   the join screen, then scan this" is three steps where one will
   do.

   So the QR is a link. Scan it, the app opens, the offer is
   already loaded, and the answer is on screen before they have
   put the phone down.

   ------------------------------------------------------------
   THE CODE GOES IN THE FRAGMENT

   `#RPG2.…`, not `?code=RPG2.…`.

   A fragment is never sent to the server. GitHub Pages, or
   whatever is hosting the build, gets a request for the page and
   nothing else — the code is not in the access log, not in a
   referrer header, and not in anything a CDN caches. Given the
   code contains the Warden's public IP address, that is worth
   the zero effort it costs.

   ------------------------------------------------------------
   WHICH BASE URL

   The awkward part. The Warden is usually on
   `http://localhost:8080`, which is meaningless to somebody in
   another city, so their own address is often exactly the wrong
   thing to put in the QR.

   The rule, in order:

     1. An explicit override, if the Warden set one.
     2. This page's own address, if it is publicly reachable —
        a real https origin, so a tunnel or the hosted build.
     3. The hosted build, which is where the app lives anyway
        and is guaranteed to be reachable from outside.

   Rule 2 matters more than it looks: a Warden running
   `npm run tunnel` gets an https address that works from
   anywhere, and their players should land on the Warden's own
   copy rather than a public one that might be a version ahead.
   ============================================================ */

/** Where the built app lives publicly. Change this if you fork. */
export const PUBLIC_APP_URL = "https://johms0976-cmyk.github.io/RPG-Engine/";

const OVERRIDE_KEY = "rpg.joinBase";

/* localhost is a secure context but not a reachable one, and
   private ranges are reachable only from the same building —
   which is the case that uses the LAN relay, not this. */
function reachableFromOutside(loc) {
  if (!loc) return false;
  if (loc.protocol !== "https:") return false;
  const h = loc.hostname;
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
  if (/^10\./.test(h)) return false;
  if (/^192\.168\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (/\.local$/i.test(h)) return false;
  return true;
}

/** A Warden hosting somewhere unusual can pin the base themselves. */
export function setJoinBase(url) {
  try {
    if (url) localStorage.setItem(OVERRIDE_KEY, String(url).trim());
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch { /* private browsing; the default still works */ }
}

export function getJoinBase() {
  try {
    const saved = localStorage.getItem(OVERRIDE_KEY);
    if (saved) return saved;
  } catch { /* fall through */ }

  const loc = typeof location !== "undefined" ? location : null;
  if (reachableFromOutside(loc)) {
    // pathname minus any filename, so /RPG-Engine/index.html -> /RPG-Engine/
    const dir = loc.pathname.replace(/[^/]*$/, "");
    return `${loc.origin}${dir}`;
  }

  return PUBLIC_APP_URL;
}

/** The full thing a QR code carries. */
export function joinLink(code, base = getJoinBase()) {
  if (!code) return "";
  const clean = String(base || PUBLIC_APP_URL).replace(/[?#].*$/, "");
  const slash = clean.endsWith("/") ? clean : `${clean}/`;
  return `${slash}?mode=join#${code}`;
}

/**
 * The other end of it: what did we arrive with?
 *
 * Reads the fragment, tolerating the `#key=value` form as well as a
 * bare `#RPG2.…`, because a link that has been through a chat client
 * and a phone's share sheet has often been helpfully rewritten.
 */
export function offerFromLocation(loc = typeof location !== "undefined" ? location : null) {
  if (!loc) return null;
  const raw = String(loc.hash || "").replace(/^#/, "");
  if (!raw) return null;

  const direct = raw.match(/(RPG[12]\.[A-Za-z0-9._-]+)/);
  return direct ? direct[1] : null;
}

/** Drop the code from the address bar once it has been consumed. */
export function clearOfferFromLocation() {
  try {
    if (typeof history !== "undefined" && history.replaceState) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch { /* nothing important depends on this */ }
}
