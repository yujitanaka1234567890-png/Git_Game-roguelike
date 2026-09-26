// 3Dの背景「水の中」（水底の都）に泳ぐ生き物。見た目だけでゲームの進行には関係しない。backdrop.js の underwater から呼ぶ。
//   ・小魚の群れ：いつも画面のあちこちで行ったり来たりしている（drawFish）
//   ・大きな影：cycle 秒ごとに、ときどき大きな生き物が遠くを横切る（drawBig）。出し物は4つ
//       whale … クジラがゆっくり横切る        squid … ダイオウイカが脈打つように泳いで横切る
//       fight … クジラにダイオウイカが絡みついて、もみ合いながら横切る
//       feed  … クジラが小魚の群れに向かって大きな口を開け、群れを飲み込んでいく
//   形はすべて右向きの「1＝体の長さ」の座標で描き、向き・大きさは変形（scale）で決める。
Game.backdropSea = {
  cycle: 30, // 大きな生き物の出し物の間隔（秒）
  duration: 17, // 1回の出し物で画面を横切る時間（秒）
  schools: null,

  rand: function (n) { return Game.backdrop.rand(n); },

  // ---------- 小魚 ----------
  seedFish: function () {
    var r = this.rand(41), W = Game.backdrop.W, H = Game.backdrop.H, list = [];
    for (var i = 0; i < 5; i++) {
      var sc = { cx: r() * W, cy: H * (0.15 + r() * 0.75), amp: 50 + r() * 110, sp: 0.12 + r() * 0.18, ph: r() * 6.28, fish: [] };
      var n = 5 + Math.floor(r() * 6);
      for (var k = 0; k < n; k++) sc.fish.push({ ox: (r() - 0.5) * 34, oy: (r() - 0.5) * 20, size: 3 + r() * 2.5, wig: r() * 6.28 });
      list.push(sc);
    }
    return list;
  },

  // 小魚1匹（x, y が体の真ん中。dir = 1 右向き / -1 左向き）
  fish: function (ctx, x, y, size, dir, t, a) {
    var tail = Math.sin(t * 12) * size * 0.25;
    ctx.fillStyle = "rgba(150,205,225," + a.toFixed(2) + ")";
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - dir * size * 0.8, y);
    ctx.lineTo(x - dir * size * 1.6, y - size * 0.45 + tail);
    ctx.lineTo(x - dir * size * 1.6, y + size * 0.45 + tail);
    ctx.closePath();
    ctx.fill();
  },

  // 群れは左右に行ったり来たり（端で向きを変える）
  drawFish: function (ctx, t, px, pz) {
    if (!this.schools) this.schools = this.seedFish();
    var W = Game.backdrop.W;
    for (var i = 0; i < this.schools.length; i++) {
      var sc = this.schools[i];
      var ang = t * sc.sp + sc.ph;
      var dir = Math.cos(ang) >= 0 ? 1 : -1;
      var cx = Game.backdrop.wrap(sc.cx + Math.sin(ang) * sc.amp - px * 3, W + 80) - 40;
      var cy = sc.cy + Math.sin(t * 0.5 + sc.ph) * 8 - pz * 3;
      for (var k = 0; k < sc.fish.length; k++) {
        var f = sc.fish[k];
        this.fish(ctx, cx + f.ox + Math.sin(t * 2 + f.wig) * 3, cy + f.oy + Math.cos(t * 1.7 + f.wig) * 2, f.size, dir, t + f.wig, 0.55);
      }
    }
  },

  // ---------- 大きな生き物 ----------
  // 今の出し物 {kind, dir, y, scale, k（0〜1：横切る進み具合）}。なければ null
  current: function (t) {
    var cyc = Math.floor(t / this.cycle), ph = t - cyc * this.cycle;
    if (ph > this.duration) return null;
    var r = this.rand(cyc * 7 + 5), roll = r();
    var kind = roll < 0.32 ? "whale" : roll < 0.6 ? "squid" : roll < 0.8 ? "fight" : "feed";
    return { kind: kind, dir: r() < 0.5 ? 1 : -1, y: 0.3 + r() * 0.4, scale: 0.8 + r() * 0.35, k: ph / this.duration, t: ph };
  },

  drawBig: function (ctx, t, px, pz) {
    var ev = this.current(t);
    if (!ev) return;
    var W = Game.backdrop.W, H = Game.backdrop.H;
    var L = 170 * ev.scale; // 体の長さ（点）
    var span = W + L * 2.4;
    var x = ev.dir > 0 ? -L * 1.2 + span * ev.k : W + L * 1.2 - span * ev.k;
    x -= px * 1.5;
    var y = H * ev.y + Math.sin(t * 0.35) * 6 - pz * 1.5;
    ctx.save();
    ctx.shadowColor = "rgba(0,8,16,0.6)"; // 影
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 8;
    if (ev.kind === "whale") this.whale(ctx, x, y, L, ev.dir, t, 0, 0);
    else if (ev.kind === "squid") this.squid(ctx, x, y, L * 0.8, ev.dir, t, 0);
    else if (ev.kind === "fight") this.fight(ctx, x, y, L, ev.dir, t);
    else this.feed(ctx, x, y, L, ev.dir, t, ev);
    ctx.restore();
  },

  // 体の長さ L・向き dir の座標にする
  local: function (ctx, x, y, L, dir, rot) {
    ctx.translate(x, y);
    ctx.scale(dir * L, L);
    if (rot) ctx.rotate(rot);
  },

  // 上が明るく下が暗い塗り（光が上から当たる）
  shade: function (ctx, top, bottom, y0, y1) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    return g;
  },

  // クジラ（mouth = 口の開き 0〜0.55 ラジアン、rot = 体の傾き）
  whale: function (ctx, x, y, L, dir, t, mouth, rot) {
    ctx.save();
    this.local(ctx, x, y, L, dir, rot);
    var body = this.shade(ctx, "rgba(58,98,128,0.8)", "rgba(10,24,38,0.85)", -0.17, 0.16);
    var w = Math.sin(t * 1.8) * 0.045; // 尾びれの上下
    // 尾びれ
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-0.44, 0.005);
    ctx.quadraticCurveTo(-0.52, -0.02 + w, -0.63, -0.1 + w * 1.6);
    ctx.quadraticCurveTo(-0.57, 0.0 + w, -0.63, 0.1 + w * 1.6);
    ctx.quadraticCurveTo(-0.52, 0.03 + w, -0.44, 0.005);
    ctx.fill();
    // 口の中（開いている時だけ見える）
    var hx = -0.02, hy = 0.06;
    if (mouth > 0.02) {
      // 下あごの先（あごの形の (0.5, -0.06) を mouth だけ回した所）
      var jx = hx + Math.cos(mouth) * 0.5 + Math.sin(mouth) * 0.06, jy = hy + Math.sin(mouth) * 0.5 - Math.cos(mouth) * 0.06;
      ctx.fillStyle = "rgba(70,18,26,0.9)";
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(0.48, 0.0);
      ctx.lineTo(jx, jy);
      ctx.closePath();
      ctx.fill();
    }
    // 頭と背中
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0.48, 0.0);
    ctx.bezierCurveTo(0.4, -0.16, 0.05, -0.17, -0.2, -0.1);
    ctx.bezierCurveTo(-0.32, -0.07, -0.4, -0.03, -0.46, -0.01);
    ctx.lineTo(-0.46, 0.02);
    ctx.bezierCurveTo(-0.38, 0.05, -0.2, 0.12, hx, 0.12);
    ctx.lineTo(hx, hy);
    ctx.closePath();
    ctx.fill();
    // 下あご（蝶番を中心に開く）
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(mouth);
    ctx.fillStyle = this.shade(ctx, "rgba(40,70,92,0.85)", "rgba(12,26,38,0.85)", 0, 0.08);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 0.06);
    ctx.bezierCurveTo(0.22, 0.09, 0.44, 0.04, 0.49, -0.04);
    ctx.lineTo(0.5, -0.06);
    ctx.closePath();
    ctx.fill();
    // あごのしま
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(120,160,180,0.25)";
    ctx.lineWidth = 0.006;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0.04 + i * 0.02, 0.03 + i * 0.006);
      ctx.lineTo(0.36 - i * 0.03, 0.0 + i * 0.012);
      ctx.stroke();
    }
    ctx.restore();
    // 胸びれ・目
    ctx.fillStyle = "rgba(20,42,58,0.85)";
    ctx.beginPath();
    ctx.moveTo(0.08, 0.1);
    ctx.quadraticCurveTo(0.0, 0.2 + w, -0.06, 0.24 + w);
    ctx.quadraticCurveTo(0.0, 0.14, 0.02, 0.11);
    ctx.fill();
    ctx.fillStyle = "rgba(200,230,240,0.7)";
    ctx.beginPath();
    ctx.arc(0.3, -0.01, 0.012, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // ダイオウイカ（胴が進む向き、腕は後ろにたなびく）。wrap = 1 なら腕を前へ回して絡みつく形
  squid: function (ctx, x, y, L, dir, t, wrap) {
    ctx.save();
    var pulse = Math.sin(t * 2.4); // 胴が縮んで水を吐くリズム
    this.local(ctx, x, y, L, dir, 0);
    // 腕8本＋長い触腕2本
    ctx.strokeStyle = "rgba(92,38,44,0.72)";
    ctx.lineCap = "round";
    for (var i = 0; i < 10; i++) {
      var long = i >= 8;
      var len = long ? 0.75 : 0.42;
      var spread = (i % 8) / 7 - 0.5;
      var wave = Math.sin(t * 2 + i * 0.9) * 0.05;
      var ex = -len * (1 - wrap * 0.3), ey = spread * 0.22 + wave + (long ? (i === 8 ? -0.08 : 0.08) : 0);
      ctx.lineWidth = long ? 0.012 : 0.022;
      ctx.beginPath();
      ctx.moveTo(-0.02, spread * 0.06);
      ctx.quadraticCurveTo(ex * 0.5, spread * 0.1 - wave * 2 - wrap * 0.2, ex, ey + wrap * 0.25 * (i % 2 ? 1 : -1));
      ctx.stroke();
    }
    // 胴（外套膜）とひれ
    var sq = 1 + pulse * 0.05;
    ctx.fillStyle = this.shade(ctx, "rgba(128,58,56,0.8)", "rgba(34,12,20,0.88)", -0.1, 0.1);
    ctx.beginPath();
    ctx.moveTo(0.0, -0.075 * sq);
    ctx.bezierCurveTo(0.2, -0.11 * sq, 0.38, -0.07 * sq, 0.5, 0);
    ctx.bezierCurveTo(0.38, 0.07 * sq, 0.2, 0.11 * sq, 0.0, 0.075 * sq);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.36, -0.03);
    ctx.lineTo(0.52, -0.09 - pulse * 0.02);
    ctx.lineTo(0.5, 0);
    ctx.lineTo(0.52, 0.09 + pulse * 0.02);
    ctx.lineTo(0.36, 0.03);
    ctx.fill();
    // 大きな目
    ctx.fillStyle = "rgba(210,200,160,0.6)";
    ctx.beginPath();
    ctx.arc(0.03, -0.01, 0.022, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // クジラとダイオウイカの戦い：イカが頭に絡みつき、クジラは身をよじりながら進む
  fight: function (ctx, x, y, L, dir, t) {
    var rot = Math.sin(t * 1.3) * 0.12;
    var shake = Math.sin(t * 7) * 2;
    // クジラの背中の後ろから、イカの胴が上に突き出す
    this.squid(ctx, x + dir * L * 0.22 + shake, y - L * 0.13, L * 0.55, -dir, t * 1.6, 1);
    this.whale(ctx, x, y + shake * 0.5, L, dir, t * 1.4, 0.12 + Math.abs(Math.sin(t * 1.1)) * 0.25, rot);
    // 頭に巻きついた腕（クジラの上に重ねる）
    ctx.save();
    ctx.shadowColor = "transparent";
    this.local(ctx, x, y + shake * 0.5, L, dir, rot);
    ctx.strokeStyle = "rgba(110,44,50,0.8)";
    ctx.lineCap = "round";
    for (var i = 0; i < 4; i++) {
      var cx = 0.16 + i * 0.07, wob = Math.sin(t * 3 + i) * 0.02;
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.ellipse(cx, 0.0, 0.035 + wob, 0.15, 0.25 - i * 0.08, -Math.PI * 0.5, Math.PI * 0.6);
      ctx.stroke();
    }
    ctx.restore();
    // もみ合いで泡が出る
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(200,235,255,0.5)";
    ctx.lineWidth = 1;
    for (var b = 0; b < 6; b++) {
      var ph = (t * 0.8 + b / 6) % 1;
      ctx.beginPath();
      ctx.arc(x + dir * L * (0.1 + (b % 3) * 0.1) + Math.sin(b * 5 + t) * 6, y - L * 0.15 - ph * 60, 1.5 + (b % 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  // クジラが小魚の群れを食べる：群れは画面の真ん中あたりで渦を巻き、近づくと口を大きく開け、口に入った魚は消える
  feed: function (ctx, x, y, L, dir, t, ev) {
    var W = Game.backdrop.W;
    var headX = x + dir * L * 0.48;
    var sx = W * 0.5, sy = y + L * 0.02;
    var r = this.rand(77);
    var near = Math.max(0, 1 - Math.abs(headX - sx) / (L * 0.9));
    var passed = dir > 0 ? headX - sx : sx - headX; // 口が群れの真ん中をどれだけ過ぎたか
    var mouth = passed > L * 0.25 ? Math.max(0, 0.5 - (passed - L * 0.25) / (L * 0.3)) : near * 0.5;
    ctx.save();
    ctx.shadowColor = "transparent";
    for (var i = 0; i < 26; i++) {
      var a = r() * 6.28, rad = 8 + r() * 26, sp = 0.6 + r() * 0.6;
      var fx = sx + Math.cos(a + ev.t * sp) * rad, fy = sy + Math.sin(a + ev.t * sp) * rad * 0.5;
      var inMouth = Math.abs(fy - sy) < L * 0.11; // 口の高さにいる魚
      var eaten = inMouth && (dir > 0 ? headX > fx + L * 0.05 : headX < fx - L * 0.05);
      if (eaten) continue;
      var flee = near * 18 * (fy < sy ? -1 : 1); // 口の外の魚は上下に逃げる
      this.fish(ctx, fx, fy + (inMouth ? 0 : flee), 3.2, Math.sin(a + ev.t * sp) > 0 ? -1 : 1, t + i, 0.65);
    }
    ctx.restore();
    this.whale(ctx, x, y, L, dir, t, mouth, 0);
  },
};
