// キャラの高解像度版（3D表示・図鑑で使う）。手描きの 16×16 の絵から 32×32 の絵を作る。
//   1. ドット絵向けの拡大（1ドットを2×2にしつつ、斜めにつながる所はなめらかに埋める。外部素材は使わず、この場で計算）
//   2. 輪郭を細く：拡大で2ドットになった外側の輪郭のうち、内側の1ドットを体の色の濃い影色にする（外側だけ黒く残る）
//   3. 光と影：左上から光が当たるように、輪郭の内側の左上側を明るく、右下側を暗くする。上の方ほど少し明るい
// アイテム・設備（12×12）はそのままの大きさで返す。
Game.hires = {
  cache: {},

  build: function (spriteName, overlayName, color) {
    var key = "hi|" + spriteName + "|" + (overlayName || "") + "|" + color;
    if (this.cache[key]) return this.cache[key];
    var g = Game.pixel.grid(spriteName, overlayName, color);
    if (!g) return null;
    var cells = g.cells;
    if (g.size === 16) cells = this.shade(this.thinOutline(this.scale2x(cells)));
    var n = cells.length;
    var cv = document.createElement("canvas");
    cv.width = cv.height = n;
    var ctx = cv.getContext("2d");
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (!cells[y][x]) continue;
        ctx.fillStyle = cells[y][x];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    this.cache[key] = cv;
    return cv;
  },

  // ドット絵向けの2倍拡大：周りの4マス（上・右・左・下）を見て、角をなめらかにする
  scale2x: function (src) {
    var n = src.length, out = [];
    for (var y = 0; y < n * 2; y++) out.push(new Array(n * 2).fill(null));
    var at = function (x, y) {
      x = Math.max(0, Math.min(n - 1, x));
      y = Math.max(0, Math.min(n - 1, y));
      return src[y][x];
    };
    for (var y2 = 0; y2 < n; y2++) {
      for (var x2 = 0; x2 < n; x2++) {
        var P = src[y2][x2], A = at(x2, y2 - 1), B = at(x2 + 1, y2), C = at(x2 - 1, y2), D = at(x2, y2 + 1);
        var e0 = P, e1 = P, e2 = P, e3 = P;
        if (C === A && C !== D && A !== B) e0 = A;
        if (A === B && A !== C && B !== D) e1 = B;
        if (D === C && D !== B && C !== A) e2 = C;
        if (B === D && B !== A && D !== C) e3 = D;
        out[y2 * 2][x2 * 2] = e0;
        out[y2 * 2][x2 * 2 + 1] = e1;
        out[y2 * 2 + 1][x2 * 2] = e2;
        out[y2 * 2 + 1][x2 * 2 + 1] = e3;
      }
    }
    return out;
  },

  // 外側の輪郭（透明に接している黒）のすぐ内側の黒を、隣の体の色の濃い色に置きかえる。
  // 目や口のように体の中にある黒は、透明に接していないので黒のまま残る
  thinOutline: function (cells) {
    var n = cells.length, self = this;
    var get = function (x, y) { return x < 0 || y < 0 || x >= n || y >= n ? null : cells[y][x]; };
    var touchesAir = function (x, y) {
      return !get(x - 1, y) || !get(x + 1, y) || !get(x, y - 1) || !get(x, y + 1);
    };
    var out = cells.map(function (r) { return r.slice(); });
    this.inner = {}; // 置きかえたマス（shade で輪郭と同じ扱いにする）
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var c = cells[y][x];
        if (!c || !this.isLine(c) || touchesAir(x, y)) continue;
        var outer = false, body = null;
        for (var i = 0; i < 4; i++) {
          var nx = x + dirs[i][0], ny = y + dirs[i][1], nc = get(nx, ny);
          if (!nc) continue;
          if (this.isLine(nc) && touchesAir(nx, ny)) outer = true;
          else if (!this.isLine(nc)) body = nc;
        }
        if (outer && body) {
          var v = self.rgb(body);
          out[y][x] = "rgb(" + Math.round(v[0] * 0.42) + "," + Math.round(v[1] * 0.42) + "," + Math.round(v[2] * 0.42) + ")";
          this.inner[x + "," + y] = true;
        }
      }
    }
    return out;
  },

  rgb: function (str) {
    if (str.charAt(0) === "#") {
      var h = str.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var v = parseInt(h, 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    }
    var m = str.match(/\d+/g);
    return [+m[0], +m[1], +m[2]];
  },

  // 輪郭（ほぼ黒）か
  isLine: function (c) {
    if (!c) return true;
    var v = this.rgb(c);
    return v[0] + v[1] + v[2] < 110;
  },

  // thinOutline で作った「内側の輪郭」のマスか（輪郭と同じく光と影の目印にする）
  isEdge: function (cells, x, y) {
    if (x < 0 || y < 0 || x >= cells.length || y >= cells.length) return true;
    return this.isLine(cells[y][x]) || !!this.inner[x + "," + y];
  },

  // 光と影をつける
  shade: function (cells) {
    var n = cells.length, out = [];
    for (var y = 0; y < n; y++) {
      out.push([]);
      for (var x = 0; x < n; x++) {
        var c = cells[y][x];
        if (!c || this.isEdge(cells, x, y)) {
          out[y].push(c);
          continue;
        }
        var f = (0.5 - y / n) * 0.14; // 上ほど少し明るい
        if (this.isEdge(cells, x - 1, y - 1)) f += 0.28; // 左上の縁に光
        else if (this.isEdge(cells, x + 1, y + 1)) f -= 0.26; // 右下の縁に影
        var v = this.rgb(c);
        var t = f > 0 ? 255 : 0, k = Math.min(0.6, Math.abs(f));
        out[y].push("rgb(" + Math.round(v[0] + (t - v[0]) * k) + "," + Math.round(v[1] + (t - v[1]) * k) + "," + Math.round(v[2] + (t - v[2]) * k) + ")");
      }
    }
    return out;
  },
};
