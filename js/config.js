// ゲーム全体の設定値。数値を変えるだけで見た目や挙動を調整できる場所。
// Game という1つの箱（名前空間）に全部をまとめて、ファイル間で共有する。
var Game = {};

Game.config = {
  tileSize: 24, // 1マスのピクセル数
  // 訪問者数の計測（visits.js）。GoatCounter で登録したコード（例："jigen-roguelike"）を入れると、公開ページで数え始める。空なら数えない
  analytics: { goatcounter: "" },
  dungeon: {
    width: 40, // マップの横マス数
    height: 27, // マップの縦マス数
    cols: 3, // 横方向の区画数（部屋の最大数 = cols × rows）
    rows: 3,
    roomChance: 0.8, // 区画が「部屋」になる確率（残りは通路の分岐点だけ）
    minRoomW: 4,
    minRoomH: 3,
    extraConnections: 2, // 回り道用に追加する通路の本数
    maxEnemies: 10, // 1つの階にいる敵の上限（最初の配置・湧き直しとも）
    minItems: 3, // 1階あたりのアイテム数（この範囲でランダム）
    maxItems: 5,
  },
  hitRate: 0.9, // 攻撃の命中率（0〜1）
  regenTurns: 6, // 何ターンごとにHPが1回復するか
  dashDelay: 25, // ダッシュ時の1歩ごとの間隔（ミリ秒）。小さいほど速い
  hitPauseMs: 350, // ダメージを受けた直後、ダッシュ・押しっぱなし移動の次の1歩まであける時間（ミリ秒）
  leveling: {
    expBase: 5, // 必要経験値の係数（大きいほどレベルが上がりにくい）
    hpPerLevel: 4, // レベルアップ1回で上がる最大HP
    atkPerLevel: 1, // レベルアップ1回で上がる攻撃力
    maxLevel: 999,
  },
  // 精神力（mind.js）：ダンジョンにいる間は少しずつ減り、0でダンジョンに取り込まれる
  mind: {
    max: 100,
    drainEvery: 8, // このターン数ごとに1減る（ふだん。満タンから0まで約800ターン）
    graceTurns: 205, // 長居の猶予（ふつうの広さの階で）。これを超えて同じ階に居続けると…
    refFloorTiles: 320, // 「ふつうの広さ」の床のマス数（猶予は広さに比例して長く・短くなる）
    minGrace: 100, // 長居の猶予の最低ターン数（とても狭い階でも、これだけは居られる）
    howlEvery: 45, // 精神力が半分未満の間、このターン数ごとに遠吠えが聞こえる
    whisperEvery: 30, // 精神力が4分の1未満の間、このターン数ごとにささやきが聞こえる
    zeroCountdown: 3, // 精神力が0になってから、このターン数のうちに1以上に戻さないとダンジョンに取り込まれる
    lingerDrainEvery: 2, // …このターン数ごとに1減るようになる（長居するほど早く取り込まれる）
    descendRecover: 10, // 階段を降りた時の回復量
    zeroInputWaitMs: 1000, // 精神力0の間、1手ごとに次の入力を受け付けるまでの間（ミリ秒）
  },
  respawnChance: 0.03, // 毎ターン、この確率で主人公から見えない場所に敵が1体湧く（その階の敵が上限未満の時）
  // 救出（rescue.js）
  lostMax: 5, // はぐれた仲間の記録を覚えておける数（超えると古いものから気配が消える）
  lostDives: 3, // はぐれた仲間を助けないまま、この回数ダンジョンに潜ると、ダンジョンへ帰ってしまう
  rescue: {
    maxTeam: 4, // 救出隊の最大人数（人型が1体は必須）
    base: 0.25, // 成功率の基本値
    perMember: 0.12, // 人型の隊員1体ごとの上乗せ
    perNonHumanoid: 0.06, // 人型以外の隊員1体ごとの上乗せ
    perStage: 0.08, // 隊員の進化段階が1つ上がるごとの上乗せ
    perRarity: 0.02, // 隊員のレア度1ごとの上乗せ
    perFloor: 0.02, // はぐれた階が1つ深くなるごとの減少（B1Fは減らない）
    min: 0.05,
    max: 0.95,
  },
  ranchMax: 30, // 拠点の牧場に置ける仲間の最大数
  // 敵のレア度。recruit = 倒した時に仲間になる確率 / spawn = 出現しやすさ（大きいほど出やすい）
  // mul = 強さ（HP・攻撃力・防御力）と経験値にかける倍率（レアなほど強く、経験値も多い）
  rarities: {
    1: { label: "よく見る", recruit: 0.3, spawn: 10, mul: 1.0 },
    2: { label: "少しめずらしい", recruit: 0.2, spawn: 5, mul: 1.3 },
    3: { label: "めずらしい", recruit: 0.07, spawn: 2, mul: 1.7 },
    4: { label: "とてもめずらしい", recruit: 0.05, spawn: 1, mul: 2.2 },
    5: { label: "幻", recruit: 0.03, spawn: 0.3, mul: 3.0 },
  },
  // アイテムのレア度（items.js の rarity）。spawn = 出やすさ（大きいほど出やすい）。強い・便利な物ほどレアで出にくい
  itemRarities: {
    1: { label: "よく見る", stars: "★", spawn: 10 },
    2: { label: "少しめずらしい", stars: "★★", spawn: 5 },
    3: { label: "めずらしい", stars: "★★★", spawn: 2.5 },
    4: { label: "とてもめずらしい", stars: "★★★★", spawn: 1 },
    5: { label: "幻", stars: "★★★★★", spawn: 0.3 },
  },
  // ボスの状態への強さ（equip.statusTurns）。
  //   debuff＝技封じ・ひるみ・放逐などの弱体 → 効かない / sleep＝眠り → 最大 sleepTurns ターン
  //   ailment＝毒・麻痺・出血などの状態異常（将来追加する時用）→ ターン数を ailmentMul 倍（ある程度は効く）
  bossResist: { sleepTurns: 2, ailmentMul: 0.5 },
  specialChance: 0.2, // 敵が攻撃できる時に、必殺技の溜めを始める確率
  allySkillChance: 0.2, // 仲間が攻撃できる時に、技の溜めを始める確率（敵と同じく予告して2ターン後に発動）
  specialWindup: 2, // 必殺技の予告ターン数（予告してから、このターン数の後に発動）
  specialMaxRatio: 0.6, // 必殺技1回で受けるダメージの上限（相手の最大HPに対する割合。即死防止）
  phasingSense: 6, // 壁抜けする敵が主人公を感じ取れる距離
  enemyEvoFactor: 2.78, // 敵が進化するのに必要な「敵の経験値」＝ 自分の強さ（経験値の値）× この数（赤龍はぬめりん50体分）
  storageMax: 60, // 拠点の倉庫に置けるアイテムの最大数
  starterStorage: ["healMoss", "healMoss"], // 初めて遊ぶ時に倉庫に入っているアイテム
  randomTargetChance: 0.2, // 攻撃相手を「HPが一番少ない相手」ではなくランダムに選ぶ確率（敵・仲間共通）
  throwRange: 10, // アイテムを投げて届く最大マス数
  throwDelay: 30, // 投げたアイテムが1マス進むアニメーションの間隔（ミリ秒）
  throwBonkDamage: 2, // 回復・強化以外のアイテムを投げ当てた時のダメージ
  maxAllies: 7, // 連れて歩ける仲間の最大数
  squad: { maxMembers: 4 }, // 分隊（squad.js）の最大人数。人型が1体は必要
  allyLeash: 5, // 仲間が敵に向かっていく範囲（主人公からこのマス数以内の敵だけ狙う）
  roamOtherRoomChance: 0.2, // うろつく敵が、次の目的地に「別の部屋」を選ぶ確率（残りは同じ部屋の中）
  diagonalWait: 120, // Shift＋矢印の後、斜め用の2つ目の矢印を待つ時間（ミリ秒）
  colors: {
    floor: "#222",
    wall: "#665544",
    player: "#ffdd33",
    allyBg: "#1d3f6e", // 仲間のマスの下地
    grid: "#1a1a1a",
    stairs: "#2a4a7a",
    grass: "#1c3a1e", // 拠点の牧場
    gate: "#3a2a5a", // 拠点の門
    houseFloor: "#3a2c20", // 拠点の家の床
    exit: "#6a5a1a", // 脱出口
    exitDim: "#3a3210",
    // 探索済みだが今は見えていない場所（暗めの色）
    floorDim: "#141414",
    wallDim: "#3a3128",
    stairsDim: "#1a2c48",
    unexplored: "#000",
    hpBar: "#e04040",
    allyHpBar: "#4caf50", // 仲間の体力ゲージ（敵の赤と見分ける）
    water: "#2a6aa6", // 水たまり
    waterDim: "#163a5a",
    hpBarBg: "#400",
  },
};

// 階段の種類ごとの使い方。その方向キーを「2回」押すと使える。
// 上り階段を追加する時は、マップに "<" を置き、ここに1行足して main.js の Game.useStairs に処理を書く
Game.STAIRS = {
  ">": { dir: [0, 1], key: "↓", action: "descend", verb: "降りる", ask: "次の階へ降りますか？", label: "階段" },
  "O": { dir: [0, 1], key: "↓", action: "escape", verb: "脱出する", ask: "ダンジョンから脱出して拠点へ帰りますか？", label: "脱出口" }, // 各ダンジョンの最深部にある
  // "<": { dir: [0, -1], key: "↑", action: "ascend", verb: "上る", label: "上り階段" },
};

// min 以上 max 以下のランダムな整数
Game.randInt = function (min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
};

// 配列からランダムに1つ選ぶ
Game.pick = function (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
};

// 8方向（上下左右を先、斜めを後に並べる。敵AIは前にある方向を優先する）
Game.DIRS8 = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];
