// 文章の中に出す小さなドット絵のアイコン（説明・持ち物・仲間一覧・選択ウィンドウで使う）。見た目だけ。
// 文章の中に次の印を書くと、その場所に絵が入る：
//   [[tile:C]]      … 拠点の設備・地形（renderer.tileSprites の文字。C 収納箱 / K 掲示板 / H 交配小屋 / Z 図鑑 / S 石碑 / T 案内板 / G 門 / > 階段）
//   [[item:gun]]    … アイテム（items.js の種類ID）
//   [[mon:numerin]] … モンスター（monsters.js の種類ID）
Game.icons = {
  size: 20, // 画面上の大きさ（px）

  // 印の中身から、絵の名前と色を決める。なければ null
  spec: function (key) {
    var p = key.split(":"), kind = p[0], id = p[1];
    if (kind === "tile") {
      var ts = Game.renderer.tileSprites[id];
      if (!ts) return null;
      return { sprite: id === "G" ? "gateM" : ts.sprite, color: ts.color, text: ts.char, textColor: ts.charColor, gate: id === "G" };
    }
    if (kind === "item") {
      var it = Game.items.types[id];
      return it ? { sprite: it.sprite, color: it.color, text: it.symbol, textColor: it.color } : null;
    }
    if (kind === "mon") {
      var m = Game.MONSTERS[id];
      return m ? { sprite: m.sprite, overlay: m.overlay, color: m.color, text: m.symbol, textColor: m.color } : null;
    }
    return null;
  },

  // アイコン1つ（canvas の要素）を作る
  make: function (key, size) {
    var s = this.spec(key);
    var px = size || this.size;
    var cv = document.createElement("canvas");
    cv.className = "icon";
    cv.width = cv.height = px;
    if (!s) return cv;
    var ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (s.gate) {
      // 門は3マスで1つの絵なので、左・中・右を縮めて並べる
      var parts = ["gateL", "gateM", "gateR"];
      for (var i = 0; i < 3; i++) {
        var g = Game.pixel.build(parts[i], null, s.color);
        if (g) ctx.drawImage(g, (i * px) / 3, px / 6, px / 3, px / 3 * 2);
      }
      return cv;
    }
    var img = Game.pixel.build(s.sprite, s.overlay, s.color);
    if (img) {
      ctx.drawImage(img, 0, 0, px, px);
    } else {
      ctx.fillStyle = s.textColor || "#fff";
      ctx.font = "bold " + Math.floor(px * 0.8) + "px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.text || "?", px / 2, px / 2 + 1);
    }
    return cv;
  },

  // el の中身を text にする（印の所はアイコンに置き換える）
  fill: function (el, text) {
    el.textContent = "";
    var re = /\[\[((?:tile|item|mon):[^\]]+)\]\]/g, last = 0, m;
    text = String(text);
    while ((m = re.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      el.appendChild(this.make(m[1]));
      last = re.lastIndex;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
    return el;
  },

  // ページ（index.html）の中の <span data-icon="tile:C"></span> に絵を入れる（起動時に1回）
  fillStatic: function () {
    var list = document.querySelectorAll("[data-icon]");
    for (var i = 0; i < list.length; i++) {
      list[i].textContent = "";
      list[i].appendChild(this.make(list[i].getAttribute("data-icon")));
    }
  },
};
