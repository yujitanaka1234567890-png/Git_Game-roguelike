// 画面への描画だけを担当する。ゲームのルール（移動判定など）はここに書かない。
// 見た目は「ドット絵」（pixelart.js・data/sprites.js）と「文字表示」の2通り。V キーで切り替え。
Game.renderer = {
  canvas: null,
  ctx: null,

  // 地形・設備のドット絵と色（地形の文字 → 絵の名前・基本色）
  tileSprites: {
    ">": { sprite: "stairs", color: "#9ab0c8", char: "▼", charColor: "#cde" },
    "O": { sprite: "exit", color: "#ffe066", char: "◎", charColor: "#ffe066" },
    "C": { sprite: "chest", color: "#e0b050", char: "▣", charColor: "#e0b050" },
    "H": { sprite: "hut", color: "#ff99cc", char: "♥", charColor: "#ff88cc" },
    "K": { sprite: "board", color: "#8a5a2a", char: "掲", charColor: "#ffcc55" },
    "G": { sprite: "gate", color: "#c8a8ff", char: "∩", charColor: "#c8a8ff" },
  },

  init: function () {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    var ts = Game.config.tileSize;
    this.canvas.width = Game.map.width * ts;
    this.canvas.height = Game.map.height * ts;
  },

  draw: function () {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    var c = Game.config.colors;
    var fov = Game.fov;
    var pixel = Game.pixel.enabled;
    // ダンジョンでは、その世界（js/data/worlds.js）の壁・床の色を使う
    var wc = Game.state === "base" ? null : Game.WORLDS[Game.currentDungeon().world].colors;
    var colors = {
      wall: wc ? wc.wall : c.wall, wallDim: wc ? wc.wallDim : c.wallDim,
      floor: wc ? wc.floor : c.floor, floorDim: wc ? wc.floorDim : c.floorDim,
    };

    // ---- マップ：未探索は真っ黒、探索済みで今見えていない所は暗く、見えている所は明るく ----
    for (var y = 0; y < Game.map.height; y++) {
      for (var x = 0; x < Game.map.width; x++) {
        if (!fov.isExplored(x, y)) {
          ctx.fillStyle = c.unexplored;
          ctx.fillRect(x * ts, y * ts, ts, ts);
          continue;
        }
        this.drawTile(x, y, Game.map.tiles[y][x], fov.isVisible(x, y), colors, pixel);
      }
    }

    // ---- 拠点の牧場を歩く仲間（連れて行く子は青い下地） ----
    if (Game.state === "base") {
      var ms = Game.baseScene.monsters;
      for (var b = 0; b < ms.length; b++) {
        var mt = Game.MONSTERS[ms[b].entry.type];
        if (Game.base.selected[ms[b].entry.id]) this.drawAllyBg(ms[b].x, ms[b].y);
        this.drawMonster(mt, ms[b].x, ms[b].y);
      }
    }

    // ---- 床のアイテム（一度見た物は、今見えていなくても暗く表示） ----
    var items = Game.items.floorItems;
    for (var j = 0; j < items.length; j++) {
      var fi = items[j];
      if (!fi.seen) continue;
      var it = Game.items.types[fi.type];
      var litItem = fov.isVisible(fi.x, fi.y);
      this.drawThing(it.sprite, null, it.color, fi.x, fi.y, it.symbol, litItem ? it.color : "#555");
      if (!litItem) this.dimCell(fi.x, fi.y);
    }

    // ---- はぐれた仲間の気配（一度見たら暗くても地図に残る） ----
    var mk = Game.rescue.marker;
    if (mk && mk.seen) {
      var litMk = fov.isVisible(mk.x, mk.y);
      this.drawThing("marker", null, "#66ffee", mk.x, mk.y, "◇", litMk ? "#66ffee" : "#337777");
      if (!litMk) this.dimCell(mk.x, mk.y);
    }

    // ---- 仲間（青い下地で敵と見分ける。いつでも表示） ----
    var allies = Game.allies.list;
    for (var a = 0; a < allies.length; a++) {
      var al = allies[a];
      if (al.x < 0) continue;
      this.drawAllyBg(al.x, al.y);
      this.drawMonster(Game.MONSTERS[al.type], al.x, al.y);
      if (al.hp < al.maxHp) this.drawHpBar(al);
      if (al.charge) this.drawChargeMark(al, "#66ccff");
    }

    // ---- 敵（見えている敵だけ） ----
    var list = Game.enemies.list;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!fov.isVisible(e.x, e.y)) continue;
      this.drawMonster(Game.MONSTERS[e.type], e.x, e.y);
      if (e.hp < e.maxHp) this.drawHpBar(e);
      if (e.charge) this.drawChargeMark(e);
    }

    // ---- 主人公 ----
    var p = Game.player;
    this.drawThing("player", null, c.player, p.x, p.y, p.symbol, c.player);

    // ---- 投げて飛んでいるアイテム ----
    var pr = Game.throwing.projectile;
    if (pr) this.drawThing(pr.sprite, null, pr.color, pr.x, pr.y, pr.symbol, pr.color);

    // ---- 必殺技・ブレスの光 ----
    Game.fx.draw(ctx, ts);

    // ---- 精神力が減ると、画面が紫の闇ににじむ（ダンジョンに取り込まれかけている表現） ----
    if (Game.state !== "base" && p.maxMind) {
      var mr = p.mind / p.maxMind;
      if (mr < 0.3) {
        ctx.fillStyle = "rgba(70, 0, 110, " + ((0.3 - mr) * 1.2).toFixed(2) + ")";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    if (Game.state === "gameover") this.drawOverlay("GAME OVER", "Enter で拠点へ戻る");
  },

  // 1マスの地形を描く
  drawTile: function (x, y, tile, lit, colors, pixel) {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    var c = Game.config.colors;
    var inBase = Game.state === "base";

    if (!pixel) {
      // 文字表示
      if (tile === "#") ctx.fillStyle = lit ? colors.wall : colors.wallDim;
      else if (tile === ">") ctx.fillStyle = lit ? c.stairs : c.stairsDim;
      else if (tile === "O") ctx.fillStyle = lit ? c.exit : c.exitDim;
      else if (tile === ",") ctx.fillStyle = c.grass;
      else if (tile === "G") ctx.fillStyle = c.gate;
      else if (inBase || tile === "C" || tile === "H" || tile === "K") ctx.fillStyle = c.houseFloor;
      else ctx.fillStyle = lit ? colors.floor : colors.floorDim;
      ctx.fillRect(x * ts, y * ts, ts, ts);
      ctx.strokeStyle = c.grid;
      ctx.strokeRect(x * ts, y * ts, ts, ts);
      var ts1 = this.tileSprites[tile];
      if (ts1) this.drawChar(ts1.char, x, y, lit || inBase ? ts1.charColor : "#667");
      return;
    }

    // ドット絵
    if (tile === "#") {
      Game.pixel.drawWall(ctx, x, y, ts, lit ? colors.wall : colors.wallDim);
      return;
    }
    if (tile === ",") {
      Game.pixel.drawGrass(ctx, x, y, ts, c.grass);
      return;
    }
    var floorColor = inBase ? (tile === "G" ? c.gate : c.houseFloor) : lit ? colors.floor : colors.floorDim;
    Game.pixel.drawFloor(ctx, x, y, ts, floorColor);
    var spr = this.tileSprites[tile];
    if (spr) {
      Game.pixel.draw(ctx, spr.sprite, null, spr.color, x, y, ts);
      if (!lit && !inBase) this.dimCell(x, y);
    }
  },

  // モンスター1体（ドット絵なら絵、文字表示なら文字）＋進化段階の印
  drawMonster: function (t, x, y) {
    this.drawThing(t.sprite, t.overlay, t.color, x, y, t.symbol, t.color);
    this.drawStagePips(x, y, t.stage);
  },

  // 絵を描く。ドット絵が無効 or 絵がなければ文字で描く
  drawThing: function (sprite, overlay, color, x, y, ch, charColor) {
    if (Game.pixel.enabled && sprite && Game.pixel.draw(this.ctx, sprite, overlay, color, x, y, Game.config.tileSize)) return;
    this.drawChar(ch, x, y, charColor);
  },

  drawAllyBg: function (x, y) {
    var ts = Game.config.tileSize;
    this.ctx.fillStyle = Game.config.colors.allyBg;
    this.ctx.fillRect(x * ts + 1, y * ts + 1, ts - 2, ts - 2);
  },

  // 見えていない物を暗くする
  dimCell: function (x, y) {
    var ts = Game.config.tileSize;
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    this.ctx.fillRect(x * ts, y * ts, ts, ts);
  },

  // ダメージを受けた敵・仲間の足元に小さなHPバーを描く
  drawHpBar: function (e) {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    var w = ts - 6;
    ctx.fillStyle = Game.config.colors.hpBarBg;
    ctx.fillRect(e.x * ts + 3, e.y * ts + ts - 3, w, 3);
    ctx.fillStyle = Game.config.colors.hpBar;
    ctx.fillRect(e.x * ts + 3, e.y * ts + ts - 3, w * (e.hp / e.maxHp), 3);
  },

  // 進化段階の印：マスの左上に小さな点（2段階目は1つ、3段階目は2つ）
  drawStagePips: function (x, y, stage) {
    if (!stage || stage < 2) return;
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    for (var i = 0; i < stage - 1; i++) {
      ctx.fillStyle = "#111";
      ctx.fillRect(x * ts + 1 + i * 5, y * ts + 1, 5, 5);
      ctx.fillStyle = "#ffe066";
      ctx.fillRect(x * ts + 2 + i * 5, y * ts + 2, 3, 3);
    }
  },

  // 技を溜めている敵（黄色）・仲間（青）：枠と「!」と残りターン数
  drawChargeMark: function (e, color) {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    color = color || "#ffe066";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x * ts + 1, e.y * ts + 1, ts - 2, ts - 2);
    ctx.lineWidth = 1;
    ctx.fillStyle = color;
    ctx.font = "bold " + Math.floor(ts * 0.45) + "px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("!" + e.charge.left, e.x * ts + ts - 1, e.y * ts);
  },

  // 画面全体を暗くして中央に文字を出す
  drawOverlay: function (title, sub) {
    var ctx = this.ctx;
    var w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e04040";
    ctx.font = "bold 40px monospace";
    ctx.fillText(title, w / 2, h / 2 - 16);
    ctx.fillStyle = "#ddd";
    ctx.font = "16px sans-serif";
    ctx.fillText(sub, w / 2, h / 2 + 24);
  },

  // 1文字をマス (x, y) の中央に描く
  drawChar: function (ch, x, y, color) {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    ctx.fillStyle = color;
    ctx.font = "bold " + Math.floor(ts * 0.8) + "px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, x * ts + ts / 2, y * ts + ts / 2 + 1);
  },
};
