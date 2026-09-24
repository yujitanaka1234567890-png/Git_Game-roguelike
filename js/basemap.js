// 拠点の空間：主人公が歩き回れる小さなマップ。
//   左：牧場（草地）… 連れ帰った仲間たちが歩き回っている。話しかけると「連れて行くか」を選べる
//   右：家           … 収納箱（▣）に触れると、倉庫から持って行く道具を選べる
//                      交配小屋（♥）に触れると、牧場の2体から新しい仲間を生み出せる
//                      救出の掲示板（掲）に触れると、はぐれた仲間の確認と救出隊の派遣ができる
//                      記録の石碑（碑）に触れると、記録の呪文（セーブ用パスワード）の書き出し・読み込みができる
//   下：門（∩）      … 乗ると行き先のダンジョンを選んで出発
Game.baseScene = {
  monsters: [], // 牧場を歩く仲間 [{entry: 牧場のデータ, x, y}]

  // 拠点のマップを文字で組み立てる（横40 × 縦14）
  buildLayout: function () {
    var W = 40, H = 14;
    var g = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) row.push("#");
      g.push(row);
    }
    var fill = function (x1, y1, x2, y2, ch) {
      for (var yy = y1; yy <= y2; yy++) for (var xx = x1; xx <= x2; xx++) g[yy][xx] = ch;
    };
    fill(1, 1, 20, 12, ","); // 牧場
    fill(22, 1, 38, 9, "."); // 家
    fill(21, 5, 21, 7, "."); // 家と牧場をつなぐ出入口
    fill(31, 10, 33, 11, "."); // 門への通路
    fill(31, 12, 33, 12, "G"); // 門
    g[2][25] = "C"; // 収納箱
    g[2][35] = "H"; // 交配小屋
    g[2][30] = "K"; // 救出の掲示板
    g[8][37] = "S"; // 記録の石碑（記録の呪文）
    g[6][30] = "@"; // 拠点に戻った時の位置
    return g.map(function (r) { return r.join(""); });
  },

  // 拠点に入る：マップを読み込み、牧場の仲間を草地に散らばらせる
  enter: function () {
    Game.map.loadStatic(this.buildLayout());
    Game.fov.reset();
    Game.renderer.init();
    Game.player.init(Game.map.startX, Game.map.startY);
    this.monsters = [];
    var grass = [];
    for (var y = 0; y < Game.map.height; y++) {
      for (var x = 0; x < Game.map.width; x++) if (Game.map.tiles[y][x] === ",") grass.push({ x: x, y: y });
    }
    for (var i = 0; i < Game.base.ranch.length && grass.length > 0; i++) {
      if (Game.base.ranch[i].onMission) continue; // 救出に出かけている子は牧場にいない
      var k = Math.floor(Math.random() * grass.length);
      var spot = grass.splice(k, 1)[0];
      this.monsters.push({ entry: Game.base.ranch[i], x: spot.x, y: spot.y });
    }
  },

  // 牧場の中身が変わった時（交配など）：いなくなった子を消し、新しい子を草地に置く
  syncMonsters: function () {
    var ranch = Game.base.ranch;
    this.monsters = this.monsters.filter(function (m) { return ranch.indexOf(m.entry) >= 0 && !m.entry.onMission; });
    for (var i = 0; i < ranch.length; i++) {
      if (ranch[i].onMission) continue;
      var here = this.monsters.some(function (m) { return m.entry === ranch[i]; });
      if (here) continue;
      var spots = [];
      for (var y = 0; y < Game.map.height; y++) {
        for (var x = 0; x < Game.map.width; x++) {
          if (Game.map.tiles[y][x] === "," && !this.monsterAt(x, y)) spots.push({ x: x, y: y });
        }
      }
      if (spots.length === 0) break;
      var s = Game.pick(spots);
      this.monsters.push({ entry: ranch[i], x: s.x, y: s.y });
    }
  },

  monsterAt: function (x, y) {
    for (var i = 0; i < this.monsters.length; i++) {
      if (this.monsters[i].x === x && this.monsters[i].y === y) return this.monsters[i];
    }
    return null;
  },

  // 主人公が1歩動こうとした時
  move: function (dx, dy) {
    var p = Game.player;
    var nx = p.x + dx, ny = p.y + dy;
    if (Game.map.tileAt(nx, ny) === "C") {
      this.openStorage(0);
      return;
    }
    if (Game.map.tileAt(nx, ny) === "H") {
      this.openBreeding(null);
      return;
    }
    if (Game.map.tileAt(nx, ny) === "K") {
      Game.rescue.openBoard();
      return;
    }
    if (Game.map.tileAt(nx, ny) === "S") {
      Game.savecode.openMenu();
      return;
    }
    var m = this.monsterAt(nx, ny);
    if (m) {
      this.openTalk(m);
      return;
    }
    if (!Game.map.canStep(p.x, p.y, dx, dy)) return;
    p.x = nx;
    p.y = ny;
    this.wander();
    if (Game.map.tileAt(p.x, p.y) === "G") this.openDepart();
  },

  // 牧場の仲間はときどき草地の上を1歩うろうろする
  wander: function () {
    for (var i = 0; i < this.monsters.length; i++) {
      var m = this.monsters[i];
      if (Math.random() > 0.3) continue;
      var d = Game.pick(Game.DIRS8);
      var nx = m.x + d[0], ny = m.y + d[1];
      if (Game.map.tileAt(nx, ny) !== ",") continue;
      if (this.monsterAt(nx, ny) || (nx === Game.player.x && ny === Game.player.y)) continue;
      m.x = nx;
      m.y = ny;
    }
  },

  // 仲間に話しかける：連れて行くかどうかの選択ウィンドウ
  openTalk: function (m) {
    var base = Game.base;
    var t = Game.enemies.types[m.entry.type];
    var s = Game.enemies.statsOf(m.entry.type);
    var going = !!base.selected[m.entry.id];
    var skillNames = Game.specials.skillsOf({ type: m.entry.type }).map(function (sk) { return sk.def.name; });
    var lines = [
      "HP " + s.hp + "　攻撃力 " + s.atk + "　防御力 " + s.def + "（冒険はLv1から）",
      "技：" + (skillNames.length > 0 ? skillNames.join("・") : "なし"),
      t.evolvesTo
        ? "冒険中に Lv" + t.evolveLevel + " になると「" + Game.enemies.types[t.evolvesTo].name + "」に進化する。"
        : "これ以上は進化しない、完成された姿だ。",
      going ? "出発を楽しみにしているようだ。" : "こちらをじっと見ている。",
    ];
    var toggle = function () {
      var r = base.toggleParty(m.entry.id);
      if (r === "added") Game.log.add(t.name + "を次の冒険に連れて行くことにした。", "good");
      else if (r === "removed") Game.log.add(t.name + "は今回はお留守番だ。");
      else Game.log.add("連れて行ける仲間は " + Game.config.maxAllies + " 体までだ。", "miss");
    };
    Game.dialog.open({
      title: t.symbol + " " + t.name + "（" + Game.enemies.rarityOf(m.entry.type).label + "）",
      lines: lines,
      options: going
        ? [{ label: "連れて行くのをやめる", onChoose: toggle }, { label: "そのままにする" }]
        : [{ label: "一緒に連れて行く", onChoose: toggle }, { label: "やめておく" }],
    });
  },

  // 収納箱：倉庫から持って行く道具を選ぶ（選ぶたびにウィンドウは開いたまま）
  openStorage: function (cursor) {
    var self = this;
    var base = Game.base;
    var options = [];
    for (var i = 0; i < base.storage.length; i++) {
      (function (index, entry) {
        var t = Game.items.types[entry.type];
        options.push({
          label: (base.taking[entry.id] ? "【持って行く】" : "　　　　　　") + t.symbol + " " + Game.items.displayName(entry),
          keepOpen: true,
          onChoose: function () {
            if (base.toggleTaking(entry.id) === "full") {
              Game.log.add("持って行ける道具は " + Game.inventory.max + " 個までだ。", "miss");
            }
            self.openStorage(index); // 表示を更新して同じ位置のまま開き直す
          },
        });
      })(i, base.storage[i]);
    }
    options.push({ label: "閉じる" });
    Game.dialog.open(
      {
        title: "収納箱（" + base.storage.length + " / " + Game.config.storageMax + "）",
        lines: [
          base.storage.length === 0 ? "空っぽだ。" : "持って行く道具を選ぶ（" + base.countTaking() + " / " + Game.inventory.max + "）",
        ],
        options: options,
      },
      cursor
    );
  },

  // 門：行き先のダンジョンを選んで出発
  openDepart: function () {
    var base = Game.base;
    var party = base.partyEntries().map(function (r) { return Game.enemies.types[r.type].name; });
    var options = [];
    for (var id in Game.DUNGEONS) {
      (function (dungeonId, d) {
        if (base.isUnlocked(dungeonId)) {
          options.push({
            label: "「" + d.name + "」へ出発（全" + d.floors + "階）" + (base.cleared[dungeonId] ? "　踏破済み" : ""),
            onChoose: function () { Game.startAdventure(dungeonId); },
          });
        } else {
          options.push({
            label: "？？？（「" + Game.DUNGEONS[d.unlockedBy].name + "」を踏破すると行ける）",
            keepOpen: true,
            onChoose: function () { Game.log.add("まだその道は閉ざされている。", "miss"); },
          });
        }
      })(id, Game.DUNGEONS[id]);
    }
    options.push({ label: "まだ準備する" });
    Game.dialog.open({
      title: "ダンジョンの門",
      lines: [
        "連れて行く仲間：" + (party.length > 0 ? party.join("・") : "なし"),
        "持って行く道具：" + base.countTaking() + " 個",
        "最深部の脱出口（◎）か「帰還の鈴」で生きて帰ろう。",
      ],
      options: options,
    });
  },

  // 交配小屋：牧場から親を2体選ぶ → 結果を確認 → 交配
  //   first = 1体目に選んだ牧場のデータ（まだなら null）
  openBreeding: function (first) {
    var self = this;
    var base = Game.base;
    var home = base.ranch.filter(function (r) { return !r.onMission; }); // 救出に出かけている子は選べない
    if (home.length < 2) {
      Game.dialog.open({
        title: "交配小屋",
        lines: ["牧場に仲間が2体以上いると、新しい仲間を生み出せる。"],
        options: [{ label: "閉じる" }],
      });
      return;
    }
    var options = [];
    for (var i = 0; i < home.length; i++) {
      (function (entry) {
        if (first && entry === first) return;
        var t = Game.MONSTERS[entry.type];
        options.push({
          label: t.symbol + " " + t.name + "（" + Game.enemies.rarityOf(entry.type).label + "）",
          onChoose: function () {
            if (!first) self.openBreeding(entry);
            else self.confirmBreeding(first, entry);
          },
        });
      })(home[i]);
    }
    options.push({ label: "やめる" });
    Game.dialog.open({
      title: "交配小屋",
      lines: first
        ? ["1体目：" + Game.MONSTERS[first.type].name, "2体目を選んでください。"]
        : ["交配すると、親の2体はダンジョンへ帰っていき、新しい子が生まれる。", "1体目を選んでください。"],
      options: options,
    });
  },

  confirmBreeding: function (a, b) {
    var self = this;
    var nameA = Game.MONSTERS[a.type].name, nameB = Game.MONSTERS[b.type].name;
    var child = Game.breedResult(a.type, b.type);
    if (!child) {
      Game.dialog.open({
        title: "交配小屋",
        lines: [nameA + " と " + nameB + " の組み合わせでは、子は生まれないようだ。"],
        options: [{ label: "別の組み合わせを選ぶ", onChoose: function () { self.openBreeding(null); } }, { label: "やめる" }],
      });
      return;
    }
    var known = !!Game.base.discovered[child];
    Game.dialog.open({
      title: "交配小屋",
      lines: [
        nameA + " × " + nameB + " → " + (known ? Game.MONSTERS[child].name : "？？？"),
        "親の2体はダンジョンへ帰っていき、もう牧場には戻らない。本当に交配する？",
      ],
      options: [
        {
          label: "交配する",
          onChoose: function () {
            var born = Game.base.breed(a.id, b.id);
            if (!born) return;
            var t = Game.MONSTERS[born];
            self.syncMonsters();
            Game.log.add(nameA + " と " + nameB + " はダンジョンへ帰っていった。", "info");
            Game.log.add("♥ 新しい仲間「" + t.name + "」が生まれた！", "good");
            Game.fx.flash(Game.fx.around(35, 2, 1), "#ff88cc", 700);
            var sk = Game.specials.skillsOf({ type: born }).map(function (s) { return s.def.name; });
            var st = Game.enemies.statsOf(born);
            Game.dialog.open({
              title: "♥ " + t.name + " が生まれた！（" + Game.enemies.rarityOf(born).label + "）",
              lines: ["HP " + st.hp + "　攻撃力 " + st.atk + "　防御力 " + st.def, "技：" + sk.join("・"), "牧場で待っている。"],
              options: [{ label: "OK" }],
            });
          },
        },
        { label: "やめる" },
      ],
    });
  },
};
