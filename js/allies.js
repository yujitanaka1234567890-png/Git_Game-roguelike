// 仲間モンスター。倒した敵が一定確率で仲間になり、主人公についてきて一緒に戦う。
// 仲間もレベルアップする（経験値は敵に与えたダメージの割合でもらえる。enemy.js の expShares）。
// 拠点に帰ると仲間もLv1に戻る（牧場には種類だけを記録し、冒険のたびにLv1で作り直す）。
// 決まったLvに達すると別の種類に進化する。生きて帰れば進化した姿が牧場に残り、途中で倒れたら取り消し。
// 仲間もときどき技を使う（敵と同じく予兆をログに出し、2ターン溜めてから発動）。
// 仲間には2種類ある：
//   ・拠点から連れてきた子（fromBase）… 倒れても・入れ替えで外しても拠点に戻るだけ
//   ・この冒険で仲間になった子         … 倒れる・外す・主人公が倒れると失われる。脱出すれば牧場へ
// 行動の優先順位：
//   1. 隣に敵がいれば攻撃（基本はHPが一番少ない敵、ときどきランダム）
//   2. 見えている敵がいて、主人公から離れすぎない範囲なら、そこへ向かう
//   3. 主人公の隣にいなければ、主人公についていく
Game.allies = {
  list: [],
  pending: [], // 心を開いたが仲間がいっぱいで、入れ替えるか確認待ちの候補 [{type, x, y, rescued?}]

  clear: function () {
    this.list = [];
    this.pending = [];
  },

  // 倒した敵が仲間になるか判定する（確率はレア度で決まる）。
  // 仲間がいっぱいなら、ターンの終わりに入れ替え確認を出すため pending に入れる
  tryRecruit: function (enemy) {
    if (Math.random() >= Game.enemies.rarityOf(enemy.type).recruit) return;
    var name = Game.enemies.types[enemy.type].name;
    if (this.list.length >= Game.config.maxAllies) {
      Game.log.add(name + "は心を開いた！ でも仲間はいっぱいだ…", "good");
      this.pending.push({ type: enemy.type, x: enemy.x, y: enemy.y });
      return;
    }
    this.join(enemy.type, enemy.x, enemy.y);
  },

  // 新しい仲間を加える（仲間になった直後はHP半分）。その場所がふさがっていれば主人公の近くに置く
  join: function (typeId, x, y) {
    if (Game.path.isOccupied(x, y) || !Game.map.isWalkable(x, y)) {
      var spot = Game.path.freeTilesNear(Game.player.x, Game.player.y, 1)[0];
      x = spot ? spot.x : -1;
      y = spot ? spot.y : -1;
    }
    var ally = this.create(typeId, x, y, null);
    ally.hp = Math.ceil(ally.maxHp / 2);
    this.list.push(ally);
    Game.log.add(ally.baseName + "が仲間になった。", "good");
    Game.sound.play("recruit");
    return ally;
  },

  // 仲間のデータを作る（Lv1）。ranchId = 拠点の牧場から連れてきた子ならその番号、新入りは null
  create: function (typeId, x, y, ranchId) {
    var t = Game.enemies.types[typeId];
    var s = Game.enemies.statsOf(typeId); // レア度の倍率込みの能力値
    return {
      type: typeId,
      baseName: t.name,
      name: "仲間の" + t.name, // ログで敵と区別するため
      symbol: t.symbol,
      color: t.color,
      maxHp: s.hp,
      hp: s.hp,
      atk: s.atk,
      def: s.def,
      level: 1,
      exp: 0,
      x: x,
      y: y,
      origType: typeId, // 仲間になった時の姿（倒れて進化が取り消された時の記録に使う）
      ranchId: ranchId === undefined ? null : ranchId,
      fromBase: ranchId !== undefined && ranchId !== null,
    };
  },

  // 入れ替え確認：index 番目の仲間と先頭の候補を入れ替える。index が -1 なら「仲間にしない」
  resolvePending: function (index) {
    var cand = this.pending.shift();
    if (!cand) return;
    var name = Game.enemies.types[cand.type].name;
    if (index < 0 || index >= this.list.length) {
      Game.log.add(name + "とはここで別れた。", "miss");
      return;
    }
    this.dismiss(this.list[index]);
    var ally = this.join(cand.type, cand.x, cand.y);
    if (cand.rescued) ally.rescued = true; // はぐれた所を救出された子（次に倒れたらもう戻らない）
  },

  // 仲間から外す（入れ替え時）
  dismiss: function (ally) {
    this.remove(ally);
    if (ally.fromBase) Game.log.add(ally.baseName + "は拠点へ帰っていった。");
    else Game.log.add(ally.baseName + "とはお別れした…", "miss");
  },

  gainExp: function (ally, amount) {
    Game.leveling.gain(ally, amount, Game.enemies.types[ally.type].growth, ally.name);
    // 進化のLvに届いていたら進化（一度に2段階上がることもある）
    while (Game.enemies.types[ally.type].evolvesTo && ally.level >= Game.enemies.types[ally.type].evolveLevel) {
      this.evolve(ally);
    }
  },

  // 進化：別の種類に変わる。能力は新しい種類の値（Lv込み）になり、
  // それまでにアイテムなどで上げた分は引き継ぐ。HPは全回復。技も新しい種類のものになる。
  // 進化は生きて拠点に帰った時に確定する（途中で倒れたら取り消し。main.js の escapeDungeon で牧場に反映）
  evolve: function (ally) {
    var E = Game.enemies;
    var oldT = E.types[ally.type], oldS = E.statsOf(ally.type);
    var newId = oldT.evolvesTo, newT = E.types[newId], newS = E.statsOf(newId);
    var lv = ally.level;
    // 同じLvの「素の能力」との差 ＝ アイテムなどで上がった分
    var bonusHp = ally.maxHp - (oldS.hp + oldT.growth.hp * (lv - 1));
    var bonusAtk = ally.atk - (oldS.atk + oldT.growth.atk * (lv - 1));
    var bonusDef = ally.def - oldS.def;
    var oldName = ally.baseName;

    ally.type = newId;
    ally.baseName = newT.name;
    ally.name = "仲間の" + newT.name;
    ally.symbol = newT.symbol;
    ally.color = newT.color;
    ally.maxHp = Math.max(1, newS.hp + newT.growth.hp * (lv - 1) + bonusHp);
    ally.hp = ally.maxHp;
    ally.atk = Math.max(1, newS.atk + newT.growth.atk * (lv - 1) + bonusAtk);
    ally.def = Math.max(0, newS.def + bonusDef);

    Game.log.add("✦ " + oldName + "の体がまばゆく光る…！ " + newT.name + "に進化した！", "good");
    Game.sound.play("evolve");
    if (ally.x >= 0) Game.fx.flash(Game.fx.around(ally.x, ally.y, 1), "#fff3a0", 700);
    var skills = Game.specials.skillsOf(ally).map(function (s) { return s.def.name; });
    Game.log.add(newT.name + "の技：" + skills.join("・"), "good");
  },

  at: function (x, y) {
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].x === x && this.list[i].y === y) return this.list[i];
    }
    return null;
  },

  remove: function (ally) {
    var i = this.list.indexOf(ally);
    if (i >= 0) this.list.splice(i, 1);
  },

  // 倒れた時：拠点から連れてきた子は拠点に戻るだけ（この冒険中の進化は取り消し）。この冒険の新入りは失われる
  die: function (ally) {
    this.remove(ally);
    if (ally.fromBase) Game.log.add(ally.name + "は力尽きて、元の姿で拠点へ戻っていった…", "bad");
    else Game.log.add(ally.name + "は倒れてしまった…", "bad");
  },

  // 新しい階に着いた時、主人公の近くに並べる
  placeNear: function (x, y) {
    // いったん全員を盤面から外してから、空いている場所を探す
    for (var i = 0; i < this.list.length; i++) {
      this.list[i].x = this.list[i].y = -1;
      this.list[i].charge = null; // 階を移ったら技の溜めは取りやめ
    }
    var spots = Game.path.freeTilesNear(x, y, this.list.length);
    for (var j = 0; j < this.list.length; j++) {
      if (spots[j]) {
        this.list[j].x = spots[j].x;
        this.list[j].y = spots[j].y;
      }
    }
  },

  takeTurn: function () {
    var snapshot = this.list.slice();
    for (var i = 0; i < snapshot.length; i++) {
      if (this.list.indexOf(snapshot[i]) < 0) continue; // このターン中に倒れた
      this.act(snapshot[i]);
    }
  },

  act: function (a) {
    var p = Game.player;
    var path = Game.path;

    // 0. 技の溜め中なら溜めを続ける／発動。そうでなければ、ときどき溜めを始める（届く相手がいる時だけ）
    if (a.charge) {
      Game.specials.allyContinue(a);
      return;
    }
    if (Game.specials.allyTryStart(a)) return;

    // 1. 隣の敵から相手を選んで攻撃
    var candidates = Game.enemies.list.filter(function (e) {
      return path.canReach(a, e);
    });
    var foe = Game.combat.chooseTarget(candidates);
    if (foe) {
      if (Game.combat.attack(a, foe)) Game.enemies.kill(foe);
      return;
    }

    // 2. 見えている一番近い敵へ向かう（主人公から leash マス以内の敵だけ）
    var target = null, best = 999;
    for (var k = 0; k < Game.enemies.list.length; k++) {
      var en = Game.enemies.list[k];
      if (!Game.fov.canSee(a.x, a.y, en.x, en.y)) continue;
      if (path.dist(p.x, p.y, en.x, en.y) > Game.config.allyLeash) continue;
      var d = path.dist(a.x, a.y, en.x, en.y);
      if (d < best) { best = d; target = en; }
    }

    var step = null;
    if (target) step = path.stepToward(a, target.x, target.y);
    // 3. 主人公についていく
    else if (path.dist(a.x, a.y, p.x, p.y) > 1) step = path.stepToward(a, p.x, p.y);

    if (step) {
      a.x += step[0];
      a.y += step[1];
    }
  },

  // 自然回復（主人公と同じ間隔）
  regen: function (turn) {
    if (turn % Game.config.regenTurns !== 0) return;
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].hp < this.list[i].maxHp) this.list[i].hp++;
    }
  },

  // 入れ替え確認ウィンドウを開く（pending の先頭の候補について）。
  // 選び終わったら onDone() を呼ぶ（候補がまだ残っていれば、呼び出し側がもう一度開く）
  openRecruitDialog: function (onDone) {
    var self = this;
    var cand = this.pending[0];
    var t = Game.enemies.types[cand.type];
    var s = Game.enemies.statsOf(cand.type);
    var options = [];
    for (var i = 0; i < this.list.length; i++) {
      (function (index, a) {
        options.push({
          label: a.baseName + " Lv" + a.level + " と入れ替える" + (a.fromBase ? "（拠点へ帰る）" : "（お別れ）"),
          onChoose: function () {
            self.resolvePending(index);
            onDone();
          },
        });
      })(i, this.list[i]);
    }
    var decline = function () {
      self.resolvePending(-1);
      onDone();
    };
    options.push({ label: "仲間にしない", onChoose: decline });
    Game.dialog.open({
      title: t.name + "（" + Game.enemies.rarityOf(cand.type).label + "）が心を開いた！",
      lines: ["HP " + s.hp + "　攻撃力 " + s.atk + "　仲間はいっぱいだ。誰かと入れ替える？"],
      options: options,
      onCancel: decline,
    });
  },

  // 画面上部の仲間一覧
  render: function () {
    var el = document.getElementById("party");
    el.innerHTML = "";
    var title = document.createElement("span");
    title.className = "party-title";
    title.textContent = "仲間 " + this.list.length + "/" + Game.config.maxAllies;
    el.appendChild(title);
    if (this.list.length === 0) {
      var none = document.createElement("span");
      none.className = "party-none";
      none.textContent = "（なし）";
      el.appendChild(none);
    }
    for (var i = 0; i < this.list.length; i++) {
      var a = this.list[i];
      var item = document.createElement("span");
      item.className = "party-member";
      var sym = document.createElement("b");
      sym.style.color = a.color;
      sym.textContent = a.symbol + " ";
      item.appendChild(sym);
      item.appendChild(
        document.createTextNode(
          a.baseName + " Lv" + a.level + "　HP " + a.hp + "/" + a.maxHp +
          "　経験 " + a.exp + "/" + Game.leveling.expForLevel(a.level + 1) +
          (a.fromBase ? "" : "　★新入り")
        )
      );
      el.appendChild(item);
    }
  },
};
