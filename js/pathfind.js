// 移動の共通処理（敵・仲間の両方が使う）。
Game.path = {
  // (x, y) に誰か（主人公・敵・仲間）がいるか
  isOccupied: function (x, y) {
    if (x === Game.player.x && y === Game.player.y) return true;
    if (Game.enemies.at(x, y)) return true;
    if (Game.allies.at(x, y)) return true;
    return false;
  },

  // (x, y) に入れるか：壁でなく、誰もいない
  isFree: function (x, y) {
    return Game.map.isWalkable(x, y) && !this.isOccupied(x, y);
  },

  // 2点間の距離（斜めも1歩と数える）
  dist: function (ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  },

  // a と b が隣り合っていて、角の壁に邪魔されずに攻撃できるか
  // （壁をすり抜ける敵がからむ時は、隣り合っていれば壁があっても届く）
  canReach: function (a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    if (this.dist(a.x, a.y, b.x, b.y) !== 1) return false;
    if (a.phasing || b.phasing) return true;
    return Game.map.canStep(a.x, a.y, dx, dy);
  },

  // unit が目標 (tx, ty) へ向かう最短経路の最初の1歩を、幅優先探索(BFS)で求める。
  // 目標に誰かいる場合は「その隣まで」の経路になる。8方向・角すり抜け禁止。
  // 見つからない or 既に目標にいるなら null
  stepToward: function (unit, tx, ty) {
    if (unit.x === tx && unit.y === ty) return null;
    var dirs = Game.DIRS8;
    var map = Game.map;
    var visited = {};
    var queue = [];
    visited[unit.x + "," + unit.y] = true;

    // 1歩目：誰かがいるマスには入れない
    for (var d = 0; d < dirs.length; d++) {
      if (!map.canStep(unit.x, unit.y, dirs[d][0], dirs[d][1])) continue;
      var nx = unit.x + dirs[d][0], ny = unit.y + dirs[d][1];
      if (!this.isFree(nx, ny)) continue;
      if (nx === tx && ny === ty) return dirs[d]; // 目標がすぐ隣
      visited[nx + "," + ny] = true;
      queue.push({ x: nx, y: ny, first: dirs[d] });
    }

    // 2歩目以降：地形だけ見て目標までつながるか調べる
    while (queue.length > 0) {
      var cur = queue.shift();
      for (var k = 0; k < dirs.length; k++) {
        if (!map.canStep(cur.x, cur.y, dirs[k][0], dirs[k][1])) continue;
        var x = cur.x + dirs[k][0], y = cur.y + dirs[k][1];
        if (x === tx && y === ty) return cur.first; // 目標に届いた
        var key = x + "," + y;
        if (visited[key]) continue;
        visited[key] = true;
        queue.push({ x: x, y: y, first: cur.first });
      }
    }
    return null;
  },

  // 進める方向からランダムに1つ選ぶ。どこにも行けなければ null
  randomStep: function (unit) {
    var ok = [];
    for (var d = 0; d < Game.DIRS8.length; d++) {
      var dir = Game.DIRS8[d];
      if (Game.map.canStep(unit.x, unit.y, dir[0], dir[1]) && this.isFree(unit.x + dir[0], unit.y + dir[1])) ok.push(dir);
    }
    if (ok.length === 0) return null;
    return Game.pick(ok);
  },

  // (sx, sy) から近い順に、空いている床を最大 count 個探す（仲間を階段の先に並べる時などに使う）
  freeTilesNear: function (sx, sy, count) {
    var result = [];
    var visited = {};
    var queue = [{ x: sx, y: sy }];
    visited[sx + "," + sy] = true;
    while (queue.length > 0 && result.length < count) {
      var cur = queue.shift();
      if (this.isFree(cur.x, cur.y)) result.push(cur);
      for (var d = 0; d < Game.DIRS8.length; d++) {
        var dir = Game.DIRS8[d];
        if (!Game.map.canStep(cur.x, cur.y, dir[0], dir[1])) continue;
        var nx = cur.x + dir[0], ny = cur.y + dir[1];
        if (visited[nx + "," + ny]) continue;
        visited[nx + "," + ny] = true;
        queue.push({ x: nx, y: ny });
      }
    }
    return result;
  },
};
