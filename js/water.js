// 水たまり（~）と水属性。
//   ・水たまりは、水底の都のように puddles: true のダンジョンの部屋にできる（dungeon.addPuddles）。だれでも歩ける
//   ・水属性（monsters.js の element: "water"）のモンスターは、水たまりの上にいると
//       攻撃力が powerMul 倍（技も同じ）になり、毎ターン heal ずつ回復する（敵も仲間も）
//   ・それ以外のキャラには影響しない
Game.water = {
  powerMul: 1.3,
  heal: 1,

  isWater: function (x, y) {
    return Game.map.tileAt(x, y) === "~";
  },

  // 水属性のキャラか（主人公は違う）
  aquatic: function (unit) {
    var t = unit && unit.type && Game.MONSTERS[unit.type];
    return !!(t && t.element === "water");
  },

  // 水属性で、今水たまりの上にいるか
  empowered: function (unit) {
    return this.aquatic(unit) && unit.x >= 0 && this.isWater(unit.x, unit.y);
  },

  // 攻撃力にかける倍率
  atkMul: function (unit) {
    return this.empowered(unit) ? this.powerMul : 1;
  },

  // 毎ターン：水たまりの上の水属性は少し回復
  tick: function () {
    var self = this;
    Game.enemies.list.concat(Game.allies.list).forEach(function (u) {
      if (self.empowered(u) && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + self.heal);
    });
  },
};
