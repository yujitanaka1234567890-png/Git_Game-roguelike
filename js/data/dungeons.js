// 【図鑑データ】ダンジョンの一覧。
//   world     ：属する世界（worlds.js）。壁や床の色、拾ったアイテムの「世界」が決まる
//   floors    ：階数（最後の階に脱出口がある）
//   unlockedBy：このダンジョンを踏破すると行けるようになる（null なら最初から行ける）
//   enemyBase ：1階の敵の数（1階深くなるごとに+1、最大は config.dungeon.maxEnemies）
//   rescueDifficulty：このダンジョンに救出隊を送る時の成功率の減少
//   spawns    ：出てくるモンスター。from〜to 階に出る（to 省略時は最後の階まで）。出やすさはレア度で決まる
// 3段階目の進化個体のような強い種類は、強いダンジョンにだけ出す。
Game.DUNGEONS = {
  beginnerCave: {
    name: "はじまりの洞窟",
    world: "magic",
    floors: 10,
    unlockedBy: null,
    enemyBase: 3,
    rescueDifficulty: 0,
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
  abyssLabyrinth: {
    name: "深淵の迷宮",
    world: "deepSea",
    floors: 15,
    unlockedBy: "beginnerCave",
    enemyBase: 5,
    rescueDifficulty: 0.15,
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
    ],
  },
};

// 今いる（これから行く）ダンジョン
Game.dungeonId = "beginnerCave";
Game.currentDungeon = function () {
  return Game.DUNGEONS[Game.dungeonId];
};
