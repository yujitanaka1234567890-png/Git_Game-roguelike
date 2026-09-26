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
    "S": { sprite: "stone", color: "#9a9aa6", char: "碑", charColor: "#bbbbdd" },
    "Z": { sprite: "book", color: "#6a8aff", char: "図", charColor: "#aaccff" },
    "T": { sprite: "sign", color: "#9e7650", char: "案", charColor: "#e0c890" },
    "G": { sprite: "gateM", color: "#c8a8ff", char: "∩", charColor: "#c8a8ff" }, // 3マスで1つの門（drawTile で左・中・右を選ぶ）
  },

  init: function () {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    var ts = Game.config.tileSize;
    this.canvas.width = Game.map.width * ts;
    this.canvas.height = Game.map.height * ts;
  },

  draw: function () {
    // 3D表示（render3d.js）がオンなら、そちらで描く
    if (Game.view3d.active()) {
      Game.view3d.draw();
      return;
    }
    Game.view3d.show(false);
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    var c = Game.config.colors;
    var fov = Game.fov;
    var pixel = Game.pixel.enabled;
    // ダンジョンでは、その世界（js/data/worlds.js）の壁・床の色を使う
    var dg = Game.state === "base" ? null : Game.currentDungeon();
    var wc = dg ? dg.colors || Game.WORLDS[dg.world].colors : null;
    this.style = dg ? dg.style || null : null; // 壁・床の模様（はじまりの箱庭など）
    var colors = {
      wall: wc ? wc.wall : c.wall, wallDim: wc ? wc.wallDim : c.wallDim,
      floor: wc ? wc.floor : c.floor, floorDim: wc ? wc.floorDim : c.floorDim,
      water: (wc && wc.water) || c.water, waterDim: (wc && wc.waterDim) || c.waterDim,
    };

    // 別の階・拠点に移ったら、動き（すべる移動など）の記録をやり直す
    if (this.lastTiles !== Game.map.tiles) {
      this.lastTiles = Game.map.tiles;
      Game.anim3d.reset();
    }
    this.buildTerrain(colors, pixel);
    this.animUntil = Date.now() + 900; // この間は1秒に60回ほど描き直して、動きをなめらかに見せる
    this.drawFrame(); // キャラなど動くもの（renderer_units.js）

    if (Game.state === "gameover") Game.minimap.hide();
    else Game.minimap.draw(); // 全体マップ（2Dでも3Dでも左上に重ねる）
    this.kick();
  },

  // 動かないもの（地形・床のアイテム・はぐれた仲間の気配）を裏の画用紙に描いておく。
  // 描き直しのたびに全部描くと重いので、ゲームの状態が変わった時（draw）だけ描き、動きの途中はこれを貼るだけにする
  buildTerrain: function (colors, pixel) {
    if (!this.terrain) this.terrain = document.createElement("canvas");
    var tc = this.terrain;
    if (tc.width !== this.canvas.width || tc.height !== this.canvas.height) {
      tc.width = this.canvas.width;
      tc.height = this.canvas.height;
    }
    var main = this.ctx;
    this.ctx = tc.getContext("2d"); // drawTile などの描き先を、いったん裏の画用紙にする
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    var c = Game.config.colors;
    var fov = Game.fov;

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
      // はぐれた仲間：モンスターの姿のまま、紫の枠の中でじっと待っている
      var mt2 = Game.MONSTERS[mk.type];
      if (mt2) this.drawThing(mt2.sprite, mt2.overlay, mt2.color, mk.x, mk.y, mt2.symbol, litMk ? mt2.color : "#555");
      else this.drawThing("marker", null, "#66ffee", mk.x, mk.y, "◇", litMk ? "#66ffee" : "#337777");
      ctx.strokeStyle = "#b066ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(mk.x * ts + 1, mk.y * ts + 1, ts - 2, ts - 2);
      ctx.lineWidth = 1;
      if (!litMk) this.dimCell(mk.x, mk.y);
    }
    this.ctx = main;
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
      else if (tile === "~") ctx.fillStyle = lit ? colors.water : colors.waterDim;
      else if (tile === "G") ctx.fillStyle = c.gate;
      else if (inBase) ctx.fillStyle = c.houseFloor;
      else ctx.fillStyle = lit ? colors.floor : colors.floorDim;
      ctx.fillRect(x * ts, y * ts, ts, ts);
      ctx.strokeStyle = c.grid;
      ctx.strokeRect(x * ts, y * ts, ts, ts);
      var ts1 = this.tileSprites[tile];
      if (ts1) this.drawChar(ts1.char, x, y, lit || inBase ? ts1.charColor : "#667");
      if (tile === "~") this.drawChar("≈", x, y, lit ? "#9fd4ff" : "#4a6a88");
      return;
    }

    // ドット絵
    if (tile === "#") {
      Game.pixel.drawWall(ctx, x, y, ts, lit ? colors.wall : colors.wallDim, this.style);
      return;
    }
    if (tile === ",") {
      Game.pixel.drawGrass(ctx, x, y, ts, c.grass);
      return;
    }
    if (tile === "~") {
      Game.pixel.drawWater(ctx, x, y, ts, lit ? colors.water : colors.waterDim);
      return;
    }
    var floorColor = inBase ? (tile === "G" ? c.gate : c.houseFloor) : lit ? colors.floor : colors.floorDim;
    Game.pixel.drawFloor(ctx, x, y, ts, floorColor, inBase ? null : this.style);
    var spr = this.tileSprites[tile];
    if (spr) {
      var name = spr.sprite;
      if (tile === "G") {
        // 門：左右のマスも門なら真ん中、左端・右端ならそれぞれの柱を描いて、3マスで1つのアーチにする
        if (Game.map.tileAt(x - 1, y) !== "G") name = "gateL";
        else if (Game.map.tileAt(x + 1, y) !== "G") name = "gateR";
      }
      Game.pixel.draw(ctx, name, null, spr.color, x, y, ts);
      if (!lit && !inBase) this.dimCell(x, y);
    }
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

  // ダメージを受けた敵・仲間の足元に小さなHPバーを描く（x, y＝表示している位置。マス単位・小数あり）
  drawHpBar: function (e, x, y) {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    var w = ts - 6;
    ctx.fillStyle = Game.config.colors.hpBarBg;
    ctx.fillRect(x * ts + 3, y * ts + ts - 3, w, 3);
    ctx.fillStyle = Game.allies.list.indexOf(e) >= 0 ? Game.config.colors.allyHpBar : Game.config.colors.hpBar;
    ctx.fillRect(x * ts + 3, y * ts + ts - 3, w * (e.hp / e.maxHp), 3);
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
  drawChargeMark: function (e, color, x, y) {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    color = color || "#ffe066";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x * ts + 1, y * ts + 1, ts - 2, ts - 2);
    ctx.lineWidth = 1;
    ctx.fillStyle = color;
    ctx.font = "bold " + Math.floor(ts * 0.45) + "px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("!" + e.charge.left, x * ts + ts - 1, y * ts);
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
