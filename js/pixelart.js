// ドット絵の描画。絵のデータは js/data/sprites.js（すべてオリジナルの手描きドット）。
// 壁・床は画像を使わず、その場で模様を描く（世界ごとの色で）。
// V キーで「ドット絵」と「文字表示」を切り替えられる（選んだ方はこのブラウザに覚えておく）。
Game.pixel = {
  enabled: true,
  cache: {}, // 一度描いた絵を覚えておく（毎回描き直さないため）
  prefKey: "dimension-roguelike-graphics",

  init: function () {
    try {
      var v = window.localStorage.getItem(this.prefKey);
      if (v === "text") this.enabled = false;
    } catch (e) {
      // 保存領域が使えなくても、ドット絵で遊べる
    }
  },

  toggle: function () {
    this.enabled = !this.enabled;
    try {
      window.localStorage.setItem(this.prefKey, this.enabled ? "pixel" : "text");
    } catch (e) {
      // 覚えておけなくても切り替えはできる
    }
    return this.enabled;
  },

  // 色を暗く（amt < 0）・明るく（amt > 0）する
  shade: function (hex, amt) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var t = amt < 0 ? 0 : 255, f = Math.abs(amt);
    r = Math.round(r + (t - r) * f);
    g = Math.round(g + (t - g) * f);
    b = Math.round(b + (t - b) * f);
    return "rgb(" + r + "," + g + "," + b + ")";
  },

  // 絵（と重ねる小物）を小さな canvas に描いて返す（アイテム・設備は 12×12、キャラは 16×16）
  build: function (spriteName, overlayName, color) {
    var key = spriteName + "|" + (overlayName || "") + "|" + color;
    if (this.cache[key]) return this.cache[key];
    var rows = Game.SPRITES[spriteName];
    if (!rows) return null;
    var size = rows.length;
    var cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    var ctx = cv.getContext("2d");
    var pal = {
      a: color,
      b: this.shade(color, -0.35),
      c: this.shade(color, 0.45),
      d: this.shade(color, -0.6),
      e: this.shade(color, 0.75),
    };
    var paint = function (grid) {
      for (var y = 0; y < size; y++) {
        var row = grid[y] || "";
        for (var x = 0; x < size; x++) {
          var ch = row[x];
          if (!ch || ch === ".") continue;
          ctx.fillStyle = pal[ch] || Game.SPRITE_COLORS[ch] || color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    };
    paint(rows);
    if (overlayName && Game.SPRITE_OVERLAYS[overlayName]) paint(Game.SPRITE_OVERLAYS[overlayName]);
    this.cache[key] = cv;
    return cv;
  },

  // マス (x, y) に絵を描く。描けたら true（絵がなければ false → 呼び出し側は文字で描く）
  draw: function (ctx, spriteName, overlayName, color, x, y, ts) {
    var cv = this.build(spriteName, overlayName, color);
    if (!cv) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, x * ts, y * ts, ts, ts);
    return true;
  },

  // ---------- 模様つきの地形（ダンジョンの style） ----------
  // 12×12 の小さな絵を作って覚えておく。マスの位置 (x, y) を 4 で割った余りで模様が決まり、
  // 4×4マスで模様がつながって繰り返す（隣のマスと継ぎ目なくつながる）
  hash: function (ix, iy, seed) {
    var h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  },

  // なめらかなまだら（period ドットごとに繰り返す）
  noise: function (px, py, cell, period, seed) {
    var n = period / cell;
    var gx = px / cell, gy = py / cell;
    var ix = Math.floor(gx), iy = Math.floor(gy);
    var fx = gx - ix, fy = gy - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    var self = this;
    var v = function (a, b) { return self.hash(((a % n) + n) % n, ((b % n) + n) % n, seed); };
    var top = v(ix, iy) * (1 - fx) + v(ix + 1, iy) * fx;
    var bot = v(ix, iy + 1) * (1 - fx) + v(ix + 1, iy + 1) * fx;
    return top * (1 - fy) + bot * fy;
  },

  styledTile: function (kind, style, base, x, y) {
    var vx = ((x % 4) + 4) % 4, vy = ((y % 4) + 4) % 4;
    var key = "tile|" + kind + "|" + style + "|" + base + "|" + vx + "|" + vy;
    if (this.cache[key]) return this.cache[key];
    var cv = document.createElement("canvas");
    cv.width = cv.height = 12;
    var ctx = cv.getContext("2d");
    var dark = this.shade(base, -0.35), darker = this.shade(base, -0.55), light = this.shade(base, 0.14), lighter = this.shade(base, 0.28);
    for (var j = 0; j < 12; j++) {
      for (var i = 0; i < 12; i++) {
        var px = vx * 12 + i, py = vy * 12 + j;
        var col;
        if (kind === "water") {
          // 水たまり：深い所・浅い所のまだらに、細いさざ波の光
          var w = this.noise(px, py, 6, 48, 13);
          col = w < 0.35 ? this.shade(base, -0.22) : w < 0.7 ? base : this.shade(base, 0.14);
          var rip = this.noise(px, py, 4, 48, 17);
          if (rip > 0.56 && rip < 0.6) col = this.shade(base, 0.4);
        } else if (style === "seaCity" && kind === "wall") {
          // 海に沈んだ都の石組み：ずらして積んだ石のブロック、下の方に海藻、ところどころにフジツボ
          var brow = Math.floor(py / 6), bx = (px + (brow % 2) * 3) % 6, by = py % 6;
          var sn = this.noise(px, py, 4, 48, 21);
          col = sn < 0.35 ? dark : sn < 0.72 ? base : light;
          if (this.noise(px, py, 6, 48, 23) > 0.62 && by >= 3) col = this.shade("#3f7a4a", (sn - 0.5) * 0.5); // 海藻
          if (this.hash(px, py, 25) < 0.02) col = "#d8d2c0"; // フジツボ
          if (by === 5 || bx === 5) col = darker; // 石の継ぎ目
          if (j === 0) col = lighter;
        } else if (style === "seaCity") {
          // 沈んだ都の石畳：大きな敷石の継ぎ目、うっすら砂、まれにサンゴのかけら
          var fn = this.noise(px, py, 6, 48, 27);
          col = fn < 0.4 ? this.shade(base, -0.1) : fn > 0.72 ? this.shade(base, 0.12) : base;
          if (px % 6 === 0 || py % 6 === 0) col = this.shade(base, -0.38);
          if (this.hash(px, py, 29) < 0.012) col = "#e0a080";
          else if (this.hash(px, py, 31) < 0.02) col = this.shade(base, 0.25);
        } else if (kind === "wall") {
          // 時空を思わせる鈍い斑：大きなまだら＋細かいまだら。ところどころに、古い星の光のような点
          var n = 0.6 * this.noise(px, py, 8, 48, 1) + 0.4 * this.noise(px, py, 4, 48, 2);
          col = n < 0.33 ? darker : n < 0.47 ? dark : n < 0.64 ? base : n < 0.8 ? light : lighter;
          if (this.noise(px, py, 6, 48, 3) > 0.72 && n > 0.5) col = this.shade("#4f7486", -0.1 + (n - 0.5)); // 鈍い青緑のにじみ
          if (this.hash(px, py, 9) < 0.012) col = "#c9d3ff";
          if (j === 0) col = this.shade(col.charAt(0) === "#" ? col : base, 0.12);
        } else {
          // 床：継ぎ目のある石板に、うっすらとしたまだら。まれに時の粒が光る
          var m = this.noise(px, py, 6, 48, 5);
          col = m < 0.4 ? this.shade(base, -0.12) : m > 0.7 ? this.shade(base, 0.1) : base;
          if (i === 0 || j === 0) col = this.shade(base, -0.4);
          if (i === 1 && j > 0 || j === 1 && i > 0) col = this.shade(base, 0.08);
          if (this.hash(px, py, 11) < 0.006) col = "#5fe0d0";
        }
        ctx.fillStyle = col;
        ctx.fillRect(i, j, 1, 1);
      }
    }
    this.cache[key] = cv;
    return cv;
  },

  // 壁：レンガ模様（style があればその模様）
  drawWall: function (ctx, x, y, ts, base, style) {
    if (style) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.styledTile("wall", style, base, x, y), x * ts, y * ts, ts, ts);
      return;
    }
    ctx.fillStyle = base;
    ctx.fillRect(x * ts, y * ts, ts, ts);
    ctx.fillStyle = this.shade(base, -0.4);
    var px = ts / 12;
    var ox = x * ts, oy = y * ts;
    // 横の目地
    ctx.fillRect(ox, oy + 5 * px, ts, px);
    ctx.fillRect(ox, oy + 11 * px, ts, px);
    // 縦の目地（段ごとにずらす）
    var shift = (x + y) % 2 === 0 ? 3 : 8;
    ctx.fillRect(ox + shift * px, oy, px, 5 * px);
    ctx.fillRect(ox + ((shift + 5) % 12) * px, oy + 6 * px, px, 5 * px);
    // 光の当たる縁
    ctx.fillStyle = this.shade(base, 0.18);
    ctx.fillRect(ox, oy, ts, px);
  },

  // 水たまり（~）
  drawWater: function (ctx, x, y, ts, base) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.styledTile("water", "water", base, x, y), x * ts, y * ts, ts, ts);
  },

  // 床：ところどころに小石（style があればその模様）
  drawFloor: function (ctx, x, y, ts, base, style) {
    if (style) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.styledTile("floor", style, base, x, y), x * ts, y * ts, ts, ts);
      return;
    }
    ctx.fillStyle = base;
    ctx.fillRect(x * ts, y * ts, ts, ts);
    var px = ts / 12;
    var seed = (x * 73856093) ^ (y * 19349663); // マスごとに決まった位置（毎回同じ模様）
    ctx.fillStyle = this.shade(base, 0.12);
    ctx.fillRect(x * ts + (Math.abs(seed) % 10 + 1) * px, y * ts + (Math.abs(seed >> 4) % 10 + 1) * px, px, px);
    ctx.fillStyle = this.shade(base, -0.25);
    ctx.fillRect(x * ts + (Math.abs(seed >> 8) % 10 + 1) * px, y * ts + (Math.abs(seed >> 12) % 10 + 1) * px, px, px);
  },

  // 草地（拠点の牧場）
  drawGrass: function (ctx, x, y, ts, base) {
    this.drawFloor(ctx, x, y, ts, base);
    var px = ts / 12;
    ctx.fillStyle = this.shade(base, 0.35);
    var s = (x * 31 + y * 17) % 7;
    ctx.fillRect(x * ts + (2 + s) * px, y * ts + 3 * px, px, 2 * px);
    ctx.fillRect(x * ts + ((7 + s) % 11) * px, y * ts + 8 * px, px, 2 * px);
  },
};
