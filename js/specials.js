// 技（必殺技）とブレス。技のデータは図鑑データ（js/data/skills.js）にある。
// モンスターは複数の技を持てる（monsters.js の skills）。進化すると技が増えたり強い技に変わる。
//
// 敵が使う時（理不尽にならないように予告つき）：
//   1. 攻撃できる相手がいる時、specialChance の確率で「溜め」を始める → 予兆をログに出す
//   2. specialWindup ターンの間、その場で溜め続ける（毎ターン様子をログに出す。マップ上に「!」印）
//   3. 発動。その時に届く相手がいなければ空振り（離れれば避けられる）
//   主人公・仲間が受けるダメージは、1回で相手の最大HPの specialMaxRatio まで（即死しない）
// 仲間が使う時：allySkillChance の確率で溜めを始め、敵と同じく予兆をログに出して specialWindup ターン後に発動
Game.specials = {
  // 技の説明を選択ウィンドウで見せる（ログの技名をクリックした時）
  showInfo: function (id) {
    var d = Game.SKILLS[id];
    if (!d) return;
    var users = Object.keys(Game.MONSTERS)
      .filter(function (m) { return (Game.MONSTERS[m].skills || []).indexOf(id) >= 0; })
      .map(function (m) { return Game.MONSTERS[m].name; });
    Game.dialog.open({
      title: "技：「" + d.name + "」",
      lines: [
        "範囲：" + this.shapeText(d),
        "威力：使い手の攻撃力 × " + d.mult + (d.hits ? "（" + d.hits + "連撃）" : ""),
        "予兆：「" + d.windup + "」→ 2ターン後に発動（それまでに離れれば避けられる）",
        "受けるダメージは最大HPの " + Math.round(Game.config.specialMaxRatio * 100) + "% まで（即死はしない）",
        "使うモンスター：" + (users.join("・") || "なし"),
      ],
      options: [{ label: "閉じる" }],
    });
    Game.refresh();
  },

  // 技の範囲の説明
  shapeText: function (def) {
    if (def.shape === "range") return "使い手から " + def.range + " マス以内で見えている全員";
    return { single: "隣の1体", around: "隣にいる全員", sight: "使い手から見えている全員" }[def.shape] || def.shape;
  },

  // unit（敵・仲間）が持っている技 [{id, def}]
  skillsOf: function (unit) {
    var ids = Game.MONSTERS[unit.type].skills || [];
    var list = [];
    for (var i = 0; i < ids.length; i++) {
      if (Game.SKILLS[ids[i]]) list.push({ id: ids[i], def: Game.SKILLS[ids[i]] });
    }
    return list;
  },

  // 技が届く相手。side = "enemy"（敵が使う → 主人公・仲間に当たる）/ "ally"（仲間が使う → 敵に当たる）
  // 敵が範囲技（隣の全員・見えている全員）を使うと、範囲にいる他の敵も巻き込まれる（事故）
  targetsFor: function (user, def, side) {
    var candidates;
    if (side === "enemy") {
      candidates = [Game.player].concat(Game.allies.list).filter(function (u) { return u.x >= 0; });
      if (def.shape !== "single") {
        candidates = candidates.concat(Game.enemies.list.filter(function (e) { return e !== user; }));
      }
    } else {
      candidates = Game.enemies.list.slice();
    }
    return candidates.filter(function (u) {
      if (def.shape === "sight") return Game.fov.canSee(user.x, user.y, u.x, u.y);
      if (def.shape === "range") {
        return Math.max(Math.abs(u.x - user.x), Math.abs(u.y - user.y)) <= def.range && Game.fov.canSee(user.x, user.y, u.x, u.y);
      }
      return Game.path.canReach(user, u);
    });
  },

  // 主人公・仲間（敵から見た「狙う相手」）か
  isOurSide: function (u) {
    return u === Game.player || Game.allies.list.indexOf(u) >= 0;
  },

  // 届く相手がいる技からランダムに1つ選ぶ。なければ null
  // （敵は、主人公・仲間に届く時だけ使う。他の敵を狙って使うことはない）
  pickUsable: function (user, side) {
    var self = this;
    var usable = this.skillsOf(user).filter(function (s) {
      var ts = self.targetsFor(user, s.def, side);
      return side === "enemy" ? ts.some(function (u) { return self.isOurSide(u); }) : ts.length > 0;
    });
    return usable.length > 0 ? Game.pick(usable) : null;
  },

  // （敵）溜めを始めるか判定する。始めたら true
  maybeStart: function (e) {
    var skill = this.pickUsable(e, "enemy");
    if (!skill) return false;
    if (Math.random() >= Game.config.specialChance) return false;
    e.charge = { left: Game.config.specialWindup, skill: skill.id };
    Game.sound.play("warn");
    Game.log.add(
      "⚠ " + e.name + "は" + skill.def.windup + "（" + Game.config.specialWindup + "ターン後に「" + skill.def.name + "」）",
      "warn",
      { skill: skill.id }
    );
    Game.fx.flash([{ x: e.x, y: e.y }], "#ffe066", 300);
    return true;
  },

  // （敵）溜め中のターン。残りが0になったら発動
  continueCharge: function (e) {
    var def = Game.SKILLS[e.charge.skill];
    e.charge.left--;
    if (e.charge.left > 0) {
      Game.log.add("⚠ " + e.name + "は" + def.charging + "（「" + def.name + "」まであと" + e.charge.left + "ターン）", "warn", { skill: e.charge.skill });
      Game.fx.flash([{ x: e.x, y: e.y }], "#ffe066", 300);
      return;
    }
    e.charge = null;
    this.release(e, def, "enemy");
  },

  // （仲間）ときどき技の溜めを始める。敵と同じく予兆をログに出し、specialWindup ターン溜めてから発動する
  // （溜め中はその場で動かない。マップ上では青い枠で示す）。始めたら true
  allyTryStart: function (a) {
    if (Math.random() >= Game.config.allySkillChance) return false;
    var skill = this.pickUsable(a, "ally");
    if (!skill) return false;
    a.charge = { left: Game.config.specialWindup, skill: skill.id };
    Game.sound.play("warn");
    Game.log.add(
      "◆ " + a.name + "は" + skill.def.windup + "（" + Game.config.specialWindup + "ターン後に「" + skill.def.name + "」）",
      "ally",
      { skill: skill.id }
    );
    return true;
  },

  // （仲間）溜め中のターン。残りが0になったら発動（その時に届く敵がいなければ空振り）
  allyContinue: function (a) {
    var def = Game.SKILLS[a.charge.skill];
    a.charge.left--;
    if (a.charge.left > 0) {
      Game.log.add("◆ " + a.name + "は" + def.charging + "（「" + def.name + "」まであと" + a.charge.left + "ターン）", "ally", { skill: a.charge.skill });
      return;
    }
    a.charge = null;
    this.release(a, def, "ally");
  },

  release: function (user, def, side) {
    Game.sound.play("special");
    Game.log.add("★ " + user.name + "の「" + def.name + "」！", side === "enemy" ? "bad" : "good", { skill: def.id });
    var targets = this.targetsFor(user, def, side);
    if (targets.length === 0) {
      Game.log.add("しかし、誰にも当たらなかった！", "miss");
      Game.fx.flash(Game.fx.around(user.x, user.y, 1), def.color, 400);
      return;
    }
    if (def.shape === "single") {
      var aimed = side === "enemy" ? targets.filter(this.isOurSide) : targets;
      if (aimed.length === 0) {
        Game.log.add("しかし、誰にも当たらなかった！", "miss");
        return;
      }
      targets = [Game.combat.chooseTarget(aimed)];
    }

    // 派手なエフェクト
    if (def.shape === "around") Game.fx.flash(Game.fx.around(user.x, user.y, 1), def.color, 500);
    if (def.shape === "sight") Game.fx.flash(Game.fx.viewCells(user.x, user.y), def.color, 600);
    if (def.shape === "range") Game.fx.flash(Game.fx.around(user.x, user.y, def.range), def.color, 600);

    for (var i = 0; i < targets.length; i++) this.hit(user, targets[i], def, side);
  },

  // 1体に技を当てる。主人公・仲間が受ける時は、合計ダメージを相手の最大HPの specialMaxRatio までに抑える
  hit: function (user, t, def, side) {
    if (t.hp <= 0 || (t !== Game.player && t.x < 0)) return; // この技ですでに倒れている
    var ours = this.isOurSide(t);
    var accident = side === "enemy" && !ours; // 敵の技に、他の敵が巻き込まれた
    var hits = def.hits || 1;
    var total = 0;
    for (var h = 0; h < hits; h++) {
      total += Math.max(1, Math.round((user.atk * def.mult - t.def) * (0.9 + Math.random() * 0.2)));
      Game.fx.flash([{ x: t.x, y: t.y }], def.color, 180, h * 220); // 連撃は点滅を重ねる
    }
    if (side === "enemy" && ours) total = Math.min(total, Math.ceil(t.maxHp * Game.config.specialMaxRatio));
    Game.combat.applyDamage(user, t, total);
    Game.log.add(
      (accident ? t.name + "も巻き込まれた！ " : t.name + "に ") + total + " のダメージ" + (hits > 1 ? "（" + hits + "連撃）" : ""),
      side === "enemy" && ours ? "bad" : accident ? "info" : "good"
    );
    if (t.hp > 0) return;
    if (side === "ally") Game.enemies.kill(t);
    else if (accident) Game.enemies.killByEnemy(t, user);
    else if (t !== Game.player) Game.allies.die(t);
  },

  // ブレス：2マス以上離れて一直線上にいる相手に吐く（最初に当たったキャラが受ける）
  tryBreath: function (e) {
    var br = Game.MONSTERS[e.type].breath;
    if (!br || e.breathCd > 0) return false;
    var candidates = [];
    for (var d = 0; d < Game.DIRS8.length; d++) {
      var dir = Game.DIRS8[d];
      var x = e.x, y = e.y, cells = [];
      for (var i = 1; i <= br.range; i++) {
        if (!Game.map.canStep(x, y, dir[0], dir[1])) break;
        x += dir[0];
        y += dir[1];
        cells.push({ x: x, y: y });
        if (Game.enemies.at(x, y)) break; // 他の敵がさえぎる
        var u = x === Game.player.x && y === Game.player.y ? Game.player : Game.allies.at(x, y);
        if (u) {
          if (i >= 2) candidates.push({ unit: u, cells: cells.slice() });
          break;
        }
      }
    }
    if (candidates.length === 0) return false;

    var target = Game.combat.chooseTarget(candidates.map(function (c) { return c.unit; }));
    var line = candidates.filter(function (c) { return c.unit === target; })[0].cells;
    var dmg = Math.max(1, Math.round(e.atk * br.power * (0.9 + Math.random() * 0.2)));
    Game.fx.flash(line, "#ff7a1a", 450);
    Game.sound.play("breath");
    Game.combat.applyDamage(e, target, dmg);
    Game.log.add(e.name + "は炎のブレスを吐いた！ " + target.name + "に " + dmg + " のダメージ", "bad");
    if (target.hp <= 0 && target !== Game.player) Game.allies.die(target);
    e.breathCd = br.cooldown;
    return true;
  },
};
