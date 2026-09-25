// 【図鑑データ】ダンジョンの一覧。
//   world     ：属する世界（worlds.js）。壁や床の色、拾ったアイテムの「世界」が決まる
//   colors    ：（省略可）このダンジョンだけの壁・床の色（世界の色の代わりに使う）
//   style     ：（省略可）壁・床の模様（pixelart.js）。"timeGarden" = 時空を思わせる鈍い斑の壁と、継ぎ目のある床
//               "seaCity" = 海に沈んだ都の石組みの壁（海藻・フジツボつき）と石畳の床
//   puddles   ：（省略可）true なら部屋に水たまり（~）ができる。水属性の敵は水たまりの上で強くなる（water.js）
//   floors    ：階数（最後の階に脱出口がある）
//   unlockedBy：このダンジョンを踏破すると行けるようになる（null なら最初から行ける）
//   enemyBase ：1階の敵の数（1階深くなるごとに+1、最大は config.dungeon.maxEnemies）
//   rescueDifficulty：このダンジョンに救出隊を送る時の成功率の減少
//   enemyMul  ：（省略可）敵のHP・攻撃力・経験値にかける倍率。1より大きいと、低い階から敵が強い（防具が必要）
//   note      ：（省略可）門で行き先を選ぶ時に出す注意書き
//   boss      ：最下層（広いボス部屋）に待ち構えるボス（monsters.js の boss: true の種類）。倒すと脱出口の封印が解ける
//   spawns    ：出てくるモンスター。from〜to 階に出る（to 省略時は最後の階まで）。出やすさはレア度で決まる
// 3段階目の進化個体のような強い種類は、強いダンジョンにだけ出す。
Game.DUNGEONS = {
  beginnerCave: {
    name: "はじまりの箱庭",
    world: "magic",
    colors: { wall: "#4a4666", wallDim: "#2a283b", floor: "#1f2030", floorDim: "#131320" },
    style: "timeGarden",
    floors: 10,
    unlockedBy: null,
    enemyBase: 3,
    rescueDifficulty: 0,
    boss: "rockColossus",
    spawns: [
      { type: "numerin", from: 1 },
      { type: "tsumujiDori", from: 1 },
      { type: "boroDoll", from: 2 },
      { type: "togemogura", from: 3 },
      { type: "numeron", from: 4 },
      { type: "floatKnife", from: 4 },
      { type: "arashiDori", from: 5 },
      { type: "redDragon", from: 6 },
      { type: "tetsuTogemogura", from: 6 },
      { type: "karakuriDoll", from: 7 },
      { type: "floatTwinBlade", from: 8 },
    ],
  },
  sunkenCity: {
    name: "水底の都",
    world: "deepSea",
    colors: { wall: "#3a6272", wallDim: "#1e3640", floor: "#26343e", floorDim: "#151e25" },
    style: "seaCity",
    puddles: true,
    floors: 12,
    unlockedBy: "beginnerCave",
    enemyBase: 4,
    rescueDifficulty: 0.1,
    boss: "shiosaiKyokaku",
    spawns: [
      { type: "abukuGani", from: 1 },
      { type: "tadayoiKurage", from: 1 },
      { type: "numerin", from: 1, to: 4 },
      { type: "urokoHei", from: 2 },
      { type: "numeron", from: 4 },
      { type: "tekkakuGani", from: 4 },
      { type: "floatKnife", from: 5 },
      { type: "akariKurage", from: 6 },
      { type: "karakuriDoll", from: 7 },
      { type: "urokoKishi", from: 8 },
    ],
  },
  abyssLabyrinth: {
    name: "深淵の迷宮",
    world: "deepSea",
    floors: 15,
    unlockedBy: "beginnerCave",
    enemyBase: 5,
    rescueDifficulty: 0.15,
    enemyMul: 1.35,
    note: "敵が強い。防具（鎖かたびら・鋼の鎧など）がないと、1階でも生き残るのは難しい",
    boss: "abyssMaw",
    spawns: [
      { type: "numeron", from: 1 },
      { type: "tetsuTogemogura", from: 1 },
      { type: "arashiDori", from: 1 },
      { type: "karakuriDoll", from: 1 },
      { type: "floatKnife", from: 1, to: 8 },
      { type: "tenkuuTsumuji", from: 9 },
      { type: "kikouShogun", from: 11 },
      { type: "floatTwinBlade", from: 3 },
      { type: "redDragon", from: 3, to: 10 },
      { type: "gurenDragon", from: 6 },
      { type: "numeDaiou", from: 8 },
      { type: "senbonTogemogura", from: 10 },
      { type: "floatThousandBlade", from: 12 },
      { type: "enteiDragon", from: 13 },
      { type: "oouzuGani", from: 10 },
      { type: "tomoshibiOu", from: 11 },
      { type: "shioNoShou", from: 12 },
    ],
  },
};

// 今いる（これから行く）ダンジョン
Game.dungeonId = "beginnerCave";
Game.currentDungeon = function () {
  return Game.DUNGEONS[Game.dungeonId];
};
