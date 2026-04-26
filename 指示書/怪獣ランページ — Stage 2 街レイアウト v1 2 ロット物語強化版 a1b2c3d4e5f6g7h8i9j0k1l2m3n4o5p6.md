# 怪獣ランページ — Stage 2 街レイアウト v1.2 ロット物語強化版

<aside>
📋

**このドキュメントの位置づけ（v1.2 ロット物語強化版）**

Stage 2「夜の歓楽街 NEON DISTRICT」の **再配置のための設計指示書**。Stage 1 v6.3 と同じフォーマット。

**Stage 1 v6.3 の §2 / §4 / §5 / §6 / §6.5 / §6.6 はそのまま継承**。Stage 2 では Stage 固有のコンセプト・取り巻き辞書・連続軸を §1 / §3 / §4.5 / §6.5 で書き直す。

**v1.2 で追加**: §4.6「ロット単位の物語デザイン」を新設。各セルを **2-4 ロットに分け、各ロットに 1 行のキャラを与え、建物・取り巻き・ground を物語で紐付ける** 設計法を明文化（Stage 1 Ch0「古民家邸 = kominka 母屋 + kura 蔵 + chaya 茶屋 + 庭」のような深さを再現）。§9 各チャンクに「ロット内訳」セクションを追加。

</aside>

<aside>
🌙

**Stage 2 のテーマ宣言**

Stage 1 末尾の踏切（Ch11）を越えると、街が **夜** に切り替わる。ネオンサインの色温度、濡れた路面の puddle_reflection、提灯の連続帯が支配する **夜の歓楽街**。プレイヤーは怪獣としてサラリーマン街→ラブホテル街→屋台横丁→静寂の神社へと進み、Stage 3「都心オフィス街」（朝）への引き渡しを担う。

**コアトーン**: 雑多 / 高密度 / 赤と青のネオン / 雨上がりの濡れた路面 / 提灯と暖簾の温かい光 / 看板の重なり

</aside>

<aside>
🆕

**v1.0 → v1.1 → v1.2 の変更点**

- **v1.0**: 方針確立。4 Acts × 12 chunks、SemanticCluster、`_AVE` 固定の道路ポリシー
- **v1.1（実装ラウンド）**: 密度目安「建物 20-30 / 家具 80-120 / 人 10-22 / ground 5-8」を満たすため建物・家具を 2.7-3.5 倍に増やし、ground 多様化を実施
- **v1.2（本版）**: **§4.6 ロット単位の物語デザインを新設**。Stage 1 Ch0 のような「邸 = 母屋+蔵+茶屋+庭」レベルの **ロット単位の意味付け** を Stage 2 にも要求。§9 各チャンクに「ロット内訳」を追加し、各セルを 2-4 ロットに分けて物語を宣言する形式に。`v1.1` の実装は密度を満たしたが「業種別建物の羅列」になっており、ロット間の関係性・地面差・境界が薄かった。本版でその不足を仕様レベルで補強する。

</aside>

---

# §1 Stage 2 の実コンセプト

## 全体像

- タイトル: **夜の歓楽街** (NEON DISTRICT)
- 12 チャンク（北→南、y=2400 → 4800、Stage 1 末尾を継ぐ）
- プレイヤーは怪獣として **夜の街** を横断する
- チャンク高さ = 200（ローカル dy ∈ [0, 200]）
- 世界幅 X ∈ [-180, +180]

## 4 Acts

| Act | チャンク | テーマ | 既存シグネチャ要素 |
| --- | --- | --- | --- |
| Act I | Ch0-2 | 駅前繁華 | 終電の駅 / ラーメン+居酒屋 / ビジネスホテル |
| Act II | Ch3-5 | 歓楽街最盛期 | カラオケ / パチンコ / 交番 / 雑居ビル |
| Act III | Ch6-8 | ホテルと屋台 | ラブホテル / 屋台横丁 / 映画館 / クラブ |
| Act IV | Ch9-11 | 静寂への転換 | 駐車場 / 神社の裏手 / 夜明け前 (Stage 3 handoff) |

## 既存の連続軸

- 主要通り x=0 のファサード連続（Stage 1 から継承）
- **提灯帯 chouchin** Ch0-Ch7（避けが y=22 facade 線、または店前 y=56-90 の高さで連続）
- **暖簾 noren** Ch1-Ch7（飲食店の入口に集約、店前 y=28-32）
- **puddle_reflection** 全チャンク（夜の濡れた路面、focal cell の access として）
- **街灯ネオン (street_lamp + sign_board)** Ch1-Ch8 の avenue 沿い
- 縦道路は **中央 `_AVE`（x=0 avenue）のみを基本骨格**（Stage 1 v6.2 方針継承）
- ground 基調は **asphalt**（夜の濡れた歩道感）。focal cell のみ `tile` / `concrete` / `red_carpet`（club/love_hotel）で強調

## 時間帯と人流グラデ

| Act | 時間帯 | 人流 |
| --- | --- | --- |
| Act I | 終電 23:00 | サラリーマン (adult_m × 多)・終電客 (adult_m,f mix) |
| Act II | 23:30 | 飲み客・ホスト/ホステス・客引き |
| Act III | 0:30 | 酔客・カップル・屋台の店主・帰宅組 |
| Act IV | 3:00-5:00 | 野良猫・寝静まる路地・神社の参拝者（早朝） |

---

# §3 Act レベル方針

## Act I — 駅前繁華（Ch0-2）

**テーマ**: Stage 1 末尾の踏切から、再開発された地方駅の北口ロータリーへ。「終電が出たばかり」のしっとりした賑わい。

- **Ch0**: train_station + bus_terminal_shelter / taxi_rank_sign / ラーメン店からの蒸気
- **Ch1**: ラーメン+居酒屋+カラオケが並ぶ「終電後の食事街」
- **Ch2**: 商店街アーケード入口、提灯ガーランドが avenue 全幅を覆う

**人流**: サラリーマン × 多、終電客 × 中、客引き × 少
**連続軸**: chouchin 帯 (上段 y=22 / 下段 y=118)、puddle_reflection 散在

## Act II — 歓楽街最盛期（Ch3-5）

**テーマ**: ネオン看板が乱立する高密度の雑居ビル街。カラオケ・パチンコ・クラブの 1F 店舗群と、上層階のオフィス/雀荘の重ね合わせ。

- **Ch3**: 高層雑居ビル（karaoke / club / business_hotel）の縦に伸びるファサード
- **Ch4**: パチンコ + 交番の交差点、客引き多数（**hero merged: 6 セル全部に焦点**）
- **Ch5**: 老舗飲み屋横丁 + ビジネスホテル + 銀行カプセルホテル

**人流**: 飲み客 × 多、ホスト/ホステス × 中、警察官 × 1 (交番前)
**連続軸**: ネオン sign_board が avenue 沿いに連続、雑居ビル ファサード y=22-90 の縦帯

## Act III — ホテルと屋台（Ch6-8）

**テーマ**: ラブホテル街、屋台横丁、映画街。賑わいのピークを過ぎ、人が裏路地に流れ込む時間帯。

- **Ch6**: ラブホテル区画 + クラブ街、ピンク・赤のネオン
- **Ch7**: 屋台横丁、yatai × 5 が中央に集約された夜店通り（**hero NW**）
- **Ch8**: 映画館 + ミニシアター街、ポスター看板の重なり

**人流**: 酔客 × 多、カップル × 中（Ch6）、屋台店主 × 1-2 / 屋台 (Ch7)、映画客 × 中
**連続軸**: yatai 帯 (Ch7 中央)、movie_theater のネオン (Ch8)

## Act IV — 静寂への転換（Ch9-11）

**テーマ**: 賑わいが消え、駐車場・廃屋・夜明け前の神社へ。Stage 3「都心オフィス街」（朝）への handoff を作る。

- **Ch9**: 駐車場 + 裏通り、夜風が吹く静かな区画
- **Ch10**: 古い住宅 + 神社の裏手、stone_pavement と落ち葉
- **Ch11**: 小さな神社の表参道、torii と石灯籠（朝靄予告、Stage 3 handoff）

**人流**: 野良猫 × 多、深夜の散歩客 × 少、参拝者 × 1（早朝、Ch11）
**連続軸**: chouchin → 街灯のみへ移行、puddle_reflection 増加（朝霧の予兆）、ground が `asphalt` → `stone_pavement` へグラデ

## Act 間の連続軸サマリ

- 桜並木は Stage 1 で終わり、Stage 2 では **chouchin 帯** が連続軸
- 電柱+電線は Stage 1 から継続、ただし夜は **cable_junction_box** が増える（電気街の表現）
- 人流は **adult_m 多 → adult_f 中 → cat 多 → 早朝参拝者** とグラデ
- ground は **asphalt 全面 → stone_pavement (Ch10-11) へ夕焼け** を示唆

---

# §3.6 ヒーロー / アンビエント階層（Stage 2 固有のジグザグ流れ）

| Chunk | ヒーロー位置 | テーマ |
| --- | --- | --- |
| Ch0 | NE | train_station |
| Ch1 | SW | ラーメン+居酒屋 (3連飲食) |
| Ch2 | NW+NE merged | 商店街アーケード入口 |
| Ch3 | NE | karaoke 高層雑居ビル |
| Ch4 | merged (全マージ) | パチンコ+交番交差点（クライマックス） |
| Ch5 | SW+SE merged | 飲み屋横丁 |
| Ch6 | NW | ラブホテル街 |
| Ch7 | NW+NE merged | 屋台横丁 |
| Ch8 | SE | 映画館 |
| Ch9 | NE | 駐車場 (静寂転換) |
| Ch10 | SW | 古い住宅+神社の裏 |
| Ch11 | NE | 神社表参道 (Stage 3 handoff) |

**Stage 2 のクライマックス**: Ch4 全マージ（パチンコ+交番）。これが Stage 2 全体の視覚的ピーク。Ch7 屋台横丁が二次クライマックス。

---

# §4.5 Stage 2 固有の建物→取り巻き辞書

| 建物 | 必須取り巻き | 補助取り巻き | 痕跡 |
| --- | --- | --- | --- |
| `train_station` | platform_edge + railway_track + bus_stop + taxi_rank_sign | flag_pole + bench × 2 + flower_planter_row | newspaper_stand |
| `ramen` | chouchin × 2 + noren + a_frame_sign | bicycle_rack + milk_crate_stack | bicycle |
| `izakaya` | chouchin × 2 + noren + a_frame_sign | sign_board + bench | garbage |
| `karaoke` | sign_board (大) + chouchin + a_frame_sign | bicycle_rack + vending | recycling_bin |
| `pachinko` | sign_board (大、ネオン) + a_frame_sign × 2 + chouchin | bench (待ち客) + traffic_cone | garbage + dumpster |
| `mahjong_parlor` | sign_board (緑、老舗) + noren | wood_fence + potted_plant | bicycle |
| `business_hotel` | sign_board (青、英字) + flag_pole | flower_planter_row + bench | mailbox |
| `capsule_hotel` | sign_board (タワー) + a_frame_sign | newspaper_stand + vending | garbage |
| `love_hotel` | sign_board (ピンク・赤) + parasol | hedge (高め、目隠し) + flower_bed | (痕跡控えめ) |
| `club` | sign_board (黒+金) + parasol + flag_pole | hedge + bollard | recycling_bin |
| `snack` | chouchin (ピンク) + noren + a_frame_sign | potted_plant + ac_unit | garbage |
| `movie_theater` | sign_board (大、ポスター見立て) + banner_pole × 2 | flag_pole + flower_planter_row | bench |
| `bank` | flag_pole + atm + flower_planter_row | bench + post_box | (痕跡控えめ) |
| `police_station (koban)` | flag_pole (×2) + traffic_cone (×2) + bicycle_rack | bench + post_box | bicycle |
| `convenience` | shop_awning + a_frame_sign + vending + bicycle_rack | parasol + newspaper_stand | bicycle + garbage |
| `yatai` (家具) | parasol + chouchin + popcorn_cart (jpn 屋台はないので近似) | bench (客 1-2) + balloon_cluster | (店主が痕跡) |
| `shrine` (Stage 末尾) | torii + stone_lantern × 2 + ema_rack + omikuji_stand | bamboo_water_fountain + sando_stone_pillar × 2 | fallen_leaves (ground) |

**ネオン色の使い分け（sign_board の見立て）**:
- 赤・ピンク → snack / love_hotel / pachinko
- 青・緑 → business_hotel / mahjong_parlor / bank
- 黄・橙 → karaoke / ramen / izakaya
- 黒・金 → club / movie_theater / capsule_hotel

---

# §4.6 ロット単位の物語デザイン（最重要原則・Stage 1 流の深さを Stage 2 にも）

<aside>
🏘️

**最重要原則**: 各セル（NW / NE / SW / SE / merged）は **「業種別建物の羅列」ではなく「2-4 個のロットがそれぞれ物語を持つ集合体」** として設計する。各ロットに **1 行のキャラ宣言** を与え、建物・取り巻き家具・ground・境界を **物語で紐付ける**。

</aside>

## Stage 1 のお手本（参考）

Stage 1 Ch0 NW セルの「古民家邸」は単一ロットで一体設計:

```
NW ロット 1: 古民家邸 (一体設計、grass 大パッチ上)
  - 物語: 「街道の左手に見える古民家、母屋・蔵・茶屋が一族の屋敷を成す」
  - 建物: kominka 母屋 (-90, 60) + kura 蔵 (-145, 30) + chaya 茶屋 (-30, 70)
  - 取り巻き: koi_pond + stepping_stones×3 + pine_tree×2 + stone_lantern + bonsai×3 + cat×2
  - ground: grass 大 (160×100) + wood_deck 縁側 + dirt 飛び石路 + fallen_leaves
  - 境界: wood_fence (邸を avenue から区切る、x=-15 縦帯)
```

Stage 1 Ch0 SW は 3 ロットに分割:

```
SW ロット 1: 伝統町家「machiya」(-150, 130)  — 「石灯籠と盆栽の伝統の家」
SW ロット 2: 子育て家庭の house (-90, 130)    — 「自転車2台と花壇のある家」
SW ロット 3: 若夫婦の townhouse (-45, 130)    — 「自転車置き場と多くの植木」
裏路地 (dy=178): 各ロットの裏に shed/kura/garage を帰属させる
```

→ **ground もロット別**: machiya 前 = grass+dirt 石庭 / house 前 = tile / townhouse 前 = concrete

## Stage 2 への適用ルール

### ルール 1: 各セルを 2-4 ロットに分割

| ロット数 | 用途 |
| --- | --- |
| 1 ロット | merged hero の大型単一施設（Ch4 パチンコ街、Ch7 屋台横丁、Ch11 神社参道） |
| 2 ロット | hero セル（NE 駅前 = 駅舎 + ロータリー など） |
| 3-4 ロット | ambient セル（複数業種の混在） |

### ルール 2: 各ロットに「1 行のキャラ宣言」を与える

業種だけでなく **「誰の店か」「どんな客が来るか」「いつの時代か」** を含める:

- ❌ 悪例: 「business_hotel」
- ✅ 良例: 「ビジネスホテル『ステーションイン』 — 出張サラリーマンが深夜チェックインする無機質な箱」

- ❌ 悪例: 「snack」
- ✅ 良例: 「スナック『夢』 — ピンクの提灯を 30 年掛け続けるママの店」

- ❌ 悪例: 「pachinko」
- ✅ 良例: 「パチンコ『キング』 — 7 階建ての巨大ネオン、深夜営業の常連客行列」

### ルール 3: 建物 2-4 棟をロット内で物語的に繋ぐ

ロット内の建物は **関係性で紐付ける**:

- 例: 「ビジネスホテル + 隣接コインランドリー + 1F のコンビニ」= 出張族の生活インフラ
- 例: 「スナック × 3 + 雀荘 1」= 横丁の夜店集合
- 例: 「ラブホテル × 2 + クラブ + 駐車場」= 歓楽トライアングル

「同じ業種の建物を 3 軒並べる」は避ける（クラブ × 3、業務店 × 4 など）。**業種を混ぜて生活感を出す**。

### ルール 4: 取り巻き家具で物語を補強

§4.5 取り巻き辞書を **ロット個性に応じてカスタマイズ**:

- ビジネスホテル: 青ネオン sign_board + flag_pole + atm + 自販機 (機能的)
- スナック: ピンク chouchin + noren + potted_plant 不揃い + bicycle 1 台 (生活感)
- ラブホ: ピンク sign_board + parasol + hedge 高め目隠し + 痕跡控えめ (匿名性)
- 雀荘: 緑 sign_board + noren + bicycle × 3 (老舗常連感)
- パチンコ: 巨大ネオン sign_board + a_frame_sign × 3 + traffic_cone (待ち列誘導)

### ルール 5: ロット ground を変える（**最重要**、ロット境界を地面で読ませる）

各ロットに **個別の ground type** を与える:

| ロット種別 | ground (基本) | アクセント |
| --- | --- | --- |
| ビジネスホテル | tile (60×40) | flower_planter 少 |
| スナック / 居酒屋 | concrete (50×40) | oil_stained_concrete (路地裏) |
| ラブホテル | red_carpet (60-100×40) | hedge 目隠し |
| クラブ | red_carpet 黒系 | parasol |
| 雀荘 / カラオケ | tile or concrete | bicycle_rack |
| 屋台 | red_carpet 大 + concrete (周囲) | wood_deck (休憩) |
| 神社境内 | stone_pavement + moss + gravel + fallen_leaves | bamboo_water_fountain |
| 古民家・町家 | grass + dirt 庭石 | stone_pavement 参道 |
| 駅前 | concrete + tile (ホーム) + asphalt (バス導線) | — |

**全 chunk で 5-8 種の ground を使う** が必達条件。

### ルール 6: ロット境界要素

ロット間の境界を視覚化（小さくても 1-2 個必ず）:

| 境界要素 | 用途 |
| --- | --- |
| `hedge` | ラブホ目隠し、住宅街、神社境内 |
| `wood_fence` | 古い住宅・蔵、裏路地区切り |
| `bamboo_fence` | 神社境内 (Ch10-11) |
| `flower_planter_row` | 公共広場、ホテル前 |
| `bollard` × 2-4 | 商業ロット間（避難 / 駐車禁止） |
| `barrier` | パチンコ列、駐車場入り口 |
| `wood_fence` 短い縦 (x=-178/178/0 等) | 裏路地への境界 |

### ルール 7: ロット間の「avenue 沿いファサード」を意識

すべてのロットは **avenue 側に「店構え」を作る**:
- 上段セル (NW/NE): facade 線 y=22 で `sign_board` / `chouchin` / `noren` / `shop_awning`
- 下段セル (SW/SE): facade 線 y=118 で同様

ファサード家具の **色** はロットキャラに応じて:
- 赤・ピンク: スナック / ラブホ / パチンコ
- 緑: 雀荘 / 薬局
- 青: ビジネスホテル / 銀行
- 黄: ラーメン / カラオケ
- 黒+金: クラブ / 高級店

## ロット設計のチェックリスト（実装時必読）

各 chunk を書くとき、以下を **すべて埋める**:

- [ ] 各セルに何ロットか宣言（NW: 3 ロット、NE: 2 ロット …）
- [ ] 各ロットに 1 行キャラ（誰の店 / どんな客 / 時代感）
- [ ] 各ロットの建物 2-4 棟（業種を混ぜる、3 連同業種は避ける）
- [ ] 各ロットの取り巻き 5-15 個（§4.5 辞書 + キャラ補強）
- [ ] **各ロットに固有 ground**（少なくとも基本タイル変更）
- [ ] 各ロット境界に hedge/fence/planter (1-2 個)
- [ ] avenue ファサード（sign_board 色をキャラと整合）
- [ ] livingTrace を各セル 1 個（ロットキャラと整合）

このチェックリストが埋まらない場合は **Stage 1 のクオリティに届いていない**。再設計せよ。

---

# §5 Stage 2 の道路設計（Stage 1 v6.2 ポリシー継承）

**Stage 2 でも固定するのは中央 `_AVE`（x=0 縦軸）のみ**。横道路（`_MID_HR` 含む）と他の縦道路はチャンクのコンセプトに沿って都度設計する。

## Act ごとの道路性格

| Act | 道路性格 | 設計のヒント |
| --- | --- | --- |
| Act I 駅前 | 駅前ロータリー、バス導線 | Ch0 は `_AVE` のみ + 駅前広場を `asphalt` ground で広場化（道路セグメントを増やさない）。Ch1-2 は `_AVE` + `_MID_HR`。 |
| Act II 歓楽街 | 高密度、雑居ビル間の細い裏道 | Ch3-5 は `_AVE` + `_MID_HR` + 雑居ビル間の `_VR(±90, 0, 100)` 短い裏道 1-2 本（必要なチャンクのみ）。 |
| Act III ホテル+屋台 | 屋台が中央に集まるため道路は減らす | Ch6-7 は `_AVE` のみ（屋台は道路ではなく ground/家具で表現）。Ch8 は `_AVE` + `_MID_HR`。 |
| Act IV 静寂 | 道路が減り、stone_pavement の参道が登場 | Ch9 は `_AVE` + `_MID_HR`、Ch10-11 は `_AVE` のみ + 参道を `stone_pavement` ground 帯で表現。 |

## 道路に置かない / 置くべきもの

- **ネオン看板の重なり**は道路ではなく facade y=22-90 の縦帯で表現
- **屋台横丁** (Ch7) は中央広場として `tile` / `red_carpet` ground で広場化、道路は最小限
- **駅前ロータリー** (Ch0) は `asphalt` 大パッチ + `bus_stop` / `taxi_rank_sign` 家具で表現
- **客引き・酔客の溜まり**は `_MID_HR` 沿いに humans を配置

---

# §6.5 Stage 2 で使う実 union（建物・家具・地面）

## 建物 (BuildingSize)

**主役（Stage 2 で多用）**: `train_station` / `ramen` / `izakaya` / `karaoke` / `pachinko` / `mahjong_parlor` / `business_hotel` / `capsule_hotel` / `love_hotel` / `club` / `snack` / `bank` / `police_station` / `movie_theater` / `convenience` / `shotengai_arcade` / `bus_terminal_shelter` / `shrine`

**脇役（背景・住宅）**: `townhouse` / `house` / `mansion` / `apartment` / `apartment_tall` / `garage` / `shed` / `kura` / `ramen` / `wagashi`

**避けたい**: `kominka` / `chaya` / `machiya` 等の和風住宅は Stage 2 では使わない（Stage 3「都心」に温存）

## 家具 (FurnitureType)

**Stage 2 シグネチャ**: `chouchin` / `noren` / `sign_board` / `a_frame_sign` / `flag_pole` / `banner_pole` / `puddle_reflection` / `cable_junction_box` / `manhole_cover` / `bollard` / `street_lamp` / `traffic_cone` / `bus_stop` / `taxi_rank_sign` / `bicycle_rack` / `newspaper_stand` / `vending` / `parasol`

**屋台（Ch7 のみ集中）**: `popcorn_cart` / `balloon_cluster` / `parasol` / `bench`

**神社（Ch11 のみ）**: `torii` / `stone_lantern` / `ema_rack` / `omikuji_stand` / `sando_stone_pillar` / `koma_inu` / `shinto_rope` / `offering_box`

**生活痕跡（全チャンク）**: `garbage` / `recycling_bin` / `dumpster` / `bicycle` / `cat` / `mailbox` / `potted_plant`

## 地面 (GroundType)

- **基調**: `asphalt`（全チャンク y=88 帯と裏路地）
- **focal 強調**: `tile` / `concrete` / `red_carpet`（club / love_hotel）
- **Act IV 移行**: `stone_pavement` (Ch10-11 神社参道)
- **アクセント**: `puddle_reflection` は **家具** (FurnitureType) であって ground ではない点に注意

---

# §6.6 SemanticCluster の Stage 2 適用ガイド

各チャンクで `clusters?: SemanticCluster[]` を宣言する。Stage 2 固有のヒント:

## hero クラスタの focal 候補

- **オープンスペース型** (基本形 A): Ch0 駅前広場 (`focal: train_station` 建物 or `bus_stop` 家具) / Ch4 パチンコ街頭 (`focal: pachinko` 建物) / Ch7 屋台広場 (`focal: 中央 yatai` 建物)
- **焦点建物型** (基本形 B): Ch3 karaoke / Ch6 love_hotel / Ch8 movie_theater / Ch11 shrine
- **3 連焦点型** (基本形 C): Ch1 ramen+izakaya+karaoke / Ch5 snack+mahjong+izakaya 横丁

## ambient クラスタの focal 候補

- 各セルに 1 つ、ヒーローでない建物の中で最大のもの（business_hotel / convenience / mansion など）

## boundary 候補（Stage 2 固有）

- `bollard` 列（avenue 沿い、夜の歓楽街では交通整理が密）
- `traffic_cone` 列（パチンコ前・交番前）
- `hedge` (love_hotel の目隠し)
- `flag_pole` 列 (movie_theater 前)

## access 候補（Stage 2 固有）

- `street_lamp` (ネオン光源として avenue 両脇 y=92 / y=108 に配置)
- `manhole_cover` (avenue 横断地点)
- `puddle_reflection` (focal 周辺に 2-3 個、夜の濡れた路面感)
- `street_mirror` (Ch4 交番前、Ch11 神社参道)

## livingTrace 候補（Stage 2 固有）

- `garbage` (Ch1-Ch7 各セル、飲食店の出し)
- `bicycle` (放置自転車、Ch3-Ch5 の業務側)
- `cat` (Ch9-Ch11 の静寂側、各セル 1 匹以上)
- `recycling_bin` (Ch6 ラブホ街、Ch9 駐車場)

---

# §9 詳細フェーズ: 各チャンクレイアウト（再配置のための設計指示）

<aside>
📐

**読み方**: 各チャンクは以下 7 項目で構成。(1) ヒーロー/アンビエント割当 / (2) ヒーローセルの焦点 4 層 / (3) 取り巻き 3 パターン / (4) 人配置 / (5) 地面パッチ・追加道路 / (6) 生活の痕跡・スケール階層 / (7) Handoff 4 項目（前後チャンクへの引き継ぎ）。座標は dx ∈ [-180, +180] / dy ∈ [0, 200] のチャンクローカル。

**🛣️ 道路注意（Stage 1 v6.2 と同じ）**: 各チャンクの道路指定は **コンセプトに沿って都度設計**。固定するのは `_AVE`（x=0）のみ。

</aside>

## Act I — 駅前繁華

### Ch0: 終電後の地方駅と北口ロータリー

**ヒーロー / アンビエント**: **NE = ヒーロー**（train_station + 駅前広場、基本形 A）/ NW・SW・SE = アンビエント

**チャンク物語**: 「23:30、終電が出たばかりの地方駅。北口ロータリーに残るタクシーと最終バス、西口の出張族のホテル街、東口の深夜コンビニ、南口のラーメン横丁。サラリーマンが帰路を求めて散る瞬間」

#### 🅴 NE ヒーロー: 駅前ロータリー (2 ロット)

**ロット NE-1: 駅舎ホール** (x=80, y=22)
- キャラ: 「『清水台駅』、3 番線まで持つ地方の要、深夜の青いネオンだけが光る」
- 建物: `train_station` (focal)
- 取り巻き: `platform_edge` × 2 + `railway_track` × 4 (y=78-86) + `signal_tower` + `flag_pole` (x=80, y=12)
- ground: `concrete` (大パッチ 200×120) + `tile` (ホーム x=80 y=70 100×20)

**ロット NE-2: バス & タクシースタンド** (x=30〜170, y=65-95)
- キャラ: 「最終バスを待つ少数の客と、酔客を狙う深夜タクシー」
- 建物: `bus_terminal_shelter` (x=30, y=65) + `apartment_tall` (x=145, y=22) — 駅東上層階に高層
- 取り巻き: `bus_stop` × 2 (x=30/130, y=88) + `taxi_rank_sign` × 2 (x=145/165) + `bench` × 4 (x=20/65/120/165, y=85) + `flower_planter_row` × 3 + `flag_pole` × 2 (x=30, x=130)
- ground: `asphalt` バスターミナル (60×30)
- livingTrace: `newspaper_stand` (x=100, y=88)

#### 🆆 NW アンビエント: 駅西口の宿泊街 (3 ロット)

**ロット NW-1: ビジネスホテル『ステーションイン』** (x=-130, y=22)
- キャラ: 「出張族が深夜チェックインする無機質な箱、青ネオンと flag_pole」
- 建物: `business_hotel` + `apartment` (x=-160, y=60) 奥
- 取り巻き: `sign_board` 青 (x=-130, y=8) + `flag_pole` (x=-130, y=12) + `atm` × 2 (x=-150/-110, y=32) + `mailbox` + `vending` × 2
- ground: `tile` (60×40)

**ロット NW-2: スナック『夢』 + 24h 薬局** (x=-75〜-25, y=22)
- キャラ: 「ピンクの提灯を 30 年掛け続けるママの店、隣で胃薬を売る薬局」
- 建物: `snack` (-75, 22) + `pharmacy` (-25, 22)
- 取り巻き: `chouchin` ピンク (x=-75, y=28) + `noren` + `shop_awning` (-25, 30) + `a_frame_sign` × 2 (x=-55/-8, y=56) + `sign_board` 緑 (薬局)
- ground: `concrete` (50×40 スナック前) + `tile` (50×40 薬局前)
- livingTrace: `mailbox` (x=-145, y=22) — NW セル痕跡

**ロット NW-3: 雑居オフィス裏** (x=-100, y=75)
- キャラ: 「2-3F が広告代理店、地下が小さなライブハウス」
- 建物: `office` (-100, 75)
- 取り巻き: `ac_outdoor_cluster` (-160, 90) + `cable_junction_box` (-160) + `puddle_reflection` (-80, 75) — 油汚れの裏
- ground: `concrete` (裏路地 70×30)

#### 🆂 SW アンビエント: 終電食堂横丁 (2 ロット)

**ロット SW-1: ラーメン『あさひ』 + 居酒屋『八』** (x=-160〜-100, y=130)
- キャラ: 「終電帰りのサラリーマンが汁麺と一杯を求める 2 軒並び」
- 建物: `ramen` (-160, 130) + `izakaya` (-100, 130)
- 取り巻き: `chouchin` × 4 (x=-175/-145/-115/-85, y=122) + `noren` × 2 + `a_frame_sign` × 2 + `shop_awning` × 2 + `sign_board` 黄 (ラーメン)
- ground: `concrete` 横丁通り (130×40)

**ロット SW-2: 横丁奥のメシ屋** (x=-90〜-45, y=175)
- キャラ: 「裏路地の小さな食堂、店主と常連だけが知る」
- 建物: `restaurant` (-90, 175) + `townhouse` (-45, 138)
- 取り巻き: `bicycle_rack` (-130, 158) + `bicycle` (-75, 158) + `milk_crate_stack` (-85, 188)
- ground: `oil_stained_concrete` 路地 (-100, y=175, 180×25) + `concrete` 裏 (-100, y=192, 200×14)
- livingTrace: `bicycle` (x=-75, y=158) — SW セル痕跡

#### 🆂 SE アンビエント: 駅東のコンビニ街 (3 ロット)

**ロット SE-1: コンビニ『ローソン』** (x=130, y=130)
- キャラ: 「24h 営業、酔客と夜勤者が買いに来る最後の砦」
- 建物: `convenience` + `apartment` (x=110, y=175) 奥
- 取り巻き: `shop_awning` (x=130, y=122) + `vending` × 2 (x=100/158, y=158) + `sign_board` (x=130, y=110) + `bicycle_rack` (x=160) + `newspaper_stand`
- ground: `tile` (70×40)

**ロット SE-2: 24h カフェ『WIRED』** (x=70, y=130)
- キャラ: 「終電後にメシ・ノマド作業ができる店、ガラスの中だけ別世界」
- 建物: `cafe` (70, 130)
- 取り巻き: `shop_awning` (70, 122) + `parasol` × 2 (x=50/90, y=148) + `a_frame_sign` (70, 148)
- ground: `wood_deck` テラス (60×30)

**ロット SE-3: 古書店『深夜堂』** (x=30, y=130)
- キャラ: 「終電がなくなった人が立ち寄る古本屋、深夜まで明かり」
- 建物: `bookstore` + `mansion` (x=165, y=175) 奥
- 取り巻き: `a_frame_sign` (30, 148) + `newspaper_stand` (30, 148)
- ground: `concrete` (50×30)
- livingTrace: `garbage` (x=158, y=188) — SE セル痕跡

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board`（business_hotel 大、ramen 中、convenience 小）
- **焦点囲み**: 駅前広場の bench × 3、flag_pole、flower_planter_row
- **歩道沿い** (avenue 両脇): `street_lamp` × 4、`bollard` × 4

**人配置**: 終電客（adult_m × 多 7-8 人、駅前広場・avenue を歩く）、待ち客（adult_f × 2、bench）、駅員（adult_m × 1、改札）、cat × 2 (NW 業務側、SE 裏)

**地面パッチ**:
- 基調: `asphalt` 全面
- NE 焦点: `concrete` 駅舎前 (x=80, y=80, 180×120)、`tile` ホーム部分 (x=80, y=70, 80×20)
- 歩道帯: `stone_pavement` (x=-65, y=100, 12×200) 継続軸
- ロット: `concrete` (NW business_hotel)、`tile` (SE convenience)、`asphalt` (SW ramen)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（追加なし、駅前は asphalt 大パッチで広場化）

**生活の痕跡 / スケール / 向き**:
- **痕跡**: NW `mailbox`、NE `newspaper_stand`、SW `bicycle`、SE `garbage` — 4 セル全て痕跡 ✅
- **スケール**: 大 `train_station` / 中 `business_hotel` × 1・`ramen` × 1・`convenience` × 1 / 小 `bench` × 3・`bollard` × 4・`mailbox` × 3 — 1:3:20 比
- **向き**: bench は train_station 向き、flag_pole は avenue 向き、taxi_rank_sign は道路向き

**Handoff (Stage 1 Ch11 → Stage 2 Ch0)**:
- **並木**: Stage 1 の `pine_tree` (Ch11) → Stage 2 では並木なし。代わりに `street_lamp` ネオン列が連続軸開始
- **歩道**: `stone_pavement` (x=-65) 帯継続
- **電柱/電線**: `power_pole` × 4 (4 隅 y=5/195) 対 + `power_line` × 2
- **予兆**: 駅舎の上空で `power_line` が密、cable_junction_box が増えていく Act II の予告

**TS スケルトン（例示）**:

```ts
{ patternId: 's2_raw', raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  };
  // NE ヒーロー: train_station
  const station = $B(out, 'train_station', 80, 22);
  const platform = $F(out, 'platform_edge', 80, 70);
  const track = $F(out, 'railway_track', 80, 78);
  // ... (12 chunks 分は実装時に肉付け)
  _CLUSTER(out, {
    id: 'ch0.NE.station', role: 'hero', cell: 'NE',
    focal: station, companions: [platform, track, /* bus_stop refs */],
    boundary: [/* flag_pole, planter */],
    access: [/* manhole, lamp */],
    livingTrace: /* newspaper_stand */ { kind: 'f', i: 0 } as any,
  });
  return out;
})() },
```

### Ch1: 終電後の食事街（ramen / izakaya / karaoke 3 連）

**チャンク物語**: 「Ch0 から南へ進むと、横丁の入口に出る。3 連飲食店（ラーメン・居酒屋・カラオケ）が湯気と歌声を漏らし、奥にスナックと雀荘の影。サラリーマンが何軒も巡って酔いを深める時間帯」

**ヒーロー / アンビエント**: **SW = ヒーロー**（基本形 C: 3 連飲食店）/ NW・NE・SE = アンビエント

#### 🆂 SW ヒーロー: 終電後の 3 連飲食店 + 横丁奥 (2 ロット)

**ロット SW-1: ラーメン・居酒屋・カラオケ 3 連**
- キャラ: 「『あさひ亭』『八』『歌姫』が並ぶ、終電族の最後の砦」
- 建物: `ramen` (-145) + `izakaya` (-95) + `karaoke` (-35) の dy=128 揃え
- 取り巻き: 各店 `chouchin` × 2 (店前 y=118) + `noren` (店前 y=128) + `a_frame_sign` (y=148) + `shop_awning` × 2 (ramen / izakaya) + `sign_board` × 3 (黄=ラーメン / 黄=居酒屋 / 黄=カラオケ)
- ground: `concrete` 3 連店前 (x=-90, y=145, 160×40)

**ロット SW-2: 横丁奥のスナック・雀荘** (x=-110〜-45, y=178)
- キャラ: 「ピンクの提灯のスナック、緑看板の老舗雀荘、深夜常連だけが知る」
- 建物: `mahjong_parlor` (-110, 175) + `snack` (-45, 178) + `townhouse` (-160, 178)
- 取り巻き: `chouchin` ピンク (-45, 168) + `noren` × 2 + `sign_board` 緑 (mahjong) + `bicycle_rack` (-75, 158)
- ground: `oil_stained_concrete` 路地裏 (-100, y=175, 180×25)
- livingTrace: `garbage` (-158, 162)

#### 🆆 NW アンビエント: 駅西宿泊街の続き (2 ロット)

**ロット NW-1: ビジネスホテル『プラザ』 + カプセル**
- キャラ: 「Ch0 のステーションインの隣、もう少し安いビジネスホテル + カプセルの選択肢」
- 建物: `business_hotel` (-130, 22) + `capsule_hotel` (-160, 60) + `apartment` (-75, 22)
- 取り巻き: `sign_board` 青 × 2 (ホテル) + `flag_pole` + `atm` + `mailbox` + `vending` + `ac_unit` × 2
- ground: `tile` ホテル前 (70×40) + `concrete` カプセル前 (50×40)
- livingTrace: `mailbox` (-150, 22)

**ロット NW-2: オフィス裏の雑居** (x=-50, y=70)
- キャラ: 「2-3F が貸しオフィス、深夜まで明かり」
- 建物: `office` (-50, 70)
- 取り巻き: `ac_outdoor_cluster` + `cable_junction_box` + `puddle_reflection`

#### 🆄 NE アンビエント: 駅東のコンビニ・住宅 (2 ロット)

**ロット NE-1: 24h コンビニ + 雑居店** (x=110/165, y=22)
- キャラ: 「Ch0 のコンビニ系列の支店、朝食を急ぐ通勤客向け」
- 建物: `convenience` (110, 22) + `shop` (165, 22) + `apartment_tall` (35, 22) + `office` (75, 70)
- 取り巻き: `shop_awning` (110, 30) + `vending` × 2 + `bicycle_rack` (110, 60) + `a_frame_sign` (145, 28) + `sign_board` × 2
- ground: `tile` コンビニ前 (70×40) + `concrete` (50×40)
- livingTrace: `bicycle_rack` (110, 60)

#### 🆂 SE アンビエント: 古書店の隣り、住宅 (2 ロット)

**ロット SE-1: 住宅 + 古書店『深夜堂』2 号店** (x=30〜140, y=130)
- キャラ: 「Ch0 の古書店の支店、駅周辺で 2 軒目」
- 建物: `bookstore` (30, 130) + `townhouse` × 2 (80/140, 130) + `apartment` (130, 175)
- 取り巻き: `mailbox` × 3 (75/138/30, 122) + `shop_awning` (30, 122) + `a_frame_sign` (50, 148) + `ac_unit` × 2 + `flower_bed` (100, 168)
- ground: `concrete` 駐車 (75, y=152, 70×30) + `tile` (110, y=152, 70×30)
- livingTrace: `cat` (105, 168)

**ロット SE-2: 蔵 + 物置 (古い裏路地)** (x=70, y=178)
- キャラ: 「再開発から取り残された古い蔵、奥に物置」
- 建物: `shed` (70, 178)
- 取り巻き: `garbage` + `recycling_bin`

**人配置**: 飲み客（adult_m × 6 が ramen/izakaya/karaoke 各店前）、サラリーマン × 2 (avenue 歩く)、客引き × 1 (Ch1 SE 端)、cat × 1 (Ch SE)

**地面パッチ**:
- 基調: `asphalt`
- SW 焦点: `concrete` 3 連店前 (x=-90, y=145, 160×40)
- アクセント: `puddle_reflection` × 3 が店前歩道に散在

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（追加なし）

**Handoff (Ch0 → Ch1)**:
- **並木**: なし（並木は Stage 1 で終了）
- **歩道**: `stone_pavement` (x=-65) 帯継続
- **電柱/電線**: 4 隅で対
- **予兆**: SW ヒーローの 3 連店が Ch2 商店街アーケードへ繋がる（chouchin 帯が連続）

### Ch2: 商店街アーケード入口（merged hero）

**チャンク物語**: 「商店街『神田銀座』の北入口、提灯のガーランドが avenue を覆う。アーケードの向こうに歓楽街最盛期 (Act II) のネオン群が見える」

**ヒーロー**: **NW+NE merged = ヒーロー**（提灯ガーランドの大アーケード）/ SW・SE = アンビエント

#### 🅴 NW+NE merged ヒーロー: 商店街アーケード入口 (1 ロット)

**ロット M-1: 提灯アーケードのゲート街**
- キャラ: 「『神田銀座商店街』の入口アーケード、左右の柱からガーランドが垂れる」
- 建物: `shotengai_arcade` × 2 (x=-118 / +118, y=22) ゲート柱 + `pachinko` (x=60, y=22) + `karaoke` (x=-60, y=22) 中の店 + `izakaya` (-25, y=70) + `ramen` (25, y=70)
- 取り巻き: `chouchin` × 14 (avenue 全幅 y=22 不揃い 22-32px) + `banner_pole` × 4 (x=-160/-54/+54/+160, y=28) + `flag_pole` × 2 (x=-30/+30, y=12)
- ground: `tile` アーケード床 (x=0, y=100, 360×30) + 各店ロット tile/concrete

#### 🆂 SW アンビエント: パチンコ街予告 + 横丁 (2 ロット)

**ロット SW-1: パチンコ街予告 + ビジネスホテル**
- キャラ: 「Ch4 パチンコ最盛期の予告、ホテルとスナックの混在」
- 建物: `pachinko` (x=-130, y=130) + `business_hotel` (-100, y=178) + `snack` (x=-75, y=130) + `townhouse` (x=-25, y=138)
- 取り巻き: `sign_board` 赤大 (x=-130, y=110) + `sign_board` ピンク (-75, 110) + `chouchin` × 2 + `noren` × 2 + `a_frame_sign` × 2
- ground: `concrete` × 2 (60×40, 50×40) + `oil_stained_concrete` (路地裏)
- livingTrace: `garbage` (-158, 188)

**ロット SW-2: 横丁の続き** (x=-160, y=175)
- 建物: `mahjong_parlor` (-160, 175) + `townhouse` (-100, 178)
- 取り巻き: `sign_board` 緑 + `bicycle`

#### 🆂 SE アンビエント: クラブ街予告 + 住宅 (2 ロット)

**ロット SE-1: クラブ街予告 + 雑居住宅**
- キャラ: 「Ch3 高層雑居ビルの予告、クラブと住宅の混在」
- 建物: `club` (x=130, y=130) + `townhouse` (75, 138) + `apartment` (30, 138)
- 取り巻き: `sign_board` 黒+金 (130, 110) + `parasol` + `flag_pole` (130, 120) + `mailbox` × 2
- ground: `red_carpet` クラブ前 (60×40) + `asphalt` 駐車 (50×40)
- livingTrace: `bicycle` (158, 188)

**ロット SE-2: 24h 薬局 + 物置** (x=165/105, y=178)
- 建物: `pharmacy` (165, 178) + `shed` (105, 178)
- 取り巻き: `a_frame_sign` (165, 168) + `shop_awning`

**人配置**: 商店街客 × 多 (avenue 全幅、両側 y=92/108)、客引き × 2 (Ch2 SE)、cat × 1

**地面パッチ**: `asphalt` 全面、avenue 中央 `tile` (x=0, y=100, 360×24) — アーケード床

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]`（Act 境界の予告として _TOP_HR を追加）

**Handoff (Ch1 → Ch2)**: chouchin 帯が連続、ramen/izakaya/karaoke の客が商店街へ流れる

---

## Act II — 歓楽街最盛期

### Ch3: 高層雑居ビル（karaoke / club / business_hotel）

**ヒーロー**: **NE = ヒーロー**（karaoke 大看板の縦帯）/ NW・SW・SE = アンビエント

**NE ヒーロー 4 層**:
- **焦点**: `karaoke` (x=130, y=22) + `apartment_tall` (x=80, y=22) の 2 棟で「高層雑居ビル」を成す
- **取り巻き**: `sign_board` (大、x=130, y=8 ファサード上端) × 1 + `chouchin` × 4 (店前 y=58) + `a_frame_sign` × 2 (1F 入口)
- **境界**: `bollard` × 3 (x=70/100/170, y=92)、`flag_pole` (x=130, y=12)
- **動線**: `street_lamp` × 2 (x=80/170, y=88)、`puddle_reflection` × 2 (store front y=110)

**チャンク物語**: 「歓楽街最盛期 (Act II) 入口、高層雑居ビルの縦に伸びるネオン。NE のカラオケ大看板が街を支配する」

#### 🅴 NE ヒーロー: カラオケ高層ビル + 集合店舗 (1 ロット)

**ロット NE-1: 雑居『ビル B』** (x=80〜170, y=22)
- キャラ: 「7 階建ての雑居ビル、1F カラオケ、2F 居酒屋、3-7F 雑居オフィス、屋上看板に巨大ネオン」
- 建物: `karaoke` (130, 22) + `apartment_tall` (80, 22) + `business_hotel` (165, 22) + `office` (165, 70) + `shop` (50, 70) + `snack` (110, 75)
- 取り巻き: `sign_board` 黄 大 (130, 8) × 4 (各建物) + `chouchin` × 6 (各店前) + `a_frame_sign` × 3 + `flag_pole` × 2 + `noren` (snack)
- ground: `concrete` カラオケ前 (60×30) + `tile` apartment_tall (50×30) + `red_carpet` snack (50×20)
- livingTrace: `recycling_bin` (30, 92)

#### 🆆 NW アンビエント: クラブ街 (2 ロット)

**ロット NW-1: クラブ街『ブラックハート』** (x=-130〜-25, y=22)
- キャラ: 「黒+金のクラブ、隣にカプセルホテル (深夜まで遊ぶ客の宿)、奥にスナック」
- 建物: `club` (-130, 22) + `capsule_hotel` (-75, 22) + `snack` (-25, 22)
- 取り巻き: `sign_board` 黒+金 (-130, 8) + `parasol` × 2 + `flag_pole` (-130, 12) + `chouchin` ピンク (-25)
- ground: `red_carpet` クラブ前 (60×20) + `concrete` カプセル (50×40)
- livingTrace: `recycling_bin` (-158, 60)

#### 🆂 SW アンビエント: ビジネスホテルと雀荘 (2 ロット)

**ロット SW-1: ビジネスホテル『チェスト』** (x=-100, y=130)
- キャラ: 「Ch1 系列の 3 軒目のホテル、街の北方面のホテルチェーン」
- 建物: `business_hotel` (-100, 130) + `townhouse` (-160, 138)
- 取り巻き: `sign_board` 青 (-100, 110) + `flag_pole` + `mailbox` × 2 + `ac_unit` × 2
- ground: `concrete` ホテル駐車 (60×40)
- livingTrace: `mailbox` (-125, 122)

**ロット SW-2: 雀荘 + 蔵** (x=-50/-130, y=138/178)
- 建物: `mahjong_parlor` (-50, 138) + `kura` (-130, 178) + `shed` (-75, 178)
- 取り巻き: `sign_board` 緑 (-50, 110) + `noren` + `wood_fence` × 2 + `cat`

#### 🆂 SE アンビエント: 高級住宅街 (2 ロット)

**ロット SE-1: マンション 2 棟** (x=80/140, y=130)
- キャラ: 「夜景が売りの新築マンション、2 棟が並ぶ」
- 建物: `mansion` × 2 (80/140, 130) + `apartment` (100, 178)
- 取り巻き: `mailbox` × 3 + `ac_unit` × 2 + `flower_bed` (100, 168)
- ground: `tile` 駐車 (110, y=152, 80×30)

**ロット SE-2: 24h カフェ + 薬局** (x=30/165, y=138)
- 建物: `pharmacy` (30, 138) + `cafe` (165, 138)
- 取り巻き: `shop_awning` × 2 + `parasol` × 2 + `bicycle` (痕跡)
- ground: `wood_deck` cafe (165, y=145, 30×30) + `concrete` pharmacy (30, y=152, 50×40)
- livingTrace: `bicycle_rack` (105, 188)

### Ch4: パチンコ + 交番交差点（merged hero / 全マージ）

**チャンク物語**: 「Stage 2 のクライマックス、街の交差点。北西の巨大パチンコ『キング』、北東のゲームセンター『マリン』、中央の小さな交番、南西のラブホ街、南東のビジネスホテル群が同時に視界に飛び込む」

**ヒーロー**: **全マージ merged = ヒーロー**（Stage 2 の視覚的ピーク、1 ロット = 街の交差点全体）

#### 🅴 merged ヒーロー: 街の交差点 (1 ロット = 全 12 棟)

**ロット M-1: 歓楽街の中心交差点**
- キャラ: 「中央に小さな交番が無力に立ち、四方を歓楽街の巨大ネオンが囲む。客引きと酔客と警察官が交錯する瞬間」
- 建物 (上段): `pachinko` (-100, 22) ★ + `game_center` (100, 22) + `snack` × 2 (-160/160, 22) + `love_hotel` (-55, 22) + `club` (60, 22) + `capsule_hotel` (-150, 70) + `office` × 2 (-100/100, 75)
- 建物 (下段): `police_station` (0, 130) ★中央 + `business_hotel` (110, 130) + `mahjong_parlor` (-100, 130) + `izakaya/ramen` (-160/160, 138) + `townhouse` × 2 (-50/50, 178) + `apartment` × 2 (-130/130, 178)
- 取り巻き (パチンコ): `sign_board` 赤巨大 (-100, 8) + `a_frame_sign` × 2 + `barrier` × 2 + `traffic_cone` × 4 (待ち列誘導)
- 取り巻き (交番): `flag_pole` × 2 + `traffic_cone` × 4 + `barrier` × 2 (中央島) + `street_mirror` × 2
- 取り巻き (各店 facade): `sign_board` × 多 (赤・ピンク・黄・緑・黒+金) + `chouchin` 多 + `noren` × 4
- ground (ロット別):
  - パチンコ前: `tile` (-100, 60, 90×50)
  - 交番前: `concrete` (0, 130, 80×50)
  - ゲーセン前: `tile` (100, 60, 90×50)
  - love_hotel: `red_carpet` (-55, 60, 50×30)
  - club: `red_carpet` (60, 60, 50×30)
  - 各端 snack: `concrete` × 2 (-160/160, 60, 30×30)

**人配置**: パチンコ客 × 6 (待ち列)、交番警察官 × 1、客引き × 3 (ホテル方向)、酔客 × 4、cat × 1

**地面パッチ**: `asphalt` 全面、パチンコ前 `tile` (x=-100, y=58, 90×40), 交番前 `concrete` (x=0, y=130, 80×40)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]` — 4 方向交差点感

**Handoff**: パチンコ大看板 + 交番が Ch4 の中心、Ch5 飲み屋横丁への引き継ぎは avenue の chouchin 連続

### Ch5: 老舗飲み屋横丁（merged hero）

**チャンク物語**: 「Ch4 の交差点を抜けると、avenue 両脇に細い横丁。老舗のスナック・雀荘・居酒屋・寿司屋が肩を寄せ合う。30 年通う常連と新参の混在」

**ヒーロー**: **SW+SE merged = ヒーロー**（横丁感、9 軒の小店密集）

#### 🅴 SW+SE merged ヒーロー: 飲み屋横丁 (3 ロット)

**ロット M-1: 横丁西『金星通り』** (x=-160〜-30, y=130)
- キャラ: 「ピンクのスナック『金星』、緑看板の老舗雀荘『松』、地元の居酒屋『八』が密集」
- 建物: `snack` (-160) + `mahjong_parlor` (-100) + `izakaya` (-30, dy=130)
- 取り巻き: `chouchin` × 3 + `noren` × 3 + `sign_board` ピンク/緑/黄 + `a_frame_sign` × 3
- ground: `concrete` 横丁通り (130×40)

**ロット M-2: 横丁中央『はたや』** (x=0, y=178)
- キャラ: 「夜中まで営業の中華料理屋」
- 建物: `ramen` (0, 178)
- 取り巻き: `chouchin` (0, 168) + `noren` + `a_frame_sign` (0, 192)

**ロット M-3: 横丁東『鮨はま』** (x=60〜160, y=130/178)
- キャラ: 「老舗寿司屋と鮨カウンター式の居酒屋」
- 建物: `snack` (60, 130) + `sushi_ya` (130, 130) + `mahjong_parlor` (60, 178) + `izakaya` (130, 178)
- 取り巻き: `chouchin` × 3 + `noren` × 3 + `sign_board` ピンク/赤
- ground: `oil_stained_concrete` 路地裏 (-30〜130, y=178, 130×25)
- livingTrace: `garbage` (-158, 188)

#### 🆆 NW アンビエント: 銀行 + 出張族の宿 (2 ロット)

**ロット NW-1: 銀行『信用金庫』** (x=-130, y=22)
- キャラ: 「夜は無人、24h ATM のみ稼働」
- 建物: `bank` (-130, 22) + `office` × 2 (-45/45, 22)
- 取り巻き: `flag_pole` (-130, 12) + `atm` × 2 + `mailbox` + `sign_board` 青
- ground: `tile` 銀行前 (60×40)
- livingTrace: `mailbox` (-130, 22)

**ロット NW-2: 出張族のスナック** (x=-75/0, y=22)
- 建物: `snack` (-75, 22) + `business_hotel` (0, 22) + `apartment` (-160, 70)
- 取り巻き: `chouchin` ピンク + `noren` + `flag_pole`
- ground: `concrete` (50×40 各)

#### 🆄 NE アンビエント: カプセル + 雑居 (1 ロット)

**ロット NE-1: カプセルホテル『フィット』 + 雑居店**
- キャラ: 「終電族の最終手段、3,000 円のカプセル + 隣にスナック」
- 建物: `capsule_hotel` (130, 22) + `snack` (75, 22) + `apartment` (160, 70)
- 取り巻き: `sign_board` 青タワー + `chouchin` ピンク + `vending` × 2 + `noren`
- ground: `tile` (60×40) + `concrete` (50×40)
- livingTrace: `garbage` (158, 60)

**人配置**: 飲み客 × 8 (横丁狭い空間に密)、ママさん × 1 (snack 前)、cat × 2

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

---

## Act III — ホテルと屋台

### Ch6: ラブホテル街

**チャンク物語**: 「Act III、ホテル街への突入。北西にラブホ 3 軒、北東にクラブ街、南は深夜のスナック横丁。匿名性と派手な看板が交錯」

**ヒーロー**: **NW = ヒーロー**（love_hotel × 3）/ NE・SW・SE = アンビエント

#### 🅴 NW ヒーロー: ラブホテル街『ハートライン』 (1 ロット)

**ロット NW-1: ラブホ 3 軒並び**
- キャラ: 「ピンクと紫のネオンが連続、目隠しの hedge 高め、駐車場が屋根付き」
- 建物: `love_hotel` × 3 (-110, 22 大 / -50, 22 小 / -160, 75) + `snack` (-10, 75) + `business_hotel` (-100, 75)
- 取り巻き: `sign_board` ピンク × 3 + `parasol` × 3 + `flag_pole` × 2 + `hedge` × 6 高め (目隠し x=-178 列 + x=10 列)
- ground: `red_carpet` 大パッチ (-80, y=60, 100×40) + `red_carpet` (-160, y=88, 30×30)
- livingTrace: `recycling_bin` (-158, 88) — 控えめ (匿名性)

#### 🆄 NE アンビエント: クラブ街『ナイトミュージック』 (2 ロット)

**ロット NE-1: クラブ 2 軒 + 雀荘** (x=30〜130, y=22)
- キャラ: 「黒+金のクラブ『B』、隣の若者向けクラブ『M』、奥に老舗雀荘」
- 建物: `club` × 2 (130/70, 22) + `mahjong_parlor` (30, 22) + `snack` (165, 22)
- 取り巻き: `sign_board` 黒+金 × 2 + `sign_board` 緑 + `parasol` × 2 + `flag_pole` × 2 + `chouchin` (165) + `noren` (30)
- ground: `red_carpet` クラブ × 2 + `tile` mahjong (30×40) + `concrete` snack
- livingTrace: `recycling_bin` (158, 60)

**ロット NE-2: カプセルホテル + shop** (x=100/165, y=75)
- 建物: `capsule_hotel` (100, 75) + `shop` (165, 75)
- 取り巻き: `vending` × 2 + `cable_junction_box`

#### 🆂 SW アンビエント: スナック横丁の続き (2 ロット)

**ロット SW-1: スナック『紅』 + 雀荘** (x=-130〜-25, y=130)
- キャラ: 「Ch5 横丁の延長、ピンクと緑のネオンが続く」
- 建物: `snack` (-130, 130) + `mahjong_parlor` (-75, 130) + `izakaya` (-25, 138) + `townhouse` (-160, 138)
- 取り巻き: `chouchin` ピンク × 2 + `sign_board` × 2 + `noren` × 2 + `a_frame_sign` × 2
- ground: `concrete` (60×40) + `oil_stained_concrete` 裏路地 (100×25)
- livingTrace: `garbage` (-158, 188)

**ロット SW-2: 路地奥の物置** (x=-130, y=178)
- 建物: `shed` (-130, 178)

#### 🆂 SE アンビエント: 雀荘 + 24h カフェ (2 ロット)

**ロット SE-1: 雀荘『竜』 + スナック** (x=130/75, y=130)
- 建物: `mahjong_parlor` (130, 130) + `snack` (75, 130)
- 取り巻き: `sign_board` 緑 + `noren` × 2 + `chouchin`

**ロット SE-2: 24h カフェ + 大邸宅** (x=30/165, y=138)
- 建物: `cafe` (30, 138) + `mansion` (165, 138) + `apartment` (100, 178)
- 取り巻き: `shop_awning` (30) + `parasol` × 2 + `mailbox` (165, 122)
- ground: `wood_deck` cafe (50×30) + `tile` mansion (60×40)
- livingTrace: `bicycle` (158, 168)

**人配置**: カップル × 2 (NW)、ホステス × 2 (NE)、酔客 × 3 (SW snack)、cat × 1

**地面パッチ**: `asphalt`、NW love_hotel 前 `red_carpet` (-80, y=58, 100×40)

**道路**: `verticalRoads: [_AVE]`（追加なし）/ `horizontalRoads: [_MID_HR]`

### Ch7: 屋台横丁（merged hero）

**チャンク物語**: 「中央 avenue が屋台横丁に変身。5 軒の屋台が中央に集約し、湯気と焼き鳥の匂いが立ち込める。横道路ゼロで広場感を出す」

**ヒーロー**: **NW+NE merged = ヒーロー**（屋台 5 連 + 上段店 6 軒）

#### 🅴 NW+NE merged ヒーロー: 屋台横丁 + 上段商店 (2 ロット)

**ロット M-1: 屋台 5 連『はやし通り』** (x=-105〜+105, y=68)
- キャラ: 「焼き鳥『山』、おでん『村』、ラーメン『松』、たこ焼き『竹』、もつ煮『梅』が並ぶ夜店」
- 建物: `yatai` × 5 (-110/-55/0/55/108, y=68 微不揃い)
- 取り巻き: `chouchin` × 5 (各屋台上 y=58) + `parasol` × 5 (y=78) + `noren` × 5 (各屋台前 y=64) + `bench` × 5 (客、不揃い)
- 動線: `popcorn_cart` × 2 (西東端) + `balloon_cluster` × 3 (上空)
- ground: `red_carpet` 屋台床 (x=0, y=78, 240×30) + `concrete` 屋台前 (320×30)

**ロット M-2: 上段店『商店通り』** (x=-160〜+162, y=22)
- キャラ: 「屋台の対岸、住宅街と shop が混在する小さな店列」
- 建物: `townhouse` × 2 (-160, y=22 / 162, y=22) + `apartment` × 2 (-75/75, y=22) + `shop` × 2 (-25/30, y=22)
- 取り巻き: `sign_board` × 4 + `shop_awning` × 2 (-25/30) + `a_frame_sign` × 2 + `mailbox` × 2 + `ac_unit` × 4
- ground: 各ロット concrete (30×40) + tile (50×40)

#### 🆂 SW アンビエント: 茶店 + 居酒屋 (1 ロット)

**ロット SW-1: 茶店『はる』 + 居酒屋『八』** (x=-100/-160, y=130/138)
- キャラ: 「日中は茶店、夜は居酒屋に変身する 2 軒」
- 建物: `chaya` (-100, 130) + `izakaya` (-160, 138) + `kura` (-50, 138) + `shed` (-130, 178) + `townhouse` (-75, 178)
- 取り巻き: `noren` × 2 + `chouchin` × 2 + `a_frame_sign` × 2 + `sign_board` 緑 (-160, 110)
- ground: `concrete` (60×40) + `oil_stained_concrete` 路地 (50×14)
- livingTrace: `cat` (-130, 178)

#### 🆂 SE アンビエント: ラーメン + 寿司 (1 ロット)

**ロット SE-1: ラーメン『朝日』 + 寿司『ゆう』** (x=100/160, y=130/138)
- キャラ: 「常連がいる老舗ラーメンと、隣の鮨屋」
- 建物: `ramen` (100, 130) + `sushi_ya` (160, 138) + `kura` (50, 138) + `shed` (130, 178) + `townhouse` (75, 178)
- 取り巻き: `chouchin` × 2 + `noren` × 2 + `a_frame_sign` × 2 + `sign_board` 黄/赤
- ground: `concrete` (60×40) + `oil_stained_concrete` 路地 (50×14)
- livingTrace: `bicycle` (75, 188)

**人配置**: 屋台客 × 8 (各屋台 1-2 人)、屋台店主 × 3、酔客 × 2、cat × 1

**地面パッチ**: `asphalt` 基調、屋台中央 `red_carpet` (x=0, y=68, 220×30) 屋台床、店前 `concrete`

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: []`（横道路ゼロ：屋台の中央集約を活かす）

**Handoff**: yatai 連続が Ch8 movie_theater のネオン看板へ、chouchin 帯が継続

### Ch8: 映画館 + ミニシアター街

**チャンク物語**: 「Act III 終盤、深夜上映の映画館とミニシアターが並ぶ。レイトショー客と酔客の交差点」

**ヒーロー**: **SE = ヒーロー**（movie_theater + 周辺）/ NW・NE・SW = アンビエント

#### 🅴 SE ヒーロー: 映画館街『シネマパサージュ』 (1 ロット)

**ロット SE-1: 映画館 + 24h カフェ + スナック**
- キャラ: 「『シネマ清水』の大ポスター看板、隣の cafe でディスカッションする映画好き」
- 建物: `movie_theater` (130, 130) + `cafe` (60, 138) + `snack` (30, 178)
- 取り巻き: `sign_board` 大ポスター (130, 118) + `banner_pole` × 3 (100/158/60) + `flag_pole` × 2 + `shop_awning` × 2 + `parasol` (60, 148) + `bench` × 3 (待ち客)
- ground: `tile` 映画館前 (130, y=152, 100×60) + `wood_deck` cafe (60, y=148, 50×30) + `concrete` snack (30, y=188, 50×14)
- livingTrace: `garbage` (158, 188)

#### 🆆 NW アンビエント: カラオケ + クラブ + スナック (1 ロット)

**ロット NW-1: 雑居ビル『B 棟』** (x=-130〜-25, y=22)
- 建物: `karaoke` (-130, 22) + `club` (-75, 22) + `snack` (-25, 22) + `apartment` (-160, 70) + `capsule_hotel` (-75, 70)
- 取り巻き: `sign_board` 黄/黒+金/ピンク + `chouchin` × 2 + `parasol` (-75) + `noren` (-25) + `a_frame_sign` × 3
- ground: `concrete` × 3 (-130/-75/-25, y=56) + `asphalt` 裏 (-160, y=95)
- livingTrace: `garbage` (-158, 60)

#### 🆄 NE アンビエント: パチンコ + ゲーセン (1 ロット)

**ロット NE-1: 雑居ビル『K 棟』** (x=130〜30, y=22)
- 建物: `pachinko` (130, 22) + `game_center` (70, 22) + `snack` (165, 22) + `mahjong_parlor` (30, 22) + `business_hotel` (100, 75) + `shop` (165, 75)
- 取り巻き: `sign_board` 赤大 + `sign_board` × 3 + `a_frame_sign` × 2 + `vending` × 2
- ground: `tile` × 2 (130/70, y=56) + `concrete` × 2 (165/30)
- livingTrace: `bicycle` (158, 60)

#### 🆂 SW アンビエント: マンション + 雀荘 (1 ロット)

**ロット SW-1: 高級マンション 2 棟 + 雀荘**
- 建物: `mansion` × 2 (-100/-45, y=130) + `apartment` (-160, 138) + `townhouse` (-75, 178) + `mahjong_parlor` (-130, 178)
- 取り巻き: `mailbox` × 3 + `ac_unit` × 3 + `sign_board` 緑 (mahjong) + `noren` (mahjong) + `bicycle_rack` (-75, 168)
- ground: `concrete` 駐車 (-75, y=152, 110×40) + `oil_stained_concrete` 裏路地 (100×14)
- livingTrace: `mailbox` (-75, 122)

**人配置**: 映画客 × 5 (SE)、酔客 × 3 (NW/NE)、cat × 1

---

## Act IV — 静寂への転換

### Ch9: 駐車場と裏通り（静寂転換の入口）

**チャンク物語**: 「Act IV、賑わいが消え、コインパーキング『コイン 24』の青い屋根が浮かぶ。深夜散歩客 1 人と野良猫だけ」

**ヒーロー**: **NE = ヒーロー**（コインパーキング + ガソスタ）

#### 🅴 NE ヒーロー: コインパーキング『コイン 24』 (1 ロット)

**ロット NE-1: 駐車場 + ガソリンスタンド + 雑居店**
- キャラ: 「24h 営業のコインパーキング 24 台、隣のガソリンスタンドは深夜営業」
- 建物: `parking` (130, 68) ★ + `gas_station` (30, 22) + `shop` (165, 22)
- 取り巻き: `traffic_cone` × 5 + `barrier` × 2 + `car` × 3 (駐車中 80/130/170, y=80) + `wood_fence` × 3 + `vending` (75, 85) + `electric_box` (145, 95) + `cable_junction_box` (110, 95)
- ground: `oil_stained_concrete` 駐車場 (100×50) + `asphalt` ガソスタ (50×40) + `concrete` shop (30×40)
- livingTrace: `garbage` (158, 60)

#### 🆆 NW アンビエント: 古い住宅 + 閉店間際スナック (1 ロット)

**ロット NW-1: 昭和の住宅 + 閉店スナック**
- キャラ: 「Stage 2 のクライマックスから引いた静寂、昭和の住宅 2 軒と閉店間際のスナック」
- 建物: `house` × 2 (-130/-90, 22) + `snack` (-45, 22) + `apartment` (-160, 70) + `shop` (-100, 75)
- 取り巻き: `mailbox` × 3 + `chouchin` 薄め (-45, 28) + `noren` + `ac_unit` × 3 + `potted_plant` × 2 + `bicycle` (-100, 88) + `cat` × 2 (-130/-90, y=60)
- ground: `concrete` (-110, 56, 100×40) + `asphalt` snack (50×40)
- livingTrace: `mailbox` (-110, 22)

#### 🆂 SW アンビエント: 蔵 + 町家 (静寂) (1 ロット)

**ロット SW-1: 古い蔵集落 (神社予兆)**
- キャラ: 「Ch10 の神社の前触れ、古い蔵と町家が並ぶ」
- 建物: `kura` (-130, 130) + `machiya` (-70, 138) + `kura` (-160, 178) + `shed` (-100, 178) + `townhouse` (-30, 178)
- 取り巻き: `wood_fence` × 4 (敷地) + `noren` (-70, 138) + `noren` (-130, 168) + `milk_crate_stack` × 2 + `cat` × 2 + `puddle_reflection` × 2
- ground: `concrete` (-130, 152, 90×40) + `oil_stained_concrete` 裏 (50×14)
- livingTrace: `garbage` (-160, 188)

#### 🆂 SE アンビエント: 住宅 + 猫の溜まり (1 ロット)

**ロット SE-1: 静寂の住宅街**
- キャラ: 「Stage 2 で野良猫が最も多い区画、Stage 3 への移行直前」
- 建物: `townhouse` × 2 (80/140, 130) + `apartment` (100, 178) + `shed` (30, 178) + `kura` (165, 178)
- 取り巻き: `mailbox` × 3 + `ac_unit` × 3 + `cat` × 4 (静寂の主役) + `wood_fence` × 2 + `recycling_bin` (30, 188) + `puddle_reflection` × 2
- ground: `concrete` 駐車 (110, y=152, 100×40) + `asphalt` 裏 (200×14)
- livingTrace: `cat` (100, 168)

**人配置**: 深夜の散歩客 × 1、cat × 4 (静寂の街の主役)

**地面パッチ**: `asphalt` 基調、駐車場 `oil_stained_concrete` (x=130, y=68, 100×80)

### Ch10: 古い住宅 + 神社の裏手

**チャンク物語**: 「Stage 3 への移行 1/2、夜明け前 4:00、神社の裏手の静寂。stone_pavement の参道が始まり、fallen_leaves が積もる」

**ヒーロー**: **SW = ヒーロー**（神社の裏 + 摂社）

#### 🅴 SW ヒーロー: 神社の裏手『清水稲荷』 (1 ロット)

**ロット SW-1: 神社の裏 + 摂社 + 蔵**
- キャラ: 「町の小さな稲荷神社の裏手、石灯籠と苔むした参道、奥に蔵」
- 建物: `kura` (-100, 130) ★ 神社蔵見立て + `shed` (-160, 130) 摂社見立て + `kura` (-50, 138) + `shed` × 2 (-130/-75, 178)
- 取り巻き: `stone_lantern` × 3 (-130/-70/-100, y=145/168) + `bamboo_fence` × 4 (境界 x=-178/0) + `bamboo_water_fountain` (-70, 158) + `hedge` × 2 + `wood_fence` × 2 + `milk_crate_stack` × 2 + `rock` × 2 (神社石)
- ground: `stone_pavement` 神社境内 (-100, 145, 80×80) + `moss` 苔 (-150, 165, 30×20) + `fallen_leaves` × 2 + `gravel` 玉砂利 (40×14)
- livingTrace: `cat` (-130, 168)

#### 🆆 NW アンビエント: 古民家 + 茶屋 (Stage 3 予告) (1 ロット)

**ロット NW-1: 古民家『山田邸』 + 茶屋『松』**
- キャラ: 「夜明け前の和風住宅、Stage 3 オフィス街への切替予告として和風要素を多く配置」
- 建物: `kominka` (-130, 22) + `chaya` (-75, 22) + `wagashi` (-25, 22) + `kura` (-160, 70) + `machiya` (-75, 75)
- 取り巻き: `noren` × 3 + `mailbox` × 3 + `chouchin` × 2 (茶屋・和菓子) + `a_frame_sign` × 2 + `potted_plant` × 2 + `wood_fence` (-130, 90) + `bonsai` (-75, 88) + `cat` (-75, 95)
- ground: `grass` 古民家庭 (-110, 56, 80×40) + `dirt` 庭石 (-75, 88, 30×16) + `concrete` × 2 (両端 30×40)
- livingTrace: `mailbox` (-150, 22)

#### 🆄 NE アンビエント: 町家 + 住宅 (1 ロット)

**ロット NE-1: 町家集落**
- キャラ: 「町家と住宅が混在、夜明けに準備する商家」
- 建物: `townhouse` × 2 (80/130, 22) + `machiya` (30, 22) + `kura` (165, 70) + `apartment` (100, 75)
- 取り巻き: `mailbox` × 3 + `noren` (machiya, 30, 28) + `ac_unit` × 3 + `wood_fence` × 2 + `bonsai` (30, 60) + `potted_plant` (80, 60) + `cat` × 2
- ground: `grass` 庭 (80, 56, 50×40) + `concrete` × 2 + `asphalt` (30×40)
- livingTrace: `cat` (105, 50)

#### 🆂 SE アンビエント: 物置 + 古い住宅 (1 ロット)

**ロット SE-1: 古い裏路地**
- キャラ: 「物置と古民家がランダムに並ぶ、夜明けの静寂」
- 建物: `shed` × 2 (60/130, 130) + `machiya` (30, 138) + `kura` (165, 178) + `shed` (100, 178)
- 取り巻き: `wood_fence` × 3 + `noren` (30, 138) + `mailbox` (30, 122) + `ac_unit` × 2 + `potted_plant` (100, 168) + `bonsai` (165, 168) + `rock` × 2 + `cat` × 2
- ground: `concrete` (30×40) + `asphalt` (95, 152, 100×40) + `concrete` 裏 (200×14)
- livingTrace: `garbage` (100, 168)

**人配置**: 早朝散歩 × 1、cat × 3

**地面パッチ**: `asphalt` 残り、SW 神社 `stone_pavement` (-100, y=145, 80×80)、`fallen_leaves` × 3

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

### Ch11: 神社の表参道（Stage 3 への handoff）

**チャンク物語**: 「Stage 2 の終わり、夜明け 5:00。鳥居の表参道、早朝参拝者がぽつぽつ。Stage 3 オフィス街への切替点」

**ヒーロー**: **NE = ヒーロー**（torii + 表参道、ランドマーク）

#### 🅴 NE ヒーロー: 神社『清水稲荷』表参道 (1 ロット)

**ロット NE-1: 鳥居 + 参道 + 境内**
- キャラ: 「赤い鳥居の参道、石灯籠と狛犬、境内に賽銭箱とおみくじ」
- 建物: なし (オープンスペース焦点 = 基本形 A)、家具焦点
- 取り巻き: `torii` (80, 22) ★ + `sando_stone_pillar` × 3 (40/80/120, y=58/88) + `stone_lantern` × 2 (40/120, y=88) + `koma_inu` × 2 (60/100, y=68) + `shinto_rope` (80, 22) + `offering_box` (80, 95) + `omikuji_stand` (50, 78) + `ema_rack` (110, 78)
- 境界: `bamboo_fence` × 6 (10/150, y=10/50/90) + `shrine_fence_red` × 2 (赤い柵)
- ground: `stone_pavement` 表参道 (80, 100, 100×100) + `gravel` 玉砂利 (80, 88, 80×30) + `fallen_leaves` × 4 + `moss` (80, 130, 30×20)
- livingTrace: `newspaper_stand` (80, 95) — 控えめ

#### 🆆 NW アンビエント: 茶屋・和菓子（Stage 3 予告） (1 ロット)

**ロット NW-1: 参道脇の茶店 + 古民家**
- キャラ: 「参拝客向けの茶店『松』、Stage 3 都心オフィス街への切替準備」
- 建物: `chaya` (-100, 22) + `wagashi` (-45, 22) + `chaya` (-160, 75) + `kominka` (-75, 75)
- 取り巻き: `noren` × 2 + `chouchin` × 2 + `a_frame_sign` × 2 + `mailbox` × 2 + `wood_fence` (-75, 90) + `potted_plant` × 2 + `bonsai` (-160, 88) + `puddle_reflection` (-120, 95)
- ground: `grass` 茶屋庭 (-100, 56, 80×40) + `concrete` × 2 + `dirt` 庭石 (-75, 88, 30×16) + `asphalt` (-45, 56, 30×40)
- livingTrace: `bicycle` (-125, 60)

#### 🆂 SW アンビエント: 蔵集落 (1 ロット)

**ロット SW-1: 古い蔵 4 軒**
- キャラ: 「神社の周辺に集中する蔵、奉納物を保管する古い建物群」
- 建物: `kura` × 2 (-130/-70, 130) + `machiya` (-25, 138) + `kura` (-160, 178) + `shed` (-100, 178)
- 取り巻き: `wood_fence` × 4 + `noren` (-25, 138) + `milk_crate_stack` × 2 + `rock` × 2 (神社石) + `cat` × 3 (静寂)
- ground: `stone_pavement` (-100, 152, 80×40) + `gravel` (-130, 188, 60×14) + `moss` (-160, 178, 25×18)
- livingTrace: `garbage` (-160, 188)

#### 🆂 SE アンビエント: 古民家 + 茶屋 (Stage 3 予告) (1 ロット)

**ロット SE-1: 古民家集落**
- キャラ: 「Stage 3 オフィス街への移行を予告する伝統建築」
- 建物: `kominka` (130, 130) + `chaya` (60, 138) + `machiya` (100, 178) + `kura` (165, 178) + `shed` (30, 178) + `wagashi` (165, 22) + `kominka` (30, 75)
- 取り巻き: `noren` × 2 + `chouchin` (60, 138) + `mailbox` × 2 + `wood_fence` × 3 + `potted_plant` (100, 168) + `bonsai` (165, 168) + `rock` (60, 178) + `cat` × 2
- ground: `stone_pavement` (95, 152, 60×40) + `gravel` (130, 188, 60×14) + `moss` (160, 178, 25×18) + `asphalt` (30, 152, 30×40)
- livingTrace: `mailbox` (110, 122)

**人配置**: 早朝参拝者 × 2 (NE 参道)、cat × 3 (静寂の主役)

**地面パッチ**: `asphalt` 縮小、NE 参道 `stone_pavement` (x=80, y=100, 100×100)、`fallen_leaves` × 4 (境内アクセント)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**Handoff (Ch11 → Stage 3 Ch0)**:
- **並木**: 桜 → 街灯 → 街灯のみ → Stage 3 でオフィス街路樹（街路樹 `tree`）に切替
- **歩道**: `stone_pavement` 神社参道帯が Stage 3 へ継続
- **電柱/電線**: 4 隅で対
- **予兆**: torii と stone_pavement が Stage 3 のオフィス街公共広場 (`stone_pavement` 大パッチ) を予告

---

# §8 変更履歴

- **v1.0**: Stage 2 「夜の歓楽街 NEON DISTRICT」の新規設計指示書。Stage 1 v6.3 のフォーマットを継承し、4 Acts × 12 チャンクで再配置を設計。実装の Stage 2 (10 chunks) は **コンセプトのみ引き継ぎ**、本指示書で 12 chunks に拡張・再配置する前提。chouchin / 暖簾 / puddle_reflection / 街灯ネオンを連続軸とし、Ch4 パチンコ+交番をクライマックスに、Ch11 神社で Stage 3 への handoff を作る構成。
- **v1.1（実装ラウンド・履歴）**: 密度目安「建物 20-30 / 家具 80-120 / 人 10-22 / ground 5-8」に達するため、各 chunk の建物を平均 7 → 19.3、家具を 30 → 103.9、ground を 5 → 16.8 に強化（2.7-3.5 倍密度）。ground 多様化（asphalt + tile + concrete + wood_deck + red_carpet + stone_pavement + oil_stained_concrete + fallen_leaves + moss + gravel + grass + dirt 等を chunk ごと使い分け）。ただし「ロット単位の物語」が薄く、業種別建物の羅列に留まったため v1.2 で補強。
- **v1.2（本版）**: ロット物語強化版。Stage 1 Ch0「古民家邸 = kominka 母屋 + kura 蔵 + chaya 茶屋 + 庭」レベルの **ロット単位の意味付け** を Stage 2 にも要求するため、§4.6「ロット単位の物語デザイン」を新設（最重要原則）。各セルを 2-4 ロットに分割し、各ロットに 1 行のキャラ宣言（誰の店 / どんな客 / 時代感）+ 建物 2-4 棟（業種混在）+ 取り巻き家具 + 個別 ground + 境界要素（hedge/wood_fence/planter）を要求するチェックリスト形式に。§9 全 12 chunks の各セルを「ロット内訳」フォーマットで書き直し、ビジネスホテル『ステーションイン』、スナック『夢』、パチンコ『キング』、ラブホ『ハートライン』、屋台『はやし通り』のような **店舗キャラ** を明示。ground もロット別 (tile/concrete/red_carpet/wood_deck/oil_stained_concrete/stone_pavement) で「店舗の個性」を表現する仕様に。
