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
    this.pops = [];
    this.generation++;
  },

  // ---------- 攻撃の動き ----------
  // 攻撃した側は相手の方へ踏み込み（3D表示）、攻撃されたキャラは逆向きにのけぞり、攻撃された側に赤いとげとげが出る。
  // 同じターンの攻撃（主人公→仲間→敵…）は、見た目と音を gapMs ずつずらして順番に見せる（交互に殴り合って見える）。
  // ※ゲームの計算はその場で終わっている。ずらすのは見た目と音だけ
  hits: [], // [{ unit, dx, dy, start, until }]  dx, dy = 攻撃者から見た向き（のけぞる向き）
  attacks: [], // 攻撃した側 [{ unit, dx, dy, start, until }]  dx, dy = 攻撃した向き
  hitMs: 260, // のけぞり・踏み込みの長さ
  gapMs: 200, // 次の攻撃の動きを始めるまでの間
  impactMs: 90, // 踏み込み始めてから当たるまで
  seqEnd: 0, // 次の攻撃の動きを始められる時刻
  lastSlot: { at: 0, impact: 0 },

  // 攻撃1回分の動きの開始時刻を決める（前の攻撃が動いている最中なら、その後ろに並ぶ）
  slot: function () {
    var now = Date.now();
    var start = this.seqEnd > now && this.seqEnd - now < 800 ? this.seqEnd : now;
    this.seqEnd = start + this.gapMs;
    this.lastSlot = { at: now, impact: start + this.impactMs };
    this.redrawAt(start + this.impactMs);
    this.redrawAt(start + this.impactMs + this.hitMs + 10); // のけぞりを元に戻して描き直す
    return start;
  },

  redrawAt: function (time) {
    var gen = this.generation;
    var self = this;
    setTimeout(function () {
      if (gen === self.generation && Game.renderer.ctx) Game.renderer.draw();
    }, Math.max(0, time - Date.now()) + 5);
  },

  // 攻撃の踏み込み（外れた時も）。当たった時は hitMark から呼ばれる
  swing: function (source, target, start) {
    if (!source || !target || source === target || source.x < 0) return;
    if (start === undefined) start = this.slot();
    var now = Date.now();
    this.attacks = this.attacks.filter(function (a) { return a.until > now; });
    this.attacks.push({ unit: source, dx: Math.sign(target.x - source.x), dy: Math.sign(target.y - source.y), start: start, until: start + this.hitMs });
  },

  hitMark: function (target, source) {
    if (!target || target.x < 0) return;
    var dx = source ? Math.sign(target.x - source.x) : 0;
    var dy = source ? Math.sign(target.y - source.y) : 0;
    if (dx === 0 && dy === 0) dy = 1;
    var now = Date.now();
    var start = this.slot();
    this.hits = this.hits.filter(function (h) { return h.until > now; });
    this.hits.push({ unit: target, dx: dx, dy: dy, start: start + this.impactMs, until: start + this.impactMs + this.hitMs });
    this.swing(source, target, start);
  },

  // ---------- ダメージの数字 ----------
  // 攻撃が当たった瞬間に、受けた側の頭の上に数字がぴょんと跳ねて消える（2D・3D 共通の記録）
  pops: [], // [{ unit, text, color, start, until }]
  popMs: 700,

  damageColor: "#ffffff", // ダメージの数字（誰が受けても白）
  healColor: "#a8f0b4", // 回復の数字（パステルの緑）

  // heal = true なら回復の数字（緑）
  popNumber: function (target, amount, heal) {
    if (!target || target.x < 0) return;
    var now = Date.now();
    var start = !heal && now - this.lastSlot.at < 20 ? this.lastSlot.impact : now; // 直前に並べた攻撃が当たる瞬間に合わせる
    this.pops = this.pops.filter(function (p) { return p.until > now; });
    this.pops.push({ unit: target, text: String(amount), color: heal ? this.healColor : this.damageColor, start: start, until: start + this.popMs });
    this.redrawAt(start);
    if (Game.renderer.kick) Game.renderer.kick();
  },

  // 表示中の数字と、跳ねる高さ（マスに対する割合）・濃さ。見えない相手の分は出さない
  activePops: function () {
    var now = Date.now(), out = [];
    for (var i = 0; i < this.pops.length; i++) {
      var p = this.pops[i];
      if (p.start > now || p.until <= now || p.unit.x < 0) continue;
      if (p.unit !== Game.player && Game.allies.list.indexOf(p.unit) < 0 && !Game.fov.isVisible(p.unit.x, p.unit.y)) continue;
      var t = (now - p.start) / this.popMs;
      var hop = Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.45 + t * 0.25; // ぴょんと跳ねてから少し浮く
      out.push({ pop: p, hop: hop, alpha: t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35 });
    }
    return out;
  },

  hasActivePops: function () {
    var now = Date.now();
    return this.pops.some(function (p) { return p.until > now; });
  },

  // 2D：数字を描く
  drawNumbers: function (ctx, ts) {
    var list = this.activePops();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold " + Math.floor(ts * 0.7) + "px monospace";
    ctx.lineWidth = 3;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var x = a.pop.unit.x * ts + ts / 2, y = a.pop.unit.y * ts + ts * 0.15 - a.hop * ts;
      ctx.globalAlpha = a.alpha;
      ctx.strokeStyle = "#101010";
      ctx.strokeText(a.pop.text, x, y);
      ctx.fillStyle = a.pop.color;
      ctx.fillText(a.pop.text, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  },

  // 今鳴らす効果音を、直前に並べた攻撃が当たる時刻まで遅らせる量（ミリ秒）
  soundDelay: function () {
    var now = Date.now();
    if (now - this.lastSlot.at > 20) return 0;
    return Math.max(0, this.lastSlot.impact - now);
  },

  find: function (list, unit) {
    var now = Date.now();
    for (var i = 0; i < list.length; i++) {
      if (list[i].unit === unit && list[i].start <= now && list[i].until > now) return list[i];
    }
    return null;
  },

  // unit が今攻撃している最中なら、その向き {dx, dy, start, until}。なければ null
  attackOf: function (unit) {
    return this.find(this.attacks, unit);
  },

  // unit が今のけぞっているなら、その向き {dx, dy}。なければ null
  tiltOf: function (unit) {
    return this.find(this.hits, unit);
  },

  // 赤いとげとげ（攻撃マーク）を描く：攻撃された側（のけぞる向きの反対側）のマスの端に
  drawHitMarks: function (ctx, ts) {
    var now = Date.now();
    for (var i = 0; i < this.hits.length; i++) {
      var h = this.hits[i];
      if (h.start > now || h.until <= now || h.unit.x < 0) continue;
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
