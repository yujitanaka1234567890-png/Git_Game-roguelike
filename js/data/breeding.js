// 【図鑑データ】交配の組み合わせ表。ここに載っている組み合わせだけ子が生まれる（親の順番は問わない）。
// 親はダンジョンへ帰り（牧場からいなくなる）、子は親より少し強い別の種類になる。
// 親の能力は拠点では常に初期値なので、同じ組み合わせからは必ず同じ子が生まれる。
Game.BREEDING = [
  { parents: ["numerin", "togemogura"], child: "togeNume" },
  { parents: ["numerin", "floatKnife"], child: "numeBlade" },
  { parents: ["togemogura", "floatKnife"], child: "bladeMogura" },
  { parents: ["numerin", "redDragon"], child: "numeDrake" },
  { parents: ["togemogura", "redDragon"], child: "scaleMogura" },
  { parents: ["boroDoll", "floatKnife"], child: "bladeDoll" },
  { parents: ["tsumujiDori", "numerin"], child: "slimeBird" },
  { parents: ["tsumujiDori", "redDragon"], child: "flameBird" },
  { parents: ["boroDoll", "togemogura"], child: "spikeDoll" },
  { parents: ["tsumujiDori", "boroDoll"], child: "windDoll" },
];

// 2体の組み合わせから生まれる子の種類ID。組み合わせ表になければ null
Game.breedResult = function (typeA, typeB) {
  for (var i = 0; i < Game.BREEDING.length; i++) {
    var p = Game.BREEDING[i].parents;
    if ((p[0] === typeA && p[1] === typeB) || (p[0] === typeB && p[1] === typeA)) return Game.BREEDING[i].child;
  }
  return null;
};
