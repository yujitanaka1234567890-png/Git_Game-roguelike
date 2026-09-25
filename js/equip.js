// 武器の装備と、アイテムで起きる状態（眠り・技封じ・守り）。
//   ・近接武器（ナイフ・刀・ハンマー・ドリル・グローブ）は持ち物から「使う」で装備／外す。装備中は主人公の攻撃力が上がる
//     （items.js の weapon：atk＝攻撃力の上乗せ、hit＝命中率の増減、pierce＝相手の防御力を無視、stun＝当てた時に相手をひるませる確率）
//   ・同時に装備できる武器は1つ。持ち物から外れる（投げる・置く）と自動で外れる。冒険ごとに外れた状態から始まる
//   ・状態：sleep（眠り。その間は行動しない。攻撃を受けると起きる）、silenced（技を使えない）、主人公の guardTurns（受けるダメージ半分）
Game.equip = {
  weapon: null, // 装備中のアイテムデータ

  reset: function () {
    this.weapon = null;
    Game.player.guardTurns = 0;
  },

  stats: function () {
    return this.weapon ? Game.items.types[this.weapon.type].weapon : null;
  },

  isEquipped: function (entry) {
    return !!entry && entry === this.weapon;
  },

  // 使う：装備する／外す（1ターン）
  toggle: function (entry) {
    if (this.weapon === entry) {
      this.unequip(true);
      return;
    }
    if (this.weapon) this.unequip(true);
    var t = Game.items.types[entry.type];
    this.weapon = entry;
    Game.player.atk += t.weapon.atk;
    Game.sound.play("maxup");
    Game.log.add(t.name + "を装備した！（攻撃力 +" + t.weapon.atk + "）" + (t.weapon.note ? " " + t.weapon.note : ""), "good");
  },

  unequip: function (withLog) {
    if (!this.weapon) return;
    var t = Game.items.types[this.weapon.type];
    Game.player.atk -= t.weapon.atk;
    if (withLog) Game.log.add(t.name + "を外した。（攻撃力 -" + t.weapon.atk + "）");
    this.weapon = null;
  },

  // 持ち物から外れた時（投げる・置く）
  onRemoved: function (entry) {
    if (entry === this.weapon) this.unequip(true);
  },

  // ---------- 戦闘への効果（主人公の攻撃の時だけ） ----------
  hitMod: function (attacker) {
    var w = attacker === Game.player ? this.stats() : null;
    return w && w.hit ? w.hit : 0;
  },

  pierces: function (attacker) {
    var w = attacker === Game.player ? this.stats() : null;
    return !!(w && w.pierce);
  },

  // 攻撃が当たった後：グローブならひるませる（1ターン行動できない）
  afterHit: function (attacker, defender) {
    var w = attacker === Game.player ? this.stats() : null;
    if (!w || !w.stun || defender.hp <= 0 || Math.random() >= w.stun) return;
    defender.sleep = Math.max(defender.sleep || 0, 1);
    Game.log.add(defender.name + "はよろめいた！（1ターン動けない）", "good");
  },

  // ---------- 状態 ----------
  // 眠っていればその分ターンを消費して true（行動しない）
  asleep: function (unit) {
    if (!unit.sleep) return false;
    unit.sleep--;
    if (unit.sleep === 0 && unit !== Game.player) Game.log.add(unit.name + "は目を覚ました。", "info");
    return true;
  },

  // 攻撃を受けたら起きる
  wake: function (unit) {
    if (unit.sleep) unit.sleep = 0;
  },

  // 主人公の守り（守護の札）：受けるダメージを半分に
  guardDamage: function (defender, dmg) {
    if (defender === Game.player && Game.player.guardTurns > 0) return Math.max(1, Math.ceil(dmg / 2));
    return dmg;
  },

  // 毎ターン：守りの残りを減らす
  tick: function () {
    var p = Game.player;
    if (p.guardTurns > 0) {
      p.guardTurns--;
      if (p.guardTurns === 0) Game.log.add("守護の札の力が消えた。", "info");
    }
  },
};
