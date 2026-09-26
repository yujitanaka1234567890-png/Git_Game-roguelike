// 訪問者数の計測（公開ページ用）。ゲームのルールには関係しない。
// 使うサービス：GoatCounter（無料・Cookie を使わない・広告の追跡をしない計測サービス。https://www.goatcounter.com）
//   ・config.analytics.goatcounter に、GoatCounter で登録した「コード」（例：jigen-roguelike）を入れると動く。空なら何もしない
//   ・自分のPCで index.html をダブルクリックで開いた時（file://）は数えない（公開ページで開いた時だけ）
//   ・数えるもの
//       ページを開いた回数・日ごとの訪問者 … GoatCounter が自動で数える（同じ人でも日が変われば別に数える）
//       「はじめての訪問」 … このブラウザで初めて開いた時に1回だけ送る（ブラウザに印を残す）。
//                             この数が、ユニークユーザー数（正しくは「ユニークなブラウザの数」）になる
//   ・送るのはページの場所と「はじめての訪問」の印だけ。セーブデータや名前などは送らない
Game.visits = {
  markKey: "dimension-roguelike-visited", // 「はじめての訪問」を送った印（このブラウザに残す）

  init: function () {
    var code = (Game.config.analytics || {}).goatcounter;
    if (!code || !/^https?:$/.test(window.location.protocol)) return; // 設定なし・自分のPCで開いた時は数えない
    var self = this;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", "https://" + code + ".goatcounter.com/count");
    s.onload = function () { self.countFirstVisit(); };
    document.head.appendChild(s);
  },

  // このブラウザで初めての訪問なら「はじめての訪問」を1回だけ数える
  countFirstVisit: function () {
    var seen = false;
    try {
      seen = window.localStorage.getItem(this.markKey) === "1";
    } catch (e) {
      return; // 印を残せないブラウザ（プライベートモードなど）では、毎回数えてしまうので送らない
    }
    if (seen || !window.goatcounter || !window.goatcounter.count) return;
    window.goatcounter.count({ path: "first-visit", title: "はじめての訪問（ユニークユーザー）", event: true });
    try {
      window.localStorage.setItem(this.markKey, "1");
    } catch (e) {
      // 印を残せなくてもゲームは続ける
    }
  },
};
