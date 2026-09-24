// 3D表示（試作）。3 キーで 2D ⇔ 3D を切り替える（選んだ方はこのブラウザに覚えておく）。
// ゲームのルールには一切さわらず、「今の状態を立体で見せる」だけの、もう1つの描画係。
// 外部のライブラリは使わず、ブラウザに入っている WebGL で直接描く。
//
// 見せ方：
//   ・カメラは斜め上から見下ろし、主人公を追いかける（なめらかに動く）
//   ・壁は箱、床は板。模様は 2D と同じもの（pixelart.js）をその場で描いて貼る
//   ・キャラ・アイテム・設備は、ドット絵を描いた「板（紙芝居）」をカメラ向きに少し傾けて立てる
//   ・光の計算はしない（面ごとに明るさを変えるだけ）→ 内蔵グラフィックでも軽い
//   ・画面に映る範囲（主人公のまわり）だけを組み立てる
Game.view3d = {
  enabled: false,
  prefKey: "dimension-roguelike-view",
  failed: false, // WebGL が使えなかった

  // 見た目の設定
  wallHeight: 0.9, // 壁の高さ（1マス＝1）
  camHeight: 7.5, // カメラの高さ
  camBack: 5.5, // カメラが主人公より手前（画面下側）にいる距離
  fov: 50, // 縦の視野角（度）
  lean: 25, // 板（キャラ）をカメラ側へ傾ける角度（度）。0 だと真っ直ぐ立つが、上から見ると潰れて見える
  dim: 0.45, // 探索済みで今見えていない所の明るさ

  canvas: null,
  gl: null,
  cam: null, // 今のカメラの注視点 {x, z}
  anim: null, // カメラを動かしている途中なら requestAnimationFrame の番号

  init: function () {
    try {
      if (window.localStorage.getItem(this.prefKey) === "3d") this.enabled = true;
    } catch (e) {
      // 覚えておけなくても切り替えはできる
    }
  },

  // 3 キー：切り替えて、表示するメッセージを返す
  toggle: function () {
    this.enabled = !this.enabled;
    if (this.enabled && !this.setup()) {
      this.enabled = false;
      return "このブラウザでは3D表示が使えない";
    }
    try {
      window.localStorage.setItem(this.prefKey, this.enabled ? "3d" : "2d");
    } catch (e) {
      // 覚えておけなくても切り替えはできる
    }
    this.cam = null; // すぐ主人公の位置へ
    if (!this.enabled) this.show(false);
    return this.enabled ? "表示：3D（試作）" : "表示：2D";
  },

  // 3D で描く場面か（倒れた時の画面は 2D の方で出す）
  active: function () {
    return this.enabled && Game.state !== "gameover" && this.setup();
  },

  show: function (on) {
    document.getElementById("game").style.display = on ? "none" : "";
    if (this.canvas) this.canvas.style.display = on ? "" : "none";
  },

  // ---------- 準備（最初に3Dにした時に1回だけ） ----------
  setup: function () {
    if (this.gl) return true;
    if (this.failed) return false;
    var cv = document.createElement("canvas");
    cv.id = "game3d";
    cv.width = 960;
    cv.height = 648;
    cv.style.display = "none";
    var gl = cv.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      this.failed = true;
      return false;
    }
    var game = document.getElementById("game");
    game.parentNode.insertBefore(cv, game.nextSibling);
    this.canvas = cv;
    this.gl = gl;

    var vs =
      "attribute vec3 aPos; attribute vec2 aUv; attribute vec4 aCol; uniform mat4 uMat;" +
      "varying vec2 vUv; varying vec4 vCol;" +
      "void main(){ gl_Position = uMat * vec4(aPos, 1.0); vUv = aUv; vCol = aCol; }";
    var fs =
      "precision mediump float; uniform sampler2D uTex; varying vec2 vUv; varying vec4 vCol;" +
      "void main(){ vec4 c = texture2D(uTex, vUv) * vCol; if (c.a < 0.05) discard; gl_FragColor = c; }";
    var prog = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(function (s) {
      var sh = gl.createShader(s[0]);
      gl.shaderSource(sh, s[1]);
      gl.compileShader(sh);
      gl.attachShader(prog, sh);
    });
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.uMat = gl.getUniformLocation(prog, "uMat");
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    var stride = 9 * 4;
    var attrs = [["aPos", 3, 0], ["aUv", 2, 3], ["aCol", 4, 5]];
    for (var i = 0; i < attrs.length; i++) {
      var loc = gl.getAttribLocation(prog, attrs[i][0]);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, attrs[i][1], gl.FLOAT, false, stride, attrs[i][2] * 4);
    }

    // 絵をまとめて貼っておく大きな1枚（アトラス）。必要になった絵から順に空いている枠へ描く
    this.atlas = document.createElement("canvas");
    this.atlas.width = this.atlas.height = this.ATLAS;
    this.actx = this.atlas.getContext("2d");
    this.actx.imageSmoothingEnabled = false;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); // ドットをくっきり
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlasDirty = true;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 1);
    return true;
  },

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
      return this.slot("spr|" + sprite + "|" + (overlay || "") + "|" + color, 12, 12, function (ctx) {
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

  // 立てた板（紙芝居）。(cx, cz) は足元の中心。up は板の上方向にずらす量、roll は傾き（のけぞり）
  board: function (cx, cz, w, h, s, c, up, roll, side) {
    var t = (this.lean * Math.PI) / 180;
    var U = [0, Math.cos(t), -Math.sin(t)], R = [1, 0, 0];
    if (roll) {
      var cs = Math.cos(roll), sn = Math.sin(roll);
      var R2 = [R[0] * cs + U[0] * sn, R[1] * cs + U[1] * sn, R[2] * cs + U[2] * sn];
      U = [U[0] * cs - R[0] * sn, U[1] * cs - R[1] * sn, U[2] * cs - R[2] * sn];
      R = R2;
    }
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

  // ---------- 描く ----------
  // renderer.draw() から呼ばれる。カメラが主人公に追いついていなければ、追いつくまで毎フレーム描き直す
  draw: function () {
    this.show(true);
    var p = Game.player;
    var tx = p.x + 0.5, tz = p.y + 0.5;
    if (!this.cam || Math.abs(this.cam.x - tx) + Math.abs(this.cam.z - tz) > 6) this.cam = { x: tx, z: tz }; // 階移動などは一瞬で
    this.render();
    var self = this;
    if (!this.anim && (Math.abs(this.cam.x - tx) > 0.01 || Math.abs(this.cam.z - tz) > 0.01)) {
      var step = function () {
        self.anim = null;
        if (!self.active()) return;
        var gx = Game.player.x + 0.5, gz = Game.player.y + 0.5;
        self.cam.x += (gx - self.cam.x) * 0.3;
        self.cam.z += (gz - self.cam.z) * 0.3;
        if (Math.abs(gx - self.cam.x) < 0.01 && Math.abs(gz - self.cam.z) < 0.01) self.cam = { x: gx, z: gz };
        self.render();
        if (self.cam.x !== gx || self.cam.z !== gz) self.anim = requestAnimationFrame(step);
      };
      this.anim = requestAnimationFrame(step);
    }
  },

  render: function () {
    var gl = this.gl;
    var cam = this.cam;
    var fov = Game.fov;
    var c = Game.config.colors;
    var inBase = Game.state === "base";
    var wc = inBase ? null : Game.WORLDS[Game.currentDungeon().world].colors;
    var wallColor = wc ? wc.wall : c.wall;
    var floorColor = wc ? wc.floor : c.floor;
    var H = this.wallHeight;
    var map = Game.map;
    this.n = 0;

    // ---- 1. 地形（画面に映る範囲だけ） ----
    var x1 = Math.max(0, Math.floor(cam.x) - 15), x2 = Math.min(map.width - 1, Math.floor(cam.x) + 15);
    var z1 = Math.max(0, Math.floor(cam.z) - 12), z2 = Math.min(map.height - 1, Math.floor(cam.z) + 7);
    var flats = []; // 床に置く設備（階段・脱出口）
    var stands = []; // 立てる設備（収納箱・門など）
    for (var z = z1; z <= z2; z++) {
      for (var x = x1; x <= x2; x++) {
        if (!fov.isExplored(x, z)) continue;
        var tile = map.tiles[z][x];
        var lit = inBase || fov.isVisible(x, z);
        var m = lit ? 1 : this.dim;
        if (tile === "#") {
          var ws = this.tileSlot("wall", wallColor);
          this.quad([x, H, z + 1], [x + 1, H, z + 1], [x + 1, H, z], [x, H, z], ws, [m, m, m, 1]);
          var tS = this.shadeCol(m, 0.78), tE = this.shadeCol(m, 0.62), tN = this.shadeCol(m, 0.45);
          if (this.open(x, z + 1)) this.quad([x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, H, z + 1], [x, H, z + 1], ws, tS);
          if (this.open(x, z - 1)) this.quad([x + 1, 0, z], [x, 0, z], [x, H, z], [x + 1, H, z], ws, tN);
          if (this.open(x - 1, z)) this.quad([x, 0, z], [x, 0, z + 1], [x, H, z + 1], [x, H, z], ws, tE);
          if (this.open(x + 1, z)) this.quad([x + 1, 0, z + 1], [x + 1, 0, z], [x + 1, H, z], [x + 1, H, z + 1], ws, tE);
          continue;
        }
        var variant = (x * 7 + z * 13) % 4;
        var fsl;
        if (tile === ",") fsl = this.tileSlot("grass", c.grass, variant);
        else if (inBase) fsl = this.tileSlot("floor", tile === "G" ? c.gate : c.houseFloor, variant);
        else fsl = this.tileSlot("floor", floorColor, variant);
        this.quad([x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, 0, z], [x, 0, z], fsl, [m, m, m, 1]);
        var spr = Game.renderer.tileSprites[tile];
        if (spr) {
          var name = spr.sprite;
          if (tile === "G") {
            if (map.tileAt(x - 1, z) !== "G") name = "gateL";
            else if (map.tileAt(x + 1, z) !== "G") name = "gateR";
          }
          var entry = { x: x, z: z, s: this.spriteSlot(name, null, spr.color, spr.char), m: m };
          if (tile === ">" || tile === "O") flats.push(entry);
          else stands.push(entry);
        }
      }
    }
    var solidEnd = this.n;

    // ---- 2. 床の上に描くもの（階段・影・仲間の印・技の光） ----
    var i;
    for (i = 0; i < flats.length; i++) this.flat(flats[i].x, flats[i].z, 0.004, 1, flats[i].s, [flats[i].m, flats[i].m, flats[i].m, 1]);
    var units = this.collectUnits();
    var sh = this.shadowSlot(), ring = this.ringSlot(), white = this.whiteSlot();
    for (i = 0; i < units.length; i++) {
      var u = units[i];
      this.flat(u.x - 0.5, u.z - 0.5, 0.006, u.boss ? 1.3 : 0.7, sh, u.boss ? [1, 0.15, 0.15, 0.8] : [1, 1, 1, 1]);
      if (u.ally) this.flat(u.x - 0.5, u.z - 0.5, 0.008, 0.92, ring, this.rgb("#4aa0ff"));
      if (u.charge) this.flat(u.x - 0.5, u.z - 0.5, 0.009, 0.96, ring, this.rgb(u.charge));
    }
    var fl = Game.fx.list;
    for (i = 0; i < fl.length; i++) {
      var col = this.rgb(fl[i].color, 1, 0.5);
      for (var k = 0; k < fl[i].cells.length; k++) this.flat(fl[i].cells[k].x, fl[i].cells[k].y, 0.012, 1, white, col);
    }
    var decalEnd = this.n;

    // ---- 3. 立てる板（設備・アイテム・キャラ） ----
    for (i = 0; i < stands.length; i++) {
      var st = stands[i];
      this.board(st.x + 0.5, st.z + 0.5, 1, 1, st.s, [st.m, st.m, st.m, 1]);
    }
    units.sort(function (a, b) { return a.z - b.z; }); // 奥から順に
    for (i = 0; i < units.length; i++) {
      var un = units[i];
      var size = un.boss ? 1.6 : un.item ? 0.6 : 0.95;
      var tilt = un.unit ? Game.fx.tiltOf(un.unit) : null;
      var ox = tilt ? tilt.dx * 0.12 : 0, oz = tilt ? tilt.dy * 0.12 : 0;
      var roll = tilt ? -(tilt.dx !== 0 ? tilt.dx : tilt.dy * 0.6) * 0.3 : 0;
      this.board(un.x + ox, un.z + oz, size, size, un.s, [un.m, un.m, un.m, 1], 0, roll);
      if (un.hp !== undefined && un.hp < un.maxHp) {
        this.board(un.x, un.z, 0.8, 0.08, white, this.rgb(c.hpBarBg), size + 0.06);
        var r = un.hp / un.maxHp;
        this.board(un.x - 0.4 + 0.4 * r, un.z, 0.8 * r, 0.08, white, this.rgb(c.hpBar), size + 0.061);
      }
      for (var pip = 0; pip < (un.stage || 1) - 1; pip++) {
        this.board(un.x, un.z, 0.14, 0.14, white, this.rgb("#ffe066"), size - 0.2, 0, -0.38 + pip * 0.18);
      }
    }
    // 攻撃マーク（赤いとげとげ）
    var now = Date.now(), spike = this.spikeSlot();
    for (i = 0; i < Game.fx.hits.length; i++) {
      var h = Game.fx.hits[i];
      if (h.until <= now || h.unit.x < 0) continue;
      if (h.unit !== Game.player && Game.allies.list.indexOf(h.unit) < 0 && !fov.isVisible(h.unit.x, h.unit.y)) continue;
      this.board(h.unit.x + 0.5 - h.dx * 0.42, h.unit.y + 0.5 - h.dy * 0.42, 0.55, 0.55, spike, [1, 1, 1, 1], 0.2);
    }
    var spriteEnd = this.n;

    // ---- 4. 画面全体にかける色（精神力が減った時の紫のにじみ） ----
    var p = Game.player;
    if (!inBase && p.maxMind && p.mind / p.maxMind < 0.3) {
      var a = (0.3 - p.mind / p.maxMind) * 1.2;
      this.quad([-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], white, [70 / 255, 0, 110 / 255, a]);
    }
    var overlayEnd = this.n;

    // ---- 実際に描く ----
    if (this.atlasDirty) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas);
      this.atlasDirty = false;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n), gl.DYNAMIC_DRAW);
    gl.uniformMatrix4fv(this.uMat, false, this.cameraMatrix());
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, solidEnd / 9);
    gl.depthMask(false); // 床の上の物は重なっても消し合わない
    gl.drawArrays(gl.TRIANGLES, solidEnd / 9, (decalEnd - solidEnd) / 9);
    gl.depthMask(true);
    gl.drawArrays(gl.TRIANGLES, decalEnd / 9, (spriteEnd - decalEnd) / 9);
    if (overlayEnd > spriteEnd) {
      gl.disable(gl.DEPTH_TEST);
      gl.uniformMatrix4fv(this.uMat, false, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      gl.drawArrays(gl.TRIANGLES, spriteEnd / 9, (overlayEnd - spriteEnd) / 9);
      gl.enable(gl.DEPTH_TEST);
    }
  },

  shadeCol: function (m, f) {
    return [m * f, m * f, m * f, 1];
  },

  // 壁の面を描くか：隣が壁でなく、マップの中なら描く
  open: function (x, z) {
    var t = Game.map.tileAt(x, z);
    return t !== undefined && t !== null && t !== "#";
  },

  // 立てて描くもの（主人公・仲間・敵・アイテム・気配・飛んでいるアイテム）を集める
  collectUnits: function () {
    var list = [];
    var fov = Game.fov;
    var c = Game.config.colors;
    var self = this;
    var add = function (o) { list.push(o); };
    var mon = function (t, x, y, unit, extra) {
      var o = { x: x + 0.5, z: y + 0.5, s: self.spriteSlot(t.sprite, t.overlay, t.color, t.symbol), m: 1, unit: unit, boss: !!t.boss, stage: t.stage };
      if (unit) { o.hp = unit.hp; o.maxHp = unit.maxHp; }
      for (var k in extra) o[k] = extra[k];
      return o;
    };
    if (Game.state === "base") {
      var ms = Game.baseScene.monsters;
      for (var b = 0; b < ms.length; b++) {
        add(mon(Game.MONSTERS[ms[b].entry.type], ms[b].x, ms[b].y, null, { ally: !!Game.base.selected[ms[b].entry.id] }));
      }
    }
    var items = Game.items.floorItems;
    for (var j = 0; j < items.length; j++) {
      var fi = items[j];
      if (!fi.seen) continue;
      var it = Game.items.types[fi.type];
      add({ x: fi.x + 0.5, z: fi.y + 0.5, s: this.spriteSlot(it.sprite, null, it.color, it.symbol), m: fov.isVisible(fi.x, fi.y) ? 1 : this.dim, item: true });
    }
    var mk = Game.rescue.marker;
    if (mk && mk.seen) {
      add({ x: mk.x + 0.5, z: mk.y + 0.5, s: this.spriteSlot("marker", null, "#66ffee", "◇"), m: fov.isVisible(mk.x, mk.y) ? 1 : this.dim, item: true });
    }
    var allies = Game.allies.list;
    for (var a = 0; a < allies.length; a++) {
      var al = allies[a];
      if (al.x < 0) continue;
      add(mon(Game.MONSTERS[al.type], al.x, al.y, al, { ally: true, charge: al.charge ? "#66ccff" : null }));
    }
    var es = Game.enemies.list;
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (!fov.isVisible(e.x, e.y)) continue;
      add(mon(Game.MONSTERS[e.type], e.x, e.y, e, { charge: e.charge ? "#ffe066" : null }));
    }
    var p = Game.player;
    add({ x: p.x + 0.5, z: p.y + 0.5, s: this.spriteSlot("player", null, c.player, p.symbol), m: 1, unit: p });
    var pr = Game.throwing.projectile;
    if (pr) add({ x: pr.x + 0.5, z: pr.y + 0.5, s: this.spriteSlot(pr.sprite, null, pr.color, pr.symbol), m: 1, item: true });
    return list;
  },

  // ---------- カメラ（行列の計算） ----------
  cameraMatrix: function () {
    var aspect = this.canvas.width / this.canvas.height;
    var f = 1 / Math.tan((this.fov * Math.PI) / 360), near = 0.5, far = 60;
    var P = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
    var eye = [this.cam.x, this.camHeight, this.cam.z + this.camBack];
    var at = [this.cam.x, 0, this.cam.z - 0.3];
    var zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
    var zl = Math.hypot(zx, zy, zz);
    zx /= zl; zy /= zl; zz /= zl;
    // x = up(0,1,0) × z
    var xx = zz, xy = 0, xz = -zx;
    var xl = Math.hypot(xx, xy, xz);
    xx /= xl; xz /= xl;
    // y = z × x
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    var V = [
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1,
    ];
    var out = new Array(16);
    for (var col = 0; col < 4; col++) {
      for (var row = 0; row < 4; row++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += P[k * 4 + row] * V[col * 4 + k];
        out[col * 4 + row] = s;
      }
    }
    return out;
  },
};
