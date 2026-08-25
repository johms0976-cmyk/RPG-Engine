/* ============================================================
   THE SHELF — every module the player can load.
   Add a line here and your tape appears in the library.
   ============================================================ */
import ypsilon14 from "./ypsilon14/index.js";
import deadweight from "./deadweight/index.js";
import template from "./_template/index.js";

/* Ypsilon 14 first because it is the flagship, DEAD WEIGHT second
   because it is the one a table can actually finish on a
   weeknight — see the header of its index.js. The template stays
   last; it is a skeleton to copy, not a thing to play. */
const MODULES = [ypsilon14, deadweight, template];
export default MODULES;
