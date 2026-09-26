// 拠点の空間：主人公が歩き回れる小さなマップ。
//   左：牧場（草地）… 連れ帰った仲間たちが歩き回っている。話しかけると「連れて行くか」を選べる
//   右：家（設備は奥の壁ぞいに2マスおきに並ぶ）
//                      収納箱（▣）… 倉庫から持って行く道具を選ぶ
//                      掲示板（掲）… 連れて行く仲間を選ぶ／はぐれた仲間の確認と救出隊の派遣
//                      交配小屋（♥）… 交配のしくみと、見つかった組み合わせ（交配は帰還時に自動。base.autoBreed）
//                      図鑑（図）… 出会ったモンスターのくわしい情報を見る（bestiary.js）
//                      記録の石碑（碑）… 記録を3つまで刻む・読み込む、最初から始める、記録の呪文（saveslots.js・savecode.js）
//                      案内板（案）… 遊び方の説明（tutorial.js。入口の近く）
//   下：門（∩）      … 乗ると行き先のダンジョンを選んで出発
Game.baseScene = {
  monsters: [], // 牧場を歩く仲間 [{entry: 牧場のデータ, x, y}]

  // 拠点のマップを文字で組み立てる（横22 × 縦12）
  buildLayout: function () {
    var W = 22, H = 12;
    var g = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) row.push("#");
      g.push(row);
    }
    var fill = function (x1, y1, x2, y2, ch) {
      for (var yy = y1; yy <= y2; yy++) for (var xx = x1; xx <= x2; xx++) g[yy][xx] = ch;
    };
    fill(1, 1, 8, 10, ","); // 牧場
    fill(10, 1, 20, 7, "."); // 家
    fill(9, 4, 9, 6, "."); // 家と牧場をつなぐ出入口
    fill(14, 8, 16, 9, "."); // 門への通路
    fill(14, 10, 16, 10, "G"); // 門
    g[1][11] = "C"; // 収納箱
    g[1][13] = "K"; // 掲示板
    g[1][15] = "H"; // 交配小屋
    g[1][17] = "Z"; // 図鑑
    g[1][19] = "S"; // 記録の石碑（記録の呪文）
    g[7][10] = "T"; // 案内板（遊び方の説明）：牧場からの出入口の近く（家の左下の隅）
    g[4][15] = "@"; // 拠点に戻った時の位置
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

  // 拠点のマップで、ある設備（文字）がある場所
  findTile: function (ch) {
    for (var y = 0; y < Game.map.height; y++) {
      var x = Game.map.tiles[y].indexOf(ch);
      if (x >= 0) return { x: x, y: y };
    }
    return null;
  },

  // 掲示板：連れて行く仲間を選ぶ・救出隊
  openBoard: function () {
    var self = this;
    var n = Game.base.partyEntries().length;
    var lost = Game.base.lost.length;
    Game.dialog.open({
      title: "掲示板",
      lines: ["冒険の仲間選びと、はぐれた仲間の救出はここで。"],
      options: [
        { label: "連れて行く仲間を選ぶ（" + n + " / " + Game.config.maxAllies + "）", onChoose: function () { self.openPartySelect(0); } },
        { label: "はぐれた仲間の救出" + (lost > 0 ? "（" + lost + " 件）" : ""), onChoose: function () { Game.rescue.openBoard(); } },
        { label: "閉じる" },
      ],
    });
  },

  // 牧場の仲間から、連れて行く子を選ぶ（選ぶたびにウィンドウは開いたまま）
  openPartySelect: function (cursor) {
    var self = this;
    var base = Game.base;
    var home = base.ranch.filter(function (r) { return !r.onMission; });
    var options = home.map(function (r, idx) {
      var t = Game.MONSTERS[r.type];
      var s = Game.enemies.statsOf(r.type);
      return {
        label: (base.selected[r.id] ? "【連れて行く】" : "　　　　　　") + "[[mon:" + r.type + "]] " + t.name +
          "（" + Game.enemies.rarityOf(r.type).label + "　HP" + s.hp + " 攻" + s.atk + "）",
        keepOpen: true,
        onChoose: function () {
          var res = base.toggleParty(r.id);
          if (res === "full") Game.log.add("連れて行ける仲間は " + Game.config.maxAllies + " 体までだ。", "miss");
          self.openPartySelect(idx);
        },
      };
    });
    options.push({ label: "決定して閉じる" });
    Game.dialog.open(
      {
        title: "連れて行く仲間（" + base.partyEntries().length + " / " + Game.config.maxAllies + "）",
        lines: [home.length === 0 ? "牧場にはまだ仲間がいない。ダンジョンで仲間を増やそう。" : "Enter で選ぶ・外す。冒険はいつも Lv1 から。"],
        options: options,
      },
      cursor
    );
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
      this.openBreeding();
      return;
    }
    if (Game.map.tileAt(nx, ny) === "K") {
      this.openBoard();
      return;
    }
    if (Game.map.tileAt(nx, ny) === "Z") {
      Game.bestiary.open(0);
      return;
    }
    if (Game.map.tileAt(nx, ny) === "S") {
      Game.saveSlots.openMenu(); // 記録の枠（3つ）・最初から・記録の呪文
      return;
    }
    if (Game.map.tileAt(nx, ny) === "T") {
      Game.tutorial.open(0);
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
      title: "[[mon:" + m.entry.type + "]] " + t.name + "（" + Game.enemies.rarityOf(m.entry.type).label + "）",
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
          label: (base.taking[entry.id] ? "【持って行く】" : "　　　　　　") + "[[item:" + entry.type + "]] " + Game.items.displayName(entry),
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
            label: "「" + d.name + "」へ出発（全" + d.floors + "階）" + (base.cleared[dungeonId] ? "　踏破済み" : "") + (d.note ? "　⚠" + d.note : ""),
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
        "最深部の帰還のゲート [[tile:O]] か「帰還の鈴」 [[item:returnBell]] で生きて帰ろう。",
      ],
      options: options,
    });
  },

  // 交配小屋：交配は自動（冒険から帰った時に、留守番していた相性のよい2体が子を生む。base.autoBreed）。
  // ここでは仕組みの説明と、これまでに見つかった組み合わせを見られる
  openBreeding: function () {
    var lines = [
      "冒険に出ている間、牧場で留守番している仲間は、相性のよい相手と出会うと子を生むことがある。",
      "生まれた子は親より少し強い。親の2体はダンジョンへ帰っていく。帰ってきた時に知らせが届く。",
    ];
    var known = Game.BREEDING.filter(function (b) { return Game.base.discovered[b.child]; });
    lines.push(known.length > 0 ? "これまでに見つかった組み合わせ：" : "まだ子が生まれたことはない。");
    for (var i = 0; i < known.length; i++) {
      var b = known[i];
      lines.push("[[mon:" + b.parents[0] + "]] " + Game.MONSTERS[b.parents[0]].name + " × [[mon:" + b.parents[1] + "]] " +
        Game.MONSTERS[b.parents[1]].name + " → [[mon:" + b.child + "]] " + Game.MONSTERS[b.child].name);
    }
    Game.dialog.open({ title: "交配小屋", lines: lines, options: [{ label: "閉じる" }] });
  },
};
