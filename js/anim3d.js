// 3D表示の「紙芝居」の動き（見た目だけ。ゲームのルールには影響しない）。
// キャラごとに、表示している位置・向きを覚えておき、描くたびに次のような見た目を計算する：
//   ・移動：マスからマスへすべるように動く（主人公は歩きの絵を交互に、モンスターはぴょんと跳ねる）
//   ・向き：左右に動くとその向きを向く。向きを変える時は紙をくるっと裏返すように細くなってから反対を向く
//   ・攻撃：相手の方へ一瞬踏み込む（主人公は攻撃の絵）
//   ・やられ：のけぞる（主人公はやられの絵、モンスターは赤っぽくなる）
//   ・待機：主人公はネオンが明滅、モンスターは息をするように伸び縮みする
// 攻撃・やられは fx.js の attackOf / tiltOf（攻撃した時に記録される）から判断する。
Game.anim3d = {
  track: new Map(), // キャラ → 表示の状態
  slideMs: 110, // 1マス動くのにかける時間
  flipMs: 160, // 向きを変える（裏返す）のにかける時間

  reset: function () {
    this.track = new Map();
  },

  turnTo: function (st, face, now) {
    if (st.face === face) return;
    st.face = face;
    st.flipT0 = now;
  },

  // obj（主人公・仲間・敵など）の今の見た目。gx, gz = 本当の位置（マスの中央）
  // 返す値：{ x, z：表示位置, flip：横の倍率（マイナスで左向き）, sx, sy：伸び縮み, lift：浮き, roll：傾き, tint：色, frame：主人公の絵の名前 }
  pose: function (obj, gx, gz, now, isHero) {
    var st = this.track.get(obj);
    if (!st) {
      st = { px: gx, pz: gz, fx: gx, fz: gz, tx: gx, tz: gz, t0: -1e9, face: 1, flipT0: -1e9, steps: 0, seed: Math.random() * 6.28 };
      this.track.set(obj, st);
    }
    st.used = now;
    if (st.tx !== gx || st.tz !== gz) {
      if (Math.abs(st.tx - gx) + Math.abs(st.tz - gz) > 3) {
        // ワープ・階移動などは一瞬で
        st.fx = gx;
        st.fz = gz;
        st.t0 = -1e9;
      } else {
        st.fx = st.px;
        st.fz = st.pz;
        st.t0 = now;
        st.steps++;
      }
      if (gx !== st.tx) this.turnTo(st, gx > st.tx ? 1 : -1, now);
      st.tx = gx;
      st.tz = gz;
    }
    var k = Math.min(1, (now - st.t0) / this.slideMs);
    st.px = st.fx + (gx - st.fx) * k;
    st.pz = st.fz + (gz - st.fz) * k;
    var moving = k < 1;

    var atk = Game.fx.attackOf(obj), hurt = Game.fx.tiltOf(obj);
    if (atk && atk.dx) this.turnTo(st, atk.dx, now);

    var o = { x: st.px, z: st.pz, sx: 1, sy: 1, lift: 0, roll: 0, tint: null, frame: null };
    var p = (now - st.flipT0) / this.flipMs;
    o.flip = p < 1 ? Math.max(0.08, Math.abs(Math.cos(p * Math.PI))) * (p < 0.5 ? -st.face : st.face) : st.face;

    if (atk) {
      var q = Math.max(0, Math.min(1, 1 - (atk.until - now) / Game.fx.hitMs));
      var lunge = Math.sin(q * Math.PI) * 0.3;
      o.x += atk.dx * lunge;
      o.z += atk.dy * lunge;
      if (!isHero) o.roll = -atk.dx * 0.25 * Math.sin(q * Math.PI);
    }
    if (hurt) {
      o.x += hurt.dx * 0.12;
      o.z += hurt.dy * 0.12;
      o.roll = -(hurt.dx !== 0 ? hurt.dx : hurt.dy * 0.6) * 0.3;
      if (!isHero) o.tint = [1, 0.5, 0.5];
    }

    if (isHero) {
      if (hurt) o.frame = "hero_hurt";
      else if (atk) o.frame = "hero_attack";
      else if (moving) o.frame = st.steps % 2 ? "hero_walk1" : "hero_walk2";
      else o.frame = Math.floor(now / 600) % 2 ? "hero_idle2" : "hero_idle1";
      if (moving) o.lift = Math.sin(k * Math.PI) * 0.05;
    } else {
      var b = Math.sin(now / 350 + st.seed);
      o.sy = 1 + 0.045 * b;
      o.sx = 1 - 0.03 * b;
      if (moving) o.lift = Math.sin(k * Math.PI) * 0.18;
    }
    return o;
  },

  // しばらく描かれていないキャラの記録を捨てる（倒れた敵など）
  sweep: function (now) {
    var self = this;
    this.track.forEach(function (st, obj) {
      if (now - st.used > 2000) self.track.delete(obj);
    });
  },
};
