// レベルと経験値（主人公・仲間の共通処理）。
// 必要な累計経験値：Lv n になるには expBase × (n-1) × n（例 expBase=5：Lv2=10, Lv3=30, Lv4=60 …）
Game.leveling = {
  expForLevel: function (lv) {
    return Game.config.leveling.expBase * (lv - 1) * lv;
  },

  // unit（level, exp, maxHp, hp, atk を持つ）に経験値を与える。
  // growth = { hp: レベルごとの最大HP上昇, atk: 攻撃力上昇 }  label = ログに出す名前
  gain: function (unit, amount, growth, label) {
    var maxLevel = Game.config.leveling.maxLevel;
    unit.exp += amount;
    while (unit.level < maxLevel && unit.exp >= this.expForLevel(unit.level + 1)) {
      unit.level++;
      Game.sound.play("levelup");
      unit.maxHp += growth.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + growth.hp);
      unit.atk += growth.atk;
      Game.log.add(
        label + "は Lv" + unit.level + " になった！（最大HP+" + growth.hp + " 攻撃力+" + growth.atk + "）",
        "good"
      );
    }
  },
};
