# 怪獣ランページ — Stage 2 街レイアウト v1.3 Stage1形式準拠版

<aside>
📋

**このドキュメントの位置づけ（v1.3 Stage1形式準拠版）**

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

# §9 詳細フェーズ: 各チャンクレイアウト

<aside>
📐

**読み方 (Stage 1 v6.3 と完全に同じフォーマット)**: 各チャンクは以下の項目で構成 — (1) ヒーロー/アンビエント割当 / (2) ヒーローセル 4 層（焦点・取り巻き・境界・動線）/ (3) アンビエント 3 セル / (4) 取り巻き 3 パターン（facade 沿い / 焦点囲み / 歩道沿い）/ (5) 人配置 / (6) 地面パッチ / (7) 道路 / (8) 生活痕跡・スケール・向き / (9) Handoff。座標は dx ∈ [-180, +180] / dy ∈ [0, 200] のチャンクローカル。

**🛣️ 道路**: 各チャンクの道路指定はコンセプトに沿って都度設計。固定するのは `_AVE` (x=0 縦軸) のみ。横道路 (`_MID_HR` 含む) は採否を判断。

</aside>

## Act I — 駅前繁華

### Ch0: 終電後の地方駅と北口ロータリー

**ヒーロー / アンビエント**: **NE = ヒーロー**（駅前広場、基本形 A オープンスペース）/ NW・SW・SE = アンビエント

**NE ヒーロー 4 層**:
- **焦点**: `train_station` (x=80, y=22) + `platform_edge` × 2 (x=50/110, y=70) + `railway_track` × 4 (y=78-86) + `signal_tower` (x=80, y=95)
- **取り巻き（駅前広場）**: `bench` × 4 不揃い (x=20/65/120/165, y=85)、`flower_planter_row` × 3、`flag_pole` × 2 (x=30/130, y=62)、`bus_terminal_shelter` (x=30, y=65)
- **境界**: `bollard` × 4 (avenue 横断 -65/+62/-150/+148, y=92-108)
- **動線**: `bus_stop` × 2 (x=30/130, y=88)、`taxi_rank_sign` × 2 (x=145/165)、`manhole_cover` × 3、`street_lamp` × 2

**アンビエント 3 セル**:
- **NW**: `business_hotel` (x=-130, y=22) + `sign_board` 青 + `atm` × 2 + `mailbox` (痕跡)
- **SW**: `ramen` (x=-160, y=130) + `izakaya` (x=-100, y=130) + `chouchin` × 2 + `noren` × 2 + `bicycle` (痕跡)
- **SE**: `convenience` (x=130, y=130) + `cafe` (x=70, y=130 テラス) + `bookstore` (x=30, y=130) + `garbage` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 4 (青/ピンク/黄/青)、`mailbox` × 3 不均等
- **焦点囲み**: NE 駅前広場の bench × 4 + flag_pole × 2 + flower_planter_row × 3
- **歩道沿い** (avenue 両脇 y=88/108): `chouchin` × 4 上空 (y=15)、`street_lamp` × 2、`puddle_reflection` × 2

**人配置**: 終電客 (adult_m × 7、avenue + 駅前広場)、駅員 × 1 (改札)、酔客 × 2 (SW)、cat × 1 (SE 裏)

**地面パッチ**:
- **基調**: `asphalt` 全面
- **NE** 焦点: `concrete` 駅舎前 (x=80 y=80, 200×120) + `tile` ホーム (x=80 y=70, 100×20)
- **歩道帯**: `stone_pavement` (x=-65, 12×200) — Stage 1 継続軸
- **ロット**: NW `tile` / SW `concrete` / SE `wood_deck` (cafe)
- **アクセント**: `oil_stained_concrete` 小 (avenue 中央、夜街シグネチャ)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（駅前は asphalt 大パッチで広場化）

**生活の痕跡 / スケール / 向き**:
- **痕跡**: NW `mailbox`、NE `newspaper_stand`、SW `bicycle`、SE `garbage` — 4 セル全 ✅
- **スケール**: 大 `train_station` / 中 `business_hotel`/`ramen`/`convenience` / 小 `bench` × 4・`mailbox` × 3 — 1:3:20
- **向き**: bench は station 方向、taxi_rank_sign は avenue 向き、bicycle は店壁傾き

**Handoff (Stage 1 Ch11 → Stage 2 Ch0)**:
- **並木**: pine_tree (Ch11) → 街灯ネオン (Stage 2 連続軸開始)
- **歩道**: `stone_pavement` (x=-65) 帯継続
- **電柱/電線**: 4 隅で対 + `cable_junction_box` 増 (Stage 2 へ)
- **予兆**: 駅舎の青ネオン + `chouchin` 帯が Act II 歓楽街への入口感

### Ch1: 終電後の食事街（ramen + izakaya + karaoke 3 連）

**ヒーロー / アンビエント**: **SW = ヒーロー**（基本形 C: 3 連飲食店）/ NW・NE・SE = アンビエント

**SW ヒーロー 4 層**:
- **焦点**: `ramen` (x=-145, y=128) + `izakaya` (x=-95, y=128) + `karaoke` (x=-35, y=128) の 3 連 dy=128 揃え
- **取り巻き（各店）**: 各店 `chouchin` × 2 (店前 y=118)、`noren` × 3、`a_frame_sign` × 3 (y=148)、`shop_awning` × 2
- **境界**: `bollard` × 2 (横丁の入口、x=-160/-10, y=110)、`flower_planter_row` × 2 (店間)、`wood_fence` (x=-178, y=148)
- **動線**: `street_lamp` × 2 (x=-120/-10, y=130)、`puddle_reflection` × 3 (店前 y=145)

**アンビエント 3 セル**:
- **NW**: `business_hotel` (x=-130, y=22) + `capsule_hotel` (x=-160, y=60) + `sign_board` 青 + `atm` + `mailbox` (痕跡)
- **NE**: `convenience` (x=110, y=22) + `apartment_tall` (x=35, y=22) + `vending` × 2 + `bicycle_rack` (痕跡)
- **SE**: `townhouse` × 2 (x=80/140, y=130) + `bookstore` (x=30, y=130) + `cat` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 4 (青 NW/NE、店列 SW)、`chouchin` 上空 × 4
- **焦点囲み**: SW 3 連店の chouchin × 4 + noren × 3 + a_frame_sign × 3
- **歩道沿い** (avenue 両脇): `street_lamp` × 2、`bollard` × 2、`manhole_cover` × 3

**人配置**: 飲み客 (adult_m × 6、3 店各 2 人)、サラリーマン × 3 (avenue)、客引き × 1 (SW 端)、cat × 1 (SE 裏)

**地面パッチ**:
- **基調**: `asphalt`
- **SW** 焦点: `concrete` 3 連店前 (x=-90 y=145, 200×40) + `oil_stained_concrete` 路地裏 (x=-100 y=175, 180×25)
- **歩道帯**: `stone_pavement` (x=-65) 継続
- **ロット**: NW `tile` (ホテル前) / NE `tile` (コンビニ) / SE `concrete` (駐車)
- **アクセント**: `oil_stained_concrete` 小 (avenue 中央)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**:
- **痕跡**: 各セル 1 個以上 ✅
- **スケール**: 大 `karaoke` / 中 `ramen`/`izakaya`/`business_hotel`/`convenience` / 小 `chouchin` × 多
- **向き**: chouchin は店前向き、暖簾は avenue 向き

**Handoff (Ch0→Ch1)**: chouchin 帯継続、Stage 1 sakura は終了、街灯ネオンが連続軸

### Ch2: 商店街アーケード入口（merged hero）

**ヒーロー / アンビエント**: **NW+NE merged = ヒーロー**（提灯ガーランドのアーケードゲート）/ SW・SE = アンビエント

**merged ヒーロー 4 層**:
- **焦点**: `shotengai_arcade` × 2 (x=-118/+118, y=22) ゲート両柱 + `pachinko` (x=60, y=22) + `karaoke` (x=-60, y=22)
- **取り巻き**: `chouchin` × 14 (avenue 全幅 y=22 不揃い間隔 22-32px) + `banner_pole` × 4 (各端 y=28)
- **境界**: `flag_pole` × 2 (中央 x=-30/+30, y=12 上空)、`flower_planter_row` × 2 (左右端 y=88)
- **動線**: `street_lamp` × 2 (avenue 両脇)、`puddle_reflection` × 3、`bollard` × 4 横断帯

**アンビエント 2 セル** (merged が大きいため 2 セルのみ):
- **SW**: `pachinko` 予告 (x=-130, y=130) + `business_hotel` + `sign_board` 赤 + `garbage` (痕跡、Ch4 予告)
- **SE**: `club` 予告 (x=130, y=130) + `townhouse` × 2 + `sign_board` 黒+金 + `bicycle` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `chouchin` × 14 アーケード帯
- **焦点囲み**: アーケードゲート両柱 + banner_pole × 4
- **歩道沿い**: `street_lamp` × 2、`bicycle_rack` × 2、`vending` × 2

**人配置**: 商店街客 × 多 8-10 (avenue 全幅)、客引き × 2 (Ch2 SE)、cat × 1

**地面パッチ**:
- **基調**: `asphalt`
- アーケード床: `tile` (x=0 y=100, 360×30) — 全幅
- **ロット**: SW `concrete` (pachinko) / SE `red_carpet` (club)
- **歩道帯**: `stone_pavement` 継続
- **アクセント**: `oil_stained_concrete` 小 (avenue 中央)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]`（Act 境界の予告 _TOP_HR）

**生活の痕跡 / スケール / 向き**:
- **痕跡**: SW garbage、SE bicycle、上段は商店街床のため痕跡少 (連続軸 chouchin で代替)
- **スケール**: 大 `shotengai_arcade` × 2 / 中 `pachinko`/`karaoke` / 小 `chouchin` × 14
- **向き**: chouchin は avenue 中央向き、banner_pole は両端向き

**Handoff (Ch1→Ch2)**: chouchin 帯が連続、Ch3 高層雑居ビル予告として SW pachinko / SE club を facade に

---

## Act II — 歓楽街最盛期

### Ch3: 高層雑居ビル（karaoke 街）

**ヒーロー / アンビエント**: **NE = ヒーロー**（karaoke 大看板の縦帯、基本形 B 高層）/ NW・SW・SE = アンビエント

**NE ヒーロー 4 層**:
- **焦点**: `karaoke` (x=130, y=22) + `apartment_tall` (x=80, y=22) + `club` (x=30, y=22) の高層 3 棟
- **取り巻き**: `sign_board` 大 (x=130, y=8 屋上ネオン) + `chouchin` × 4 (店前 y=58) + `a_frame_sign` × 3
- **境界**: `bollard` × 3 (x=70/100/170, y=92) + `flag_pole` (x=130, y=12)
- **動線**: `street_lamp` × 2 (x=80/170, y=88)、`puddle_reflection` × 2 (店前 y=110)、`recycling_bin` (痕跡)

**アンビエント 3 セル**:
- **NW**: `club` (x=-130, y=22) + `capsule_hotel` (x=-75, y=22) + `sign_board` 黒+金 + `parasol` + `recycling_bin` (痕跡)
- **SW**: `business_hotel` (x=-100, y=130) + `townhouse` (x=-160, y=138) + `mahjong_parlor` (x=-50, y=138) + `mailbox` (痕跡)
- **SE**: `mansion` × 2 (x=80/140, y=130) + `pharmacy` (x=30, y=138) + `cafe` (x=165, y=138) + `bicycle_rack` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 4 (黄/黒+金/ピンク/青)、屋上ネオン × 1 大
- **焦点囲み**: NE 雑居ビル前の chouchin × 4 + a_frame_sign × 3
- **歩道沿い**: `street_lamp` × 2、`puddle_reflection` × 3

**人配置**: ホスト/ホステス × 4 (NW)、飲み客 × 5 (NE karaoke)、サラリーマン × 3 (avenue)、cat × 1

**地面パッチ**:
- **基調**: `asphalt`
- **NE** 焦点: `concrete` karaoke 前 (60×30) + `tile` apartment_tall (50×30) + `red_carpet` club (50×20)
- **ロット**: NW `red_carpet` (club) / SW `concrete` / SE `tile` (mansion 駐車) + `wood_deck` (cafe)
- **歩道帯**: `stone_pavement` 継続
- **アクセント**: `oil_stained_concrete` 小

**道路**: `verticalRoads: [_AVE, _VR(-90, 0, 100)]`（雑居ビル間裏路地）/ `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**:
- **痕跡**: 各セル 1 個以上 ✅
- **スケール**: 大 `apartment_tall`/`karaoke` / 中 `club`/`mansion` / 小 `chouchin`/`a_frame_sign`
- **向き**: ネオン sign は avenue 向き、parasol は入口向き

**Handoff (Ch2→Ch3)**: SW pachinko 予告 → Ch4 大パチンコへ、chouchin 帯継続

### Ch4: パチンコ + 交番交差点（merged hero、Stage 2 クライマックス）

**ヒーロー / アンビエント**: **全マージ merged = ヒーロー**（街の交差点、Stage 2 視覚的ピーク）

**merged ヒーロー 4 層**:
- **焦点**: `pachinko` (x=-100, y=22) ★ + `police_station` (x=0, y=130) ★ 中央交番 + `game_center` (x=100, y=22)
- **取り巻き**: `sign_board` 巨大 × 2 (パチンコ・ゲーセン y=8) + `flag_pole` × 2 (交番前 x=±12) + `traffic_cone` × 4 (交番前路上)
- **境界**: `bollard` × 4 (avenue 横断帯)、`barrier` × 2 (パチンコ前)
- **動線**: `street_lamp` × 2、`street_mirror` × 2 (交差点)、`puddle_reflection` × 4 (4 角)

**アンビエント (狭い)**:
- **NW** + NE 端: `snack` × 2 (x=-160/+160, y=22) + `love_hotel` (x=-55, y=22) + `club` (x=60, y=22) + `capsule_hotel`/`shop` 奥
- **SW** + SE 下段: `mahjong_parlor`/`business_hotel`/`izakaya`/`ramen`/`townhouse`/`apartment` 混在

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 6 (赤/黄/ピンク/緑/黒+金/青)、屋上ネオン × 2 大
- **焦点囲み**: 交番中央 + パチンコ前 + ゲーセン前
- **歩道沿い**: `street_lamp` × 2、`bollard` × 4、`manhole_cover` × 3、`newspaper_stand` × 2

**人配置**: パチンコ客 × 6 (待ち列)、警察官 × 1 (交番)、客引き × 3、酔客 × 4、サラリーマン × 4 (avenue)、cat × 1

**地面パッチ**:
- **基調**: `asphalt`
- **焦点**: `tile` パチンコ前 (90×50) + `concrete` 交番前 (80×50) + `tile` ゲーセン (90×50)
- 各ロット: `red_carpet` × 2 (love_hotel/club)、`concrete` × 4 (snack/ホテル)
- **歩道帯**: `stone_pavement` 継続
- **アクセント**: `oil_stained_concrete` (avenue 中央 + パチンコ前路地)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]`（4 方向交差点感）

**生活の痕跡 / スケール / 向き**:
- **痕跡**: garbage (NW)、bicycle (SE)、cat (SW)
- **スケール**: 大 `pachinko`/`game_center` / 中 `koban`/`love_hotel`/`club` / 小 `traffic_cone` × 6・`bollard` × 4
- **向き**: 交番 flag_pole は avenue 向き、parasol は入口向き

**Handoff (Ch3→Ch4)**: 大ネオン継続、Ch5 横丁への転換

### Ch5: 老舗飲み屋横丁（merged hero）

**ヒーロー / アンビエント**: **SW+SE merged = ヒーロー**（横丁感、4-5 連の小店並び）/ NW・NE = アンビエント

**merged ヒーロー 4 層**:
- **焦点**: `snack` × 2 (x=-160/+60, y=130) + `mahjong_parlor` (x=-100, y=130) + `izakaya` (x=-30, y=130) + `sushi_ya` (x=130, y=130) — 5 軒並び
- **取り巻き（各店）**: `chouchin` × 5 (各店前 y=122) + `noren` × 5 (y=128)、`a_frame_sign` × 4 (y=148 不揃い)
- **境界**: `wood_fence` × 2 (横丁の両入口 x=-178/+178, y=120)、`hedge` (x=20, y=145)
- **動線**: `street_lamp` × 3 (中央 + 端、y=130)、`puddle_reflection` × 4 (店前 y=148)

**アンビエント 2 セル**:
- **NW**: `bank` (x=-130, y=22) + `flag_pole` + `atm` × 2 + `mailbox` (痕跡)
- **NE**: `capsule_hotel` (x=130, y=22) + `sign_board` + `vending` × 2 + `garbage` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): NW bank + NE capsule の sign_board × 2、`atm` × 2
- **焦点囲み**: 横丁 5 軒の chouchin × 5 + noren × 5 + a_frame_sign × 4
- **歩道沿い**: `street_lamp` × 3、`puddle_reflection` × 4

**人配置**: 飲み客 × 8 (横丁狭い空間に密)、ママさん × 1 (snack 前)、サラリーマン × 2 (avenue)、cat × 2 (路地)

**地面パッチ**:
- **基調**: `asphalt`
- merged 焦点: `concrete` 横丁通り (x=0 y=145, 360×30) + `oil_stained_concrete` 路地裏 (280×20)
- **ロット**: NW `tile` (bank 前) / NE `tile` (capsule)
- **歩道帯**: `stone_pavement` 継続
- **アクセント**: `oil_stained_concrete` 小 (avenue)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**:
- **痕跡**: SW snack 前 garbage、NE capsule 前 garbage、cat × 2
- **スケール**: 中 `bank`/`capsule_hotel`/`mahjong_parlor`/`izakaya`/`sushi_ya`/`snack` × 2 / 小 `chouchin` × 5
- **向き**: 横丁 chouchin は店前向き、ピンク/緑/黄が混在

**Handoff (Ch4→Ch5)**: クライマックスから横丁へ密度減、Ch6 ラブホ街予告

---

## Act III — ホテルと屋台

### Ch6: ラブホテル街

**ヒーロー / アンビエント**: **NW = ヒーロー**（love_hotel 街、基本形 B）/ NE・SW・SE = アンビエント

**NW ヒーロー 4 層**:
- **焦点**: `love_hotel` × 3 (x=-110/-50, y=22 大2軒 + x=-160, y=75 小1軒)
- **取り巻き**: `sign_board` ピンク × 2 (大ネオン y=8) + `parasol` × 2 (入口 y=58) + `flag_pole` × 2
- **境界**: `hedge` × 5 高め目隠し (x=-178 列 y=10/50/90 + x=10 列 y=10/50)
- **動線**: `street_lamp` (x=-150, y=88)、`puddle_reflection` × 2、`flower_bed` (x=-75, y=88)

**アンビエント 3 セル**:
- **NE**: `club` × 2 (x=130/70, y=22) + `mahjong_parlor` (x=30, y=22) + `sign_board` 黒+金 + `recycling_bin` (痕跡)
- **SW**: `snack` (x=-130, y=130) + `mahjong_parlor` (x=-75, y=130) + `izakaya` + `chouchin` ピンク + `garbage` (痕跡)
- **SE**: `mahjong_parlor` (x=130, y=130) + `cafe` (x=30, y=138) + `mansion` (x=165, y=138) + `sign_board` 緑 + `bicycle` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 4 (ピンク × 2、黒+金 × 2)
- **焦点囲み**: NW ラブホ前の parasol × 2 + flag_pole × 2 + 目隠し hedge × 5
- **歩道沿い** (avenue 両脇): `street_lamp` × 2、`puddle_reflection` × 3、`bollard` × 2

**人配置**: カップル × 2 (NW)、ホステス × 2 (NE)、酔客 × 3 (SW snack)、cat × 1

**地面パッチ**:
- **基調**: `asphalt`
- **NW** 焦点: `red_carpet` ラブホ前 (x=-80 y=60, 100×40) + `red_carpet` 小 (-160, 88)
- **ロット**: NE `red_carpet` × 2 (club) / SW `concrete` (snack 通り) + `oil_stained_concrete` (路地) / SE `wood_deck` (cafe) + `tile` (mahjong)
- **歩道帯**: `stone_pavement` 継続

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**:
- **痕跡**: NW recycling_bin (匿名性で控えめ)、NE recycling、SW garbage、SE bicycle
- **スケール**: 大 `love_hotel` × 3 / 中 `club`/`mahjong_parlor`/`mansion` / 小 `hedge` × 5・`parasol` × 2
- **向き**: parasol は入口向き、hedge は外向き目隠し

**Handoff (Ch5→Ch6)**: 横丁から派手なネオン、Ch7 屋台予告として SW snack の chouchin

### Ch7: 屋台横丁（merged hero、横道路ゼロ）

**ヒーロー / アンビエント**: **NW+NE merged = ヒーロー**（屋台 5 連が中央集約、基本形 A オープンスペース）/ SW・SE = アンビエント

**merged ヒーロー 4 層**:
- **焦点**: `yatai` × 5 (x=-110/-55/0/55/108, y=68 微不揃い) ★
- **取り巻き（屋台周辺）**: 各屋台 `chouchin` × 1 (上空 y=58) + `parasol` × 1 (y=78) + `noren` × 5 (y=64)、客 `bench` × 5 (準対称、屋台間)
- **境界**: `wood_fence` × 2 (横丁入口 avenue 端 x=±178)、`flower_planter_row` × 2
- **動線**: `popcorn_cart` × 2 (西東端)、`balloon_cluster` × 3 (上空 y=30)、`street_lamp` × 2

**アンビエント 2 セル**:
- **SW**: `chaya` (x=-100, y=130) + `izakaya` (x=-160, y=138) + `noren` + `cat` (痕跡)
- **SE**: `ramen` (x=100, y=130) + `sushi_ya` (x=160, y=138) + `chouchin` × 2 + `bicycle` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): 上段店ロット (townhouse/apartment/shop) の sign_board × 4
- **焦点囲み**: 屋台 5 連 + bench × 5 + parasol × 5 + chouchin × 5
- **歩道沿い**: `street_lamp` × 2、`balloon_cluster` × 3 上空 (祭り感)、`popcorn_cart` × 2

**人配置**: 屋台客 × 8 (各屋台 1-2 人)、屋台店主 × 5 (各屋台後ろ)、酔客 × 2、cat × 1

**地面パッチ**:
- **基調**: `asphalt`
- merged 焦点: `red_carpet` 屋台床 (x=0 y=78, 240×30) + `concrete` 屋台前 (x=0 y=100, 320×30)
- **ロット**: SW `concrete` (chaya 前) + `oil_stained_concrete` (路地) / SE `concrete` (ramen 前)
- 上段店: `tile` × 2 / `concrete` × 4
- **歩道帯**: `stone_pavement` 継続

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: []`（横道路ゼロ：屋台中央集約を活かす）

**生活の痕跡 / スケール / 向き**:
- **痕跡**: SW cat、SE bicycle、屋台周辺 garbage × 1
- **スケール**: 中 `yatai` × 5 / 小 `bench` × 5・`chouchin` × 5・`parasol` × 5
- **向き**: parasol は屋台中央向き、bench は屋台向き

**Handoff (Ch6→Ch7)**: ラブホから屋台へ、yatai 連続が Ch8 movie_theater のネオン看板へ予告

### Ch8: 映画館 + ミニシアター街

**ヒーロー / アンビエント**: **SE = ヒーロー**（movie_theater 大ポスター、基本形 B）/ NW・NE・SW = アンビエント

**SE ヒーロー 4 層**:
- **焦点**: `movie_theater` (x=130, y=130) ★ + `cafe` (x=60, y=138) 隣
- **取り巻き**: `sign_board` ポスター見立て (x=130, y=118) + `banner_pole` × 3 (x=100/158/60, y=120) + `flag_pole` × 2 + `shop_awning` × 2
- **境界**: `flower_planter_row` × 2 (x=110/170, y=170)、`bollard` × 3 (x=80/178/30, y=140)
- **動線**: `street_lamp` × 2、`bench` × 3 待ち客、`puddle_reflection` × 2

**アンビエント 3 セル**:
- **NW**: `karaoke` (x=-130, y=22) + `club` (x=-75, y=22) + `snack` (x=-25, y=22) + `sign_board` 黄 + `garbage` (痕跡)
- **NE**: `pachinko` (x=130, y=22) + `game_center` (x=70, y=22) + `snack` (x=165, y=22) + `sign_board` 赤 + `bicycle` (痕跡)
- **SW**: `mansion` × 2 (x=-100/-45, y=130) + `mahjong_parlor` (x=-130, y=178) + `mailbox` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `sign_board` × 5 (黄/黒+金/ピンク/赤/緑)
- **焦点囲み**: SE 映画館前のポスター + banner_pole × 3 + flag_pole × 2
- **歩道沿い**: `street_lamp` × 2、`puddle_reflection` × 3

**人配置**: 映画客 × 5 (SE)、ホスト × 3 (NW)、パチンコ客 × 3 (NE)、cat × 1

**地面パッチ**:
- **基調**: `asphalt`
- **SE** 焦点: `tile` 映画館前 (100×60) + `wood_deck` cafe (50×30)
- **ロット**: NW `concrete` × 2 + `tile` (snack) / NE `tile` × 2 + `concrete` × 2 / SW `concrete` (mansion 駐車)
- **歩道帯**: `stone_pavement` 継続

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**:
- **痕跡**: 4 セル各 1 個以上 ✅
- **スケール**: 大 `movie_theater`/`pachinko` / 中 `karaoke`/`mansion`/`game_center` / 小 `banner_pole` × 3
- **向き**: ポスター看板は avenue 向き、banner_pole は左右対象

**Handoff (Ch7→Ch8)**: 屋台から映画館へ、深夜上映の客 × 5 が SE に集中

---

## Act IV — 静寂への転換

### Ch9: 駐車場と裏通り（静寂転換の入口）

**ヒーロー / アンビエント**: **NE = ヒーロー**（コインパーキング、基本形 A オープンスペース）/ NW・SW・SE = アンビエント（古い住宅 / 蔵 / 町家）

**NE ヒーロー 4 層**:
- **焦点**: `parking` (x=130, y=68) 大駐車場 + `gas_station` (x=30, y=22)
- **取り巻き**: `traffic_cone` × 4 + `barrier` × 2 + 駐車車両 `car` × 3 (x=80/130/170, y=80)
- **境界**: `wood_fence` × 3 (区画 x=75 列)、`hedge` × 2 (x=178)
- **動線**: `street_lamp` × 1 (寂しい)、`vending` × 1 (孤立)、`garbage` (痕跡)

**アンビエント 3 セル**:
- **NW**: 古い `house` × 2 (x=-130/-90, y=22) + `snack` (x=-45, y=22 閉店間際) + `mailbox` × 3 (痕跡)
- **SW**: `kura` (x=-130, y=130) + `machiya` (x=-70, y=138) + `wood_fence` × 3 + `garbage` (痕跡: 寂しさ)
- **SE**: `townhouse` × 2 (x=80/140, y=130) + `apartment` (x=100, y=178) + `cat` × 4 (痕跡: 静寂の主役)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): 古い `mailbox` × 4 不揃い
- **焦点囲み**: 駐車場 traffic_cone × 4 + 駐車車両 × 3 + barrier × 2
- **歩道沿い**: `puddle_reflection` × 3 (朝霧の予兆)、`street_lamp` × 2

**人配置**: 深夜散歩客 × 1、cat × 5 (静寂の街の主役)

**地面パッチ**:
- **基調**: `asphalt`
- **NE** 焦点: `oil_stained_concrete` 駐車場 (x=130 y=80, 100×50)
- **ロット**: NW `concrete` (古い住宅) / SW `stone_pavement` 80×40 + `fallen_leaves` 30×16 (神社予兆) / SE `concrete` (駐車)
- **歩道帯**: `stone_pavement` 継続

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**:
- **痕跡**: NW mailbox × 4、SW garbage、SE cat × 4
- **スケール**: 大 `parking` / 中 `gas_station`/`house`/`kura` / 小 `traffic_cone` × 4・`car` × 3
- **向き**: 駐車車両は駐車場入り口向き、cat は様々

**Handoff (Ch8→Ch9)**: 賑わいから静寂へ、chouchin 1 本だけ残る (寂しさ表現)

### Ch10: 古い住宅 + 神社の裏手

**ヒーロー / アンビエント**: **SW = ヒーロー**（神社の裏 + 蔵集落、stone_pavement 参道予告）/ NW・NE・SE = アンビエント

**SW ヒーロー 4 層**:
- **焦点**: `kura` (x=-100, y=130) ★ 神社蔵見立て + `shed` (x=-160, y=130) 摂社見立て
- **取り巻き**: `stone_lantern` × 3 (準対称 x=-130/-70/-100, y=145/168) + `bamboo_water_fountain` (x=-70, y=158)
- **境界**: `bamboo_fence` × 4 (神社境内輪郭 x=-178 列 + x=0 列)、`hedge` × 2
- **動線**: `stone_pavement` 帯 (x=-100, y=145, 80×80)、`fallen_leaves` × 2 ground

**アンビエント 3 セル**:
- **NW**: `kominka` (x=-130, y=22) + `chaya` (x=-75, y=22) + `wagashi` (x=-25, y=22) + `noren` × 3 + `mailbox` (痕跡)
- **NE**: `townhouse` × 2 (x=80/130, y=22) + `machiya` (x=30, y=22) + `bonsai` + `cat` (痕跡)
- **SE**: `shed` × 2 (x=60/130, y=130) + `machiya` (x=30, y=138) + `kura` (x=165, y=178) + `garbage` (痕跡)

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `noren` × 3 (chaya/wagashi/kominka)、`mailbox` × 3 不揃い
- **焦点囲み**: SW 神社の stone_lantern × 3 + bamboo_water_fountain + bamboo_fence × 4
- **歩道沿い**: `puddle_reflection` × 3 (朝霧)、`street_lamp` × 2

**人配置**: 早朝散歩 × 1、cat × 4 (静寂)

**地面パッチ**:
- **基調**: `asphalt` 残り
- **SW** 焦点: `stone_pavement` 神社境内 (-100, 145, 80×80) + `moss` 苔 (30×20) + `fallen_leaves` × 2 + `gravel` 玉砂利 (40×14)
- **ロット**: NW `grass` 古民家庭 (80×40) + `dirt` 庭石 (30×16) / NE `grass` 庭 (50×40) + `concrete` / SE `concrete` (蔵集落) + `asphalt`
- **歩道帯**: `stone_pavement` 継続

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**:
- **痕跡**: NW mailbox、NE cat、SE garbage、SW cat × 2
- **スケール**: 中 `kominka`/`chaya`/`machiya`/`kura` / 小 `stone_lantern` × 3・`bamboo_fence` × 4
- **向き**: 石灯籠は参道向き、bonsai は南向き、bamboo_water_fountain は神社入口向き

**Handoff (Ch9→Ch10)**: 駐車場の静寂から神社の裏へ、stone_pavement 参道開始

### Ch11: 神社の表参道（Stage 3 への handoff）

**ヒーロー / アンビエント**: **NE = ヒーロー**（torii と表参道、Stage 3 への移行点）/ NW・SW・SE = アンビエント（Stage 3 予告として和風）

**NE ヒーロー 4 層**:
- **焦点**: `torii` 鳥居 (x=80, y=22) ★ ランドマーク + `offering_box` (x=80, y=95) + `omikuji_stand` + `ema_rack`
- **取り巻き**: `sando_stone_pillar` × 3 (x=40/80/120, y=58/88) + `stone_lantern` × 2 (x=40/120, y=88) + `koma_inu` × 2 (x=60/100, y=68)
- **境界**: `bamboo_fence` × 6 (参道両側 x=10/150 列、y=10/50/90) + `shrine_fence_red` × 2 (赤柵)
- **動線**: 参道 `stone_pavement` 帯 (x=80, y=100, 100×100)、`shinto_rope` (鳥居上 x=80, y=22)

**アンビエント 3 セル**:
- **NW**: `chaya` (x=-100, y=22) + `wagashi` (x=-45, y=22) + `kominka` (x=-75, y=75) + `noren` × 2 + `bicycle` (痕跡)
- **SW**: `kura` × 2 (x=-130/-70, y=130) + `machiya` (x=-25, y=138) + `wood_fence` × 3 + `garbage` (痕跡)
- **SE**: `kominka` (x=130, y=130) + `chaya` (x=60, y=138) + `mailbox` (痕跡) + `cat` × 2

**取り巻き 3 パターン**:
- **facade 沿い** (y=22): `noren` × 3 (chaya/wagashi)、`chouchin` × 2 (Stage 3 予告として和風 facade)
- **焦点囲み**: NE 表参道の sando_stone_pillar × 3 + stone_lantern × 2 + koma_inu × 2
- **歩道沿い**: `puddle_reflection` × 3 (朝霧)、`street_lamp` × 2

**人配置**: 早朝参拝者 × 2 (NE 参道)、cat × 3 (静寂の主役)

**地面パッチ**:
- **基調**: `asphalt` 縮小
- **NE** 焦点: `stone_pavement` 表参道 (x=80, y=100, 100×100) + `gravel` 玉砂利 (80×30) + `fallen_leaves` × 4 (40/120, y=88, 25×15) + `moss` (30×20)
- **ロット**: NW `grass` (茶屋庭 80×40) + `dirt` 庭石 / SW `stone_pavement` 蔵集落 (80×40) + `gravel` (60×14) + `moss` (25×18) / SE `stone_pavement` (60×40) + `gravel` (60×14) + `moss`
- **歩道帯**: `stone_pavement` 継続

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**生活の痕跡 / スケール / 向き**:
- **痕跡**: NW bicycle、SW garbage、SE mailbox、NE newspaper_stand
- **スケール**: 中 `chaya`/`wagashi`/`kominka`/`kura`/`machiya` / 小 `stone_lantern` × 2・`koma_inu` × 2・`bamboo_fence` × 6
- **向き**: torii は avenue 向き、koma_inu は内向き対、stone_lantern は参道側に開口

**Handoff (Ch11 → Stage 3 Ch0)**:
- **並木**: 街灯 → Stage 3 でオフィス街路樹 `tree` に切替
- **歩道**: `stone_pavement` 神社参道帯が Stage 3 へ継続
- **電柱/電線**: 4 隅で対
- **予兆**: torii と stone_pavement が Stage 3 のオフィス公共広場 (`stone_pavement` 大パッチ) を予告

---
# §8 変更履歴

- **v1.0**: Stage 2 「夜の歓楽街 NEON DISTRICT」の新規設計指示書。Stage 1 v6.3 のフォーマットを継承し、4 Acts × 12 チャンクで再配置を設計。実装の Stage 2 (10 chunks) は **コンセプトのみ引き継ぎ**、本指示書で 12 chunks に拡張・再配置する前提。chouchin / 暖簾 / puddle_reflection / 街灯ネオンを連続軸とし、Ch4 パチンコ+交番をクライマックスに、Ch11 神社で Stage 3 への handoff を作る構成。
- **v1.1（実装ラウンド・履歴）**: 密度目安「建物 20-30 / 家具 80-120 / 人 10-22 / ground 5-8」に達するため、各 chunk の建物を平均 7 → 19.3、家具を 30 → 103.9、ground を 5 → 16.8 に強化（2.7-3.5 倍密度）。ground 多様化（asphalt + tile + concrete + wood_deck + red_carpet + stone_pavement + oil_stained_concrete + fallen_leaves + moss + gravel + grass + dirt 等を chunk ごと使い分け）。ただし「ロット単位の物語」が薄く、業種別建物の羅列に留まったため v1.2 で補強。
- **v1.2**: ロット物語強化版。Stage 1 Ch0「古民家邸 = kominka 母屋 + kura 蔵 + chaya 茶屋 + 庭」レベルの **ロット単位の意味付け** を Stage 2 にも要求するため、§4.6「ロット単位の物語デザイン」を新設。各セルを 2-4 ロットに分割し、各ロットに 1 行のキャラ宣言 + 建物 + 取り巻き + 個別 ground を要求。§9 全 12 chunks をロット内訳形式に。
- **v1.3（本版）**: Stage 1 v6.3 と完全に同じ §9 フォーマットに統一。v1.2 で追加した §4.6「ロット単位の物語デザイン」を撤回（Stage 1 にはロット概念がないため）。各セルを 4 層構造（焦点・取り巻き・境界・動線）+ アンビエント 3 セル + 取り巻き 3 パターン（facade 沿い / 焦点囲み / 歩道沿い）+ 人配置 + 地面パッチ + 道路 + 生活痕跡・スケール・向き + Handoff という Stage 1 と同じ項目で記述。1 chunk あたり 35-50 行程度に圧縮し、コードの可読性を優先。Stage 2 固有のキャラ感は §1 / §3 のテーマ宣言で扱い、§9 は配置仕様に専念。
