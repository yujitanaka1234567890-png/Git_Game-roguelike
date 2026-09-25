// 選択ウィンドウ（画面中央上に出る）。仲間の入れ替え確認・拠点での会話・収納・出発確認などで共通に使う。
// 開いている間はゲームが止まり、↑↓ で選んで Enter（またはスペース）で決定、Esc で取り消し。
//   Game.dialog.open({
//     title: "見出し", lines: ["説明文", ...],
//     options: [{ label: "選択肢", onChoose: function () {...}, keepOpen: false }, ...],
//     onCancel: function () {...},  // Esc の時（省略可）
//     image: canvas                 // 見出しの下に大きく出す絵（省略可。図鑑で使う）
//   }, 最初に選んでおく番号（省略可）);
Game.dialog = {
  current: null,

  open: function (cfg, cursor) {
    this.current = {
      title: cfg.title || "",
      lines: cfg.lines || [],
      options: cfg.options || [],
      onCancel: cfg.onCancel || null,
      image: cfg.image || null,
      cursor: Math.min(cursor || 0, Math.max(0, (cfg.options || []).length - 1)),
    };
  },

  isOpen: function () {
    return this.current !== null;
  },

  close: function () {
    this.current = null;
  },

  move: function (d) {
    var c = this.current;
    if (!c || c.options.length === 0) return;
    c.cursor = (c.cursor + d + c.options.length) % c.options.length;
    Game.sound.play("cursor");
  },

  // 選んでいる選択肢を実行する（keepOpen でなければ先にウィンドウを閉じる）
  choose: function () {
    var c = this.current;
    if (!c) return;
    var opt = c.options[c.cursor];
    if (!opt) return;
    if (!opt.keepOpen) this.close();
    if (opt.onChoose) opt.onChoose();
  },

  cancel: function () {
    var c = this.current;
    if (!c) return;
    this.close();
    if (c.onCancel) c.onCancel();
  },

  render: function () {
    var el = document.getElementById("dialog");
    var c = this.current;
    if (!c) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = "";
    var add = function (tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      el.appendChild(e);
      return e;
    };
    if (c.title) add("div", "inv-title", c.title);
    if (c.image) {
      var big = add("canvas", "dialog-image");
      big.width = c.image.width * 5;
      big.height = c.image.height * 5;
      var bctx = big.getContext("2d");
      bctx.imageSmoothingEnabled = false;
      bctx.drawImage(c.image, 0, 0, big.width, big.height);
    }
    for (var i = 0; i < c.lines.length; i++) add("div", "inv-desc", c.lines[i]);
    var ul = add("ul");
    var selectedLi = null;
    for (var j = 0; j < c.options.length; j++) {
      var li = document.createElement("li");
      if (j === c.cursor) {
        li.className = "selected";
        selectedLi = li;
      }
      li.textContent = c.options[j].label;
      ul.appendChild(li);
    }
    add("div", "inv-help", "↑↓：選ぶ　Enter / スペース：決定　Esc：閉じる");
    // 選択肢が多くてウィンドウがスクロールする時、選んでいる行が見えるようにする
    if (selectedLi) selectedLi.scrollIntoView({ block: "nearest" });
  },
};
