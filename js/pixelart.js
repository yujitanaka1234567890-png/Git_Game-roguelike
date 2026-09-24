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

  // 絵（と重ねる小物）を 12×12 の小さな canvas に描いて返す
  build: function (spriteName, overlayName, color) {
    var key = spriteName + "|" + (overlayName || "") + "|" + color;
    if (this.cache[key]) return this.cache[key];
    var rows = Game.SPRITES[spriteName];
    if (!rows) return null;
    var cv = document.createElement("canvas");
    cv.width = 12;
    cv.height = 12;
    var ctx = cv.getContext("2d");
    var pal = {
      a: color,
      b: this.shade(color, -0.35),
      c: this.shade(color, 0.45),
    };
    var paint = function (grid) {
      for (var y = 0; y < 12; y++) {
        var row = grid[y] || "";
        for (var x = 0; x < 12; x++) {
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

  // 壁：レンガ模様
  drawWall: function (ctx, x, y, ts, base) {
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

  // 床：ところどころに小石
  drawFloor: function (ctx, x, y, ts, base) {
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
