// 全体マップ（3D表示の時だけ、ゲーム画面の左上に薄く重ねる）。
// 探索済みの床・階段・アイテム・仲間・見えている敵・主人公を小さな点で描く。見た目だけでルールには影響しない。
Game.minimap = {
  canvas: null,
  sizes: [0, 3, 5, 7], // 1マスの大きさ（px）。N キーで 非表示 → 小 → 中 → 大 と切り替え
  sizeNames: ["非表示", "小", "中", "大"],
  sizeIndex: 2,
  prefKey: "dimension-roguelike-minimap",

  init: function () {
    try {
      var v = parseInt(window.localStorage.getItem(this.prefKey), 10);
      if (v >= 0 && v < this.sizes.length) this.sizeIndex = v;
    } catch (e) {
      // 覚えておけなくても使える
    }
  },

  // N キー：大きさを切り替えて、表示するメッセージを返す
  cycle: function () {
    this.sizeIndex = (this.sizeIndex + 1) % this.sizes.length;
    try {
      window.localStorage.setItem(this.prefKey, String(this.sizeIndex));
    } catch (e) {
      // 覚えておけなくても切り替えはできる
    }
    return "全体マップ：" + this.sizeNames[this.sizeIndex] + (Game.view3d.enabled ? "" : "（3D表示の時に出る）");
  },

  // ゲーム画面（3D）の上に重ねる canvas を用意する
  setup: function () {
    if (this.canvas) return;
    var cv = document.createElement("canvas");
    cv.id = "minimap";
    document.getElementById("game-wrap").appendChild(cv);
    this.canvas = cv;
  },

  hide: function () {
    if (this.canvas) this.canvas.style.display = "none";
  },

  draw: function () {
    this.setup();
    var map = Game.map, fov = Game.fov, cs = this.sizes[this.sizeIndex];
    var cv = this.canvas;
    if (!cs) {
      cv.style.display = "none";
      return;
    }
    cv.style.display = "";
    if (cv.width !== map.width * cs || cv.height !== map.height * cs) {
      cv.width = map.width * cs;
      cv.height = map.height * cs;
    }
    var ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, cv.width, cv.height);

    var colors = { ">": "#4aa0ff", "O": "#ffe066", "G": "#c8a8ff", "~": "#3a7ac8" };
    for (var y = 0; y < map.height; y++) {
      for (var x = 0; x < map.width; x++) {
        var t = map.tiles[y][x];
        if (t === "#" || !fov.isExplored(x, y)) continue;
        ctx.fillStyle = colors[t] || (fov.isVisible(x, y) ? "rgba(210, 220, 245, 0.75)" : "rgba(150, 160, 190, 0.45)");
        ctx.fillRect(x * cs, y * cs, cs, cs);
      }
    }
    var dot = function (x, y, color, big) {
      ctx.fillStyle = color;
      var s = big ? cs + 2 : cs;
      ctx.fillRect(x * cs + cs / 2 - s / 2, y * cs + cs / 2 - s / 2, s, s);
    };
    var items = Game.items.floorItems;
    for (var i = 0; i < items.length; i++) if (items[i].seen) dot(items[i].x, items[i].y, "#ffd84a");
    var mk = Game.rescue.marker;
    if (mk && mk.seen) dot(mk.x, mk.y, "#b066ff");
    if (Game.state === "base") {
      var ms = Game.baseScene.monsters;
      for (var b = 0; b < ms.length; b++) dot(ms[b].x, ms[b].y, "#8fd18f");
    }
    var es = Game.enemies.list;
    for (var e = 0; e < es.length; e++) if (fov.isVisible(es[e].x, es[e].y)) dot(es[e].x, es[e].y, "#ff4a4a");
    var al = Game.allies.list;
    for (var a = 0; a < al.length; a++) if (al[a].x >= 0) dot(al[a].x, al[a].y, al[a].squad ? "#ffaa33" : "#4aa0ff");
    dot(Game.player.x, Game.player.y, "#37f2ff", true);
  },
};
