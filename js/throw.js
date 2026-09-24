// アイテムを投げる処理。
//   ・主人公の位置から、選んだ方向へまっすぐ飛ぶ（最大 config.throwRange マス）
//   ・最初に当たったキャラ（敵・仲間）に効果が出て、アイテムはなくなる
//   ・壁（斜めは角の壁も）に当たるか届かなければ、その手前の床に落ちる
Game.throwing = {
  projectile: null, // 飛んでいる最中のアイテム {x, y, symbol, color}（renderer が描く）

  // 飛ぶ道筋を計算する。{ path: [{x,y}...], hit: 当たったキャラ or null }
  trace: function (dx, dy) {
    var x = Game.player.x, y = Game.player.y;
    var path = [];
    for (var i = 0; i < Game.config.throwRange; i++) {
      if (!Game.map.canStep(x, y, dx, dy)) break;
      x += dx;
      y += dy;
      path.push({ x: x, y: y });
      var unit = Game.enemies.at(x, y) || Game.allies.at(x, y);
      if (unit) return { path: path, hit: unit };
    }
    return { path: path, hit: null };
  },

  // entry（アイテムデータ）を投げる。アニメーションが終わったら onDone() を呼ぶ
  start: function (entry, dx, dy, onDone) {
    var t = Game.items.types[entry.type];
    var result = this.trace(dx, dy);
    var self = this;
    var token = Game.dashToken; // 途中でやり直し・階移動したら中断するため
    var i = 0;

    Game.log.add(t.name + "を投げた。");
    Game.sound.play("throw");

    function step() {
      if (token !== Game.dashToken) {
        self.projectile = null;
        return;
      }
      if (i < result.path.length) {
        var pos = result.path[i++];
        self.projectile = { x: pos.x, y: pos.y, symbol: t.symbol, color: t.color, sprite: t.sprite };
        Game.renderer.draw();
        setTimeout(step, Game.config.throwDelay);
        return;
      }
      self.projectile = null;
      self.land(entry, result);
      onDone();
    }
    step();
  },

  // 着地：キャラに当たれば効果、当たらなければ床に落ちる
  land: function (entry, result) {
    var name = Game.items.types[entry.type].name;
    if (result.hit) {
      Game.items.throwHit(entry, result.hit);
      return;
    }
    var last = result.path.length > 0 ? result.path[result.path.length - 1] : Game.player;
    var spot = Game.items.dropSpotNear(last.x, last.y);
    if (spot) {
      Game.items.place(spot.x, spot.y, entry);
      Game.log.add(name + "は床に落ちた。", "miss");
    } else {
      Game.log.add(name + "はどこかへ消えてしまった…", "miss");
    }
  },
};
