// 主人公の状態と行動。
Game.player = {
  name: "あなた",
  symbol: "@",
  x: 0,
  y: 0,
  // 冒険開始時の能力値。ダンジョンを出る（またはやり直す）と、
  // レベル・経験値・アイテムで上がった分はすべてここに戻る
  base: { maxHp: 20, atk: 5, def: 1 },
  maxHp: 20,
  hp: 20,
  atk: 5, // 攻撃力
  def: 1, // 防御力
  level: 1,
  exp: 0, // 累計経験値

  // 新しい冒険の開始時（能力値を初期値に戻し、HP全快）
  init: function (x, y) {
    this.placeAt(x, y);
    this.maxHp = this.base.maxHp;
    this.atk = this.base.atk;
    this.def = this.base.def;
    this.hp = this.maxHp;
    this.level = 1;
    this.exp = 0;
    Game.mind.reset(); // 精神力も満タン（mind.js）
  },

  // レベル lv になるのに必要な累計経験値（計算は leveling.js）
  expForLevel: function (lv) {
    return Game.leveling.expForLevel(lv);
  },

  // 経験値を得る。必要量に届いたらレベルアップ（一度に複数上がることもある）
  gainExp: function (amount) {
    var cfg = Game.config.leveling;
    Game.leveling.gain(this, amount, { hp: cfg.hpPerLevel, atk: cfg.atkPerLevel }, "あなた");
  },

  // 階を移動した時など、位置だけ変える
  placeAt: function (x, y) {
    this.x = x;
    this.y = y;
  },

  // dx, dy 方向へ行動する。敵がいれば攻撃、いなければ移動。
  // 仲間がいる方向へ動くと、仲間と場所を入れ替える。
  // 結果を文字列で返す： "moved"（動けた） / "attacked"（攻撃した） / "blocked"（進めない）
  tryMove: function (dx, dy) {
    var nx = this.x + dx;
    var ny = this.y + dy;
    var enemy = Game.enemies.at(nx, ny);
    // 壁の中にいる「壁をすり抜ける敵」にも攻撃は届く
    if (!Game.map.canStep(this.x, this.y, dx, dy) && !(enemy && enemy.phasing)) return "blocked";

    if (enemy) {
      if (Game.combat.attack(this, enemy)) Game.enemies.kill(enemy);
      return "attacked";
    }

    // 仲間がいたら場所を入れ替える
    var ally = Game.allies.at(nx, ny);
    if (ally) {
      ally.x = this.x;
      ally.y = this.y;
    }

    this.x = nx;
    this.y = ny;
    Game.items.pickupAt(nx, ny);
    Game.rescue.checkStep(nx, ny); // はぐれた仲間の気配を踏んだら救出
    var st = this.stairsHere();
    if (st) {
      var icon = st.action === "escape" ? "[[tile:O]]" : "[[tile:>]]";
      Game.log.add(icon + " " + st.label + "がある。（" + st.key + " を2回で" + st.verb + "）");
      Game.notice.show(st.label + "の上にいる。" + st.ask + "（" + st.key + " を2回押すと" + st.verb + "）", "info");
    }
    return "moved";
  },

  // 足元が階段なら、その階段の情報（config.js の Game.STAIRS）を返す。違えば null
  stairsHere: function () {
    return Game.STAIRS[Game.map.tileAt(this.x, this.y)] || null;
  },

  onStairs: function () {
    return this.stairsHere() !== null;
  },

  // 一定ターンごとにHPが1回復する
  regen: function (turn) {
    if (turn % Game.config.regenTurns === 0 && this.hp < this.maxHp) this.hp++;
  },
};
