// 2D描画のうち「動くもの」（主人公・仲間・敵・牧場の子・技の光・数字など）。見た目だけでルールには触れない。
// renderer.draw() が地形を裏の画用紙に描いたあと、drawFrame() でその上にキャラを描く。
// キャラの位置・向き・歩きの絵は 3D と同じ紙芝居の動き（anim3d.js）を使うので、
// マスからマスへすべるように動き、左右で向きを変え、攻撃では踏み込む。動いている間は1秒に約60回描き直す（kick）。
Object.assign(Game.renderer, {
  animUntil: 0, // この時刻（ミリ秒）までは描き直し続ける（何か起きた直後）
  animLoop: null,

  // キャラの今の見た目。tx, ty ＝ 表示している位置（マスの左上、小数あり）
  poseOf: function (obj, x, y, now, isHero) {
    var p = Game.anim3d.pose(obj, x + 0.5, y + 0.5, now, isHero);
    p.tx = p.x - 0.5;
    p.ty = p.z - 0.5;
    return p;
  },

  // 1コマ分を描く（地形は buildTerrain で描いた物を貼るだけ）
  drawFrame: function () {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    var c = Game.config.colors;
    var fov = Game.fov;
    var now = Date.now();
    if (this.terrain) ctx.drawImage(this.terrain, 0, 0);

    // ---- 拠点の牧場を歩く仲間（連れて行く子は青い下地） ----
    if (Game.state === "base") {
      var ms = Game.baseScene.monsters;
      for (var b = 0; b < ms.length; b++) {
        var bp = this.poseOf(ms[b], ms[b].x, ms[b].y, now, false);
        if (Game.base.selected[ms[b].entry.id]) this.drawAllyBg(bp.tx, bp.ty);
        this.drawUnit(Game.MONSTERS[ms[b].entry.type], bp);
      }
    }

    // ---- 仲間（青い下地で敵と見分ける。いつでも表示） ----
    var allies = Game.allies.list;
    for (var a = 0; a < allies.length; a++) {
      var al = allies[a];
      if (al.x < 0) continue;
      var ap = this.poseOf(al, al.x, al.y, now, false);
      this.drawAllyBg(ap.tx, ap.ty);
      this.drawUnit(Game.MONSTERS[al.type], ap);
      this.drawDangerPulse(al, ap.tx, ap.ty);
      if (al.hp < al.maxHp) this.drawHpBar(al, ap.tx, ap.ty);
      if (al.charge) this.drawChargeMark(al, "#66ccff", ap.tx, ap.ty);
    }

    // ---- 敵（見えている敵だけ。壁の中にいる敵は半透明） ----
    var list = Game.enemies.list;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!fov.isVisible(e.x, e.y)) continue;
      var ep = this.poseOf(e, e.x, e.y, now, false);
      this.drawUnit(Game.MONSTERS[e.type], ep, Game.map.tileAt(e.x, e.y) === "#" ? 0.55 : 1);
      if (e.hp < e.maxHp) this.drawHpBar(e, ep.tx, ep.ty);
      if (e.charge) this.drawChargeMark(e, null, ep.tx, ep.ty);
    }

    // ---- 主人公 ----
    var p = Game.player;
    this.drawUnit(null, this.poseOf(p, p.x, p.y, now, true));

    // ---- 攻撃マーク（赤いとげとげ）とダメージの数字 ----
    Game.fx.drawHitMarks(ctx, ts);
    Game.fx.drawNumbers(ctx, ts);

    // ---- 投げて飛んでいるアイテム ----
    var pr = Game.throwing.projectile;
    if (pr) this.drawThing(pr.sprite, null, pr.color, pr.x, pr.y, pr.symbol, pr.color);

    // ---- 必殺技・ブレスの光 ----
    Game.fx.draw(ctx, ts);

    // ---- 精神力が減ると、画面が紫の闇ににじむ（ダンジョンに取り込まれかけている表現） ----
    if (Game.state !== "base" && p.maxMind) {
      var mr = p.mind / p.maxMind;
      if (mr < 0.3) {
        ctx.fillStyle = "rgba(70, 0, 110, " + ((0.3 - mr) * 1.2).toFixed(2) + ")";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
    if (Game.state === "gameover") this.drawOverlay("GAME OVER", "Enter で拠点へ戻る");
  },

  // キャラ1体を、紙芝居の見た目（pose）で描く。t = モンスターの種類データ（主人公は null）、alpha = 透明度
  // 足元を中心に、向き（左右反転・裏返しの細り）・伸び縮み・跳ね・傾きをつける。ボスは1.6倍で足元に赤い影
  drawUnit: function (t, pose, alpha) {
    var ctx = this.ctx;
    var ts = Game.config.tileSize;
    var hero = !t;
    var color = hero ? Game.config.colors.player : t.color;
    var sprite = hero
      ? (Game.SPRITES[pose.frame] ? pose.frame : "player")
      : (pose.suffix && Game.SPRITES[t.sprite + pose.suffix] ? t.sprite + pose.suffix : t.sprite);
    var img = Game.pixel.enabled ? Game.pixel.build(sprite, hero ? null : t.overlay, color) : null;
    var size = !hero && t.boss && img ? ts * 1.6 : ts;
    var footX = (pose.tx + 0.5) * ts, footY = (pose.ty + 1) * ts;
    if (!hero && t.boss && img) {
      ctx.fillStyle = "rgba(255, 40, 40, 0.28)";
      ctx.beginPath();
      ctx.ellipse(footX, footY - 2, ts * 0.8, ts * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(footX, footY - (pose.lift || 0) * ts);
    if (pose.roll) ctx.rotate(pose.roll);
    if (img) {
      var flip = pose.flip === undefined ? 1 : pose.flip;
      ctx.scale(flip * (pose.sx || 1), pose.sy || 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -size / 2, -size, size, size);
    } else {
      ctx.fillStyle = color;
      ctx.font = "bold " + Math.floor(ts * 0.8) + "px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(hero ? Game.player.symbol : t.symbol, 0, -ts / 2 + 1);
    }
    ctx.restore();
    if (!hero) this.drawStagePips(pose.tx, pose.ty, t.stage);
  },

  // ---------- 動いている間の描き直し ----------
  // 2D はふだん何か起きた時だけ描くので、動いている物がある間だけ1秒に約60回描き直す（3D は render3d.js が描き直し続ける）
  needsAnim: function () {
    if (Date.now() < this.animUntil) return true; // 移動・攻撃の直後（すべる・踏み込む・のけぞる）
    if (Game.state === "gameover") return false;
    if (Game.fx.hasActivePops()) return true;
    if (Game.state === "base") return false;
    var self = this;
    return Game.allies.list.some(function (a) { return self.inDanger(a); });
  },

  kick: function () {
    if (this.animLoop || !this.ctx || Game.view3d.active() || !this.needsAnim()) return;
    var self = this;
    var tick = function () {
      if (Game.view3d.active() || !self.needsAnim()) {
        self.animLoop = null;
        if (!Game.view3d.active()) self.drawFrame(); // 最後の1枚（止まった姿・数字を消す）
        return;
      }
      self.animLoop = requestAnimationFrame(tick);
      self.drawFrame();
    };
    this.animLoop = requestAnimationFrame(tick);
  },

  // 死にかけ（HPが dangerRatio 以下）の仲間か
  dangerRatio: 0.25,
  inDanger: function (u) {
    return u.x >= 0 && u.hp > 0 && u.hp / u.maxHp <= this.dangerRatio;
  },

  // 点滅の強さ 0〜1（何もしていない間も薄い紅色にゆっくり点滅する）
  dangerPulse: function () {
    return 0.5 + 0.5 * Math.sin(Date.now() / 220);
  },

  drawDangerPulse: function (u, x, y) {
    if (!this.inDanger(u)) return;
    var ts = Game.config.tileSize;
    this.ctx.fillStyle = "rgba(255, 70, 110, " + (0.12 + 0.33 * this.dangerPulse()).toFixed(2) + ")";
    this.ctx.fillRect(x * ts, y * ts, ts, ts);
  },
});
