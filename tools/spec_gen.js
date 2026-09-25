// 仕様書（docs/spec の monsters.md・skills.md・items.md）をゲームのデータから作り直す道具。Claude が使う（ゲーム本体には入らない）。
//   node tools/spec_gen.js            … docs/spec に書き出す（「要望:」は空に戻る）
//   node tools/spec_gen.js 出力先     … 別の場所に書き出す。docs/spec と diff すると「ユーザーが書き換えた値」がわかる
const fs = require("fs");
const outDir = process.argv[2] || "docs/spec";
fs.mkdirSync(outDir, { recursive: true });
var src=['js/config.js','js/data/skills.js','js/data/monsters.js','js/data/dungeons.js','js/data/breeding.js','js/items.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
eval(src+';global.Game=Game;');
const C=Game.config, M=Game.MONSTERS, S=Game.SKILLS, D=Game.DUNGEONS;
function groups(file, obj){ // コメントの見出しで分類
  const lines=fs.readFileSync(file,'utf8').split('\n'); let g='その他', out=[];
  for(const l of lines){ let m=l.match(/^  \/\/ ---- (.+?) ----/); if(m){g=m[1];continue;}
    m=l.match(/^  (\w+): \{/); if(m&&obj[m[1]]) out.push([g,m[1]]); }
  return out;
}
const shapeName={single:'隣の1体',around:'隣の全員',sight:'見えている全員',range:'近くの見えている全員'};
function where(id){const r=[];for(const k in D){const d=D[k];if(d.boss===id)r.push(d.name+' 最下層（ボス）');
  (d.spawns||[]).forEach(s=>{if(s.type===id)r.push(d.name+' B'+s.from+'F〜B'+(s.to||d.floors)+'F');});}
  Game.BREEDING.forEach(b=>{if(b.child===id)r.push('交配：'+M[b.parents[0]].name+' ＋ '+M[b.parents[1]].name);});
  return r.join(' / ')||'（なし）';}
// ---- モンスター ----
let o=['# モンスター仕様書','','> 直したい所は、その行の値を書き換えるか、`- 要望:` の後ろに文章で書いてください。','> 書き方のルールは [README.md](README.md)。技の中身は [skills.md](skills.md)。','',
'共通：HP・攻撃力・防御力・経験値は「レア度1の時の基準値」。実際の強さはレア度の倍率（1.0 / 1.3 / 1.7 / 2.2 / 3.0）がかかる。',''];
let last=null;
for(const [g,id] of groups('js/data/monsters.js',M)){const t=M[id];if(g!==last){o.push('## '+g,'');last=g;}
  const r=C.rarities[t.rarity], feat=[];
  if(t.phasing)feat.push('壁抜け');if(t.breath)feat.push('ブレス');if(t.humanoid)feat.push('人型');if(t.element==='water')feat.push('水属性');if(t.breedOnly)feat.push('交配のみ');if(t.boss)feat.push('ボス');
  o.push('### '+t.name+'（'+id+'）','- 段階: '+(t.stage||'-'),'- レア度: '+t.rarity+'（'+r.label+'）',
  '- HP: '+t.hp,'- 攻撃力: '+t.atk,'- 防御力: '+t.def,'- 経験値: '+t.exp);
  if(t.growth)o.push('- 成長（Lvごと）: HP+'+t.growth.hp+' 攻撃力+'+t.growth.atk);
  o.push('- 技: '+(t.skills||[]).map(s=>S[s]?S[s].name:s).join('、'));
  if(t.evolvesTo)o.push('- 進化: Lv'+t.evolveLevel+' で '+M[t.evolvesTo].name);
  if(t.enemyEvoExp)o.push('- 敵として進化に必要な経験値: '+t.enemyEvoExp);
  o.push('- 特徴: '+(feat.join('、')||'なし'),'- 出る場所: '+where(id),'- 要望: ','');}
fs.writeFileSync(outDir+'/monsters.md',o.join('\n'));
// ---- 技 ----
o=['# 技の仕様書','','> 直したい所は、その行の値を書き換えるか、`- 要望:` の後ろに文章で書いてください。','','共通：敵は予兆のあと2ターン溜めてから使う。主人公・仲間が1回で受けるダメージは最大HPの60%まで。',''];last=null;
const users=id=>Object.keys(M).filter(m=>(M[m].skills||[]).includes(id)).map(m=>M[m].name).join('、')||'（なし）';
for(const [g,id] of groups('js/data/skills.js',S)){const s=S[id];if(g!==last){o.push('## '+g,'');last=g;}
  o.push('### '+s.name+'（'+id+'）','- 範囲: '+(shapeName[s.shape]||s.shape)+(s.range?'（'+s.range+'マス）':''),'- 威力: 攻撃力×'+s.mult+(s.hits?'　×'+s.hits+'回':''),
  '- 予兆1: '+(s.windup||''),'- 予兆2: '+(s.charging||''),'- 使う種類: '+users(id),'- 要望: ','');}
fs.writeFileSync(outDir+'/skills.md',o.join('\n'));
// ---- アイテム ----
const T=Game.items.types,GL=Game.items.groupLabels;
o=['# アイテム仕様書','','> 直したい所は、その行の値を書き換えるか、`- 要望:` の後ろに文章で書いてください。','',
'## レア度と出やすさ','','| レア度 | 名前 | 出やすさ |','|---|---|---|'];
for(const k in C.itemRarities)o.push('| '+C.itemRarities[k].stars+' '+k+' | '+C.itemRarities[k].label+' | '+C.itemRarities[k].spawn+' |');
o.push('','強い・便利な物ほどレア度を高くして出にくくする。1階に落ちている数は '+C.dungeon.minItems+'〜'+C.dungeon.maxItems+' 個。','',
'## ボスへの状態の効き方','','- 弱体（技封じ・ひるみ・放逐）: 効かない','- 眠り: 最大'+C.bossResist.sleepTurns+'ターン','- 状態異常（毒・麻痺・出血など。将来）: ターン数×'+C.bossResist.ailmentMul+'（最低1ターン）','- 要望: ','');
for(const g of Game.items.groupOrder){o.push('## '+GL[g],'');for(const id in T){const t=T[id];if(t.group!==g)continue;
  o.push('### '+t.name+'（'+id+'）','- レア度: '+t.rarity+'（'+C.itemRarities[t.rarity].label+'）','- 効果: '+t.desc);
  if(t.weapon)o.push('- 武器: 攻撃力+'+t.weapon.atk+(t.weapon.hit?'　命中'+(t.weapon.hit>0?'+':'')+Math.round(t.weapon.hit*100)+'%':'')+(t.weapon.pierce?'　防御無視':'')+(t.weapon.stun?'　ひるみ'+Math.round(t.weapon.stun*100)+'%':''));
  if(t.charges)o.push('- 回数: '+t.charges+'　届く距離: '+t.range+'マス');
  o.push('- 投げて当てた時: '+({heal:'相手が回復',atkUp:'相手の攻撃力+1',bonk:C.throwBonkDamage+'ダメージ'}[t.throwEffect]),'- 要望: ','');}}
fs.writeFileSync(outDir+'/items.md',o.join('\n'));
