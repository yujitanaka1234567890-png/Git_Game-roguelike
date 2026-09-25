// 【図鑑データ】モンスターの一覧。名前はすべてオリジナル。
// 新しい種類を増やす時はここに書き足す（出現場所は dungeons.js、交配の組み合わせは breeding.js）。
// 書き足したら admin/bestiary.html を開いて、設定ミスの警告が出ていないか確認する。
//
//   name / symbol / color：名前と見た目（symbol は文字表示モード用、color はドット絵の基本色）
//   sprite / overlay：ドット絵（sprites.js の絵の名前と、上に重ねる小物の名前）
//   hp / atk / def / exp ：レア度1の時の値。実際の値はレア度の倍率（config.js の rarities の mul）をかけたもの
//   rarity   ：レア度 1〜5（出現しやすさ・仲間になる確率・強さの倍率が決まる）
//   growth   ：仲間になった後、Lvが1上がるごとの上昇量
//   skills   ：持っている技（skills.js のID）。敵も仲間も予告して2ターン溜めてから使う
//   stage    ：進化段階（1〜3）
//   evolvesTo / evolveLevel：仲間がこのLvに達すると、この種類に進化する（生きて帰れば確定）
//   enemyEvoExp：敵として進化するのに必要な「敵の経験値」。敵が他の敵を倒すと、倒された敵の経験値（exp×レア度倍率）がたまり、
//                ここに届くと進化する。例）赤龍は 250 必要、ぬめりんを倒すと 5 もらえる → ぬめりん50体で進化
//   phasing  ：壁をすり抜ける（敵の時）
//   breath   ：離れた相手へのブレス（敵の時）
//   breedOnly：交配でしか手に入らない（ダンジョンには出ない）
//   humanoid ：人型で知能が高い（救出隊には人型が1体は必要）
//   element  ："water"（水属性）なら、水たまり（~）の上で攻撃力が上がり、少しずつ回復する（water.js）
//   boss     ：ダンジョン最下層のボス（dungeons.js の boss）。仲間にならず、進化もしない。大きく描かれる
Game.MONSTERS = {
  // ---- ぬめ系 ----
  numerin: {
    name: "ぬめりん", symbol: "N", sprite: "nume1", color: "#55dd77", hp: 8, atk: 3, def: 0, exp: 5,
    rarity: 1, growth: { hp: 3, atk: 1 }, skills: ["press"],
    stage: 1, evolvesTo: "numeron", evolveLevel: 5, enemyEvoExp: 14,
  },
  numeron: {
    name: "ぬめろん", symbol: "N", sprite: "nume2", color: "#33ccaa", hp: 12, atk: 4, def: 1, exp: 10,
    rarity: 2, growth: { hp: 4, atk: 1 }, skills: ["press", "acidSplash"],
    stage: 2, evolvesTo: "numeDaiou", evolveLevel: 30, enemyEvoExp: 36,
  },
  numeDaiou: {
    name: "ぬめ大王", symbol: "N", sprite: "nume3", color: "#44ffee", hp: 16, atk: 5, def: 1, exp: 16,
    rarity: 3, growth: { hp: 5, atk: 2 }, skills: ["megaPress", "acidSplash"],
    stage: 3,
  },
  // ---- トゲ系 ----
  togemogura: {
    name: "トゲモグラ", symbol: "T", sprite: "toge1", color: "#e09050", hp: 12, atk: 4, def: 1, exp: 12,
    rarity: 2, growth: { hp: 4, atk: 1 }, skills: ["spikeStorm"],
    stage: 1, evolvesTo: "tetsuTogemogura", evolveLevel: 5, enemyEvoExp: 44,
  },
  tetsuTogemogura: {
    name: "鉄トゲモグラ", symbol: "T", sprite: "toge2", color: "#b8b8c8", hp: 16, atk: 5, def: 2, exp: 14,
    rarity: 3, growth: { hp: 5, atk: 1 }, skills: ["spikeStorm", "ironCharge"],
    stage: 2, evolvesTo: "senbonTogemogura", evolveLevel: 30, enemyEvoExp: 67,
  },
  senbonTogemogura: {
    name: "千本トゲモグラ", symbol: "T", sprite: "toge3", color: "#ffcc66", hp: 18, atk: 5, def: 2, exp: 16,
    rarity: 4, growth: { hp: 6, atk: 2 }, skills: ["thousandSpikes", "ironCharge"],
    stage: 3,
  },
  // ---- 刃系（壁をすり抜ける） ----
  floatKnife: {
    name: "浮遊ナイフ", symbol: "†", sprite: "blade1", color: "#c8d4ee", hp: 10, atk: 5, def: 1, exp: 15,
    rarity: 3, growth: { hp: 3, atk: 2 }, skills: ["slashDance"], phasing: true,
    stage: 1, evolvesTo: "floatTwinBlade", evolveLevel: 5, enemyEvoExp: 72,
  },
  floatTwinBlade: {
    name: "浮遊双刃", symbol: "†", sprite: "blade2", color: "#88bbff", hp: 12, atk: 5, def: 1, exp: 15,
    rarity: 4, growth: { hp: 4, atk: 2 }, skills: ["slashDance", "crossSlash"], phasing: true,
    stage: 2, evolvesTo: "floatThousandBlade", evolveLevel: 30, enemyEvoExp: 92,
  },
  floatThousandBlade: {
    name: "浮遊千刃", symbol: "†", sprite: "blade3", color: "#ffffff", hp: 12, atk: 4, def: 1, exp: 15,
    rarity: 5, growth: { hp: 5, atk: 2 }, skills: ["thousandSlash", "crossSlash"], phasing: true,
    stage: 3,
  },
  // ---- 龍系（離れた相手にブレス。2ターンに1度まで） ----
  redDragon: {
    name: "赤龍", symbol: "D", sprite: "dragon1", color: "#ff4a3a", hp: 20, atk: 5, def: 2, exp: 30,
    rarity: 5, growth: { hp: 8, atk: 2 }, skills: ["crimsonRoar"],
    breath: { range: 7, power: 0.8, cooldown: 2 },
    stage: 1, evolvesTo: "gurenDragon", evolveLevel: 5, enemyEvoExp: 250,
  },
  gurenDragon: {
    name: "紅蓮龍", symbol: "D", sprite: "dragon2", color: "#ff8a1a", hp: 26, atk: 6, def: 3, exp: 40,
    rarity: 5, growth: { hp: 9, atk: 3 }, skills: ["crimsonRoar", "flameFang"],
    breath: { range: 7, power: 0.8, cooldown: 2 },
    stage: 2, evolvesTo: "enteiDragon", evolveLevel: 30, enemyEvoExp: 334,
  },
  enteiDragon: {
    name: "焔帝龍", symbol: "D", sprite: "dragon3", color: "#ffd23a", hp: 32, atk: 7, def: 3, exp: 55,
    rarity: 5, growth: { hp: 10, atk: 3 }, skills: ["infernoRoar", "flameFang"],
    breath: { range: 7, power: 0.8, cooldown: 2 },
    stage: 3,
  },
  // ---- 人形系（人型。将来の救出隊の候補） ----
  boroDoll: {
    name: "ボロ人形", symbol: "P", sprite: "doll1", color: "#c8a8e8", hp: 10, atk: 4, def: 1, exp: 10,
    rarity: 2, growth: { hp: 3, atk: 1 }, skills: ["threadBind"], humanoid: true,
    stage: 1, evolvesTo: "karakuriDoll", evolveLevel: 5, enemyEvoExp: 36,
  },
  karakuriDoll: {
    name: "からくり人形", symbol: "P", sprite: "doll2", color: "#d8b060", hp: 14, atk: 5, def: 2, exp: 13,
    rarity: 3, growth: { hp: 4, atk: 1 }, skills: ["threadBind", "gearHammer"], humanoid: true,
    stage: 2, evolvesTo: "kikouShogun", evolveLevel: 30, enemyEvoExp: 61,
  },
  kikouShogun: {
    name: "機巧将軍", symbol: "P", sprite: "doll3", color: "#ffdd88", hp: 18, atk: 6, def: 2, exp: 17,
    rarity: 4, growth: { hp: 5, atk: 2 }, skills: ["commandSlash", "gearHammer"], humanoid: true,
    stage: 3,
  },
  // ---- つむじ鳥系 ----
  tsumujiDori: {
    name: "つむじ鳥", symbol: "B", sprite: "bird1", color: "#88ddee", hp: 7, atk: 4, def: 0, exp: 6,
    rarity: 1, growth: { hp: 2, atk: 1 }, skills: ["kamaitachi"],
    stage: 1, evolvesTo: "arashiDori", evolveLevel: 5, enemyEvoExp: 17,
  },
  arashiDori: {
    name: "嵐つむじ", symbol: "B", sprite: "bird2", color: "#55aaff", hp: 11, atk: 5, def: 1, exp: 10,
    rarity: 2, growth: { hp: 3, atk: 2 }, skills: ["stormKamaitachi", "beakGust"],
    stage: 2, evolvesTo: "tenkuuTsumuji", evolveLevel: 30, enemyEvoExp: 36,
  },
  tenkuuTsumuji: {
    name: "天空つむじ王", symbol: "B", sprite: "bird3", color: "#bbeeff", hp: 15, atk: 6, def: 1, exp: 16,
    rarity: 4, growth: { hp: 4, atk: 2 }, skills: ["greatTornado", "beakGust"],
    stage: 3,
  },
  // ---- ボス（各ダンジョンの最下層） ----
  rockColossus: {
    name: "岩苔の巨像", symbol: "Ω", sprite: "golem", color: "#8a9a6a", hp: 40, atk: 4, def: 1, exp: 50,
    rarity: 5, growth: { hp: 0, atk: 0 }, skills: ["rockAvalanche", "quakeWave"], stage: 1, boss: true,
  },
  abyssMaw: {
    name: "深淵の大口", symbol: "Ψ", sprite: "maw", color: "#3a6aa0", hp: 60, atk: 6, def: 2, exp: 90,
    rarity: 5, growth: { hp: 0, atk: 0 }, skills: ["whirlpool", "swallow"], stage: 1, boss: true,
  },
  // ---- 水属性：カニ系 ----
  abukuGani: {
    name: "あぶくガニ", symbol: "C", sprite: "crab1", color: "#ff8866", hp: 9, atk: 3, def: 1, exp: 6,
    rarity: 1, growth: { hp: 3, atk: 1 }, skills: ["bubbleShot"], element: "water",
    stage: 1, evolvesTo: "tekkakuGani", evolveLevel: 5, enemyEvoExp: 17,
  },
  tekkakuGani: {
    name: "鉄殻ガニ", symbol: "C", sprite: "crab2", color: "#c86a4a", hp: 14, atk: 4, def: 3, exp: 11,
    rarity: 2, growth: { hp: 4, atk: 1 }, skills: ["bubbleShot", "bigPincer"], element: "water",
    stage: 2, evolvesTo: "oouzuGani", evolveLevel: 30, enemyEvoExp: 39,
  },
  oouzuGani: {
    name: "大渦ガニ", symbol: "C", sprite: "crab3", color: "#ff5a3a", hp: 20, atk: 6, def: 3, exp: 18,
    rarity: 4, growth: { hp: 5, atk: 2 }, skills: ["whirlPincer", "bigPincer"], element: "water",
    stage: 3,
  },
  // ---- 水属性：クラゲ系 ----
  tadayoiKurage: {
    name: "ただよいクラゲ", symbol: "J", sprite: "jelly1", color: "#b9a8ff", hp: 7, atk: 3, def: 0, exp: 6,
    rarity: 1, growth: { hp: 2, atk: 1 }, skills: ["numbTentacle"], element: "water",
    stage: 1, evolvesTo: "akariKurage", evolveLevel: 5, enemyEvoExp: 17,
  },
  akariKurage: {
    name: "灯りクラゲ", symbol: "J", sprite: "jelly2", color: "#88ccff", hp: 11, atk: 4, def: 1, exp: 12,
    rarity: 3, growth: { hp: 3, atk: 2 }, skills: ["numbTentacle", "lanternPulse"], element: "water",
    stage: 2, evolvesTo: "tomoshibiOu", evolveLevel: 30, enemyEvoExp: 56,
  },
  tomoshibiOu: {
    name: "深淵の灯王", symbol: "J", sprite: "jelly3", color: "#7affd8", hp: 16, atk: 6, def: 1, exp: 17,
    rarity: 4, growth: { hp: 4, atk: 2 }, skills: ["abyssGlow", "numbTentacle"], element: "water",
    stage: 3,
  },
  // ---- 水属性：うろこ系（人型） ----
  urokoHei: {
    name: "うろこ兵", symbol: "F", sprite: "fish1", color: "#5aa0c8", hp: 11, atk: 4, def: 1, exp: 10,
    rarity: 2, growth: { hp: 3, atk: 1 }, skills: ["tridentThrust"], element: "water", humanoid: true,
    stage: 1, evolvesTo: "urokoKishi", evolveLevel: 5, enemyEvoExp: 36,
  },
  urokoKishi: {
    name: "うろこ騎士", symbol: "F", sprite: "fish2", color: "#4a80b0", hp: 15, atk: 5, def: 3, exp: 14,
    rarity: 3, growth: { hp: 4, atk: 2 }, skills: ["tridentThrust", "tideCharge"], element: "water", humanoid: true,
    stage: 2, evolvesTo: "shioNoShou", evolveLevel: 30, enemyEvoExp: 67,
  },
  shioNoShou: {
    name: "潮の将", symbol: "F", sprite: "fish3", color: "#3ad0c0", hp: 19, atk: 6, def: 3, exp: 18,
    rarity: 4, growth: { hp: 5, atk: 2 }, skills: ["tidalCommand", "tridentThrust"], element: "water", humanoid: true,
    stage: 3,
  },
  // ---- ボス（水底の都） ----
  shiosaiKyokaku: {
    name: "潮鳴りの巨殻", symbol: "Ж", sprite: "shellboss", color: "#d8a070", hp: 70, atk: 6, def: 3, exp: 100,
    rarity: 5, growth: { hp: 0, atk: 0 }, skills: ["tsunami", "shellCrush"], element: "water", stage: 1, boss: true,
  },
  // ---- 交配でしか生まれない種類（breeding.js） ----
  togeNume: {
    name: "トゲぬめ", symbol: "t", sprite: "nume1", overlay: "spikes", color: "#aaee55", hp: 14, atk: 5, def: 1, exp: 14,
    rarity: 2, growth: { hp: 4, atk: 1 }, skills: ["stickyNeedles"], stage: 1, breedOnly: true,
  },
  numeBlade: {
    name: "ぬめ刃", symbol: "n", sprite: "nume1", overlay: "blade", color: "#66ffcc", hp: 11, atk: 6, def: 1, exp: 16,
    rarity: 3, growth: { hp: 3, atk: 2 }, skills: ["slimeSlash"], stage: 1, breedOnly: true,
  },
  bladeMogura: {
    name: "刃モグラ", symbol: "m", sprite: "toge1", overlay: "blade", color: "#dddddd", hp: 12, atk: 6, def: 2, exp: 16,
    rarity: 3, growth: { hp: 4, atk: 2 }, skills: ["bladeDrill"], stage: 1, breedOnly: true,
  },
  numeDrake: {
    name: "ぬめ竜", symbol: "d", sprite: "nume2", overlay: "wings", color: "#77ff55", hp: 22, atk: 6, def: 2, exp: 32,
    rarity: 5, growth: { hp: 8, atk: 2 }, skills: ["slimeFlame"], stage: 1, breedOnly: true,
  },
  scaleMogura: {
    name: "竜鱗モグラ", symbol: "s", sprite: "toge2", overlay: "flame", color: "#ff6644", hp: 23, atk: 6, def: 3, exp: 32,
    rarity: 5, growth: { hp: 8, atk: 2 }, skills: ["scaleRush"], stage: 1, breedOnly: true,
  },
  bladeDoll: {
    name: "刃人形", symbol: "p", sprite: "doll1", overlay: "blade", color: "#e0c0ff", hp: 12, atk: 6, def: 2, exp: 16,
    rarity: 3, growth: { hp: 4, atk: 2 }, skills: ["threadBlade"], stage: 1, breedOnly: true, humanoid: true,
  },
  slimeBird: {
    name: "ぬめ鳥", symbol: "b", sprite: "bird1", overlay: "drip", color: "#99ffaa", hp: 8, atk: 4, def: 1, exp: 9,
    rarity: 2, growth: { hp: 3, atk: 1 }, skills: ["slimeFlap"], stage: 1, breedOnly: true,
  },
  flameBird: {
    name: "炎翼鳥", symbol: "b", sprite: "bird2", overlay: "flame", color: "#ff9944", hp: 22, atk: 6, def: 2, exp: 32,
    rarity: 5, growth: { hp: 7, atk: 3 }, skills: ["flameWingGale"], stage: 1, breedOnly: true,
  },
  spikeDoll: {
    name: "トゲ人形", symbol: "p", sprite: "doll1", overlay: "spikes", color: "#ffaa66", hp: 11, atk: 4, def: 2, exp: 14,
    rarity: 3, growth: { hp: 4, atk: 1 }, skills: ["needleHug"], stage: 1, breedOnly: true, humanoid: true,
  },
  windDoll: {
    name: "風見人形", symbol: "p", sprite: "doll1", overlay: "wings", color: "#bbeeff", hp: 10, atk: 4, def: 1, exp: 13,
    rarity: 3, growth: { hp: 3, atk: 2 }, skills: ["windmillSpin"], stage: 1, breedOnly: true, humanoid: true,
  },
};
