// 撃つ・振る：銃と杖（方向を選んで使うアイテム）。
//   ・持ち物で「使う」→ 方向を選ぶ → 弾（光）がまっすぐ飛び、最初に当たったキャラに効果（仲間にも当たる）
//   ・使える回数は items.js の charges。使い切ると「空」になり、もう撃てない（投げることはできる）
//   ・銃は遠くから撃てる代わりに、ダメージは攻撃力に関係なく固定（items.js の power）で弱め
//   ・杖：夢見の杖＝眠らせる／反発の杖＝はじき飛ばす（壁や相手にぶつかると少し痛い）／放逐の杖＝遠くへ飛ばす
Game.shoot = {
  // 残りの回数
  left: function (entry) {
    return Game.items.types[entry.type].charges - (entry.uses || 0);
  },

  // 方向を選ぶ前の確認。撃てなければ理由のメッセージ、撃てれば null
  check: function (entry) {
    if (this.left(entry) > 0) return null;
    return Game.items.types[entry.type].emptyText;
  },

  // entry を (dx, dy) 方向へ撃つ。アニメーションが終わったら onDone()
  start: function (entry, dx, dy, onDone) {
    var t = Game.items.types[entry.type];
    var result = this.trace(dx, dy, t.range);
    var token = Game.dashToken;
    var i = 0;
    entry.uses = (entry.uses || 0) + 1;
    Game.log.add(t.name + "を" + Game.items.verbs[t.category] + "。（残り " + this.left(entry) + "）");
    Game.sound.play(t.category === "gun" ? "hit" : "special");
    var step = function () {
      if (token !== Game.dashToken) {
        Game.throwing.projectile = null;
        return;
      }
      if (i < result.path.length) {
        var pos = result.path[i++];
        Game.throwing.projectile = { x: pos.x, y: pos.y, symbol: t.boltSymbol, color: t.boltColor, sprite: null };
        Game.renderer.draw();
        setTimeout(step, Game.config.throwDelay * 0.6);
        return;
      }
      Game.throwing.projectile = null;
      if (result.hit) Game.shoot.effects[t.shot](t, result.hit, dx, dy);
      else Game.log.add("何にも当たらなかった。", "miss");
      onDone();
    };
    step();
  },

  // 飛ぶ道筋（throw.js と同じ考え方。range マスまで）
  trace: function (dx, dy, range) {
    var x = Game.player.x, y = Game.player.y, path = [];
    for (var i = 0; i < range; i++) {
      if (!Game.map.canStep(x, y, dx, dy)) break;
      x += dx;
      y += dy;
      path.push({ x: x, y: y });
      var unit = Game.enemies.at(x, y) || Game.allies.at(x, y);
      if (unit) return { path: path, hit: unit };
    }
    return { path: path, hit: null };
  },

  // 当たった相手を倒した時の後始末
  finish: function (target) {
    if (target.hp > 0) return;
    if (Game.allies.list.indexOf(target) >= 0) Game.allies.die(target);
    else Game.enemies.kill(target);
  },

  effects: {
    // 銃：攻撃力に関係なく固定ダメージ（防御力は引く。最低1）
    bullet: function (t, target) {
      var dmg = Math.max(1, t.power - (target.def || 0));
      Game.combat.applyDamage(Game.player, target, dmg);
      Game.log.add("弾が" + target.name + "に当たった！ " + dmg + " のダメージ", "good");
      Game.shoot.finish(target);
    },

    // 夢見の杖：眠らせる（ボスは短い）
    sleep: function (t, target) {
      var turns = Game.equip.statusTurns(target, "sleep", t.power); // ボスは短い
      target.sleep = Math.max(target.sleep || 0, turns);
      target.charge = null;
      Game.log.add(target.name + "は深い眠りに落ちた…（" + turns + "ターン。攻撃を受けると起きる）", "good");
    },

    // 反発の杖：撃った向きへ power マスはじき飛ばす。途中で止まったらぶつかって 3 ダメージ
    knock: function (t, target, dx, dy) {
      var moved = 0;
      while (moved < t.power && Game.map.canStep(target.x, target.y, dx, dy) && Game.path.isFree(target.x + dx, target.y + dy)) {
        target.x += dx;
        target.y += dy;
        moved++;
      }
      Game.log.add(target.name + "は " + moved + " マスはじき飛ばされた！", "good");
      if (moved < t.power) {
        Game.combat.applyDamage(Game.player, target, 3);
        Game.log.add(target.name + "はぶつかって 3 のダメージ", "good");
        Game.shoot.finish(target);
      }
    },

    // 放逐の杖：この階のどこか遠く（主人公から見えない床）へ飛ばす。ボスには効かない
    banish: function (t, target) {
      if (Game.equip.statusTurns(target, "debuff", 1) === 0) {
        Game.log.add(target.name + "には効かなかった…", "miss");
        return;
      }
      var p = Game.player, spots = [];
      for (var y = 0; y < Game.map.height; y++) {
        for (var x = 0; x < Game.map.width; x++) {
          if (!Game.map.isFloor(Game.map.tileAt(x, y)) || !Game.path.isFree(x, y)) continue;
          if (Game.fov.isVisible(x, y) || Math.abs(x - p.x) + Math.abs(y - p.y) < 10) continue;
          spots.push({ x: x, y: y });
        }
      }
      if (spots.length === 0) {
        Game.log.add("しかし何も起こらなかった。", "miss");
        return;
      }
      var s = Game.pick(spots);
      target.x = s.x;
      target.y = s.y;
      target.charge = null;
      Game.log.add(target.name + "はどこか遠くへ飛ばされていった！", "good");
    },
  },
};
