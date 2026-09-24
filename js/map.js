// 現在のマップ（ダンジョンの階 or 拠点）と「そのマスに入れるか」の判定。
// ダンジョンは dungeon.js が毎階ランダムに作り、拠点は basemap.js の固定マップを読み込む。
//   # = 壁   . = 床   > = 下り階段   O = 脱出口
//   （拠点用） , = 牧場の草地   C = 収納箱 / H = 交配小屋 / K = 救出の掲示板 / S = 記録の石碑（入れない。触れると開く）   G = ダンジョンへの門
Game.map = {
  tiles: [], // tiles[y][x]
  width: 0,
  height: 0,
  rooms: [], // [{x1, y1, x2, y2}, ...] 部屋の範囲（今後「同じ部屋にいるか」の判定などに使う）
  startX: 0,
  startY: 0,
  enemySpawns: [], // [{x, y}, ...] 敵を置く位置
  itemSpawns: [], // [{x, y}, ...] アイテムを置く位置
  bossSpawn: null, // ボス部屋のボスの位置（最下層だけ）

  // 新しい階を作る
  generate: function (floor) {
    var d = Game.dungeon.generate(floor);
    this.tiles = d.tiles;
    this.width = d.width;
    this.height = d.height;
    this.rooms = d.rooms;
    this.startX = d.startX;
    this.startY = d.startY;
    this.enemySpawns = d.enemySpawns;
    this.itemSpawns = d.itemSpawns;
    this.bossSpawn = d.bossSpawn || null; // ボス部屋ならボスの位置
  },

  // 文字で描いた固定マップを読み込む（拠点用）。@ の位置を初期位置にする
  loadStatic: function (layout) {
    this.height = layout.length;
    this.width = layout[0].length;
    this.tiles = [];
    this.rooms = [];
    this.enemySpawns = [];
    this.itemSpawns = [];
    this.bossSpawn = null;
    for (var y = 0; y < this.height; y++) {
      var row = [];
      for (var x = 0; x < this.width; x++) {
        var ch = layout[y][x];
        if (ch === "@") {
          this.startX = x;
          this.startY = y;
          ch = ".";
        }
        row.push(ch);
      }
      this.tiles.push(row);
    }
  },

  // (x, y) が属する部屋を返す（部屋の入口＝部屋を囲む1マスの輪の上も含む）。通路なら null
  // 部屋同士は必ず壁2マス以上離れているので、2つの部屋に同時に属することはない
  roomAt: function (x, y) {
    for (var i = 0; i < this.rooms.length; i++) {
      var r = this.rooms[i];
      if (x >= r.x1 - 1 && x <= r.x2 + 1 && y >= r.y1 - 1 && y <= r.y2 + 1) return r;
    }
    return null;
  },

  tileAt: function (x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return "#";
    return this.tiles[y][x];
  },

  // (x, y) のマスに入れるか？ マップ外・壁・収納箱・交配小屋・掲示板は入れない
  isWalkable: function (x, y) {
    var t = this.tileAt(x, y);
    return t !== "#" && t !== "C" && t !== "H" && t !== "K" && t !== "S";
  },

  // (x, y) から (dx, dy) 方向へ1歩進めるか（地形だけで判定。キャラの有無は見ない）
  // 斜めの場合、角の壁をすり抜けることはできない
  canStep: function (x, y, dx, dy) {
    if (!this.isWalkable(x + dx, y + dy)) return false;
    if (dx !== 0 && dy !== 0) {
      if (!this.isWalkable(x + dx, y) || !this.isWalkable(x, y + dy)) return false;
    }
    return true;
  },
};
