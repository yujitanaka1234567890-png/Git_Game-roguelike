// 戦闘計算。攻撃する側・される側は主人公・敵・仲間のどれでも同じ形（hp, atk, def, name）で扱う。
Game.combat = {
  // attacker が defender を攻撃する。HPを減らしてログを出す。倒したら true を返す
  attack: function (attacker, defender) {
    var friendly = attacker === Game.player || Game.allies.list.indexOf(attacker) >= 0;
    if (Math.random() >= Game.config.hitRate) {
      Game.log.add(attacker.name + "の攻撃は外れた", "miss");
      Game.fx.swing(attacker, defender); // 外れても踏み込む動きは見せる
      Game.sound.play("miss");
      return false;
    }
    var dmg = this.calcDamage(attacker, defender);
    this.applyDamage(attacker, defender, dmg);
    Game.log.add(attacker.name + "の攻撃！ " + defender.name + "に " + dmg + " のダメージ", friendly ? "good" : "bad");
    Game.sound.play(friendly ? "hit" : "hurt");
    return defender.hp <= 0;
  },

  // ダメージ = (攻撃力 − 防御力) に ±20% のばらつき。最低でも1
  calcDamage: function (attacker, defender) {
    var base = attacker.atk * Game.water.atkMul(attacker) - defender.def; // 水属性は水たまりの上で強い
    var rand = 0.8 + Math.random() * 0.4;
    return Math.max(1, Math.round(base * rand));
  },

  // HPを減らす。敵が受けたダメージは「誰が与えたか」を記録する（倒した時の経験値の分配に使う）
  applyDamage: function (source, defender, dmg) {
    var actual = Math.min(dmg, defender.hp); // 残りHPを超えた分は数えない
    defender.hp -= actual;
    defender.wasHit = true; // ダッシュの間あけなどの判定用
    Game.fx.hitMark(defender, source); // のけぞり＋赤いとげとげ
    if (defender.dmgLog && source) defender.dmgLog.push({ unit: source, amount: actual });
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
