// 見た目だけのエフェクト（必殺技・ブレスの光など）。ゲームの進行には影響しない。
// マスの上に色付きの光を一定時間重ねて描き、時間が来たら消す。
Game.fx = {
  list: [], // 今表示中の光 [{cells: [{x, y}], color}]
  generation: 0, // 階を移動したら古いエフェクトを出さないための番号

  // cells を color で ms ミリ秒光らせる（delay ミリ秒後に開始）
  flash: function (cells, color, ms, delay) {
    var self = this;
    var gen = this.generation;
    setTimeout(function () {
      if (gen !== self.generation) return;
      var f = { cells: cells, color: color };
      self.list.push(f);
      Game.renderer.draw();
      setTimeout(function () {
        var i = self.list.indexOf(f);
        if (i >= 0) self.list.splice(i, 1);
        if (gen === self.generation) Game.renderer.draw();
      }, ms || 350);
    }, delay || 0);
  },

  clear: function () {
    this.list = [];
    this.generation++;
  },

  // (x, y) の周り r マス（自分のマスも含む）
  around: function (x, y, r) {
    var cells = [];
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) cells.push({ x: x + dx, y: y + dy });
    }
    return cells;
  },

  // (x, y) から見えている範囲のマス（fov.viewRects と同じ範囲）
  viewCells: function (x, y) {
    var cells = [];
    var rects = Game.fov.viewRects(x, y);
    for (var i = 0; i < rects.length; i++) {
      var v = rects[i];
      for (var yy = v.y1; yy <= v.y2; yy++) {
        for (var xx = v.x1; xx <= v.x2; xx++) cells.push({ x: xx, y: yy });
      }
    }
    return cells;
  },

  draw: function (ctx, ts) {
    if (this.list.length === 0) return;
    ctx.globalAlpha = 0.55;
    for (var i = 0; i < this.list.length; i++) {
      ctx.fillStyle = this.list[i].color;
      var cells = this.list[i].cells;
      for (var j = 0; j < cells.length; j++) ctx.fillRect(cells[j].x * ts, cells[j].y * ts, ts, ts);
    }
    ctx.globalAlpha = 1;
  },
};
