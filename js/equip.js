// 装備と、アイテムで起きる状態（眠り・技封じ・守り）。
//   ・装備は3か所（同時にそれぞれ1つ）。持ち物から「使う」で装備／外す（1ターン）
//       weapon（近接武器：ナイフ・刀・ハンマー・ドリル・グローブ）… 主人公の攻撃力が上がる
//         （items.js の weapon：atk＝攻撃力の上乗せ、hit＝命中率の増減、pierce＝防御力を無視、stun＝ひるませる確率）
//       gun（銃）… V キーで向いた方向を選んで撃つ（shoot.js）
//       armor（防具）… 主人公の防御力が上がる（items.js の armor：def＝防御力の上乗せ）
//   ・持ち物から外れる（投げる・置く）と自動で外れる。冒険ごとに外れた状態から始まる
//   ・状態：sleep（眠り。その間は行動しない。攻撃を受けると起きる）、silenced（技を使えない）、主人公の guardTurns（受けるダメージ3/4）
//   ・状態をかける時は statusTurns で実際のターン数を決める（ボスは弱体が効かず、眠りは短い。config.bossResist）
Game.equip = {
  weapon: null, // 装備中の近接武器（アイテムデータ）
  gun: null, // 装備中の銃
  armor: null, // 装備中の防具
  slotNames: { weapon: "武器", gun: "銃", armor: "防具" },

  reset: function () {
    this.weapon = null;
    this.gun = null;
    this.armor = null;
    Game.player.guardTurns = 0;
  },

  // アイテムの種類が入る場所（装備できなければ null）
  slotOf: function (type) {
    var t = Game.items.types[type];
    if (t.weapon) return "weapon";
    if (t.effect === "gun") return "gun";
    if (t.armor) return "armor";
    return null;
  },

  stats: function () {
    return this.weapon ? Game.items.types[this.weapon.type].weapon : null;
  },

  isEquipped: function (entry) {
    return !!entry && (entry === this.weapon || entry === this.gun || entry === this.armor);
  },

  // 使う：装備する／外す（1ターン）
  toggle: function (entry) {
    var slot = this.slotOf(entry.type);
    if (this[slot] === entry) {
      this.unequip(slot, true);
      return;
    }
    if (this[slot]) this.unequip(slot, true);
    var t = Game.items.types[entry.type];
    this[slot] = entry;
    var bonus = this.applyBonus(t, 1);
    Game.sound.play("maxup");
    Game.log.add(t.name + "を装備した！" + bonus + (t.weapon && t.weapon.note ? " " + t.weapon.note : "") +
      (slot === "gun" ? "（V で撃つ）" : ""), "good");
  },

  // 能力の上乗せを足す（sign=1）・引く（sign=-1）。ログ用の文字を返す
  applyBonus: function (t, sign) {
    var p = Game.player;
    if (t.weapon) {
      p.atk += sign * t.weapon.atk;
      return "（攻撃力 " + (sign > 0 ? "+" : "-") + t.weapon.atk + "）";
    }
    if (t.armor) {
      p.def += sign * t.armor.def;
      return "（防御力 " + (sign > 0 ? "+" : "-") + t.armor.def + "）";
    }
    return "";
  },

  unequip: function (slot, withLog) {
    var entry = this[slot];
    if (!entry) return;
    var t = Game.items.types[entry.type];
    var bonus = this.applyBonus(t, -1);
    if (withLog) Game.log.add(t.name + "を外した。" + bonus);
    this[slot] = null;
  },

  // 持ち物から外れた時（投げる・置く）
  onRemoved: function (entry) {
    for (var slot in this.slotNames) if (this[slot] === entry) this.unequip(slot, true);
  },

  // ---------- 戦闘への効果（主人公の攻撃の時だけ） ----------
  hitMod: function (attacker) {
    var w = attacker === Game.player ? this.stats() : null;
    return w && w.hit ? w.hit : 0;
  },

  // 貫通（ドリル）の時のダメージの元：ドリルの攻撃力＋主人公の素の攻撃力（武器の分を除く）の半分。防御力は無視。
  // 貫通でなければ null
  pierceBase: function (attacker) {
    var w = attacker === Game.player ? this.stats() : null;
    if (!w || !w.pierce) return null;
    return w.atk + (attacker.atk - w.atk) / 2;
  },

  // 攻撃が当たった後：グローブならひるませる（1ターン行動できない。ボスには効かない）
  afterHit: function (attacker, defender) {
    var w = attacker === Game.player ? this.stats() : null;
    if (!w || !w.stun || defender.hp <= 0 || Math.random() >= w.stun) return;
    if (this.statusTurns(defender, "debuff", 1) === 0) {
      Game.log.add(defender.name + "はびくともしない。効果がなかった…（ボスはひるまない）", "miss");
      return;
    }
    defender.sleep = Math.max(defender.sleep || 0, 1);
    Game.log.add(defender.name + "はよろめいた！（1ターン動けない）", "good");
  },

  // ---------- 状態 ----------
  // target に状態をかける時の実際のターン数（0 なら効かない）。
  //   kind："sleep"（眠り）/ "debuff"（技封じ・ひるみ・放逐などの弱体）/ "ailment"（毒・麻痺・出血などの状態異常。将来用）
  //   ボスは弱体が効かず、眠りは最大 bossResist.sleepTurns ターン、状態異常は ailmentMul 倍（最低1ターン）
  statusTurns: function (target, kind, turns) {
    if (!target.isBoss) return turns;
    var r = Game.config.bossResist;
    if (kind === "debuff") return 0;
    if (kind === "sleep") return Math.min(turns, r.sleepTurns);
    if (kind === "ailment") return Math.max(1, Math.round(turns * r.ailmentMul));
    return turns;
  },

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

  // 主人公の守り（守護の札）：受けるダメージを3/4に
  guardDamage: function (defender, dmg) {
    if (defender === Game.player && Game.player.guardTurns > 0) return Math.max(1, Math.ceil(dmg * 0.75));
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
