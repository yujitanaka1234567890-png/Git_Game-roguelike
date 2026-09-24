// キーボード入力を「方向」に変換してゲームに伝える。
//   矢印キー        : 上下左右に1歩（階段の上では、その階段の方向キー2回で使う）
//   Shift + 矢印2つ : 斜めに1歩（例：Shift を押したまま ↑ と → を同時に押す）
//   Shift + 矢印1つ : その方向へダッシュ。Shift を押している間だけ続き、離すと止まる
//                     ※押してから少し（config.diagonalWait）待ち、2つ目の矢印が来なければダッシュ
//   スペース        : 足踏み
Game.input = {
  arrows: {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  },
  held: {}, // いま押されている矢印キー
  shiftHeld: false, // いま Shift が押されているか（ダッシュ継続の判定に使う）
  dashTimer: null, // ダッシュ開始待ちのタイマー

  // onMove(dx, dy, isRepeat)：移動・足踏み / onDash(dx, dy)：ダッシュ / onKey(key)：それ以外のキー
  init: function (onMove, onDash, onKey) {
    var self = this;

    window.addEventListener("keydown", function (e) {
      Game.sound.unlock(); // ブラウザは最初の操作の後でないと音を出せない
      self.shiftHeld = e.shiftKey;
      var dir = self.arrows[e.key];
      if (dir) {
        e.preventDefault(); // 矢印キーでページがスクロールしないようにする
        self.held[e.key] = true;
        if (e.shiftKey) {
          var diag = self.findDiagonal(e.key);
          if (diag) {
            self.cancelDash(); // 2つ目の矢印が来た → ダッシュではなく斜め移動
            onMove(diag[0], diag[1], e.repeat);
          } else if (!e.repeat) {
            // 押しっぱなしの連打（repeat）ではダッシュを再開しない
            self.cancelDash();
            self.dashTimer = setTimeout(function () {
              self.dashTimer = null;
              onDash(dir[0], dir[1]);
            }, Game.config.diagonalWait);
          }
        } else {
          onMove(dir[0], dir[1], e.repeat);
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        onMove(0, 0, e.repeat);
        return;
      }
      if (onKey) onKey(e.key);
    });

    window.addEventListener("keyup", function (e) {
      delete self.held[e.key];
      if (e.key === "Shift") self.shiftHeld = false;
    });

    // 別ウィンドウに切り替えた時など、キーを離したことが伝わらない場合の保険
    window.addEventListener("blur", function () {
      self.held = {};
      self.shiftHeld = false;
    });
  },

  cancelDash: function () {
    if (this.dashTimer) clearTimeout(this.dashTimer);
    this.dashTimer = null;
  },

  // 今押した矢印と直交する矢印が押されていれば、合成した斜め方向を返す
  findDiagonal: function (key) {
    var d = this.arrows[key];
    for (var other in this.held) {
      var o = this.arrows[other];
      if (other !== key && o && d[0] * o[0] + d[1] * o[1] === 0) {
        return [d[0] + o[0], d[1] + o[1]];
      }
    }
    return null;
  },
};
