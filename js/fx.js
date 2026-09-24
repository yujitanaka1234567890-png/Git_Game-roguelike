// 見た目だけのエフェクト（必殺技・ブレスの光など）。ゲームの進行には影響しない。
// マスの上に色付きの光を一定時間重ねて描き、時間が来たら消す。
Game.fx = {
  list: [], // 今表示中の光 [{cells: [{x, y}], color}]
  generation: 0, // 階を移動したら古いエフェクトを出さないための番号

  // cells を color で ms ミリ秒光らせる（delay ミリ秒後に開始）
  flash: function (cells, color, ms, delay) {
    var self = this;
    var gen = this.generation;
    setTimeout(function () {
      if (gen !== self.generation) return;
      var f = { cells: cells, color: color };
      self.list.push(f);
      Game.renderer.draw();
      setTimeout(function () {
        var i = self.list.indexOf(f);
        if (i >= 0) self.list.splice(i, 1);
        if (gen === self.generation) Game.renderer.draw();
      }, ms || 350);
    }, delay || 0);
  },

  clear: function () {
    this.list = [];
    this.hits = [];
    this.attacks = [];
    this.generation++;
  },

  // ---------- 攻撃を受けた時の動き ----------
  // 攻撃されたキャラは、攻撃された方向と逆に少し傾き（のけぞり）、攻撃された側に赤いとげとげ（攻撃マーク）が出る
  hits: [], // [{ unit, dx, dy, until }]  dx, dy = 攻撃者から見た向き（のけぞる向き）
  attacks: [], // 攻撃した側 [{ unit, dx, dy, until }]  dx, dy = 攻撃した向き（3D表示の攻撃ポーズに使う）
  hitMs: 260,

  hitMark: function (target, source) {
    if (!target || target.x < 0) return;
    var dx = source ? Math.sign(target.x - source.x) : 0;
    var dy = source ? Math.sign(target.y - source.y) : 0;
    if (dx === 0 && dy === 0) dy = 1;
    var now = Date.now();
    this.hits = this.hits.filter(function (h) { return h.unit !== target && h.until > now; });
    this.hits.push({ unit: target, dx: dx, dy: dy, until: now + this.hitMs });
    if (source && source !== target) {
      this.attacks = this.attacks.filter(function (a) { return a.unit !== source && a.until > now; });
      this.attacks.push({ unit: source, dx: dx, dy: dy, until: now + this.hitMs });
    }
    var gen = this.generation;
    var self = this;
    setTimeout(function () {
      if (gen === self.generation && Game.renderer.ctx) Game.renderer.draw(); // のけぞりを元に戻して描き直す
    }, this.hitMs + 10);
  },

  // unit が今攻撃している最中なら、その向き {dx, dy, until}。なければ null
  attackOf: function (unit) {
    var now = Date.now();
    for (var i = 0; i < this.attacks.length; i++) {
      if (this.attacks[i].unit === unit && this.attacks[i].until > now) return this.attacks[i];
    }
    return null;
  },

  // unit が今のけぞっているなら、その向き {dx, dy}。なければ null
  tiltOf: function (unit) {
    var now = Date.now();
    for (var i = 0; i < this.hits.length; i++) {
      if (this.hits[i].unit === unit && this.hits[i].until > now) return this.hits[i];
    }
    return null;
  },

  // 赤いとげとげ（攻撃マーク）を描く：攻撃された側（のけぞる向きの反対側）のマスの端に
  drawHitMarks: function (ctx, ts) {
    var now = Date.now();
    for (var i = 0; i < this.hits.length; i++) {
      var h = this.hits[i];
      if (h.until <= now || h.unit.x < 0) continue;
      if (h.unit !== Game.player && Game.allies.list.indexOf(h.unit) < 0 && !Game.fov.isVisible(h.unit.x, h.unit.y)) continue;
      var cx = h.unit.x * ts + ts / 2 - h.dx * ts * 0.42;
      var cy = h.unit.y * ts + ts / 2 - h.dy * ts * 0.42;
      this.spike(ctx, cx, cy, ts * 0.3, ts * 0.12);
    }
  },

  // とげとげの星形
  spike: function (ctx, cx, cy, rOut, rIn) {
    ctx.beginPath();
    for (var k = 0; k < 16; k++) {
      var r = k % 2 === 0 ? rOut : rIn;
      var a = (Math.PI * 2 * k) / 16 - Math.PI / 2;
      var px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "#ff2a2a";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#400";
    ctx.stroke();
  },

  // (x, y) の周り r マス（自分のマスも含む）
  around: function (x, y, r) {
    var cells = [];
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) cells.push({ x: x + dx, y: y + dy });
    }
    return cells;
  },

  // (x, y) から見えている範囲のマス（fov.viewRects と同じ範囲）
  viewCells: function (x, y) {
    var cells = [];
    var rects = Game.fov.viewRects(x, y);
    for (var i = 0; i < rects.length; i++) {
      var v = rects[i];
      for (var yy = v.y1; yy <= v.y2; yy++) {
        for (var xx = v.x1; xx <= v.x2; xx++) cells.push({ x: xx, y: yy });
      }
    }
    return cells;
  },

  draw: function (ctx, ts) {
    if (this.list.length === 0) return;
    ctx.globalAlpha = 0.55;
    for (var i = 0; i < this.list.length; i++) {
      ctx.fillStyle = this.list[i].color;
      var cells = this.list[i].cells;
      for (var j = 0; j < cells.length; j++) ctx.fillRect(cells[j].x * ts, cells[j].y * ts, ts, ts);
    }
    ctx.globalAlpha = 1;
  },
};
