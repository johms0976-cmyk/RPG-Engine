/* ============================================================
   THE SHELF — every module the player can load.
   Add a line here and your tape appears in the library.
   ============================================================ */
import ypsilon14 from "./ypsilon14/index.js";
import anotherbughunt from "./anotherbughunt/index.js";
import deadweight from "./deadweight/index.js";
import template from "./_template/index.js";

/* Ypsilon 14 first because it is the flagship and the tutorial.
   ANOTHER BUG HUNT second because it is the campaign the tutorial
   was written to hand off to — Ypsilon's crew are nine days out
   from Samsa, and this is what is waiting there. DEAD WEIGHT
   third because it is the one a table can actually finish on a
   weeknight. The template stays last; it is a skeleton to copy,
   not a thing to play. */
const MODULES = [ypsilon14, anotherbughunt, deadweight, template];
export default MODULES;
