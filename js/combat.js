// 戦闘計算。攻撃する側・される側は主人公・敵・仲間のどれでも同じ形（hp, atk, def, name）で扱う。
Game.combat = {
  // attacker が defender を攻撃する。HPを減らしてログを出す。倒したら true を返す
  attack: function (attacker, defender) {
    var friendly = attacker === Game.player || Game.allies.list.indexOf(attacker) >= 0;
    if (Math.random() >= Game.config.hitRate + Game.equip.hitMod(attacker)) { // 武器で命中率が変わる
      Game.log.add(attacker.name + "の攻撃は外れた", "miss");
      Game.fx.swing(attacker, defender); // 外れても踏み込む動きは見せる
      Game.sound.play("miss");
      return false;
    }
    var dmg = this.calcDamage(attacker, defender);
    this.applyDamage(attacker, defender, dmg);
    Game.log.add(attacker.name + "の攻撃！ " + defender.name + "に " + dmg + " のダメージ", friendly ? "good" : "bad");
    Game.sound.play(friendly ? "hit" : "hurt");
    Game.equip.afterHit(attacker, defender); // グローブ：ときどきひるませる
    return defender.hp <= 0;
  },

  // ダメージ = (攻撃力 − 防御力) に ±20% のばらつき。最低でも1
  // ドリル（貫通）：防御力を無視する代わりに、ドリルの攻撃力＋主人公の素の攻撃力の半分だけ
  calcDamage: function (attacker, defender) {
    var pierce = Game.equip.pierceBase(attacker);
    var base = pierce !== null ? pierce : attacker.atk * Game.water.atkMul(attacker) - defender.def; // 水属性は水たまりの上で強い
    var rand = 0.8 + Math.random() * 0.4;
    return Math.max(1, Math.round(base * rand));
  },

  // HPを減らす。敵が受けたダメージは「誰が与えたか」を記録する（倒した時の経験値の分配に使う）
  applyDamage: function (source, defender, dmg) {
    dmg = Game.equip.guardDamage(defender, dmg); // 守護の札：主人公が受けるダメージ半分
    Game.equip.wake(defender); // 攻撃を受けると起きる
    var actual = Math.min(dmg, defender.hp); // 残りHPを超えた分は数えない
    defender.hp -= actual;
    defender.wasHit = true; // ダッシュの間あけなどの判定用
    Game.fx.hitMark(defender, source); // のけぞり＋赤いとげとげ
    Game.fx.popNumber(defender, actual); // ダメージの数字がぴょんと跳ねる
    if (defender.dmgLog && source) defender.dmgLog.push({ unit: source, amount: actual });
    this.breakBossCharge(defender, actual);
  },

  // ボスが技を溜めている間に、最大HPの bossBreakRatio 以上のダメージを与えると溜めが崩れて技が止まる（ボスだけ）
  breakBossCharge: function (unit, amount) {
    var c = unit.charge;
    var t = unit.type && Game.MONSTERS[unit.type];
    if (!c || !t || !t.boss || unit.hp <= 0) return;
    c.taken = (c.taken || 0) + amount;
    if (c.taken < unit.maxHp * Game.config.bossBreakRatio) return;
    unit.charge = null;
    Game.log.add("★ " + unit.name + "の構えが崩れた！「" + Game.SKILLS[c.skill].name + "」は止まった。", "good", { skill: c.skill });
    Game.notice.show(unit.name + "の技を止めた！", "good");
  },

  // 隣にいる攻撃候補から相手を選ぶ：基本はHPが一番少ない相手。
  // ときどき（randomTargetChance）ランダムに選ぶ。候補がなければ null
  chooseTarget: function (candidates) {
    if (candidates.length === 0) return null;
    if (Math.random() < Game.config.randomTargetChance) return Game.pick(candidates);
    var best = candidates[0];
    for (var i = 1; i < candidates.length; i++) {
      if (candidates[i].hp < best.hp) best = candidates[i];
    }
    return best;
  },
};
