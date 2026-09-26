// 仲間の回避：敵が技を溜めている（予告している）間、その技が当たるマスをよける。
//   ・一直線の技（line）… 光っている一直線のマス
//   ・隣への技（single・around）… 使い手の周り1マス
//   ・範囲の技（range）… 使い手から range マス以内
//   ・部屋全体の技（sight）… よけきれないので気にしない
// 当たっても痛くない技（予想ダメージが今のHPの config.allyDodgeIgnoreRatio 以下）は基本よけない。
// ただし config.allyDodgeWhim の確率で、念のためよける（気まぐれ。毎ターン決め直す）。
// ルールだけ（描画はしない）。allies.act・squad.act から使う。
Game.dodge = {
  // 敵 e の溜めている技が当たるマスの一覧。よけられない・溜めていなければ null
  dangerCells: function (e) {
    if (!e.charge) return null;
    var def = Game.SKILLS[e.charge.skill];
    if (!def) return null;
    if (def.shape === "line") return e.charge.dir ? Game.specials.lineCells(e, e.charge.dir, def.range) : null;
    if (def.shape === "sight") return null;
    var r = def.shape === "range" ? def.range : 1;
    var cells = [];
    for (var y = e.y - r; y <= e.y + r; y++) {
      for (var x = e.x - r; x <= e.x + r; x++) if (x !== e.x || y !== e.y) cells.push({ x: x, y: y });
    }
    return cells;
  },

  // 敵 e の技を仲間 a が受けた時の予想ダメージ（技の即死防止の上限つき）
  estimate: function (e, a) {
    var def = Game.SKILLS[e.charge.skill];
    var one = Math.max(1, Math.round(e.atk * Game.water.atkMul(e) * def.mult - a.def));
    return Math.min(one * (def.hits || 1), Math.ceil(a.maxHp * Game.config.specialMaxRatio));
  },

  // マス (x, y) にいると受けそうな技のダメージの合計（溜めている敵ぜんぶ）
  damageAt: function (a, x, y) {
    var total = 0;
    for (var i = 0; i < Game.enemies.list.length; i++) {
      var e = Game.enemies.list[i];
      var cells = this.dangerCells(e);
      if (!cells) continue;
      for (var k = 0; k < cells.length; k++) {
        if (cells[k].x === x && cells[k].y === y) {
          total += this.estimate(e, a);
          break;
        }
      }
    }
    return total;
  },

  // そのマスは、a にとって避けるべきか
  avoid: function (a, x, y) {
    var dmg = this.damageAt(a, x, y);
    if (dmg <= 0) return false;
    if (dmg > a.hp * Game.config.allyDodgeIgnoreRatio) return true;
    // 痛くない技：気まぐれでたまによける（このターンに1回だけ決める）
    if (a.whimTurn !== Game.turn) {
      a.whimTurn = Game.turn;
      a.whim = Math.random() < Game.config.allyDodgeWhim;
    }
    return a.whim;
  },

  // 今いるマスが危なければ、安全な隣のマスへよける（主人公に近い方を選ぶ）。よけたら true
  tryDodge: function (a) {
    if (a.x < 0 || !this.avoid(a, a.x, a.y)) return false;
    var best = null, bestD = 999, p = Game.player;
    for (var i = 0; i < Game.DIRS8.length; i++) {
      var d = Game.DIRS8[i];
      var nx = a.x + d[0], ny = a.y + d[1];
      if (!Game.map.canStep(a.x, a.y, d[0], d[1]) || !Game.path.isFree(nx, ny)) continue;
      if (this.avoid(a, nx, ny)) continue;
      var dist = Game.path.dist(nx, ny, p.x, p.y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    if (!best) return false; // 逃げ場がない：いつも通り戦う
    a.x += best[0];
    a.y += best[1];
    return true;
  },

  // 1歩 step で危ないマスへ入ってしまうなら true（その場で待つ）。今いる所も危ない時は止めない
  blocks: function (a, step) {
    if (!step) return false;
    return this.avoid(a, a.x + step[0], a.y + step[1]) && !this.avoid(a, a.x, a.y);
  },
};
