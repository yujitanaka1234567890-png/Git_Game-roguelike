// 【図鑑データ】技（必殺技）の一覧。モンスターは monsters.js の skills にここのIDを並べて持つ。
// 名前はすべてオリジナル。
//   shape：single（隣の1体）/ around（隣の全員）/ sight（見えている全員）/ range（使い手から range マス以内で見えている全員）
//          line（向いた方向へ一直線に range マス。溜め始めに向きが決まり、溜めている間は危ないマスが光る）
//   mult ：使い手の攻撃力にかける倍率 / hits：連続で当たる回数（省略時1） / color：エフェクトの色
//   windup / charging：敵が使う時の予兆ログ（予告1ターン目 / 2ターン目）
Game.SKILLS = {
  // ---- ぬめ系 ----
  press: {
    name: "のしかかりプレス", shape: "single", mult: 3, color: "#ffffff",
    windup: "体を大きくふくらませ始めた…", charging: "さらにパンパンにふくらんでいる…！",
  },
  acidSplash: {
    name: "とろける溶解液", shape: "around", mult: 1.6, color: "#88ff66",
    windup: "体の表面がぶくぶくと泡立ち始めた…", charging: "今にもはじけそうに震えている…！",
  },
  megaPress: {
    name: "大王ボディプレス", shape: "single", mult: 4, color: "#ffffff",
    windup: "天井に届きそうなほど跳び上がる構えだ…", charging: "床がみしみしと鳴っている…！",
  },
  // ---- トゲ系 ----
  spikeStorm: {
    name: "トゲ嵐", shape: "around", mult: 2, color: "#ffaa33",
    windup: "背中のトゲを逆立て始めた…", charging: "トゲがギラギラと光っている…！",
  },
  ironCharge: {
    name: "鉄甲突進", shape: "single", mult: 3, color: "#c0c0d0",
    windup: "地面を後ろ足でかき始めた…", charging: "鉄の背中が赤熱している…！",
  },
  thousandSpikes: {
    name: "千本針地獄", shape: "around", mult: 2.8, color: "#ffcc44",
    windup: "全身の針がざわざわと伸び始めた…", charging: "針先がいっせいにこちらを向いた…！",
  },
  // ---- 刃系 ----
  slashDance: {
    name: "千切り乱舞", shape: "single", mult: 1.1, hits: 3, color: "#ff3355",
    windup: "刃が赤く光り始めた…", charging: "刃の回転がどんどん速くなる…！",
  },
  crossSlash: {
    name: "双刃十字斬り", shape: "single", mult: 1.8, hits: 2, color: "#88bbff",
    windup: "二本の刃が交差する形に構えた…", charging: "刃と刃がこすれて火花が散る…！",
  },
  thousandSlash: {
    name: "千刃嵐舞", shape: "single", mult: 1.0, hits: 5, color: "#ffffff",
    windup: "無数の刃が円を描いて集まり始めた…", charging: "刃の渦がうなりを上げている…！",
  },
  // ---- 龍系 ----
  crimsonRoar: {
    name: "紅蓮の咆哮", shape: "sight", mult: 1.5, color: "#ff5522",
    windup: "大きく息を吸い込み始めた…", charging: "口の奥が真っ赤に燃え上がっている…！",
  },
  flameFang: {
    name: "炎牙", shape: "single", mult: 3, color: "#ff8a1a",
    windup: "牙に炎がまとわりつき始めた…", charging: "牙が白く輝くほど燃えている…！",
  },
  infernoRoar: {
    name: "焔帝の大咆哮", shape: "sight", mult: 2.2, color: "#ffd23a",
    windup: "周りの空気が揺らめき始めた…", charging: "全身から金色の炎が噴き出している…！",
  },
  // ---- 人形系 ----
  threadBind: {
    name: "ほつれ糸縛り", shape: "single", mult: 2.5, color: "#d8b0ff",
    windup: "ほつれた糸をたぐり寄せ始めた…", charging: "糸がぴんと張りつめている…！",
  },
  gearHammer: {
    name: "歯車ハンマー", shape: "single", mult: 3.2, color: "#c8a060",
    windup: "腕の歯車がぎりぎりと巻き上がり始めた…", charging: "歯車が火花を散らして回っている…！",
  },
  commandSlash: {
    name: "号令斬り", shape: "around", mult: 2.6, color: "#ffdd88",
    windup: "刀を高く掲げ、号令をかける構えだ…", charging: "全身のからくりがうなりを上げている…！",
  },
  // ---- つむじ鳥系 ----
  kamaitachi: {
    name: "かまいたち", shape: "range", range: 2, mult: 1.2, color: "#aaffff",
    windup: "翼を大きく広げ始めた…", charging: "周りの空気が渦を巻いている…！",
  },
  stormKamaitachi: {
    name: "嵐のかまいたち", shape: "range", range: 3, mult: 1.4, color: "#88eeff",
    windup: "翼で激しく風をかき集め始めた…", charging: "鋭い風の刃がいくつも渦巻いている…！",
  },
  beakGust: {
    name: "突風くちばし", shape: "single", mult: 2.8, color: "#88ddff",
    windup: "くちばしを低く構えた…", charging: "風をまとって体が浮き上がっている…！",
  },
  greatTornado: {
    name: "大竜巻", shape: "range", range: 4, mult: 1.9, color: "#66ccff",
    windup: "上空で大きく旋回し始めた…", charging: "巨大な竜巻が形になりつつある…！",
  },
  // ---- ボス ----
  rockAvalanche: {
    name: "岩なだれ", shape: "range", range: 2, mult: 1.3, color: "#a0a080",
    windup: "両腕の大岩を高く振り上げた…", charging: "天井からぱらぱらと小石が落ちてくる…！",
  },
  rockBeam: {
    name: "苔光線", shape: "line", range: 3, mult: 1.7, color: "#d8e070",
    windup: "胸の苔がじわりと光り、こちらへ向いた…", charging: "光がまっすぐに集まっていく…！",
  },
  quakeWave: {
    name: "大地の震え", shape: "sight", mult: 1.3, color: "#c0a060",
    windup: "足を大きく踏み鳴らす構えだ…", charging: "床の苔がいっせいに逆立った…！",
  },
  whirlpool: {
    name: "深淵の渦潮", shape: "range", range: 2, mult: 1.5, color: "#3a8aff",
    windup: "巨大な口で水を吸い込み始めた…", charging: "大口のまわりの水が渦を巻いている…！",
  },
  swallow: {
    name: "丸呑み", shape: "single", mult: 3.5, color: "#ff4466",
    windup: "大きな口をゆっくりと開き始めた…", charging: "口の奥の暗闇がこちらを見ている…！",
  },
  // ---- 水属性（水底の都） ----
  bubbleShot: {
    name: "あぶく弾", shape: "range", range: 3, mult: 1.3, color: "#88ddff",
    windup: "口から泡をぶくぶく溜め始めた…", charging: "大きな泡がいくつも膨らんでいる…！",
  },
  bigPincer: {
    name: "大バサミ", shape: "single", mult: 2.8, color: "#ff8866",
    windup: "ハサミを大きく振り上げた…", charging: "ハサミがぎりぎりと音を立てている…！",
  },
  whirlPincer: {
    name: "渦潮バサミ", shape: "around", mult: 2.4, color: "#66aaff",
    windup: "ハサミで水を渦巻かせ始めた…", charging: "足元の水が激しく渦を巻いている…！",
  },
  numbTentacle: {
    name: "しびれ触手", shape: "around", mult: 1.7, color: "#e0e070",
    windup: "触手をゆらゆらと広げ始めた…", charging: "触手がぱちぱちと光っている…！",
  },
  lanternPulse: {
    name: "灯りの波動", shape: "range", range: 3, mult: 1.5, color: "#ffe88a",
    windup: "体の灯りがゆっくり強くなっていく…", charging: "まぶしいほどに光が満ちている…！",
  },
  abyssGlow: {
    name: "深淵の光", shape: "sight", mult: 1.9, color: "#7affd8",
    windup: "冠が暗く瞬き始めた…", charging: "あたりの闇がすべて光に吸い込まれていく…！",
  },
  tridentThrust: {
    name: "三叉突き", shape: "single", mult: 2.5, color: "#9fe8ff",
    windup: "三叉の槍を低く構えた…", charging: "槍の先に水の渦がまとわりついている…！",
  },
  tideCharge: {
    name: "波濤突撃", shape: "around", mult: 2.0, color: "#5ab0ff",
    windup: "盾を構えて身を沈めた…", charging: "背後に大波がせり上がっている…！",
  },
  tidalCommand: {
    name: "大潮の号令", shape: "sight", mult: 1.8, color: "#3ad0c0",
    windup: "槍を高く掲げ、潮を呼び始めた…", charging: "遠くから潮鳴りが近づいてくる…！",
  },
  tsunami: {
    name: "大津波", shape: "line", range: 5, mult: 1.7, color: "#3a8aff",
    windup: "殻の奥から低い潮鳴りが響き始めた…", charging: "殻の前にまっすぐ大波がせり上がってくる…！",
  },
  shellCrush: {
    name: "殻砕き", shape: "around", mult: 2.6, color: "#d8a070",
    windup: "巨大な殻を大きく持ち上げた…", charging: "殻がきしみ、床の水が跳ね上がる…！",
  },
  // ---- 交配で生まれる種類 ----
  stickyNeedles: {
    name: "ねばトゲ弾", shape: "around", mult: 2.2, color: "#aaff88",
    windup: "ねばねばのトゲを膨らませ始めた…", charging: "トゲからしずくが垂れている…！",
  },
  slimeSlash: {
    name: "ぬめり斬り", shape: "single", mult: 1.5, hits: 2, color: "#66ffcc",
    windup: "刃がぬめりに包まれ始めた…", charging: "ぬめった刃が鈍く光る…！",
  },
  bladeDrill: {
    name: "回転刃掘り", shape: "around", mult: 2.5, color: "#dddddd",
    windup: "体を丸めて回転し始めた…", charging: "回転がうなりを上げている…！",
  },
  slimeFlame: {
    name: "ぬめ炎ブレス", shape: "sight", mult: 1.6, color: "#77ff55",
    windup: "喉がぼこぼこと泡立ち始めた…", charging: "緑色の炎が口からあふれそうだ…！",
  },
  scaleRush: {
    name: "竜鱗突進", shape: "single", mult: 3.5, color: "#ff6644",
    windup: "竜の鱗を逆立てて身を低くした…", charging: "鱗の隙間から炎が漏れている…！",
  },
  threadBlade: {
    name: "糸刃あやつり", shape: "single", mult: 1.6, hits: 2, color: "#e0c0ff",
    windup: "糸の先の刃がゆらりと浮かび上がった…", charging: "刃が糸に引かれて弧を描いている…！",
  },
  slimeFlap: {
    name: "ぬめ羽ばたき", shape: "around", mult: 2.0, color: "#99ffaa",
    windup: "ぬめった翼をばさばさと広げ始めた…", charging: "しずくが四方に飛び散りそうだ…！",
  },
  flameWingGale: {
    name: "炎翼旋風", shape: "sight", mult: 1.7, color: "#ff9944",
    windup: "炎の翼で空をあおぎ始めた…", charging: "熱い風が部屋中に渦巻いている…！",
  },
  needleHug: {
    name: "針山抱擁", shape: "single", mult: 3.2, color: "#ffaa66",
    windup: "トゲだらけの腕をゆっくり広げた…", charging: "腕の針がきしきしと鳴っている…！",
  },
  windmillSpin: {
    name: "風車ぐるま", shape: "around", mult: 2.3, color: "#bbeeff",
    windup: "腕を風車のように回し始めた…", charging: "回転がびゅうびゅうと風を切っている…！",
  },
};

// それぞれの技に自分のID（キー）を覚えさせておく（ログから技の説明を開く時などに使う）
for (var skillId in Game.SKILLS) Game.SKILLS[skillId].id = skillId;
