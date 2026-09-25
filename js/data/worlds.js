// 【図鑑データ】世界（パラレルワールド）の一覧と、次元変換の読み替え表。
// 各ダンジョンはどれか1つの世界に属する（dungeons.js の world）。
// アイテムは「拾った世界」を覚えていて、別の世界で使うと DIMENSION_RULES の読み替えが入る。
// アイテムの名前はどの世界でも共通（辻褄は後で考える）。
Game.WORLDS = {
  magic: {
    name: "魔法の世界",
    desc: "古い魔力が満ちる石造りの迷宮。",
    colors: { wall: "#665544", wallDim: "#3a3128", floor: "#222222", floorDim: "#141414" },
  },
  deepSea: {
    name: "深海調査",
    desc: "水圧にきしむ海底の調査施設跡。",
    colors: { wall: "#1f4a66", wallDim: "#12283a", floor: "#0e1a24", floorDim: "#081018" },
  },
  cyberpunk: {
    name: "サイバーパンク",
    desc: "ネオンと配線が絡み合う巨大都市の地下。",
    colors: { wall: "#5a2a6a", wallDim: "#301838", floor: "#1a1022", floorDim: "#100a16" },
  },
  sf: {
    name: "SF",
    desc: "星間船の朽ちた居住区画。",
    colors: { wall: "#4a5a6a", wallDim: "#28323c", floor: "#161c22", floorDim: "#0c1014" },
  },
  steampunk: {
    name: "スチームパンク",
    desc: "蒸気と歯車がうなる機関都市の底。",
    colors: { wall: "#7a5a2a", wallDim: "#42321a", floor: "#221a10", floorDim: "#140f09" },
  },
};

// 次元変換の読み替え表：item の種類を from の世界で拾い、to の世界で使った時の変化。
//   powerMul：効き目の倍率 / note：使った時にログに出す説明
// 中身はこれから決める（今は空。下の例のように書き足す）。
Game.DIMENSION_RULES = [
  // { item: "flashTalisman", from: "magic", to: "cyberpunk", powerMul: 1.2, note: "閃光の符が電子の光に変換され、少し強く輝いた。" },
];
