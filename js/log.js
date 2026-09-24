// 画面下のメッセージログ。新しいものが下に追加され、古いものから消える。
Game.log = {
  lines: [],
  max: 6,

  clear: function () {
    this.lines = [];
  },

  // type: "good"（有利） / "bad"（不利） / "miss" / "info" → 文字色が変わる（style.css）
  add: function (text, type) {
    this.lines.push({ text: text, type: type || "info" });
    if (this.lines.length > this.max) this.lines.shift();
  },

  render: function () {
    var el = document.getElementById("log");
    el.innerHTML = "";
    for (var i = 0; i < this.lines.length; i++) {
      var div = document.createElement("div");
      div.className = "log-" + this.lines[i].type;
      div.textContent = this.lines[i].text;
      el.appendChild(div);
    }
  },
};
