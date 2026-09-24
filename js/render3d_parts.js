// 3D表示（render3d.js）の部品：絵の置き場（アトラス）と、四角形の組み立て。
// Game.view3d に機能を書き足す形で分けている（1ファイルが大きくなりすぎないように）。
Object.assign(Game.view3d, {
  // ---------- 絵の置き場（アトラス） ----------
  ATLAS: 1024,
  SLOT: 32,
  slots: {},
  nextSlot: 0,

  // key の絵を枠に描いて、その位置（UV）を返す。paint(ctx) は (0,0)〜(w,h) に描く
  slot: function (key, w, h, paint) {
    var s = this.slots[key];
    if (s) return s;
    var per = this.ATLAS / this.SLOT;
    if (this.nextSlot >= per * per) {
      // 枠が足りなくなったら全部描き直す（めったに起きない）
      this.slots = {};
      this.nextSlot = 0;
      this.actx.clearRect(0, 0, this.ATLAS, this.ATLAS);
    }
    var i = this.nextSlot++;
    var sx = (i % per) * this.SLOT, sy = Math.floor(i / per) * this.SLOT;
    var ctx = this.actx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, w, h);
    ctx.clip();
    ctx.translate(sx, sy);
    paint(ctx);
    ctx.restore();
    var A = this.ATLAS, e = 0.02;
    s = { u0: (sx + e) / A, v0: (sy + e) / A, u1: (sx + w - e) / A, v1: (sy + h - e) / A };
    this.slots[key] = s;
    this.atlasDirty = true;
    return s;
  },

  // モンスター・アイテム・設備の絵（なければ文字）
  spriteSlot: function (sprite, overlay, color, ch) {
    var cv = sprite ? Game.pixel.build(sprite, overlay, color) : null;
    if (cv) {
      return this.slot("spr|" + sprite + "|" + (overlay || "") + "|" + color, cv.width, cv.height, function (ctx) {
        ctx.drawImage(cv, 0, 0);
      });
    }
    return this.slot("chr|" + ch + "|" + color, 32, 32, function (ctx) {
      ctx.fillStyle = color;
      ctx.font = "bold 26px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch || "?", 16, 17);
    });
  },

  // 壁・床の模様（2D と同じ描き方）。variant で床の小石の位置を変える
  tileSlot: function (kind, color, variant) {
    var v = variant || 0;
    return this.slot(kind + "|" + color + "|" + v, 24, 24, function (ctx) {
      var vx = v * 5 + 1, vy = v * 3 + 2; // 2D の模様はマスの位置で決まるので、仮の位置を渡す
      ctx.translate(-vx * 24, -vy * 24);
      if (kind === "wall") Game.pixel.drawWall(ctx, vx, vy, 24, color);
      else if (kind === "grass") Game.pixel.drawGrass(ctx, vx, vy, 24, color);
      else Game.pixel.drawFloor(ctx, vx, vy, 24, color);
    });
  },

  // 真っ白（色を付けて帯や光に使う）・丸い影・四角い枠・攻撃マーク
  whiteSlot: function () {
    return this.slot("white", 8, 8, function (ctx) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 8, 8);
    });
  },
  shadowSlot: function () {
    return this.slot("shadow", 32, 32, function (ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(16, 16, 15, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  ringSlot: function () {
    return this.slot("ring", 32, 32, function (ctx) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 28, 28);
    });
  },
  spikeSlot: function () {
    return this.slot("spike", 32, 32, function (ctx) {
      Game.fx.spike(ctx, 16, 16, 15, 6);
    });
  },

  // ---------- 頂点の組み立て ----------
  data: new Float32Array(9 * 6 * 4000),
  n: 0,

  vert: function (x, y, z, u, v, c) {
    if (this.n + 9 > this.data.length) {
      var bigger = new Float32Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    var d = this.data, n = this.n;
    d[n] = x; d[n + 1] = y; d[n + 2] = z; d[n + 3] = u; d[n + 4] = v;
    d[n + 5] = c[0]; d[n + 6] = c[1]; d[n + 7] = c[2]; d[n + 8] = c[3];
    this.n = n + 9;
  },

  // 4つの角（左下・右下・右上・左上）で四角を1枚
  quad: function (p0, p1, p2, p3, s, c) {
    this.vert(p0[0], p0[1], p0[2], s.u0, s.v1, c);
    this.vert(p1[0], p1[1], p1[2], s.u1, s.v1, c);
    this.vert(p2[0], p2[1], p2[2], s.u1, s.v0, c);
    this.vert(p0[0], p0[1], p0[2], s.u0, s.v1, c);
    this.vert(p2[0], p2[1], p2[2], s.u1, s.v0, c);
    this.vert(p3[0], p3[1], p3[2], s.u0, s.v0, c);
  },

  // 床に寝かせた四角（x, z はマスの左上。size は1マスに対する大きさ、中央寄せ）
  flat: function (x, z, y, size, s, c) {
    var m = (1 - size) / 2;
    var x0 = x + m, x1 = x + 1 - m, z0 = z + m, z1 = z + 1 - m;
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], s, c);
  },

  // 立てた板（紙芝居）。(cx, cz) は足元の中心。up は板の上方向にずらす量、roll は傾き（のけぞり）、
  // side は横にずらす量、flip がマイナスなら絵を左右反転（左向き）
  board: function (cx, cz, w, h, s, c, up, roll, side, flip) {
    var t = (this.lean * Math.PI) / 180;
    var U = [0, Math.cos(t), -Math.sin(t)], R = [1, 0, 0];
    if (roll) {
      var cs = Math.cos(roll), sn = Math.sin(roll);
      var R2 = [R[0] * cs + U[0] * sn, R[1] * cs + U[1] * sn, R[2] * cs + U[2] * sn];
      U = [U[0] * cs - R[0] * sn, U[1] * cs - R[1] * sn, U[2] * cs - R[2] * sn];
      R = R2;
    }
    if (flip < 0) s = { u0: s.u1, u1: s.u0, v0: s.v0, v1: s.v1 };
    var bx = cx + U[0] * (up || 0) + R[0] * (side || 0);
    var by = 0.01 + U[1] * (up || 0) + R[1] * (side || 0);
    var bz = cz + U[2] * (up || 0) + R[2] * (side || 0);
    var hw = w / 2;
    var p0 = [bx - R[0] * hw, by - R[1] * hw, bz - R[2] * hw];
    var p1 = [bx + R[0] * hw, by + R[1] * hw, bz + R[2] * hw];
    this.quad(p0, p1,
      [p1[0] + U[0] * h, p1[1] + U[1] * h, p1[2] + U[2] * h],
      [p0[0] + U[0] * h, p0[1] + U[1] * h, p0[2] + U[2] * h], s, c);
  },

  rgb: function (hex, mul, alpha) {
    var h = (hex || "#fff").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var v = parseInt(h, 16), m = mul === undefined ? 1 : mul;
    return [((v >> 16) & 255) / 255 * m, ((v >> 8) & 255) / 255 * m, (v & 255) / 255 * m, alpha === undefined ? 1 : alpha];
  },
});
