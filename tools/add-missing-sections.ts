/**
 * tools/add-missing-sections.ts
 * Stage 3-5 spec の各 chunk に Stage 1 形式の不足セクションを追加:
 *   - **取り巻き 3 パターン**: facade 沿い / 焦点囲み / 歩道沿い
 *   - **生活の痕跡 / スケール / 向き**: 痕跡 / スケール / 向き
 * 既存の "**Handoff" 直前に挿入。
 */
import * as fs from 'fs';

interface ChunkContent {
  ambient3patterns: string;  // 取り巻き 3 パターン
  livingTraceScaleOri: string;  // 生活の痕跡 / スケール / 向き
}

// Stage 3 の各 chunk 用テンプレート (Ch0-Ch11)
const STAGE3_CONTENT: ChunkContent[] = [
  { // Ch0: 駅 + バスターミナル
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 4 (公共・商店)、\`mailbox\` × 3 不均等
- 焦点囲み: 駅前広場の bench × 6 + flag_pole × 3 + flower_planter_row × 4
- 歩道沿い (avenue 両脇): \`street_lamp\` × 4、\`manhole_cover\` × 6 横断ゼブラ、\`bollard\` × 8`,
    livingTraceScaleOri: `- 痕跡: SW bicycle、SE bicycle、駅前 newspaper_stand
- スケール: 大 \`train_station\` / 中 \`bus_terminal_shelter\` × 2、\`convenience\`、\`cafe\` / 小 \`bench\` × 6・\`flag_pole\` × 3
- 向き: bench は station 向き、taxi_rank_sign は avenue 向き、parasol は cafe テラス向き`,
  },
  { // Ch1: カフェ + ATM + コンビニ
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 4 (青/緑/青/赤、各業種)、\`atm\` × 2 (bank)
- 焦点囲み: SW cafe テラスの parasol × 3 + bench × 3 + a_frame_sign
- 歩道沿い: \`street_lamp\` × 2、\`manhole_cover\` × 3、\`bicycle_rack\` × 2`,
    livingTraceScaleOri: `- 痕跡: NW mailbox、NE bicycle、SW bicycle、SE newspaper_stand
- スケール: 大 \`bank\`/\`office\` / 中 \`cafe\`/\`convenience\`/\`pharmacy\` / 小 \`parasol\` × 3・\`bench\` × 3
- 向き: parasol は外向き、a_frame_sign は通勤導線向き`,
  },
  { // Ch2: 高層雑居オフィス
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 5 (各オフィス)、\`flag_pole\` × 3
- 焦点囲み: NE 高層ビル前の flag_pole × 2 + statue + bollard × 4
- 歩道沿い: \`street_lamp\` × 2、\`bicycle_rack\` × 2`,
    livingTraceScaleOri: `- 痕跡: NW bicycle_rack、SW mailbox、SE mailbox、NE 痕跡控えめ (オフィス感)
- スケール: 大 \`apartment_tall\` / 中 \`office\` × 2・\`mansion\` × 2 / 小 \`flag_pole\` × 3・\`bollard\` × 4
- 向き: flag_pole は avenue 向き、a_frame_sign は 1F 入口向き`,
  },
  { // Ch3: 公共 3 連
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 3 (公共施設前)、\`atm\` × 2 (bank)、\`mailbox\` × 3
- 焦点囲み: 3 施設前の bench × 6 + flag_pole × 3 + flower_planter_row × 3
- 歩道沿い: \`manhole_cover\` × 6 横断、\`atm\` × 2、\`bicycle_rack\` × 2`,
    livingTraceScaleOri: `- 痕跡: 公共施設は痕跡控えめ、SW/SE mailbox + bicycle
- スケール: 大 \`city_hall\` / 中 \`post_office\`/\`bank\`/\`mansion\` / 小 \`flag_pole\` × 3・\`bench\` × 6
- 向き: flag_pole は avenue 向き、bench は施設入口向き`,
  },
  { // Ch4: 医療 3 連
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 3 (医療施設前)、\`a_frame_sign\` (pharmacy)
- 焦点囲み: 3 医療施設前の bench × 4 待合 + flower_bed × 4 + 救急車 \`car\`
- 歩道沿い: \`bicycle_rack\` × 3、\`recycling_bin\` × 2`,
    livingTraceScaleOri: `- 痕跡: 病院前 bicycle、薬局前 bicycle、recycling_bin
- スケール: 大 \`hospital\`/\`apartment_tall\` / 中 \`clinic\`/\`pharmacy\` / 小 \`bench\` × 4・\`flag_pole\` × 3
- 向き: bench は病院向き (待合)、car (救急車) は緊急口向き`,
  },
  { // Ch5: civic plaza 拡張
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 4 (各端)、\`mailbox\` × 2
- 焦点囲み: 中央広場の statue + fountain_large + bench × 8 + flag_pole × 4 + flower_bed × 6
- 歩道沿い: \`street_lamp\` × 4、\`manhole_cover\` × 4`,
    livingTraceScaleOri: `- 痕跡: 公共広場は痕跡控えめ、SE convenience の bicycle
- スケール: 大 \`library\`/\`museum\` / 中 \`bank\`/\`statue\`/\`fountain_large\` / 小 \`bench\` × 8・\`flag_pole\` × 4
- 向き: 中央広場の bench は statue 向き、各施設前 flag_pole は avenue 向き`,
  },
  { // Ch6: ツインタワー
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 4 (各オフィス)、\`flag_pole\` × 4
- 焦点囲み: NE ツインタワー前の statue + flag_pole × 2 + bollard × 6
- 歩道沿い: \`street_lamp\` × 2、\`bicycle_rack\` × 2`,
    livingTraceScaleOri: `- 痕跡: NE 痕跡控えめ (ガラスの威圧感)、SE bicycle_rack、SW flag_pole
- スケール: 大 \`tower\`/\`skyscraper\` / 中 \`office\` × 2・\`apartment_tall\` / 小 \`bollard\` × 6・\`flag_pole\` × 4
- 向き: flag_pole は avenue 向き、statue はビルロビー向き`,
  },
  { // Ch7: 中央広場 + 時計塔
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 2 (各オフィス)、\`flag_pole\` × 2
- 焦点囲み: 時計塔広場の bench × 8 + flag_pole × 2 + statue × 2 + flower_planter_row × 4
- 歩道沿い: \`street_lamp\` × 4、\`manhole_cover\` × 4`,
    livingTraceScaleOri: `- 痕跡: SW cafe の bicycle、SE bookstore の newspaper_stand
- スケール: 大 \`clock_tower\` / 中 \`office\` × 2・\`cafe\`/\`bookstore\` / 小 \`bench\` × 8・\`bollard\` × 8
- 向き: bench は時計塔向き、parasol は cafe 入口向き`,
  },
  { // Ch8: ラジオ塔
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 4 (オフィス)、\`flag_pole\` × 5
- 焦点囲み: SW radio_tower 基礎の bollard × 4 + barrier × 2
- 歩道沿い: \`street_lamp\` × 2、\`bicycle_rack\` × 2`,
    livingTraceScaleOri: `- 痕跡: NW bicycle、SE recycling_bin、痕跡控えめ
- スケール: 大 \`radio_tower\` (細長) / 中 \`office\` × 4 / 小 \`bollard\` × 4・\`barrier\` × 2
- 向き: 塔は天向き (垂直)、flag_pole は avenue 向き`,
  },
  { // Ch9: 大型百貨店
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` 大 (百貨店)、\`shop_awning\`、\`flower_planter_row\` × 4
- 焦点囲み: 百貨店前広場の banner_pole × 4 + parasol × 4 + bench × 6 + flower_bed × 4
- 歩道沿い: \`street_lamp\` × 4、\`bicycle_rack\` × 2`,
    livingTraceScaleOri: `- 痕跡: SW cafe bicycle、SE bakery bicycle、garbage 控えめ
- スケール: 大 \`department_store\` / 中 \`cafe\`/\`bakery\` / 小 \`parasol\` × 4・\`banner_pole\` × 4・\`bench\` × 6
- 向き: 銀河 sign は avenue 向き、parasol は店前向き`,
  },
  { // Ch10: ショッピングモール + cafe
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 3 (各店)、\`shop_awning\` × 3
- 焦点囲み: NE 中型百貨店の flower_planter_row × 2 + bench × 2 + parasol × 2
- 歩道沿い: \`street_lamp\` × 2、\`bicycle\` × 2`,
    livingTraceScaleOri: `- 痕跡: NW newspaper_stand、SW bicycle、SE bicycle (florist)
- スケール: 大 \`department_store\` (中型) / 中 \`bookstore\`/\`cafe\`/\`florist\` / 小 \`parasol\` × 4・\`flower_bed\` × 3
- 向き: parasol は店前、a_frame_sign は通勤導線向き`,
  },
  { // Ch11: 都市公園 + Stage 4 handoff
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\`、\`sign_board\` (NW office、NE gas_station)
- 焦点囲み: SW 都市公園の fountain + bench × 6 + flower_bed × 4 + statue
- 歩道沿い: \`street_lamp\` × 2、\`manhole_cover\` × 2`,
    livingTraceScaleOri: `- 痕跡: NE traffic_cone (ガソスタ)、SE oil_stained_concrete (Stage 4 予告)
- スケール: 大 \`gas_station\`/\`parking\` / 中 \`office\` / 小 \`bench\` × 6・\`flower_bed\` × 4
- 向き: bench は fountain 向き、traffic_cone は給油口向き`,
  },
];

function injectSections(specPath: string, contents: ChunkContent[]): void {
  let src = fs.readFileSync(specPath, 'utf8');

  // 後ろから順に処理 (insertion で位置がずれるのを防ぐ)
  for (let n = contents.length - 1; n >= 0; n--) {
    const chMarker = `### Ch${n}:`;
    const chStart = src.indexOf(chMarker);
    if (chStart < 0) continue;
    // 次のセクション or chunk までを範囲とする
    let chunkEnd = src.length;
    const nextCh = src.indexOf(`### Ch${n + 1}:`, chStart);
    const nextSec = src.indexOf(`# §`, chStart);
    if (nextCh > chStart) chunkEnd = nextCh;
    if (nextSec > chStart && nextSec < chunkEnd) chunkEnd = nextSec;

    const chunkSlice = src.slice(chStart, chunkEnd);
    if (chunkSlice.includes('**取り巻き 3 パターン**')) {
      console.log(`  Ch${n}: 既に追加済み、スキップ`);
      continue;
    }

    // 挿入位置: chunk 内の Handoff の前 or 道路の後
    let insertAt: number;
    const handoffIdx = src.indexOf('**Handoff', chStart);
    if (handoffIdx > chStart && handoffIdx < chunkEnd) {
      insertAt = handoffIdx;
    } else {
      // chunk 末尾 (次の chunk の手前) に挿入
      insertAt = chunkEnd;
      while (insertAt > 0 && src[insertAt - 1] === '\n') insertAt--;
      insertAt++;
    }

    const insertion = `**取り巻き 3 パターン**:
${contents[n].ambient3patterns}

**生活の痕跡 / スケール / 向き**:
${contents[n].livingTraceScaleOri}

`;
    src = src.slice(0, insertAt) + insertion + src.slice(insertAt);
    console.log(`  Ch${n}: 挿入完了 (位置 ${insertAt})`);
  }

  fs.writeFileSync(specPath, src);
}

// Stage 4 (HARBOR)
const STAGE4_CONTENT: ChunkContent[] = [
  { // Ch0: 港神社 + 桟橋
    ambient3patterns: `- facade 沿い (y=22): \`mailbox\` × 2 (chaya 茶屋)、\`sign_board\` × 2 (kura 蔵)
- 焦点囲み: NW 神社の torii + stone_lantern × 2 + offering_box + koma_inu × 2 + sando_stone_pillar × 2
- 歩道沿い: \`buoy\` × 3 (海岸線)、\`guardrail_short\` × 4`,
    livingTraceScaleOri: `- 痕跡: SE bicycle (kura 帰属)、SW 桟橋 drum_can
- スケール: 大 \`shrine\` / 中 \`kura\`/\`chaya\` / 小 \`stone_lantern\` × 2・\`buoy\` × 3
- 向き: torii は avenue 向き、koma_inu は内向き対、buoy は海面向き`,
  },
  { // Ch1: 漁市場通り
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 4 (各店)、\`chouchin\` × 2 (sushi_ya/chaya)
- 焦点囲み: 市場通りの forklift × 2 + pallet_stack × 4 + drum_can × 4
- 歩道沿い: \`signal_tower\`、\`barrier\` × 2 (作業区画)`,
    livingTraceScaleOri: `- 痕跡: SE 蔵の bicycle、SW 桟橋 buoy × 2
- スケール: 大 \`warehouse\` / 中 \`sushi_ya\`/\`chaya\`/\`ramen\` / 小 \`forklift\` × 2・\`pallet_stack\` × 4
- 向き: noren は店前向き、forklift は搬入口向き`,
  },
  { // Ch2: 造船所予兆
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 2 (warehouse)、\`barrier\` × 2 (危険警告)
- 焦点囲み: NE 造船所の water_tank × 4 + drum_can × 6 + signal_tower
- 歩道沿い: \`forklift\` × 2、\`pallet_stack\` × 4`,
    livingTraceScaleOri: `- 痕跡: NW dumpster、SE bicycle、SW cat
- スケール: 大 \`silo\` × 2・\`factory_stack\` / 中 \`warehouse\`/\`garage\` / 小 \`drum_can\` × 6
- 向き: factory_stack は天向き (煙突)、forklift は搬入口向き`,
  },
  { // Ch3: コンテナゲート
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 2 (ゲート)、\`signal_tower\` × 2
- 焦点囲み: ゲート前の barrier × 6 + traffic_cone × 8 + flag_pole × 2
- 歩道沿い: \`forklift\` × 4、\`signal_tower\` × 2`,
    livingTraceScaleOri: `- 痕跡: 工業区画は痕跡控えめ、各 warehouse 前 dumpster
- スケール: 大 \`warehouse\` × 2 / 中 \`container_stack\` × 3 / 小 \`barrier\` × 6・\`traffic_cone\` × 8
- 向き: signal_tower は天向き、barrier はヤード入口向き`,
  },
  { // Ch4: ガントリークレーン (クライマックス)
    ambient3patterns: `- facade 沿い (y=22): クレーン基礎 \`flag_pole\` × 2 頂上、\`signal_tower\` × 4 準対称
- 焦点囲み: ツインクレーン下の hazard_stripe 大 + barrier × 8 + bollard × 6
- 歩道沿い: \`forklift\` × 4、\`traffic_cone\` × 6`,
    livingTraceScaleOri: `- 痕跡: 痕跡なし (重工業の威圧感)
- スケール: 大 \`crane_gantry\` × 2 (h=78) / 中 \`container_stack\` × 6 / 小 \`signal_tower\` × 4・\`barrier\` × 8
- 向き: クレーンアームは avenue 跨ぎ、signal_tower は天向き`,
  },
  { // Ch5: コンテナ山 + 港湾線路
    ambient3patterns: `- facade 沿い (y=22): \`signal_tower\` × 2 (列車信号)、\`flag_pole\`
- 焦点囲み: コンテナ山 8 個 + signal_tower × 2 + barrier × 4
- 歩道沿い: \`railway_track\` × 7 (港湾線路、avenue 全幅 y=140)`,
    livingTraceScaleOri: `- 痕跡: 痕跡控えめ、forklift × 3 と drum_can が動線痕跡
- スケール: 大 \`container_stack\` × 8 / 中 \`silo\` × 2 / 小 \`drum_can\` × 6・\`railway_track\` × 7
- 向き: 線路は avenue 跨ぎ、container は積み重ね方向`,
  },
  { // Ch6: 製鉄所
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 2 (双煙突 x=-50/+50, y=8)、\`hazard_stripe\` 大
- 焦点囲み: 製鉄所の water_tank × 4 + drum_can × 8 + electric_box × 2 + cable_junction_box × 2
- 歩道沿い: \`forklift\` × 2、\`barrier\` × 6`,
    livingTraceScaleOri: `- 痕跡: 痕跡なし (重工業)
- スケール: 大 \`factory_stack\` × 2 (双煙突) / 中 \`silo\` × 3 / 小 \`drum_can\` × 8・\`rock\` × 4 (鉄屑)
- 向き: factory_stack は天向き、water_tank は配管向き`,
  },
  { // Ch7: 石油タンク群
    ambient3patterns: `- facade 沿い (y=22): \`silo\` × 8 (オイルタンク横一列)、\`hazard_stripe\` 全面
- 焦点囲み: タンクファームの water_tank × 6 + drum_can × 8 + pallet_stack × 4
- 歩道沿い: \`cable_junction_box\` × 4、\`signal_tower\` × 2`,
    livingTraceScaleOri: `- 痕跡: 痕跡控えめ
- スケール: 大 \`silo\` × 8 (タンク並び) / 中 \`water_tank\` × 6 / 小 \`drum_can\` × 8
- 向き: タンクは天向き、配管は接続向き`,
  },
  { // Ch8: 発電所 + 化学工場
    ambient3patterns: `- facade 沿い (y=22): \`factory_stack\` × 3 (大煙突 x=-100/0/100, y=22)
- 焦点囲み: 発電所の electric_box × 6 + cable_junction_box × 4 + fire_extinguisher × 4 + water_tank × 4
- 歩道沿い: \`power_pole\` × 4 (avenue 端、密)、\`hazard_stripe\` × 6`,
    livingTraceScaleOri: `- 痕跡: 痕跡なし (危険化学物質)
- スケール: 大 \`factory_stack\` × 3・\`silo\` × 2 / 中 \`warehouse\` / 小 \`electric_box\` × 6・\`fire_extinguisher\` × 4
- 向き: 煙突は天向き、化学プラント配管は工場間向き`,
  },
  { // Ch9: 廃工場 + 倉庫街
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` × 2 (warehouse 古看板)、\`barrier\` × 2
- 焦点囲み: NE 廃工場の dumpster × 2 + pallet_stack × 4 + drum_can × 6
- 歩道沿い: \`barrier\` × 2、\`traffic_cone\` × 2`,
    livingTraceScaleOri: `- 痕跡: NW dumpster、SE bicycle、SW cat × 2 (静寂)
- スケール: 中 \`warehouse\` × 4・\`garage\` × 2 / 小 \`dumpster\` × 2・\`pallet_stack\` × 4
- 向き: 廃工場の barrier は出入禁止向き、cat は様々`,
  },
  { // Ch10: 港湾事務所 + 守衛所
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 4 (消防・警察)、\`sign_board\` × 2
- 焦点囲み: 守衛所前の traffic_cone × 6 + bicycle_rack × 2 + bicycle × 4 + flag_pole × 4
- 歩道沿い: \`bench\` × 2、\`bollard\` × 4`,
    livingTraceScaleOri: `- 痕跡: bicycle_rack + bicycle × 4 (パトロール用)、SE bicycle
- スケール: 中 \`fire_station\`/\`police_station\`/\`gas_station\` / 小 \`traffic_cone\` × 6・\`flag_pole\` × 4
- 向き: flag_pole は avenue 向き、bicycle は出動口向き`,
  },
  { // Ch11: 港湾終端 + Stage 5 予兆
    ambient3patterns: `- facade 沿い (y=22): \`sign_board\` (warehouse)、\`chouchin\` × 4 (Stage 5 予告!)
- 焦点囲み: SE 茶屋『松』の noren × 2 + parasol × 2 + bench × 2 + flag_pole (赤)
- 歩道沿い: \`bollard\` × 2、\`hedge\` × 2 (Stage 5 への切替)`,
    livingTraceScaleOri: `- 痕跡: NW dumpster (Stage 4 余韻)、SE bicycle、SW cat × 2
- スケール: 中 \`chaya\`/\`wagashi\`/\`warehouse\`/\`garage\` / 小 \`chouchin\` × 4 (Stage 5 予告)・\`bench\` × 2
- 向き: chouchin は店前向き (赤の予告)、Stage 5 の祭り感を hint に`,
  },
];

// Stage 5 (CASTLE TOWN)
const STAGE5_CONTENT: ChunkContent[] = [
  { // Ch0: 鳥居ゲート + 大提灯
    ambient3patterns: `- facade 沿い (y=22): \`torii\` 中央 + \`chouchin\` 大 (上空 y=8 avenue 跨ぐ)
- 焦点囲み: 鳥居前の flag_pole × 4 + banner_pole × 4 + matsuri_drum × 2 + yatai × 4-6
- 歩道沿い: \`popcorn_cart\` × 2、\`bench\` × 4 (準対称、参拝待ち)`,
    livingTraceScaleOri: `- 痕跡: SW chaya × 2 + bench (家族客の溜まり)
- スケール: 大 \`torii\` 鳥居 / 中 \`chaya\`/\`wagashi\` / 小 \`yatai\` × 4-6・\`flag_pole\` × 4
- 向き: torii は avenue 向き、yatai は中央向き、bench は鳥居向き`,
  },
  { // Ch1: 屋台通り 1
    ambient3patterns: `- facade 沿い (y=22): yatai 上空 \`chouchin\` × 8、\`noren\` × 多
- 焦点囲み: 屋台 8 連 + parasol × 各屋台 + chouchin × 各屋台
- 歩道沿い: \`popcorn_cart\` × 2、\`balloon_cluster\` × 4 (上空)`,
    livingTraceScaleOri: `- 痕跡: 屋台店主 × 4-5、SW/SE chaya/wagashi 客
- スケール: 中 \`yatai\` × 8 / 小 \`chouchin\` × 多・\`noren\` × 多
- 向き: 屋台は中央向き、chouchin は上空、parasol は屋台に庇`,
  },
  { // Ch2: 屋台通り 2 + 抽選会
    ambient3patterns: `- facade 沿い (y=22): \`chouchin\` × 多、\`yatai\` 上段
- 焦点囲み: 中央 big_tent (抽選会) + fountain_pavilion + balloon_cluster × 4
- 歩道沿い: \`popcorn_cart\` × 2、\`bench\` × 周囲`,
    livingTraceScaleOri: `- 痕跡: 屋台店主 × 4、抽選参加者 × 4
- スケール: 大 \`big_tent\`/\`fountain_pavilion\` / 中 \`yatai\` × 7 / 小 \`balloon_cluster\` × 4
- 向き: 屋台は中央向き、big_tent は入口向き`,
  },
  { // Ch3: メリーゴーランド広場
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 2 (メリー頂上 y=58)、\`ticket_booth\` × 2
- 焦点囲み: ツインメリーの balloon_cluster × 4 + bench × 4 (準対称) + popcorn_cart × 2
- 歩道沿い: \`flower_planter_row\` × 4 (x=±170, y=80/170)、\`banner_pole\` × 2`,
    livingTraceScaleOri: `- 痕跡: 子供 × 8、観客 (big_tent 周辺)
- スケール: 大 \`carousel\` × 2 / 中 \`big_tent\` × 2 / 小 \`balloon_cluster\` × 4・\`bench\` × 4
- 向き: bench はメリー向き、メリーは天向き`,
  },
  { // Ch4: 盆踊り広場 (太鼓中央)
    ambient3patterns: `- facade 沿い (y=22): \`big_tent\` 太鼓櫓 + \`flag_pole\` × 3
- 焦点囲み: 太鼓 4 (中央十字) + 周囲 yatai × 8 + bench × 8 (観客輪)
- 歩道沿い: \`chouchin\` 上空大群 × 12 (avenue 全幅、y=8/22)、\`balloon_cluster\` × 4`,
    livingTraceScaleOri: `- 痕跡: 太鼓奏者 × 4 ★、観客 × 12 (bench)、屋台店主 × 4
- スケール: 大 \`big_tent\` (太鼓櫓) / 中 \`matsuri_drum\` × 4・\`yatai\` × 8 / 小 \`bench\` × 8・\`chouchin\` × 12
- 向き: 太鼓は中央向き、bench は太鼓向き、提灯は上空`,
  },
  { // Ch5: 公園休憩
    ambient3patterns: `- facade 沿い (y=22): 控えめ (静寂)
- 焦点囲み: 中央噴水周囲の bench × 8 (八方向) + flower_bed × 6 + tree × 4 + flower_planter_row × 4
- 歩道沿い: \`street_lamp\` × 2、\`balloon_cluster\` × 2 (上空)`,
    livingTraceScaleOri: `- 痕跡: SW yatai 客、SE chaya、cat × 1 (Stage 5 で唯一)
- スケール: 大 \`fountain\` / 中 \`tree\` × 4・\`yatai\` × 2 / 小 \`bench\` × 8・\`flower_bed\` × 6
- 向き: bench は fountain 向き、tree は周囲を囲む`,
  },
  { // Ch6: ジェットコースター
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 2 (頂上旗)、\`signal_tower\` × 2 (安全)
- 焦点囲み: ツインコースターの signal_tower × 2 + barrier × 4 (基礎) + ticket_booth × 2 + chaya × 2 + bench × 6 (待ち列)
- 歩道沿い: \`flower_planter_row\` × 2、\`flag_pole\` × 2`,
    livingTraceScaleOri: `- 痕跡: 観客 × 多 (big_tent 周辺)、行列 × 4-6
- スケール: 大 \`roller_coaster\` × 2 / 中 \`big_tent\` × 2・\`chaya\` × 2 / 小 \`signal_tower\` × 2・\`bench\` × 6
- 向き: コースターは上空向き、bench は発券所向き`,
  },
  { // Ch7: 大観覧車 ★ ランドマーク
    ambient3patterns: `- facade 沿い (y=22): \`balloon_cluster\` × 2 (頂上アクセント x=-15/+15, y=8)、\`banner_pole\` × 4
- 焦点囲み: 観覧車周囲の bench × 6 + flower_bed × 4 + flag_pole × 2 + chaya × 2
- 歩道沿い: \`flower_planter_row\` × 4`,
    livingTraceScaleOri: `- 痕跡: カップル × 多 (待ち列)、観光客
- スケール: 大 \`ferris_wheel\` ★ / 中 \`chaya\` × 2・\`big_tent\` × 2 / 小 \`balloon_cluster\` × 2・\`bench\` × 6
- 向き: 観覧車は天向き、bench は観覧車向き`,
  },
  { // Ch8: 第 2 コースター + カーニバル
    ambient3patterns: `- facade 沿い (y=22): \`flag_pole\` × 2、\`balloon_cluster\` × 4 (上空)
- 焦点囲み: ツインコースター + 中央 carousel + ticket_booth × 2 + signal_tower × 2
- 歩道沿い: \`bench\` × 6 (待ち列)、\`flower_planter_row\` × 2`,
    livingTraceScaleOri: `- 痕跡: カップル × 多、子供 × 中、観客 × 多
- スケール: 大 \`roller_coaster\` × 2 / 中 \`carousel\`/\`big_tent\` × 2 / 小 \`signal_tower\` × 2・\`bench\` × 6
- 向き: コースターは上空向き、carousel は中央回転`,
  },
  { // Ch9: テント + バルーンアーチ
    ambient3patterns: `- facade 沿い (y=22): \`big_tent\` × 4 (準対称)、\`balloon_cluster\` × 6 (上空不均等)
- 焦点囲み: 中央 fountain_pavilion + carousel + 周囲 bench × 多
- 歩道沿い: \`popcorn_cart\` × 4、\`chouchin\` 上空大群 × 8`,
    livingTraceScaleOri: `- 痕跡: 観客 × 多 (テント周辺)、屋台客
- スケール: 大 \`big_tent\` × 4・\`fountain_pavilion\` / 中 \`carousel\` / 小 \`balloon_cluster\` × 6・\`popcorn_cart\` × 4
- 向き: テントは中央向き (ショー)、balloon は上空`,
  },
  { // Ch10: クライマックス前集約
    ambient3patterns: `- facade 沿い (y=22): \`yatai\` 上空 \`chouchin\` × 多、\`flag_pole\` × 4 (城方向指す)
- 焦点囲み: 中央 carousel + big_tent × 2 + matsuri_drum × 2 (Ch11 予告)
- 歩道沿い: \`popcorn_cart\` × 2、\`bench\` × 多`,
    livingTraceScaleOri: `- 痕跡: 観客 × 多、太鼓奏者 × 2 (予告)、子供 × 多
- スケール: 中 \`big_tent\` × 2・\`carousel\`/\`yatai\` × 多 / 小 \`matsuri_drum\` × 2・\`balloon_cluster\` × 4
- 向き: flag_pole は南向き (城方向)、太鼓は中央向き`,
  },
  { // Ch11: 天守閣 GOAL
    ambient3patterns: `- facade 沿い (y=22): \`balloon_cluster\` × 11 (天頂)、\`banner_pole\` × 5 (旗ガーランド)、\`flag_pole\` × 3
- 焦点囲み: 城前応援団の応援メリー × 2 (x=±117) + 太鼓 × 4+4 + yatai × 8 (城前左右)
- 歩道沿い: \`sakura_tree\` × 2 (参道、x=±30, y=88)、\`flower_bed\` × 4、\`street_lamp\` × 2`,
    livingTraceScaleOri: `- 痕跡: 儀式参加者 × 12 ★、太鼓奏者 × 4
- スケール: 大 \`castle\` ★★ (w=70 h=110) / 中 \`carousel\` × 2・\`big_tent\` × 2 / 小 \`matsuri_drum\` × 8・\`balloon_cluster\` × 11
- 向き: 城は南向き (王座)、応援メリーは城向き、太鼓は城向き、桜は参道側に開花`,
  },
];

console.log('Stage 3:');
injectSections(
  '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 3 街レイアウト v1 1 Stage1形式準拠版 b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7.md',
  STAGE3_CONTENT,
);

console.log('\nStage 4:');
injectSections(
  '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 4 街レイアウト v1 0 設計指示書 c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8.md',
  STAGE4_CONTENT,
);

console.log('\nStage 5:');
injectSections(
  '/home/user/kaiju-rampage/指示書/怪獣ランページ — Stage 5 街レイアウト v1 0 設計指示書 d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9.md',
  STAGE5_CONTENT,
);

console.log('\n全 Stage sections 追加完了');
