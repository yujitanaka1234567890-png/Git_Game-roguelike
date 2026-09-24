// 敵の管理と行動（AI）。移動経路の計算は pathfind.js、必殺技・ブレスは specials.js を使う。
// 行動の優先順位：
//   0. 必殺技の溜め中なら、溜めを続ける／発動する
//   1. 隣に主人公・仲間がいれば攻撃（ときどき必殺技の溜めを始める）
//      攻撃相手は基本HPが一番少ない相手、ときどきランダム
//   2. （赤龍）離れた相手に一直線のブレス
//   3. 主人公が見えていれば、その位置を覚えて追いかける
//   4. 見失ったら、最後に見た位置まで行ってみる
//   5. それ以外は、部屋の中や別の部屋へうろつく
Game.enemies = {
  list: [],

  // 敵の種類データは図鑑データ（js/data/monsters.js）にある。ここでは同じものを types として使う
  types: Game.MONSTERS,

  rarityOf: function (typeId) {
    return Game.config.rarities[this.types[typeId].rarity];
  },

  // レア度の倍率をかけた実際の能力値
  statsOf: function (typeId) {
    var t = this.types[typeId];
    var mul = this.rarityOf(typeId).mul;
    return {
      hp: Math.round(t.hp * mul),
      atk: Math.round(t.atk * mul),
      def: Math.round(t.def * mul),
      exp: Math.round(t.exp * mul),
    };
  },

  init: function (spawns, floor) {
    this.list = [];
    for (var i = 0; i < spawns.length; i++) {
      this.spawn(this.pickType(floor), spawns[i].x, spawns[i].y);
    }
  },

  // 湧き直し：respawnChance の確率で、主人公から見えない離れた場所に敵が1体湧く（上限まで）
  tryRespawn: function () {
    if (Math.random() >= Game.config.respawnChance) return;
    if (this.list.length >= Game.config.dungeon.maxEnemies) return;
    var p = Game.player;
    for (var tries = 0; tries < 20; tries++) {
      var t = Game.dungeon.randomTileIn(Game.pick(Game.map.rooms));
      if (!Game.path.isFree(t.x, t.y) || Game.fov.isVisible(t.x, t.y)) continue;
      if (Game.path.dist(t.x, t.y, p.x, p.y) < 6) continue;
      this.spawn(this.pickType(Game.floor), t.x, t.y);
      return;
    }
  },

  // 今のダンジョンのその階に出る種類（js/data/dungeons.js の spawns）から、レア度に応じた出やすさで選ぶ
  pickType: function (floor) {
    var ok = Game.currentDungeon().spawns.filter(function (s) {
      return s.from <= floor && (!s.to || floor <= s.to);
    });
    var total = 0, i;
    for (i = 0; i < ok.length; i++) total += this.rarityOf(ok[i].type).spawn;
    var r = Math.random() * total;
    for (i = 0; i < ok.length; i++) {
      r -= this.rarityOf(ok[i].type).spawn;
      if (r < 0) return ok[i].type;
    }
    return ok[ok.length - 1].type;
  },

  spawn: function (typeId, x, y) {
    var t = this.types[typeId];
    var s = this.statsOf(typeId);
    this.list.push({
      type: typeId, name: t.name, symbol: t.symbol, color: t.color,
      maxHp: s.hp, hp: s.hp, atk: s.atk, def: s.def, exp: s.exp,
      phasing: !!t.phasing,
      x: x, y: y,
      chasing: false, // 主人公を追っているか
      targetX: 0, targetY: 0, // 追跡中：最後に主人公を見た位置
      dest: null, // うろつき中：目指している場所 {x, y}
      dmgLog: [], // 受けたダメージの記録 [{unit, amount}]（経験値の分配用）
      charge: null, // 技の溜め中 { left: 残りターン, skill: 技のID }
      breathCd: 0, // ブレスが再び使えるまでのターン数
    });
  },

  // 主人公側（主人公・仲間・アイテム）に倒された時の処理
  kill: function (enemy) {
    this.remove(enemy);
    var shares = this.expShares(enemy);
    var parts = [];
    for (var i = 0; i < shares.length; i++) {
      var s = shares[i];
      parts.push((s.unit === Game.player ? "あなた" : s.unit.baseName) + " " + s.exp);
    }
    Game.log.add(enemy.name + "をたおした！（経験値：" + parts.join(" / ") + "）", "good");
    Game.sound.play("kill");
    for (var j = 0; j < shares.length; j++) {
      if (shares[j].unit === Game.player) Game.player.gainExp(shares[j].exp);
      else Game.allies.gainExp(shares[j].unit, shares[j].exp);
    }
    Game.allies.tryRecruit(enemy);
  },

  // 経験値の分け方：その敵に与えたダメージの割合で分ける。
  // 途中で倒れた仲間の取り分は消える。取り分がある者は最低1。記録がなければ主人公が全部もらう
  expShares: function (enemy) {
    var total = 0;
    var byUnit = [];
    for (var i = 0; i < enemy.dmgLog.length; i++) {
      var rec = enemy.dmgLog[i];
      total += rec.amount;
      var found = null;
      for (var k = 0; k < byUnit.length; k++) if (byUnit[k].unit === rec.unit) found = byUnit[k];
      if (found) found.amount += rec.amount;
      else byUnit.push({ unit: rec.unit, amount: rec.amount });
    }
    if (total === 0) return [{ unit: Game.player, exp: enemy.exp }];

    var shares = [];
    for (var j = 0; j < byUnit.length; j++) {
      var u = byUnit[j].unit;
      var alive = u === Game.player || Game.allies.list.indexOf(u) >= 0;
      if (!alive || byUnit[j].amount === 0) continue;
      shares.push({ unit: u, exp: Math.max(1, Math.round((enemy.exp * byUnit[j].amount) / total)) });
    }
    return shares;
  },

  remove: function (enemy) {
    var i = this.list.indexOf(enemy);
    if (i >= 0) this.list.splice(i, 1);
  },

  // (x, y) にいる敵を返す。いなければ null
  at: function (x, y) {
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].x === x && this.list[i].y === y) return this.list[i];
    }
    return null;
  },

  // (x, y) の隣（8方向・角越しは除く）に敵がいるか
  adjacentTo: function (x, y) {
    for (var i = 0; i < this.list.length; i++) {
      if (Game.path.canReach({ x: x, y: y }, this.list[i])) return true;
    }
    return false;
  },

  // 主人公から見えている敵の数
  visibleCount: function () {
    var n = 0;
    for (var i = 0; i < this.list.length; i++) {
      if (Game.fov.isVisible(this.list[i].x, this.list[i].y)) n++;
    }
    return n;
  },

  // 全ての敵が1回ずつ行動する（主人公・仲間の行動の後に呼ばれる）
  takeTurn: function () {
    var snapshot = this.list.slice();
    for (var i = 0; i < snapshot.length; i++) {
      if (Game.player.hp <= 0) return; // 主人公が倒れたら以降の敵は動かない
      if (this.list.indexOf(snapshot[i]) < 0) continue; // このターン中に倒された
      this.act(snapshot[i]);
    }
  },

  // e の隣にいて攻撃できる主人公・仲間
  reachableFoes: function (e) {
    var list = [];
    if (Game.path.canReach(e, Game.player)) list.push(Game.player);
    for (var i = 0; i < Game.allies.list.length; i++) {
      if (Game.path.canReach(e, Game.allies.list[i])) list.push(Game.allies.list[i]);
    }
    return list;
  },

  act: function (e) {
    var p = Game.player;
    var path = Game.path;
    if (e.breathCd > 0) e.breathCd--;

    // 0. 必殺技の溜め中
    if (e.charge) {
      Game.specials.continueCharge(e);
      return;
    }

    // 1. 攻撃（ときどき必殺技の溜めを始める）
    if (Game.specials.maybeStart(e)) return;
    var target = Game.combat.chooseTarget(this.reachableFoes(e));
    if (target) {
      // 主人公が倒れた場合は main.js の endTurn で判定する
      if (Game.combat.attack(e, target) && target !== p) Game.allies.die(target);
      return;
    }

    // 2. 離れた相手へのブレス
    if (Game.specials.tryBreath(e)) return;

    if (e.phasing) {
      this.actPhasing(e);
      return;
    }

    // 3. 主人公が見えたら位置を覚える
    if (Game.fov.canSee(e.x, e.y, p.x, p.y)) {
      e.chasing = true;
      e.targetX = p.x;
      e.targetY = p.y;
      e.dest = null;
    }

    var step = null;
    if (e.chasing) {
      // 3〜4. 追跡：覚えた位置へ向かう。着いても主人公がいなければ諦める
      step = path.stepToward(e, e.targetX, e.targetY);
      if (!step) e.chasing = false;
    }
    if (!e.chasing) {
      // 5. うろつき：目的地がない・着いた・誰かが居座っている時は選び直す
      var blocked = e.dest && path.isOccupied(e.dest.x, e.dest.y) && !(e.x === e.dest.x && e.y === e.dest.y);
      if (!e.dest || (e.x === e.dest.x && e.y === e.dest.y) || blocked) {
        e.dest = this.pickDestination(e);
      }
      step = path.stepToward(e, e.dest.x, e.dest.y);
      if (!step) {
        e.dest = null; // 行き詰まったら次のターンに選び直す
        step = path.randomStep(e);
      }
    }

    if (step) {
      e.x += step[0];
      e.y += step[1];
      if (e.chasing && e.x === e.targetX && e.y === e.targetY) e.chasing = false; // 見失った
    }
  },

  // 壁をすり抜ける敵の移動：近く（phasingSense 以内）に主人公がいれば、壁を無視してまっすぐ近づく。
  // いなければ、壁も含めてふらふら漂う。マップの外周より外には出ない
  actPhasing: function (e) {
    var p = Game.player;
    var canFloat = function (x, y) {
      if (x < 1 || y < 1 || x > Game.map.width - 2 || y > Game.map.height - 2) return false;
      return !Game.path.isOccupied(x, y);
    };
    var tries = [];
    if (Game.path.dist(e.x, e.y, p.x, p.y) <= Game.config.phasingSense) {
      var sx = Math.sign(p.x - e.x), sy = Math.sign(p.y - e.y);
      tries = [[sx, sy], [sx, 0], [0, sy]];
    } else {
      tries = [Game.pick(Game.DIRS8)];
    }
    for (var i = 0; i < tries.length; i++) {
      var d = tries[i];
      if ((d[0] !== 0 || d[1] !== 0) && canFloat(e.x + d[0], e.y + d[1])) {
        e.x += d[0];
        e.y += d[1];
        return;
      }
    }
  },

  // うろつきの目的地：基本は今いる部屋の中をぐるぐる。たまに（roamOtherRoomChance）別の部屋へ。
  // 通路にいる時はどこかの部屋を目指す
  pickDestination: function (e) {
    var here = Game.map.roomAt(e.x, e.y);
    if (here && Math.random() >= Game.config.roamOtherRoomChance) {
      return Game.dungeon.randomTileIn(here);
    }
    var rooms = Game.map.rooms.filter(function (r) { return r !== here; });
    var room = Game.pick(rooms.length > 0 ? rooms : Game.map.rooms);
    return Game.dungeon.randomTileIn(room);
  },
};
