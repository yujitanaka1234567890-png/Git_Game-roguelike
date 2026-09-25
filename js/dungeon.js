// ランダムダンジョン生成。
// やり方（区画分割による古典的な部屋＋通路の生成）：
//   1. マップを cols × rows のマス目（セル）に分ける
//   2. 各セルに部屋を1つ置く（一部のセルは部屋ではなく、通路の分岐点1マスだけ）
//   3. 隣り合うセル同士を通路でつなぐ。まず全セルが必ずつながる「木」を作り、
//      さらに数本おまけの通路を足して、ぐるっと回れるルートを作る
//   4. 部屋の中に 主人公の初期位置・階段・敵・アイテム を置く
Game.dungeon = {
  generate: function (floor) {
    var cfg = Game.config.dungeon;
    var result = null;
    if (floor >= Game.currentDungeon().floors && Game.currentDungeon().boss) result = this.bossFloor(cfg);
    for (var attempt = 0; attempt < 50 && !result; attempt++) result = this.tryGenerate(cfg, floor);
    if (result) {
      if (Game.currentDungeon().puddles) this.addPuddles(result);
      return result;
    }
    throw new Error("ダンジョン生成に失敗しました");
  },

  // 1回分の生成。部屋が少なすぎたら null を返して作り直す
  tryGenerate: function (cfg, floor) {
    var W = cfg.width, H = cfg.height;
    var tiles = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) row.push("#");
      tiles.push(row);
    }

    // 2. セルごとに部屋（または分岐点）を置く。
    //    部屋はセルの左・上を1マス、右・下を2マス空けて置くので、隣のセルの部屋とは必ず壁3マス以上離れる。
    //    （間が3マスあれば、通路の曲がり角を「どちらの部屋の壁にも接しない列」に置ける）
    var cellW = Math.floor(W / cfg.cols);
    var cellH = Math.floor(H / cfg.rows);
    var cells = [];
    for (var r = 0; r < cfg.rows; r++) {
      for (var c = 0; c < cfg.cols; c++) {
        var minX = c * cellW + 1, maxX = c * cellW + cellW - 3;
        var minY = r * cellH + 1, maxY = r * cellH + cellH - 3;
        var cell = { c: c, r: r, isRoom: Math.random() < cfg.roomChance };
        if (cell.isRoom) {
          var w = Game.randInt(cfg.minRoomW, maxX - minX + 1);
          var h = Game.randInt(cfg.minRoomH, maxY - minY + 1);
          cell.x1 = Game.randInt(minX, maxX - w + 1);
          cell.y1 = Game.randInt(minY, maxY - h + 1);
          cell.x2 = cell.x1 + w - 1;
          cell.y2 = cell.y1 + h - 1;
        } else {
          cell.x1 = cell.x2 = Game.randInt(minX, maxX);
          cell.y1 = cell.y2 = Game.randInt(minY, maxY);
        }
        this.fillRect(tiles, cell.x1, cell.y1, cell.x2, cell.y2);
        cells.push(cell);
      }
    }

    var rooms = cells.filter(function (cl) { return cl.isRoom; });
    if (rooms.length < 3) return null;

    // 3. 通路でつなぐ
    var edges = this.spanningTree(cfg.cols, cfg.rows);
    this.addExtraEdges(edges, cfg.cols, cfg.rows, cfg.extraConnections);
    this.removeDeadEnds(edges, cells, cfg.cols, cfg.rows);
    for (var i = 0; i < edges.length; i++) {
      this.connect(tiles, cells[edges[i][0]], cells[edges[i][1]]);
    }

    // 4. 主人公・階段・敵の位置を決める（主人公と階段は別の部屋）
    var startRoom = Game.pick(rooms);
    var otherRooms = rooms.filter(function (rm) { return rm !== startRoom; });
    var start = this.randomTileIn(startRoom);
    var stairs = this.randomTileIn(Game.pick(otherRooms));
    var dg = Game.currentDungeon();
    tiles[stairs.y][stairs.x] = floor >= dg.floors ? "O" : ">"; // 最深部は脱出口

    var enemyCount = Math.min(cfg.maxEnemies, dg.enemyBase + floor - 1);
    var used = {};
    var enemySpawns = [];
    for (var n = 0; n < enemyCount * 5 && enemySpawns.length < enemyCount; n++) {
      var t = this.randomTileIn(Game.pick(otherRooms));
      if (used[t.x + "," + t.y]) continue;
      used[t.x + "," + t.y] = true;
      enemySpawns.push(t);
    }

    // アイテム：どの部屋にも置く。主人公の初期位置・階段・他のアイテムとは重ねない
    var itemCount = Game.randInt(cfg.minItems, cfg.maxItems);
    var itemUsed = {};
    itemUsed[start.x + "," + start.y] = true;
    itemUsed[stairs.x + "," + stairs.y] = true;
    var itemSpawns = [];
    for (var m = 0; m < itemCount * 5 && itemSpawns.length < itemCount; m++) {
      var it = this.randomTileIn(Game.pick(rooms));
      if (itemUsed[it.x + "," + it.y]) continue;
      itemUsed[it.x + "," + it.y] = true;
      itemSpawns.push(it);
    }

    return {
      width: W, height: H, tiles: tiles, rooms: rooms,
      startX: start.x, startY: start.y,
      stairsX: stairs.x, stairsY: stairs.y,
      enemySpawns: enemySpawns,
      itemSpawns: itemSpawns,
    };
  },

  // 最下層：広く開けたボス部屋。左に主人公、右奥にボス。脱出口はなく、ボスを倒すと帰還のゲート（脱出口）が現れる
  // （enemies.bossDown。現れる場所はボスが倒れたマス。そこに置けない時は右奥の stairsX, stairsY）。
  // 身を隠せるよう柱を4本立てる。通路はない。
  bossFloor: function (cfg) {
    var W = cfg.width, H = cfg.height;
    var tiles = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) row.push("#");
      tiles.push(row);
    }
    var room = { x1: 3, y1: 3, x2: W - 4, y2: H - 4, isRoom: true };
    this.fillRect(tiles, room.x1, room.y1, room.x2, room.y2);
    var cy = Math.floor((room.y1 + room.y2) / 2);
    // 柱（2×2）
    var pillars = [[12, 8], [12, cy + 4], [26, 8], [26, cy + 4]];
    for (var i = 0; i < pillars.length; i++) {
      var px = pillars[i][0], py = pillars[i][1];
      tiles[py][px] = tiles[py][px + 1] = tiles[py + 1][px] = tiles[py + 1][px + 1] = "#";
    }
    var exit = { x: room.x2 - 1, y: cy }; // ボスを倒した時のゲートの予備の場所（最初は床）
    // ボスの取り巻き（少しだけ）とアイテム（少しだけ）
    var used = {};
    var pickFree = function (x1, x2) {
      for (var t = 0; t < 50; t++) {
        var p = { x: Game.randInt(x1, x2), y: Game.randInt(room.y1, room.y2) };
        if (tiles[p.y][p.x] !== "." || used[p.x + "," + p.y]) continue;
        used[p.x + "," + p.y] = true;
        return p;
      }
      return null;
    };
    used[exit.x + "," + exit.y] = true;
    used[(room.x1 + 2) + "," + cy] = true;
    used[(room.x2 - 5) + "," + cy] = true;
    var enemySpawns = [pickFree(20, room.x2 - 2), pickFree(20, room.x2 - 2)].filter(Boolean);
    var itemSpawns = [pickFree(room.x1, 15), pickFree(room.x1, 15)].filter(Boolean);
    return {
      width: W, height: H, tiles: tiles, rooms: [room],
      startX: room.x1 + 2, startY: cy,
      stairsX: exit.x, stairsY: exit.y,
      enemySpawns: enemySpawns, itemSpawns: itemSpawns,
      bossSpawn: { x: room.x2 - 5, y: cy },
    };
  },

  // 水たまり（~）：部屋ごとに0〜2か所、まるく広がる。主人公の初期位置・階段の上には作らない
  addPuddles: function (d) {
    var tiles = d.tiles;
    for (var i = 0; i < d.rooms.length; i++) {
      var room = d.rooms[i];
      var count = Game.randInt(0, 2) + (room.x2 - room.x1 > 8 ? 1 : 0);
      for (var n = 0; n < count; n++) {
        var c = this.randomTileIn(room);
        var r = Game.randInt(1, 2) + Math.random() * 0.6;
        for (var y = Math.floor(c.y - r); y <= Math.ceil(c.y + r); y++) {
          for (var x = Math.floor(c.x - r); x <= Math.ceil(c.x + r); x++) {
            if (y < room.y1 || y > room.y2 || x < room.x1 || x > room.x2) continue;
            if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) > r * r) continue;
            if (tiles[y][x] !== "." || (x === d.startX && y === d.startY)) continue;
            tiles[y][x] = "~";
          }
        }
      }
    }
  },

  fillRect: function (tiles, x1, y1, x2, y2) {
    for (var y = y1; y <= y2; y++) {
      for (var x = x1; x <= x2; x++) tiles[y][x] = ".";
    }
  },

  randomTileIn: function (room) {
    return { x: Game.randInt(room.x1, room.x2), y: Game.randInt(room.y1, room.y2) };
  },

  // セル番号 i の上下左右の隣セル番号
  neighbors: function (i, cols, rows) {
    var c = i % cols, r = Math.floor(i / cols);
    var list = [];
    if (c > 0) list.push(i - 1);
    if (c < cols - 1) list.push(i + 1);
    if (r > 0) list.push(i - cols);
    if (r < rows - 1) list.push(i + cols);
    return list;
  },

  // 全セルをちょうど1通りでつなぐ「木」をランダムに作る（迷路作りと同じ方法）
  spanningTree: function (cols, rows) {
    var n = cols * rows;
    var visited = {};
    var edges = [];
    var first = Game.randInt(0, n - 1);
    var stack = [first];
    visited[first] = true;
    while (stack.length > 0) {
      var cur = stack[stack.length - 1];
      var next = this.neighbors(cur, cols, rows).filter(function (j) { return !visited[j]; });
      if (next.length === 0) {
        stack.pop();
        continue;
      }
      var to = Game.pick(next);
      visited[to] = true;
      edges.push([cur, to]);
      stack.push(to);
    }
    return edges;
  },

  // まだつながっていない隣同士をいくつかつなぎ、回り道（ループ）を作る
  addExtraEdges: function (edges, cols, rows, count) {
    var has = function (a, b) {
      for (var i = 0; i < edges.length; i++) {
        if ((edges[i][0] === a && edges[i][1] === b) || (edges[i][0] === b && edges[i][1] === a)) return true;
      }
      return false;
    };
    for (var tries = 0, added = 0; tries < 30 && added < count; tries++) {
      var a = Game.randInt(0, cols * rows - 1);
      var b = Game.pick(this.neighbors(a, cols, rows));
      if (has(a, b)) continue;
      edges.push([a, b]);
      added++;
    }
  },

  // 通路の行き止まりをなくす：部屋ではない区画（通路の分岐点）が1本の通路としかつながっていないと
  // そこが行き止まりになるので、別の隣の区画ともつないで、必ず通り抜けられるようにする
  removeDeadEnds: function (edges, cells, cols, rows) {
    var has = function (a, b) {
      return edges.some(function (e) { return (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a); });
    };
    var degree = function (i) {
      return edges.filter(function (e) { return e[0] === i || e[1] === i; }).length;
    };
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].isRoom) continue;
      var others = this.neighbors(i, cols, rows).filter(function (j) { return !has(i, j); });
      while (degree(i) < 2 && others.length > 0) {
        var k = Math.floor(Math.random() * others.length);
        edges.push([i, others.splice(k, 1)[0]]);
      }
    }
  },

  // 隣り合う2つのセル（の部屋）を、カギ型の通路でつなぐ
  connect: function (tiles, a, b) {
    var tmp;
    if (a.r === b.r) {
      // 左右に並んでいる：a を左にそろえる
      if (a.c > b.c) { tmp = a; a = b; b = tmp; }
      var ay = Game.randInt(a.y1, a.y2);
      var by = Game.randInt(b.y1, b.y2);
      // 2つの部屋の間の列で曲がる。部屋のすぐ隣の列（＝部屋の壁）で曲がると壁が削れるので避ける
      var midX = Game.randInt(a.x2 + 2, b.x1 - 2);
      this.hLine(tiles, a.x2, midX, ay);
      this.vLine(tiles, ay, by, midX);
      this.hLine(tiles, midX, b.x1, by);
    } else {
      // 上下に並んでいる：a を上にそろえる
      if (a.r > b.r) { tmp = a; a = b; b = tmp; }
      var ax = Game.randInt(a.x1, a.x2);
      var bx = Game.randInt(b.x1, b.x2);
      var midY = Game.randInt(a.y2 + 2, b.y1 - 2);
      this.vLine(tiles, a.y2, midY, ax);
      this.hLine(tiles, ax, bx, midY);
      this.vLine(tiles, midY, b.y1, bx);
    }
  },

  hLine: function (tiles, x1, x2, y) {
    for (var x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      if (tiles[y][x] === "#") tiles[y][x] = ".";
    }
  },

  vLine: function (tiles, y1, y2, x) {
    for (var y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      if (tiles[y][x] === "#") tiles[y][x] = ".";
    }
  },
};
