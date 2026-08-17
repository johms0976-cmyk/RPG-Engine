/* ============================================================
   useRemoteGame — a useGame-shaped object backed by the network.

   The trick that keeps this small: Play.jsx only ever touches the
   object it is handed. So if we build something with the same keys
   — state fields read from the host's snapshot, action functions
   replaced by intent senders — the existing play screen works on a
   phone with no changes at all.

   What stays local: the module (compiled into every client, looked
   up by id rather than shipped), and the two purely cosmetic modals
   (talking, device) which are opened by your own tap and shouldn't
   pop up on everyone else's phone.
   ============================================================ */
import { useMemo, useState, useCallback } from "react";
import MODULES from "../modules/index.js";
import { PLAYER_ACTIONS, pendingOwner } from "./protocol.js";
import { possibleAssists, possibleTherapists, findPc } from "../engine/crew.js";
import { dayOf } from "../engine/world.js";

export function useRemoteGame(snapshot, myPcId, send) {
  const [talking, setTalking] = useState(null);
  const [device, setDevice] = useState(null);

  const mod = useMemo(
    () => MODULES.find((m) => m.id === (snapshot && snapshot.modId)) || null,
    [snapshot && snapshot.modId],
  );

  const fire = useCallback((action, args) => {
    if (!PLAYER_ACTIONS.has(action)) return;
    send({ t: "intent", action, args, asPc: myPcId });
  }, [send, myPcId]);

  return useMemo(() => {
    const s = snapshot && snapshot.state;
    if (!mod || !s) return null;

    const me = findPc(s.crew, myPcId);
    // A prompt aimed at another player is not shown here — they answer it
    // on their own phone and everyone sees the result in the feed.
    const owner = pendingOwner(s.pending);
    const myPending = s.pending && (!owner || owner === myPcId) ? s.pending : null;
    const day = dayOf(s.w);

    const send_ = {};
    for (const name of PLAYER_ACTIONS) send_[name] = (...args) => fire(name, args);

    return {
      ...send_,
      mod,
      items: mod.items,
      w: s.w,
      crew: s.crew,
      // The phone is always looking at its own character, whatever the
      // host's activeId happens to be at this instant.
      pc: me,
      activeId: myPcId,
      feed: s.feed,
      pending: myPending,
      combat: s.combat,
      resting: s.resting && s.resting.pcId && s.resting.pcId !== myPcId ? null : s.resting,
      levelUp: s.levelUp && s.levelUp.pcId && s.levelUp.pcId !== myPcId ? null : s.levelUp,
      shopping: s.shopping,
      lastRoll: s.lastRoll,
      houseRules: s.houseRules,
      talking, setTalking,
      device, setDevice,
      // Switching character is the host's business; a phone owns one PC.
      setActiveId: () => {},
      setResting: () => {}, setLevelUp: () => {}, setShopping: () => {},
      setPending: () => {}, setHouseRules: () => {},
      possibleAssists: (target) => possibleAssists(s.crew, target || me, day),
      possibleTherapists: (target) => possibleTherapists(s.crew, target, day),
      act: () => {},
      api: {},
    };
  }, [snapshot, mod, myPcId, fire, talking, device]);
}
