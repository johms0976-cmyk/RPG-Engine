/* ============================================================
   ANOTHER BUG HUNT — TABLES

   The published book carries a d100 of carcinid variations, and
   its entries are Tuesday Knight Games' creative work. They are
   NOT reproduced here. What is reproduced is the *idea*, which
   is a good one and is a system rather than expression: every
   carc the crew meets should read as an individual and as
   something with a culture, because a swarm of identical
   monsters is an obstacle and a society of them is a horror.

   The entries below are original to this engine. If you own the
   book, roll on its table instead — yours is better and it is
   the reason to own the book.
   ============================================================ */

export const tables = {
  carcinid: {
    name: "This one, specifically", die: "1d20", tone: "horror",
    entries: [
      { max: 1, text: "The carapace has been worn smooth across the shoulders, the way a doorframe goes smooth. Something has been rubbing against it, for years, affectionately." },
      { max: 2, text: "Its claws end in fine manipulators rather than blades. It does not attack. It reaches for things and turns them over." },
      { max: 3, text: "Freshly moulted — soft, dripping, and setting hard as you watch. No armour yet. It knows this and it is furious about it." },
      { max: 4, text: "Somebody's dog tags have been incorporated into the shell above the thorax, deliberately, and the shell has grown around them." },
      { max: 5, text: "It is missing three limbs down one side and has compensated so completely that you would not notice unless you counted." },
      { max: 6, text: "The plates are scored all over in fine geometric hatching — too regular for damage, too irregular for machining. Somebody carved this." },
      { max: 7, text: "It is much smaller than the others and moves at the edge of the group, and the others make room for it." },
      { max: 8, text: "Its shell is translucent along the underside, and things are visibly moving inside it that are not organs." },
      { max: 9, text: "It carries a length of colony conduit in one claw and has been using it as a tool. It is holding it correctly." },
      { max: 10, text: "One eye cluster is clouded over. It leads with the good side and hesitates fractionally before turning." },
      { max: 11, text: "It is enormous — half again the size of the others — and slower, and everything else defers to it without being asked." },
      { max: 12, text: "There are healed acid burns across the front of it. Somebody got a throw off. Somebody did not get a second one." },
      { max: 13, text: "Its Shriek is wrong: lower, longer, and unmistakably a different voice from the others. They stop and listen when it uses it." },
      { max: 14, text: "It has fibre-welded a marine's chest plate across its own thorax as armour it did not need." },
      { max: 15, text: "It is dragging something wrapped in resin behind it and will not put it down, even in a fight." },
      { max: 16, text: "The shell is pale, almost white, and the joints are stiff. This one is very old and it is a long way from anywhere it should be." },
      { max: 17, text: "It has been painted — resin pigment, in bands, applied by another carc and not by this one." },
      { max: 18, text: "It stops when it sees you, and it keeps stopping, and at no point does it attack. It is waiting for you to do something specific and you will never work out what." },
      { max: 19, text: "Its mandibles are fused shut with hardened fibre, tied off neatly. It cannot Shriek. Something did this to it as a punishment." },
      { max: 20, text: "It is wearing the top half of a hazard suit, badly, and it has not worked out the arms." },
    ],
  },

  storm: {
    name: "The weather, while you are outside in it", die: "1d10", tone: "warden",
    entries: [
      { max: 2, text: "The rain comes in a sheet hard enough to drop visibility to nothing for a slow count of six." },
      { max: 4, text: "Lightning, very close. For half a second the whole valley is lit and you see exactly how much of it is moving." },
      { max: 5, text: "The mud gives underfoot and takes somebody down to the knee. Getting out costs a minute and a boot." },
      { max: 6, text: "The wind drops entirely, for about twenty seconds, and in the gap you can hear a great deal that the rain had been covering." },
      { max: 7, text: "Water is coming over the trail now rather than across it. It was not doing that an hour ago." },
      { max: 8, text: "Something large moves along the treeline, keeping pace, staying exactly at the limit of the lamps." },
      { max: 9, text: "The thunder arrives with something underneath it, at a pitch you feel in the teeth rather than hear.", effects: [{ stress: 1, why: "that was not thunder" }] },
      { max: 10, text: "The rain stops. All of it, at once, for most of a minute. Nothing about that is meteorological.", effects: [{ stress: 1, why: "the rain stopped" }] },
    ],
  },

  quiet: {
    name: "Inside, while nobody is talking", die: "1d10", tone: "warden",
    entries: [
      { max: 1, text: "A door somewhere in the building closes at a speed that means a hand did it." },
      { max: 2, text: "Water is getting in somewhere new. You can hear it finding its way down through two decks." },
      { max: 3, text: "The emergency lighting dips, holds, and comes back at a slightly different colour." },
      { max: 4, text: "Something in the ducting shifts its weight, once, and settles." },
      { max: 5, text: "You can smell the rain, which means a door is open somewhere that was shut." },
      { max: 6, text: "A radio somewhere in the room opens on its own, delivers four seconds of the Signal, and closes." },
      { max: 7, text: "Scratching, unhurried, in a straight line, along the far side of a wall — and then it stops being straight." },
      { max: 8, text: "Somebody's personal locator chirps a proximity tone from a pocket in the dark. Nobody in your crew is carrying one." },
      { max: 9, text: "The thud that has been coming up through the floor stops. It does not start again.", effects: [{ stress: 1, why: "it stopped" }] },
      { max: 10, text: "Nothing happens for a long time, in a building where a great many things happened very quickly, and you find yourself waiting for your turn.", effects: [{ stress: 1, why: "you are waiting for your turn" }] },
    ],
  },

  hive: {
    name: "In the tunnels and aboard the ship", die: "1d10", tone: "horror",
    entries: [
      { max: 2, text: "The walls contract, once, along the whole length of the passage, and relax." },
      { max: 3, text: "Something a long way off is being taken apart, and it is taking a while, and it is audible." },
      { max: 4, text: "A drift of shed carapace, decades of it, banked up against a wall like snow." },
      { max: 5, text: "The air pressure changes as though a very large door has opened somewhere ahead." },
      { max: 6, text: "You pass a chamber containing a single human boot, upright, undamaged, and dry." },
      { max: 7, text: "A carcinid goes past the mouth of the passage carrying something, does not look in, and does not come back." },
      { max: 8, text: "Every surface around you is warm on one side and cold on the other, and the warm side is the side facing down." },
      { max: 9, text: "Somewhere below, all at once, several hundred of them make the same sound and then stop.", effects: [{ stress: 1, why: "they did it together" }] },
      { max: 10, text: "Somebody's voice, clearly, saying your character's name — from a direction with nothing in it.", effects: [{ stress: 2, why: "it knew your name" }] },
    ],
  },

  onFail: {
    name: "It costs you something", die: "1d10", tone: "warden",
    entries: [
      { max: 2, text: "It takes far longer than it should have.", effects: [{ time: 20 }] },
      { max: 4, text: "It works, eventually, and makes a great deal of noise doing it.", effects: [{ noise: "a botched job, loudly" }] },
      { max: 6, text: "Something breaks that you were relying on and will notice later." },
      { max: 8, text: "The water is higher when you look up than it was when you looked down.", effects: [{ time: 30 }] },
      { max: 10, text: "You get it done and you are being watched while you do.", effects: [{ stress: 1, why: "you are being watched" }] },
    ],
  },
};
