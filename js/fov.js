// 「見えている範囲」の管理（FOV = Field of View）。
// ルール：
//   ・自分の周り1マスは、どこにいても必ず見える
//   ・部屋の中（入口を含む）にいる → さらに、その部屋全体と周りの壁が見える
//   ・一度見た場所は「探索済み」として地図に残る（今見えていない所は暗く表示）
//   ・拠点では revealAll = true にして全体を見せる
// 敵が主人公に気づくかどうかも、同じルール（canSee）で判定する。
Game.fov = {
  visible: [], // visible[y][x]  今見えているか
  explored: [], // explored[y][x] 一度でも見たか
  revealAll: false,

  // 新しい階に入った時に呼ぶ
  reset: function () {
    this.visible = this.makeGrid();
    this.explored = this.makeGrid();
  },

  makeGrid: function () {
    var g = [];
    for (var y = 0; y < Game.map.height; y++) {
      var row = [];
      for (var x = 0; x < Game.map.width; x++) row.push(false);
      g.push(row);
    }
    return g;
  },

  // (x, y) に立った時に見える四角い範囲のリスト（周囲1マス ＋ いる部屋）
  // ※部屋の入口に立った時、部屋の外側の通路も見えるように周囲1マスは常に含める
  viewRects: function (x, y) {
    var rects = [{ x1: x - 1, y1: y - 1, x2: x + 1, y2: y + 1 }];
    var r = Game.map.roomAt(x, y);
    if (r) rects.push({ x1: r.x1 - 1, y1: r.y1 - 1, x2: r.x2 + 1, y2: r.y2 + 1 });
    return rects;
  },

  // (fx, fy) に立っている者から (tx, ty) が見えるか
  canSee: function (fx, fy, tx, ty) {
    var rects = this.viewRects(fx, fy);
    for (var i = 0; i < rects.length; i++) {
      var v = rects[i];
      if (tx >= v.x1 && tx <= v.x2 && ty >= v.y1 && ty <= v.y2) return true;
    }
    return false;
  },

  // 主人公の位置から見える範囲を計算し直す（画面を描く前に毎回呼ぶ）
  update: function () {
    this.visible = this.makeGrid();
    var rects = this.revealAll
      ? [{ x1: 0, y1: 0, x2: Game.map.width - 1, y2: Game.map.height - 1 }]
      : this.viewRects(Game.player.x, Game.player.y);
    for (var i = 0; i < rects.length; i++) {
      var v = rects[i];
      for (var y = Math.max(0, v.y1); y <= Math.min(Game.map.height - 1, v.y2); y++) {
        for (var x = Math.max(0, v.x1); x <= Math.min(Game.map.width - 1, v.x2); x++) {
          this.visible[y][x] = true;
          this.explored[y][x] = true;
        }
      }
    }
  },

  isVisible: function (x, y) {
    return !!(this.visible[y] && this.visible[y][x]);
  },

  isExplored: function (x, y) {
    return !!(this.explored[y] && this.explored[y][x]);
  },
};
