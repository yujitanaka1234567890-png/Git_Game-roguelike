// 3D表示（試作）。3 キーで 2D ⇔ 3D を切り替える（選んだ方はこのブラウザに覚えておく）。
// ゲームのルールには一切さわらず、「今の状態を立体で見せる」だけの、もう1つの描画係。
// 外部のライブラリは使わず、ブラウザに入っている WebGL で直接描く。
//
// 見せ方：
//   ・カメラは斜め上から見下ろし、主人公を追いかける。左上に全体マップ（minimap.js）
//   ・キャラは紙芝居のように動く（すべる移動・向きの裏返し・攻撃の踏み込み・やられ。anim3d.js）
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
  camHeight: 10.5, // カメラの高さ（大きいほど引きで広く見える）
  camBack: 7.7, // カメラが主人公より手前（画面下側）にいる距離（高さとの比で見下ろす角度が決まる）
  fov: 50, // 縦の視野角（度）
  lean: 25, // 板（キャラ）をカメラ側へ傾ける角度（度）。0 だと真っ直ぐ立つが、上から見ると潰れて見える
  dim: 0.45, // 探索済みで今見えていない所の明るさ
  zoom: 1, // カメラの距離の倍率（＋／－キー。小さいほど寄る）
  zoomMin: 0.55,
  zoomMax: 1.6,
  zoomKey: "dimension-roguelike-zoom",

  canvas: null,
  gl: null,
  cam: null, // 今のカメラの注視点 {x, z}（主人公の表示位置）
  loop: null, // 描き直し続けている間は requestAnimationFrame の番号
  lastTiles: null, // 前に描いたマップ（変わったら別の階）

  init: function () {
    try {
      if (window.localStorage.getItem(this.prefKey) === "3d") this.enabled = true;
      var z = parseFloat(window.localStorage.getItem(this.zoomKey));
      if (z >= this.zoomMin && z <= this.zoomMax) this.zoom = z;
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
    this.lastTiles = null; // 動きの記録をやり直す
    if (!this.enabled) this.show(false);
    return this.enabled ? "表示：3D（試作）" : "表示：2D";
  },

  // ＋／－キー：カメラを寄せる（dir = -1）・引く（dir = 1）。表示するメッセージを返す
  zoomBy: function (dir) {
    if (!this.enabled) return "カメラの寄り引きは3D表示の時に使える（3 キー）";
    this.zoom = Math.max(this.zoomMin, Math.min(this.zoomMax, Math.round((this.zoom + dir * 0.15) * 100) / 100));
    try {
      window.localStorage.setItem(this.zoomKey, String(this.zoom));
    } catch (e) {
      // 覚えておけなくても使える
    }
    return "カメラ：" + Math.round(this.zoom * 100) + "%（＋で寄る・－で引く）";
  },

  // 3D で描く場面か（倒れた時の画面は 2D の方で出す）
  active: function () {
    return this.enabled && Game.state !== "gameover" && this.setup();
  },

  show: function (on) {
    document.getElementById("game").style.display = on ? "none" : "";
    if (this.canvas) this.canvas.style.display = on ? "" : "none";
    if (!on) Game.minimap.hide();
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
    var self = this;
    cv.addEventListener("wheel", function (e) {
      e.preventDefault();
      Game.refresh(self.zoomBy(e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
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

  // ---------- 描く ----------
  // renderer.draw() から呼ばれる（ゲームの状態が変わった時）。紙芝居の動きのため、その後も1秒に30回ほど描き直し続ける
  draw: function () {
    this.show(true);
    if (this.lastTiles !== Game.map.tiles) {
      // 別の階・拠点に移った：動きの記録をやり直す
      this.lastTiles = Game.map.tiles;
      Game.anim3d.reset();
    }
    Game.minimap.draw();
    this.render();
    this.startLoop();
  },

  startLoop: function () {
    if (this.loop) return;
    var self = this, last = 0;
    var tick = function (t) {
      if (!self.active()) {
        self.loop = null;
        return;
      }
      self.loop = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      self.render();
    };
    this.loop = requestAnimationFrame(tick);
  },

  render: function () {
    var gl = this.gl;
    var fov = Game.fov;
    var c = Game.config.colors;
    var inBase = Game.state === "base";
    var dg = inBase ? null : Game.currentDungeon();
    var wc = dg ? dg.colors || Game.WORLDS[dg.world].colors : null;
    var style = dg ? dg.style || null : null;
    var wallColor = wc ? wc.wall : c.wall;
    var floorColor = wc ? wc.floor : c.floor;
    var H = this.wallHeight;
    var map = Game.map;
    var now = Date.now();
    this.n = 0;

    // キャラの今の見た目（紙芝居の動き）を先に決め、カメラは主人公の表示位置を追う
    var units = this.collectUnits(now);
    var hero = units.heroPose;
    var cam = (this.cam = { x: hero.x, z: hero.z });
    Game.anim3d.sweep(now);

    // ---- 1. 地形（画面に映る範囲だけ） ----
    var zr = Math.max(1, this.zoom); // 引くほど広く組み立てる
    var x1 = Math.max(0, Math.floor(cam.x - 20 * zr)), x2 = Math.min(map.width - 1, Math.floor(cam.x + 20 * zr));
    var z1 = Math.max(0, Math.floor(cam.z - 17 * zr)), z2 = Math.min(map.height - 1, Math.floor(cam.z + 9 * zr));
    var flats = []; // 床に置く設備（階段・脱出口）
    var stands = []; // 立てる設備（収納箱・門など）
    for (var z = z1; z <= z2; z++) {
      for (var x = x1; x <= x2; x++) {
        if (!fov.isExplored(x, z)) continue;
        var tile = map.tiles[z][x];
        var lit = inBase || fov.isVisible(x, z);
        var m = lit ? 1 : this.dim;
        if (tile === "#") {
          var ws = style ? this.tileSlot("wall", wallColor, (x % 4) + (z % 4) * 4, style) : this.tileSlot("wall", wallColor);
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
        if (tile === "~") {
          // 水たまり：ゆらゆらと明るさが揺れる
          var wv = m * (0.85 + 0.15 * Math.sin(now / 500 + x * 0.7 + z * 1.3));
          this.quad([x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, 0, z], [x, 0, z],
            this.tileSlot("water", (wc && wc.water) || c.water, (x % 4) + (z % 4) * 4, "water"), [wv, wv, wv, 1]);
          continue;
        }
        if (tile === ",") fsl = this.tileSlot("grass", c.grass, variant);
        else if (inBase) fsl = this.tileSlot("floor", tile === "G" ? c.gate : c.houseFloor, variant);
        else fsl = style ? this.tileSlot("floor", floorColor, (x % 4) + (z % 4) * 4, style) : this.tileSlot("floor", floorColor, variant);
        this.quad([x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, 0, z], [x, 0, z], fsl, [m, m, m, 1]);
        var spr = Game.renderer.tileSprites[tile];
        if (spr) {
          var name = spr.sprite;
          if (tile === "G") {
            if (map.tileAt(x - 1, z) !== "G") name = "gateL";
            else if (map.tileAt(x + 1, z) !== "G") name = "gateR";
          }
          var entry = { x: x, z: z, s: this.spriteSlot(name, null, spr.color, spr.char), m: m };
          if (tile === ">") flats.push(entry);
          else stands.push(entry);
        }
      }
    }
    var solidEnd = this.n;

    // ---- 2. 床の上に描くもの（階段・影・仲間の印・技の光） ----
    var i;
    for (i = 0; i < flats.length; i++) this.flat(flats[i].x, flats[i].z, 0.004, 1, flats[i].s, [flats[i].m, flats[i].m, flats[i].m, 1]);
    var sh = this.shadowSlot(), ring = this.ringSlot(), white = this.whiteSlot();
    for (i = 0; i < units.length; i++) {
      var u = units[i];
      this.flat(u.x - 0.5, u.z - 0.5, 0.006, u.boss ? 1.3 : 0.7, sh, u.boss ? [1, 0.15, 0.15, 0.8] : [1, 1, 1, 1]);
      if (u.ally) this.flat(u.x - 0.5, u.z - 0.5, 0.008, 0.92, ring, this.rgb(u.squad ? "#ffaa33" : "#4aa0ff"));
      if (u.rescueRing) this.flat(u.x - 0.5, u.z - 0.5, 0.008, 1, ring, this.rgb("#b066ff"));
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
      var size = un.boss ? 2 : un.item ? 0.7 : 1.3; // 引きで見ても分かるよう、キャラは1マスより少し大きく
      var fp = un.flip === undefined ? 1 : un.flip;
      var w = size * Math.abs(fp) * (un.sx || 1), h = size * (un.sy || 1);
      var tint = un.tint || (un.unitRef && un.unitRef.sleep > 0 ? [0.6, 0.7, 1.15] : [1, 1, 1]); // 眠っていると青っぽい
      this.board(un.x, un.z, w, h, un.s, [un.m * tint[0], un.m * tint[1], un.m * tint[2], 1], un.lift || 0, un.roll || 0, 0, fp);
      var top = h + (un.lift || 0);
      if (un.hp !== undefined && un.hp < un.maxHp) {
        this.board(un.x, un.z, 0.8, 0.08, white, this.rgb(c.hpBarBg), top + 0.06);
        var r = un.hp / un.maxHp;
        // 中身は下地より少しカメラ側に置く（同じ面だと下地に隠れて赤黒くしか見えなかった）。仲間は緑、敵は赤
        this.board(un.x - 0.4 + 0.4 * r, un.z + 0.03, 0.8 * r, 0.08, white, this.rgb(un.ally ? c.allyHpBar : c.hpBar), top + 0.06);
      }
      for (var pip = 0; pip < (un.stage || 1) - 1; pip++) {
        this.board(un.x, un.z, 0.14, 0.14, white, this.rgb("#ffe066"), top - 0.2, 0, -0.42 + pip * 0.18);
      }
    }
    // 攻撃マーク（赤いとげとげ）：攻撃された側に出す
    var spike = this.spikeSlot();
    for (i = 0; i < Game.fx.hits.length; i++) {
      var hm = Game.fx.hits[i];
      var pu = units.byObj.get(hm.unit);
      if (hm.start > now || hm.until <= now || !pu) continue;
      this.board(pu.x - hm.dx * 0.42, pu.z - hm.dy * 0.42, 0.55, 0.55, spike, [1, 1, 1, 1], 0.2);
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

  // 立てて描くもの（主人公・仲間・敵・アイテム・気配・飛んでいるアイテム）を集め、
  // キャラは紙芝居の動き（anim3d.js）で今の見た目を決める。list.byObj＝キャラ→見た目、list.heroPose＝主人公
  collectUnits: function (now) {
    var list = [];
    list.byObj = new Map();
    var fov = Game.fov;
    var self = this;
    var add = function (o) { list.push(o); };
    // キャラ1体：obj = 動きを覚えておく相手（主人公・仲間・敵・牧場の子）
    var mon = function (t, x, y, obj, unit, extra) {
      var pose = Game.anim3d.pose(obj, x + 0.5, y + 0.5, now, false);
      var spr = pose.suffix && Game.SPRITES[t.sprite + pose.suffix] ? t.sprite + pose.suffix : t.sprite; // 歩き・攻撃の絵
      var o = { s: self.spriteSlot(spr, t.overlay, t.color, t.symbol), m: 1, boss: !!t.boss, stage: t.stage };
      for (var pk in pose) o[pk] = pose[pk];
      if (unit) { o.hp = unit.hp; o.maxHp = unit.maxHp; o.unitRef = unit; }
      for (var k in extra) o[k] = extra[k];
      list.byObj.set(obj, o);
      return o;
    };
    if (Game.state === "base") {
      var ms = Game.baseScene.monsters;
      for (var b = 0; b < ms.length; b++) {
        add(mon(Game.MONSTERS[ms[b].entry.type], ms[b].x, ms[b].y, ms[b], null, { ally: !!Game.base.selected[ms[b].entry.id] }));
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
      // はぐれた仲間：モンスターの姿のまま動かず、紫の枠の中に立っている
      var lt = Game.MONSTERS[mk.type];
      add({
        x: mk.x + 0.5, z: mk.y + 0.5, m: fov.isVisible(mk.x, mk.y) ? 1 : this.dim, rescueRing: true,
        s: lt ? this.spriteSlot(lt.sprite, lt.overlay, lt.color, lt.symbol) : this.spriteSlot("marker", null, "#66ffee", "◇"),
      });
    }
    var allies = Game.allies.list;
    for (var a = 0; a < allies.length; a++) {
      var al = allies[a];
      if (al.x < 0) continue;
      add(mon(Game.MONSTERS[al.type], al.x, al.y, al, al, { ally: true, squad: !!al.squad, charge: al.charge ? "#66ccff" : null }));
    }
    var es = Game.enemies.list;
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      if (!fov.isVisible(e.x, e.y)) continue;
      add(mon(Game.MONSTERS[e.type], e.x, e.y, e, e, { charge: e.charge ? "#ffe066" : null }));
    }
    var p = Game.player;
    var hp = Game.anim3d.pose(p, p.x + 0.5, p.y + 0.5, now, true);
    hp.s = this.spriteSlot(hp.frame, null, Game.config.colors.player, p.symbol);
    hp.m = 1;
    add(hp);
    list.byObj.set(p, hp);
    list.heroPose = hp;
    var pr = Game.throwing.projectile;
    if (pr) add({ x: pr.x + 0.5, z: pr.y + 0.5, s: this.spriteSlot(pr.sprite, null, pr.color, pr.symbol), m: 1, item: true });
    return list;
  },

  // ---------- カメラ（行列の計算） ----------
  cameraMatrix: function () {
    var aspect = this.canvas.width / this.canvas.height;
    var f = 1 / Math.tan((this.fov * Math.PI) / 360), near = 0.5, far = 90;
    var P = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
    var eye = [this.cam.x, this.camHeight * this.zoom, this.cam.z + this.camBack * this.zoom];
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
