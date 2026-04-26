# 怪獣ランページ — Stage 3 街レイアウト v1.1 Stage1形式準拠版

<aside>
📋

**このドキュメントの位置づけ（v1.1 Stage1形式準拠版）**

Stage 3「都心オフィス街 DOWNTOWN」の **再配置のための設計指示書**。Stage 1 v6.3 と同じフォーマット。

**Stage 1 v6.3 の §2 / §4 / §5 / §6 / §6.5 / §6.6 はそのまま継承**。Stage 3 では Stage 固有のコンセプト・取り巻き辞書・連続軸を §1 / §3 / §4.5 / §6.5 で書き直す。

</aside>

<aside>
🏙️

**Stage 3 のテーマ宣言**

Stage 2 末尾の神社の参道（早朝）から **朝のオフィス街** に切り替わる。**通勤客の波**、ガラス張りの高層ビル、銀行・市役所・病院などの公共中枢、駅前広場、横断歩道。プレイヤーは怪獣として **都心の機能集積** を破壊しながら通勤ラッシュを駆け抜ける。

**コアトーン**: 整然 / 直線 / ガラスとコンクリート / 公共施設の重み / 朝の光と影 / ビジネス感

**Stage 2 との対比**: Stage 2 は雑多・夜・赤橙のネオン → Stage 3 は整然・朝・青灰のガラス。Stage 1 → 2 とは違う種類の「街の機能の切替」。

</aside>

<aside>
🆕

**v1.0 の方針**

- Stage 1 v6.3 の **公園モデル 4 層構造** と **SemanticCluster** 継承
- 道路は **中央 `_AVE` のみ固定**（Stage 1 v6.2 方針継承）
- 12 チャンクで構成、4 Acts 配分
- 連続軸: **公共施設のファサード列 / 銀行+市役所+病院の機能集積 / 街路樹 `tree` / 横断歩道のゼブラ模様**
- 既存実装の Stage 3（現状は和風プレースホルダー）は本指示書に基づき **オフィス街として再配置** する前提
- **建物が大きい点** が Stage 1/2 との違い: tower / skyscraper / department_store / city_hall / library が登場、スケール階層 (1 大 + 3-5 中 + 15-25 小) は維持しつつ「大」を巨大に

</aside>

---

# §1 Stage 3 の実コンセプト

## 全体像

- タイトル: **都心オフィス街** (DOWNTOWN)
- 12 チャンク（北→南、y=4800 → 7200、Stage 2 末尾を継ぐ）
- プレイヤーは怪獣として **平日朝の通勤ラッシュ** を駆け抜ける
- チャンク高さ = 200
- 世界幅 X ∈ [-180, +180]

## 4 Acts

| Act | チャンク | テーマ | 既存シグネチャ要素 |
| --- | --- | --- | --- |
| Act I | Ch0-2 | 都心入口 | 駅前広場 / バスターミナル / 雑居オフィス |
| Act II | Ch3-5 | 公共中枢 | 市役所 / 銀行 / 図書館 / 美術館 / 病院 |
| Act III | Ch6-8 | 高層ビジネス街 | tower / skyscraper / 百貨店 / クロックタワー |
| Act IV | Ch9-11 | 商業中心 | department_store ★ / shopping mall / 駅前再開発 |

## 既存の連続軸

- 主要通り x=0 のファサード連続（Stage 1, 2 から継承）
- **街路樹 `tree`** Ch0-Ch11 全チャンク（avenue 両脇、Stage 2 のネオンから一転して緑）
- **公共ファサード帯** y=22 で flag_pole + atm + flower_planter_row が並ぶ
- **横断歩道 (zebra crossing)** = `manhole_cover` を組み合わせ + `_HR` 全幅道路で表現
- **電柱+電線** Ch0-Ch11（Stage 1, 2 継承だが密度低）
- 縦道路は **中央 `_AVE` のみ固定**
- ground 基調は **concrete + tile**（公共広場）。focal cell に `stone_pavement` (広場) / `wood_deck` (カフェ前) でアクセント

## 時間帯と人流グラデ

| Act | 時間帯 | 人流 |
| --- | --- | --- |
| Act I | 朝 7:30 | 通勤客 (adult_m,f mix × 多)・駅員・タクシー客 |
| Act II | 朝 8:30 | 公務員・銀行員・病院職員・市民 |
| Act III | 朝 9:30 | OL/ビジネスマン・受付・カフェ客 |
| Act IV | 朝 10:30 | 買い物客・観光客・配達員・百貨店店員 |

---

# §3 Act レベル方針

## Act I — 都心入口（Ch0-2）

**テーマ**: Stage 2 の神社参道（早朝）から、中規模都市の **再開発駅前** へ。Stage 1 と違い、駅は **中規模ターミナル** で大型化。バス・タクシー・地下鉄の集約点。

- **Ch0**: train_station 大 + バスターミナル + 駅前広場（`asphalt` + `tile` 大パッチ）。Stage 2 から朝の光に切替
- **Ch1**: 駅前ロータリー脇のカフェ + 銀行 ATM + コンビニ
- **Ch2**: 高層雑居オフィス（apartment_tall + office）の入口、サラリーマンの行列

**人流**: 通勤客 adult_m,f × 多 (avenue 全幅 y=92/108)、駅員 × 1、タクシー客 × 2-3
**連続軸**: 街路樹 `tree` 開始（Ch0 から avenue 両脇 x=±170）

## Act II — 公共中枢（Ch3-5）

**テーマ**: 都心の **機能集積**。市役所・銀行・図書館・病院・郵便局の大型公共施設が並ぶ「機能の博物館」。Stage 1 Ch5 civic_plaza を巨大化したような、4-6 軒の公共施設が連続する区画。

- **Ch3**: city_hall（市役所、Act III までで最大の公共施設）+ post_office + bank
- **Ch4**: hospital + clinic + pharmacy 連続（医療街）
- **Ch5**: library + museum + 公園広場（civic plaza 拡張）

**人流**: 公務員 × 中、銀行員 × 中、病院職員 × 中、市民（adult mix）× 多、車椅子 × 1（hospital 前、痕跡として配置）
**連続軸**: 公共ファサード y=22、flag_pole 列 (各施設前に 1 本)、`stone_pavement` 広場帯 (Ch5 中央 80×80)

## Act III — 高層ビジネス街（Ch6-8）

**テーマ**: ガラス張り高層ビル、tower / skyscraper / clock_tower / radio_tower の **垂直性**。Stage 1 / 2 にない巨大建物が登場し、スケール感が変わる。

- **Ch6**: tower + skyscraper のツインビル（Act III の山）
- **Ch7**: clock_tower (時計塔) + ferris_wheel?? や違和感あるので外す → 代わりに オフィス街の中央広場 + フォトジェニック銅像
- **Ch8**: radio_tower + 中規模オフィス街（office × 4-6）

**人流**: ビジネスマン × 多、OL × 多、受付 × 中、配達員 × 1-2
**連続軸**: 高層建物の影（建物自体が y=22 facade で 80-110 高、avenue 両脇）、街路樹は中規模に縮小

## Act IV — 商業中心（Ch9-11）

**テーマ**: **百貨店**ランドマーク。Stage 1 では `department_store` を 1 棟だけ予告として置いた、Stage 3 では 1-2 棟が中心となる「ショッピング都市」。Stage 4 への handoff として工業地帯が遠景に予告。

- **Ch9**: 大型 department_store ★ ランドマーク（横幅 100+、avenue 中央配置）
- **Ch10**: shopping mall + 中規模商業（cafe / bakery / florist）+ 観光案内
- **Ch11**: 駅前再開発 + 都市公園 + Stage 4 港湾予告（銅像 / ground に `oil_stained_concrete` のアクセント）

**人流**: 買い物客 × 多、観光客 × 中、配達員 × 2、百貨店店員 × 中
**連続軸**: 街路樹継続、`tile` 大パッチ（百貨店前広場）、Ch11 で `oil_stained_concrete` がチラ見えで Stage 4 予告

## Act 間の連続軸サマリ

- 街路樹 `tree` は Ch0-Ch10 で連続、Ch11 で減（Stage 4 への切替予告）
- 公共ファサード y=22 帯は Act II で密、他で散
- 人流は **通勤客 → 公務員 → ビジネスマン → 買い物客** とグラデ
- ground は **concrete + tile 基調 → Ch11 で oil_stained_concrete 予告**

---

# §3.6 ヒーロー / アンビエント階層（Stage 3 のジグザグ流れ）

| Chunk | ヒーロー位置 | テーマ |
| --- | --- | --- |
| Ch0 | merged (NW+NE) | train_station 大 + バスターミナル |
| Ch1 | SW | カフェ + ATM |
| Ch2 | NE | apartment_tall 高層オフィス入口 |
| Ch3 | merged (NW+NE) | city_hall + post_office + bank（公共3連） |
| Ch4 | SW+SE merged | hospital + clinic + pharmacy（医療3連） |
| Ch5 | merged (全) | civic plaza 拡張（クライマックス公共） |
| Ch6 | NE | tower + skyscraper ツインビル |
| Ch7 | merged (全) | clock_tower 中央広場 |
| Ch8 | SW | radio_tower + オフィス街 |
| Ch9 | merged (全) | department_store ★ ランドマーク（クライマックス商業） |
| Ch10 | NE | shopping mall + cafe |
| Ch11 | SW | 都市公園 + Stage 4 handoff |

**Stage 3 のクライマックス**: Ch5 civic plaza 拡張（公共のピーク）と Ch9 department_store（商業のピーク）の 2 段ピーク。

---

# §4.5 Stage 3 固有の建物→取り巻き辞書

| 建物 | 必須取り巻き | 補助取り巻き | 痕跡 |
| --- | --- | --- | --- |
| `train_station` (大) | platform_edge × 2 + railway_track × 4 + bus_terminal_shelter + taxi_rank_sign × 2 | flag_pole + bench × 4 + flower_planter_row × 2 | newspaper_stand |
| `office` | flag_pole + flower_planter_row + a_frame_sign | bench + bicycle_rack | bicycle |
| `tower` | flag_pole × 2 (大、x=±10) + statue + flower_planter_row × 2 | banner_pole × 2 + bench × 4 | (痕跡控えめ、ガラスの威圧感) |
| `skyscraper` | flag_pole × 2 + flower_planter_row + bollard × 4 | banner_pole + statue | (痕跡控えめ) |
| `city_hall` | flag_pole × 3 (国旗+市旗+企業旗) + statue + fountain_large | bench × 6 (来庁者) + flower_planter_row × 4 | newspaper_stand |
| `bank` | atm + flag_pole + flower_planter_row | bench + post_box + bollard × 2 | (痕跡控えめ、防犯感) |
| `post_office` | post_box × 3 (大中小) + flag_pole + mailbox 列 | bench + flower_planter_row | bicycle |
| `hospital` | flag_pole + bench × 4 (待合) + flower_bed | atm + ambulance（`car` で代替）+ recycling_bin | (痕跡: car 駐車場の bicycle) |
| `clinic` | flag_pole + bench × 2 + a_frame_sign | flower_planter_row + potted_plant | bicycle |
| `pharmacy` | shop_awning + a_frame_sign + sign_board (緑+) + bicycle_rack | bench + parasol + flower_planter_row | bicycle + recycling_bin |
| `library` | flag_pole + bench × 4 + flower_bed × 2 | statue (literary figure) + bicycle_rack | bicycle |
| `museum` | flag_pole + statue × 2 (大、入口左右) + fountain | bench × 6 + banner_pole | (痕跡: 観光客の bench) |
| `clock_tower` | flag_pole + statue + bench × 4 (周囲広場) | flower_planter_row × 4 + bollard × 4 | (痕跡控えめ、ランドマーク) |
| `radio_tower` | flag_pole + bollard × 4 (基礎) + flower_planter_row × 2 | (取り巻き最小、塔自体が主役) | (痕跡控えめ) |
| `department_store` | shop_awning + sign_board (大) + flower_planter_row × 4 + parasol × 4 | banner_pole × 4 + bench × 4 + bicycle_rack | shopping_bag (家具なし、家具で代替: garbage) |
| `cafe` | shop_awning + parasol × 2 + a_frame_sign + bench × 2 (テラス) | potted_plant + flower_bed | bicycle (テラス前) |
| `bookstore` | shop_awning + a_frame_sign + bench (読書) | parasol + potted_plant | newspaper_stand |
| `bakery` | shop_awning + a_frame_sign + parasol | sign_board + potted_plant | bicycle |
| `florist` | shop_awning + flower_bed × 3 + flower_planter_row × 3 + parasol | a_frame_sign + bicycle | (痕跡: 花の濡れ → puddle_reflection) |

**Stage 3 ならではのスケール感**:
- `tower` / `skyscraper` / `clock_tower` / `radio_tower` / `department_store` は **建物自体が大スケール**。取り巻き家具は逆に少なめ・整列で、建物の威圧感を引き立てる
- `city_hall` / `library` / `museum` は **取り巻きが多い**（広場感、市民活動感）

---

# §5 Stage 3 の道路設計

**Stage 3 でも固定するのは中央 `_AVE` のみ**。横道路（`_MID_HR` 含む）と他の縦道路はチャンクのコンセプトに沿って都度設計する。

## Act ごとの道路性格

| Act | 道路性格 | 設計のヒント |
| --- | --- | --- |
| Act I 駅前 | 大型ターミナル、バス導線 | Ch0 は `_AVE` のみ + バスターミナル広場 (`asphalt` 大パッチ)。Ch1-2 は `_AVE` + `_MID_HR` |
| Act II 公共中枢 | 横断歩道密、公共施設前のアクセス道 | Ch3-5 で `_AVE` + `_MID_HR` + 各施設前 `_HR(60, x1, x2)` 短い帯。Ch5 に `_TOP_HR` で広場の上端をつくる |
| Act III ビジネス街 | 高層ビル間の細い裏道、配送導線 | Ch6 は `_AVE` + `_VR(±60, 0, 100)` 短い裏道（ビル間）。Ch7 中央広場は道路最小（`_AVE` のみ）。Ch8 は `_AVE` + `_MID_HR` |
| Act IV 商業中心 | 百貨店前広場、観光客の溜まり | Ch9 百貨店前は `_AVE` + 広場 ground。Ch10 は `_AVE` + `_MID_HR`。Ch11 は `_AVE` のみ + Stage 4 移行のため `oil_stained_concrete` 予告パッチ |

## ゼブラ横断歩道の表現

- 既存 `manhole_cover` 家具を avenue 横断地点 (y=92, 100, 108) に 5-6 個並べる + `_HR` 全幅で **横断歩道帯** を視覚化
- 通勤客の波 humans を avenue の y=92 / y=108 に密集配置で表現

## 高層ビルの取り巻き設計

- `tower` / `skyscraper` の前は **広いガラス張りロビー**を `tile` 大パッチで表現
- 入口 `flag_pole` × 2 + `bollard` × 4 で「企業の入り口」感
- ビル間の細い裏道は `_VR` 短いセグメント

---

# §6.5 Stage 3 で使う実 union（建物・家具・地面）

## 建物 (BuildingSize)

**主役（Stage 3 で多用）**: `train_station` / `office` / `tower` / `skyscraper` / `apartment_tall` / `city_hall` / `bank` / `post_office` / `hospital` / `clinic` / `pharmacy` / `library` / `museum` / `clock_tower` / `radio_tower` / `department_store` / `cafe` / `bookstore` / `bakery` / `florist` / `convenience` / `restaurant` / `gas_station`

**脇役（背景）**: `apartment` / `mansion` / `house` / `townhouse` / `parking`

**避けたい**: `kominka` / `chaya` / `machiya` / `kura` / `dojo` / `wagashi` / `kimono_shop` / `sushi_ya` / `ryokan` / `onsen_inn` / `pagoda` / `tahoto` / `shrine` / `temple` 等の和風建物（Stage 3 は **都心オフィス街** で和風要素は最小化）

## 家具 (FurnitureType)

**Stage 3 シグネチャ**: `flag_pole` / `banner_pole` / `flower_planter_row` / `flower_bed` / `bench` / `statue` / `fountain` / `fountain_large` / `plaza_tile_circle` / `bollard` / `manhole_cover` / `street_lamp` / `bicycle_rack` / `bus_stop` / `taxi_rank_sign` / `traffic_cone` (工事区画) / `barrier` / `electric_box` / `cable_junction_box` / `pedestrian_bridge`

**駅前**: `platform_edge` / `railway_track` / `signal_tower` / `bus_terminal_shelter` (建物だが家具的に取り巻く)

**店舗**: `shop_awning` / `a_frame_sign` / `parasol` / `sign_board` / `vending` / `atm` / `post_box`

**生活痕跡**: `bicycle` / `garbage` / `recycling_bin` / `dumpster` / `mailbox` / `newspaper_stand` / `cat`

**避けたい**: `chouchin` / `noren` (和風) / `torii` / `stone_lantern` / `bonsai` / `koma_inu` / `bamboo_fence` / `koi_pond` / `stepping_stones` (Stage 5 / 1 専用)

## 地面 (GroundType)

- **基調**: `concrete` (avenue 両脇、公共広場周辺)
- **focal 強調**: `tile` (公共施設前)、`stone_pavement` (Ch5 civic plaza 大広場、Ch7 中央広場)、`wood_deck` (カフェ前)
- **Stage 4 予告 (Ch11)**: `oil_stained_concrete` の小パッチ
- **Act III アクセント**: `asphalt` (オフィス前駐車場)
- **Stage 3 では使わない**: `grass` / `dirt` (住宅街でない)、`gravel` / `moss` (和風)、`fallen_leaves` (寺社)

---

# §6.6 SemanticCluster の Stage 3 適用ガイド

## hero クラスタの focal 候補

- **オープンスペース型** (基本形 A): Ch0 駅前広場 (`focal: train_station` 建物 or `bus_terminal_shelter`) / Ch5 civic plaza (`focal: fountain_large` または `statue` 家具) / Ch7 中央広場 (`focal: clock_tower` 建物) / Ch9 百貨店前広場 (`focal: department_store` 建物)
- **焦点建物型** (基本形 B): Ch2 apartment_tall / Ch6 tower / Ch8 radio_tower
- **3 連焦点型** (基本形 C): Ch3 city_hall+post_office+bank（公共 3 連）/ Ch4 hospital+clinic+pharmacy（医療 3 連）

## ambient クラスタの focal 候補

- 各セルに 1 つ、ヒーローでない建物（office / convenience / cafe / mansion）

## boundary 候補（Stage 3 固有）

- `bollard` 列（公共施設前、車両規制）
- `flower_planter_row` 列（広場の輪郭）
- `flag_pole` 列（公共・企業の入り口）
- `barrier` (工事区画、Ch10 など)
- **避ける**: `hedge` / `wood_fence` / `bamboo_fence` (和風・住宅向け)

## access 候補（Stage 3 固有）

- `street_lamp` (avenue 沿い、朝の弱い光)
- `manhole_cover` (横断歩道の zebra として 5-6 連)
- `bench` 列 (公共広場の動線、市民の流れ)
- `bicycle_rack` (オフィス・公共施設前)
- **避ける**: `stepping_stones` (和風)

## livingTrace 候補（Stage 3 固有）

- `bicycle` (オフィス・cafe 前の業務側)
- `newspaper_stand` (駅前・公共施設前)
- `recycling_bin` (Ch10 商業)
- `mailbox` (post_office 周辺)
- `garbage` (Ch11 都市公園)
- **避ける**: `cat` は最小限（都心は野良猫が少ない）、`laundry_pole` / `laundry_balcony` は Stage 3 では使わない

---

# §9 詳細フェーズ: 各チャンクレイアウト

<aside>
🛣️

**道路注意**: 各チャンクの道路指定は **コンセプトに沿って都度設計**。固定するのは `_AVE`（x=0）のみ。Stage 3 では公共広場や百貨店前を **広場として ground で表現**し、道路を増やさない。

</aside>

## Act I — 都心入口

### Ch0: 大型ターミナル駅と北口広場

**ヒーロー**: **NW+NE merged = ヒーロー**（駅 + 広場 + バスターミナル、基本形 A）/ SW・SE = アンビエント

**merged 4 層**:
- **焦点**: `train_station` (x=0, y=22) 大 + `bus_terminal_shelter` (x=-100, y=68) + `bus_terminal_shelter` (x=100, y=68)
- **取り巻き**: `platform_edge` × 2 (x=-50/50, y=78)、`railway_track` × 4 (y=86)、`signal_tower` (x=0, y=95)、`flag_pole` × 3 (駅前広場、x=-30/0/30, y=58)、`bench` × 6 (準対称、x=-130/-70/-20/30/80/130, y=85)
- **境界**: `bollard` × 8 (avenue 横断帯、y=95-105)、`flower_planter_row` × 4
- **動線**: `taxi_rank_sign` × 2 (x=-150/150, y=72)、`bus_stop` × 2 (x=-100/100, y=85)、`manhole_cover` × 6 (avenue 横断、ゼブラ表現)、`street_lamp` × 4

**アンビエント**:
- **SW**: `convenience` (x=-130, y=130) + `vending` × 2 + `bicycle` (痕跡)
- **SE**: `cafe` (x=130, y=130) + `parasol` × 2 + `bench` × 2 (テラス) + `bicycle` (痕跡)

**人配置**: 通勤客 × 多 12-15 人（駅前広場 + avenue）、駅員 × 1、タクシー客 × 2 (x=-150/150)、バス待ち × 2

**地面パッチ**:
- 基調: `concrete` 全面 (x=0, y=100, 360×200)
- 駅前: `tile` 大パッチ (x=0, y=70, 200×100) — 公共広場
- ホーム: `asphalt` (y=80-90 帯)
- ロット: `tile` (cafe SE)、`asphalt` (convenience SW)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]` (駅前は ground 大パッチで広場化)

**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 4 (公共・商店)、`mailbox` × 3 不均等
- 焦点囲み: 駅前広場の bench × 6 + flag_pole × 3 + flower_planter_row × 4
- 歩道沿い (avenue 両脇): `street_lamp` × 4、`manhole_cover` × 6 横断ゼブラ、`bollard` × 8

**生活の痕跡 / スケール / 向き**:
- 痕跡: SW bicycle、SE bicycle、駅前 newspaper_stand
- スケール: 大 `train_station` / 中 `bus_terminal_shelter` × 2、`convenience`、`cafe` / 小 `bench` × 6・`flag_pole` × 3
- 向き: bench は station 向き、taxi_rank_sign は avenue 向き、parasol は cafe テラス向き

**Handoff (Stage 2 Ch11 → Stage 3 Ch0)**:
- **並木**: 神社の参道 → Stage 3 で街路樹 `tree` × 2 (x=±170, y=10) 開始
- **歩道**: `stone_pavement` (x=-65) 帯継続
- **電柱/電線**: 4 隅で対
- **予兆**: 駅舎の規模が Stage 2 と一線、Act II 公共中枢への入口感

### Ch1: カフェ + ATM + コンビニ（駅前ロータリー脇）

**ヒーロー**: **SW = ヒーロー**（cafe テラス、基本形 B）

**SW 4 層**:
- **焦点**: `cafe` (x=-130, y=130) 中型
- **取り巻き**: `shop_awning` (x=-130, y=120) + `parasol` × 3 (テラス、x=-160/-130/-100, y=148) + `bench` × 3 (テラス座席、準対称) + `a_frame_sign` (x=-100, y=148)
- **境界**: `flower_planter_row` × 2 (x=-170/-90, y=170)、`bollard` × 2
- **動線**: `bicycle_rack` (x=-90, y=160)、`street_lamp` (x=-65, y=140)

**アンビエント**:
- **NW**: `bank` (x=-130, y=22) + `atm` × 2 + `flag_pole` + `mailbox` (痕跡)
- **NE**: `convenience` (x=130, y=22) + `vending` × 2 + `bicycle` (痕跡)
- **SE**: `office` (x=130, y=130) + `flag_pole` + `bench` + `newspaper_stand` (痕跡)

**人配置**: cafe 客 × 4、ATM 利用者 × 2 (NW)、サラリーマン × 5 (avenue)、cat × 0 (都心)

**地面パッチ**: `concrete` 全面、cafe 前 `wood_deck` (x=-130, y=148, 90×30)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 4 (青/緑/青/赤、各業種)、`atm` × 2 (bank)
- 焦点囲み: SW cafe テラスの parasol × 3 + bench × 3 + a_frame_sign
- 歩道沿い: `street_lamp` × 2、`manhole_cover` × 3、`bicycle_rack` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: NW mailbox、NE bicycle、SW bicycle、SE newspaper_stand
- スケール: 大 `bank`/`office` / 中 `cafe`/`convenience`/`pharmacy` / 小 `parasol` × 3・`bench` × 3
- 向き: parasol は外向き、a_frame_sign は通勤導線向き

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch2: 高層雑居オフィス入口

**ヒーロー**: **NE = ヒーロー**（apartment_tall + office、基本形 B 高層）

**NE 4 層**:
- **焦点**: `apartment_tall` (x=130, y=22) 大 + `office` (x=80, y=22) 中
- **取り巻き**: `flag_pole` × 2 (x=80/130, y=8)、`flower_planter_row` × 2、`bench` × 2 (入口待合)、`a_frame_sign` (x=110, y=58) — 1F 店舗
- **境界**: `bollard` × 4 (車両規制)、`flower_planter_row` × 2
- **動線**: `street_lamp` × 2 (x=80/170, y=88)

**アンビエント**:
- **NW**: `office` (x=-130, y=22) + `flag_pole` + `bicycle_rack` (痕跡)
- **SW**: `mansion` (x=-100, y=130) + `mailbox` × 2 (痕跡)
- **SE**: `mansion` (x=130, y=130) + `mailbox` (痕跡)

**人配置**: ビジネスマン × 8 (NE 入口に集中)、OL × 4、配達員 × 1 (avenue)

---

## Act II — 公共中枢
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 5 (各オフィス)、`flag_pole` × 3
- 焦点囲み: NE 高層ビル前の flag_pole × 2 + statue + bollard × 4
- 歩道沿い: `street_lamp` × 2、`bicycle_rack` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: NW bicycle_rack、SW mailbox、SE mailbox、NE 痕跡控えめ (オフィス感)
- スケール: 大 `apartment_tall` / 中 `office` × 2・`mansion` × 2 / 小 `flag_pole` × 3・`bollard` × 4
- 向き: flag_pole は avenue 向き、a_frame_sign は 1F 入口向き

**地面パッチ**:
- **基調**: ステージ標準テクスチャを全面
- **焦点**: ヒーロー前にアクセントパッチ
- **歩道帯**: `stone_pavement` (x=-65) — Stage 連続軸

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（チャンクコンセプトに沿った最小構成）

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch3: 公共 3 連（市役所 + 郵便局 + 銀行）

**ヒーロー**: **NW+NE merged = ヒーロー**（公共 3 連、基本形 C）

**merged 上段 4 層**:
- **焦点**: `city_hall` (x=-130, y=22) 大 + `post_office` (x=0, y=22) 中 + `bank` (x=130, y=22) 中
- **取り巻き**: 各施設前 `flag_pole` × 1 (3 本) + `flower_planter_row` × 3 (各施設前) + `bench` × 6 (待ち客)
- **境界**: `bollard` × 6 (車両規制)、`flower_planter_row` × 3
- **動線**: `manhole_cover` × 6 (横断帯)、`bicycle_rack` × 2、`atm` × 2 (bank 前)

**アンビエント**:
- **SW**: `mansion` × 2 + `mailbox` (痕跡)
- **SE**: `mansion` × 2 + `bicycle` (痕跡)

**人配置**: 公務員 × 5、市民 × 8 (avenue)、銀行員 × 2 (bank 前)、配達員 × 1 (post_office)

**地面パッチ**: `concrete` 全面、3 施設前 `tile` 帯 (x=0, y=58, 360×40) — 公共連続広場

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _HR(60, -180, 180)]` — 施設前アクセス道全幅
**取り巻き 3 パターン**:
- facade 沿い (y=22): `flag_pole` × 3 (公共施設前)、`atm` × 2 (bank)、`mailbox` × 3
- 焦点囲み: 3 施設前の bench × 6 + flag_pole × 3 + flower_planter_row × 3
- 歩道沿い: `manhole_cover` × 6 横断、`atm` × 2、`bicycle_rack` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: 公共施設は痕跡控えめ、SW/SE mailbox + bicycle
- スケール: 大 `city_hall` / 中 `post_office`/`bank`/`mansion` / 小 `flag_pole` × 3・`bench` × 6
- 向き: flag_pole は avenue 向き、bench は施設入口向き

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch4: 医療 3 連（病院 + 診療所 + 薬局）

**ヒーロー**: **SW+SE merged = ヒーロー**（医療 3 連、基本形 C）

**merged 下段 4 層**:
- **焦点**: `hospital` (x=-100, y=130) 大 + `clinic` (x=30, y=130) 中 + `pharmacy` (x=130, y=130) 中
- **取り巻き**: 各施設前 `flag_pole` + `flower_bed` × 4、hospital 前 `bench` × 4 (待合) + `car` (救急車見立て、x=-100, y=148)
- **境界**: `bollard` × 6、`flower_planter_row` × 2
- **動線**: `bicycle_rack` × 3 (各施設前)、`a_frame_sign` (pharmacy 前)、`recycling_bin` × 2

**アンビエント**:
- **NW**: `apartment_tall` (x=-130, y=22) + `flag_pole`
- **NE**: `apartment_tall` (x=130, y=22) + `flag_pole`

**人配置**: 病院職員 × 4、患者 × 6 (待合 bench)、市民 × 5 (avenue)、子供連れ × 2
**取り巻き 3 パターン**:
- facade 沿い (y=22): `flag_pole` × 3 (医療施設前)、`a_frame_sign` (pharmacy)
- 焦点囲み: 3 医療施設前の bench × 4 待合 + flower_bed × 4 + 救急車 `car`
- 歩道沿い: `bicycle_rack` × 3、`recycling_bin` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: 病院前 bicycle、薬局前 bicycle、recycling_bin
- スケール: 大 `hospital`/`apartment_tall` / 中 `clinic`/`pharmacy` / 小 `bench` × 4・`flag_pole` × 3
- 向き: bench は病院向き (待合)、car (救急車) は緊急口向き

**地面パッチ**:
- **基調**: ステージ標準テクスチャを全面
- **焦点**: ヒーロー前にアクセントパッチ
- **歩道帯**: `stone_pavement` (x=-65) — Stage 連続軸

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（チャンクコンセプトに沿った最小構成）

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch5: civic plaza 拡張（クライマックス公共）

**ヒーロー**: **merged 全マージ = ヒーロー**（基本形 A 大広場、Stage 3 公共のピーク）

**merged 4 層**:
- **焦点**: `plaza_tile_circle` (x=0, y=100) 中央 + `fountain_large` (x=0, y=120) 噴水 + `statue` (x=0, y=145) 像
- **取り巻き**: `flag_pole` × 4 (準対称、x=-60/-20/+20/+60, y=80) + `bench` × 8 (周囲、x=-130/-70/-20/30/80/130, y=78 と y=178)、`flower_bed` × 6 (準対称)
- **境界**: `flower_planter_row` × 6 (広場輪郭)、`bollard` × 6 (避けて広場感)
- **動線**: `street_lamp` × 4、`manhole_cover` × 4

**アンビエント (大型公共施設で 4 セルを囲む)**:
- **NW**: `library` (x=-130, y=22)
- **NE**: `museum` (x=130, y=22)
- **SW**: `bank` (x=-130, y=130) (Ch3 と分担、Ch5 でも置く)
- **SE**: `convenience` (x=130, y=130) + `bicycle` (痕跡)

**人配置**: 市民 × 10 (広場)、観光客 × 4 (museum 前)、図書館客 × 3、cat × 0

**地面パッチ**: `concrete` 全面、中央広場 `stone_pavement` 大円 (x=0, y=130, 200×80)、各施設前 `tile`

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR]` — Act II/III 境界

---

## Act III — 高層ビジネス街
**取り巻き 3 パターン**:
- facade 沿い (y=22): `flag_pole` × 4 (各端)、`mailbox` × 2
- 焦点囲み: 中央広場の statue + fountain_large + bench × 8 + flag_pole × 4 + flower_bed × 6
- 歩道沿い: `street_lamp` × 4、`manhole_cover` × 4

**生活の痕跡 / スケール / 向き**:
- 痕跡: 公共広場は痕跡控えめ、SE convenience の bicycle
- スケール: 大 `library`/`museum` / 中 `bank`/`statue`/`fountain_large` / 小 `bench` × 8・`flag_pole` × 4
- 向き: 中央広場の bench は statue 向き、各施設前 flag_pole は avenue 向き

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch6: ツインタワー（tower + skyscraper）

**ヒーロー**: **NE = ヒーロー**（tower + skyscraper の二棟、基本形 B 高層）

**NE 4 層**:
- **焦点**: `tower` (x=80, y=22) 大 + `skyscraper` (x=140, y=22) 大（高層ツイン）
- **取り巻き**: `flag_pole` × 2 (x=80/140, y=8)、`statue` (x=110, y=68) ロビー前、`flower_planter_row` × 2、`bollard` × 6 (車両規制)
- **境界**: `flower_planter_row` × 2 (x=80/140, y=58)、`bollard` × 4
- **動線**: `street_lamp` × 2

**アンビエント**:
- **NW**: `office` (x=-130, y=22) + `flag_pole`
- **SW**: `apartment_tall` (x=-130, y=130) + `flag_pole`
- **SE**: `office` (x=130, y=130) + `flag_pole` + `bicycle_rack` (痕跡)

**地面パッチ**: `concrete` 基調、ツインタワー前 `tile` ロビー大パッチ (x=110, y=70, 130×80)

**道路**: `verticalRoads: [_AVE, _VR(60, 0, 100)]` (ビル間裏道) / `horizontalRoads: [_MID_HR]`
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 4 (各オフィス)、`flag_pole` × 4
- 焦点囲み: NE ツインタワー前の statue + flag_pole × 2 + bollard × 6
- 歩道沿い: `street_lamp` × 2、`bicycle_rack` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: NE 痕跡控えめ (ガラスの威圧感)、SE bicycle_rack、SW flag_pole
- スケール: 大 `tower`/`skyscraper` / 中 `office` × 2・`apartment_tall` / 小 `bollard` × 6・`flag_pole` × 4
- 向き: flag_pole は avenue 向き、statue はビルロビー向き

**人配置**: 各セル 2-3 名、ヒーロー側に集中、avenue 通行人 × 数名、cat × 1

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch7: 中央広場 + 時計塔

**ヒーロー**: **merged = ヒーロー**（時計塔ランドマーク、基本形 A）

**merged 4 層**:
- **焦点**: `clock_tower` (x=0, y=68) 中央 ★ ランドマーク
- **取り巻き**: `flag_pole` × 2 (x=-30/30, y=78)、`statue` × 2 (x=-50/50, y=120)、`bench` × 8 (周囲、八方向)、`flower_planter_row` × 4
- **境界**: `bollard` × 8 (時計塔基礎の輪郭)、`flower_bed` × 4
- **動線**: `street_lamp` × 4、`manhole_cover` × 4 (avenue)

**アンビエント**:
- **NW**: `office` (x=-130, y=22) + `flag_pole`
- **NE**: `office` (x=130, y=22) + `flag_pole`
- **SW**: `cafe` (x=-100, y=130) + `parasol` (テラス) + `bicycle` (痕跡)
- **SE**: `bookstore` (x=130, y=130) + `a_frame_sign` + `newspaper_stand` (痕跡)

**地面パッチ**: `concrete` 基調、時計塔広場 `stone_pavement` 大円 (x=0, y=100, 240×120)
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 2 (各オフィス)、`flag_pole` × 2
- 焦点囲み: 時計塔広場の bench × 8 + flag_pole × 2 + statue × 2 + flower_planter_row × 4
- 歩道沿い: `street_lamp` × 4、`manhole_cover` × 4

**生活の痕跡 / スケール / 向き**:
- 痕跡: SW cafe の bicycle、SE bookstore の newspaper_stand
- スケール: 大 `clock_tower` / 中 `office` × 2・`cafe`/`bookstore` / 小 `bench` × 8・`bollard` × 8
- 向き: bench は時計塔向き、parasol は cafe 入口向き

**人配置**: 各セル 2-3 名、ヒーロー側に集中、avenue 通行人 × 数名、cat × 1

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（チャンクコンセプトに沿った最小構成）

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch8: ラジオ塔とオフィス街

**ヒーロー**: **SW = ヒーロー**（radio_tower + オフィス、基本形 B）

**SW 4 層**:
- **焦点**: `radio_tower` (x=-100, y=130) ★ ランドマーク（細長く高い）
- **取り巻き**: `flag_pole` (x=-100, y=120)、`bollard` × 4 (基礎、準対称)、`flower_planter_row`
- **境界**: `barrier` × 2 (基礎の安全帯)
- **動線**: 最小限

**アンビエント**:
- **NW**: `office` (x=-130, y=22) + `flag_pole` + `bicycle` (痕跡)
- **NE**: `office` × 2 (x=80/140, y=22) + `flag_pole` × 2
- **SE**: `office` (x=130, y=130) + `flag_pole` + `recycling_bin` (痕跡)

---

## Act IV — 商業中心
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 4 (オフィス)、`flag_pole` × 5
- 焦点囲み: SW radio_tower 基礎の bollard × 4 + barrier × 2
- 歩道沿い: `street_lamp` × 2、`bicycle_rack` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: NW bicycle、SE recycling_bin、痕跡控えめ
- スケール: 大 `radio_tower` (細長) / 中 `office` × 4 / 小 `bollard` × 4・`barrier` × 2
- 向き: 塔は天向き (垂直)、flag_pole は avenue 向き

**人配置**: 各セル 2-3 名、ヒーロー側に集中、avenue 通行人 × 数名、cat × 1

**地面パッチ**:
- **基調**: ステージ標準テクスチャを全面
- **焦点**: ヒーロー前にアクセントパッチ
- **歩道帯**: `stone_pavement` (x=-65) — Stage 連続軸

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（チャンクコンセプトに沿った最小構成）

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch9: 大型百貨店ランドマーク

**ヒーロー**: **merged 全マージ = ヒーロー**（百貨店、基本形 B 巨大）

**merged 4 層**:
- **焦点**: `department_store` (x=0, y=22) 大（横幅 100+、avenue 中央）
- **取り巻き**: `shop_awning` (x=0, y=58)、`sign_board` (大、ファサード)、`flower_planter_row` × 4 (店前広場)、`parasol` × 4 (テラス)、`banner_pole` × 4 (準対称、x=-50/-20/+20/+50)
- **境界**: `bollard` × 8 (車両規制)、`flower_bed` × 4
- **動線**: `bench` × 6 (買い物客)、`bicycle_rack` × 2、`street_lamp` × 4

**アンビエント (狭い空間)**:
- **SW**: `cafe` (x=-130, y=130) + `parasol`
- **SE**: `bakery` (x=130, y=130) + `a_frame_sign` + `bicycle` (痕跡)

**人配置**: 買い物客 × 多 15 人 (店前広場)、店員 × 2、観光客 × 4

**地面パッチ**: `concrete` 基調、百貨店前 `tile` 大パッチ (x=0, y=78, 280×80)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]` (百貨店前は ground 広場で表現)
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` 大 (百貨店)、`shop_awning`、`flower_planter_row` × 4
- 焦点囲み: 百貨店前広場の banner_pole × 4 + parasol × 4 + bench × 6 + flower_bed × 4
- 歩道沿い: `street_lamp` × 4、`bicycle_rack` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: SW cafe bicycle、SE bakery bicycle、garbage 控えめ
- スケール: 大 `department_store` / 中 `cafe`/`bakery` / 小 `parasol` × 4・`banner_pole` × 4・`bench` × 6
- 向き: 銀河 sign は avenue 向き、parasol は店前向き

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch10: ショッピングモール + カフェ

**ヒーロー**: **NE = ヒーロー**（shopping mall = department_store 中型 + cafe）

**NE 4 層**:
- **焦点**: `department_store` (x=130, y=22) 中（小型百貨店）
- **取り巻き**: `shop_awning` + `sign_board` + `flower_planter_row` × 2 + `bench` × 2 + `parasol` × 2

**アンビエント**:
- **NW**: `bookstore` (x=-130, y=22) + `a_frame_sign` + `newspaper_stand` (痕跡)
- **SW**: `cafe` (x=-100, y=130) + `parasol` × 2 + `bicycle` (痕跡)
- **SE**: `florist` (x=130, y=130) + `flower_bed` × 3 + `parasol` + `bicycle` (痕跡)
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 3 (各店)、`shop_awning` × 3
- 焦点囲み: NE 中型百貨店の flower_planter_row × 2 + bench × 2 + parasol × 2
- 歩道沿い: `street_lamp` × 2、`bicycle` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: NW newspaper_stand、SW bicycle、SE bicycle (florist)
- スケール: 大 `department_store` (中型) / 中 `bookstore`/`cafe`/`florist` / 小 `parasol` × 4・`flower_bed` × 3
- 向き: parasol は店前、a_frame_sign は通勤導線向き

- **境界**: 既存ヒーロー 4 層の境界指定を参照

- **動線**: 既存ヒーロー 4 層の動線指定を参照

**人配置**: 各セル 2-3 名、ヒーロー側に集中、avenue 通行人 × 数名、cat × 1

**地面パッチ**:
- **基調**: ステージ標準テクスチャを全面
- **焦点**: ヒーロー前にアクセントパッチ
- **歩道帯**: `stone_pavement` (x=-65) — Stage 連続軸

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（チャンクコンセプトに沿った最小構成）

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch11: 都市公園 + Stage 4 handoff

**ヒーロー**: **SW = ヒーロー**（都市公園、基本形 A オープンスペース、Stage 4 への入口）

**SW 4 層**:
- **焦点**: `fountain` (x=-100, y=130) 中央
- **取り巻き**: `bench` × 6 (周囲)、`flower_bed` × 4、`statue` (記念像)、`flag_pole`
- **境界**: `flower_planter_row` × 4、`bollard` × 2
- **動線**: `street_lamp` × 2、`manhole_cover` × 2

**アンビエント (Stage 4 予告)**:
- **NW**: `office` (x=-130, y=22) + `flag_pole` (Stage 3 の余韻)
- **NE**: `gas_station` (x=130, y=22) + `traffic_cone` × 3 + 自販機（Stage 4 工業の予告）
- **SE**: `parking` (x=130, y=130) + `oil_stained_concrete` ground 帯 + `barrier` (Stage 4 予告)

**人配置**: 観光客 × 3、市民 × 5、配達員 × 2 (NE/SE)

**地面パッチ**: `concrete` 基調、SW 公園 `tile` (x=-100, y=130, 160×100) + `grass` 小パッチ (噴水周辺)、SE `oil_stained_concrete` 小パッチ (Stage 4 予告)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**取り巻き 3 パターン**:
- facade 沿い (y=22): `flag_pole`、`sign_board` (NW office、NE gas_station)
- 焦点囲み: SW 都市公園の fountain + bench × 6 + flower_bed × 4 + statue
- 歩道沿い: `street_lamp` × 2、`manhole_cover` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: NE traffic_cone (ガソスタ)、SE oil_stained_concrete (Stage 4 予告)
- スケール: 大 `gas_station`/`parking` / 中 `office` / 小 `bench` × 6・`flower_bed` × 4
- 向き: bench は fountain 向き、traffic_cone は給油口向き

**Handoff (Ch11 → Stage 4 Ch0)**:
- **並木**: 街路樹 `tree` 終端 (Ch11 で減)、Stage 4 では `pine_tree` 漁港 / `bush` のみ
- **歩道**: `stone_pavement` 帯から `concrete` のみへ
- **電柱/電線**: 4 隅で対、Stage 4 で密度上昇
- **予兆**: SE `oil_stained_concrete` パッチと `parking` が Stage 4 工業港湾 (`steel_plate` / `harbor_water`) を予告

---

# §8 変更履歴

- **v1.0（本版）**: Stage 3 「都心オフィス街 DOWNTOWN」の新規設計指示書。既存実装は **和風プレースホルダー** だったため、本指示書で **オフィス街として全面再設計**。Stage 1 v6.3 のフォーマットを継承し、4 Acts × 12 チャンクで構成。Act I 駅前 → Act II 公共中枢（city_hall+post_office+bank の 3 連 / hospital+clinic+pharmacy の 3 連）→ Act III 高層ビジネス街（tower / skyscraper / clock_tower / radio_tower）→ Act IV 商業中心（department_store ランドマーク）。Stage 1/2 と違い **建物自体が大スケール**（tower / skyscraper / department_store）で、取り巻き家具は整列して建物の威圧感を引き立てる方針。Ch5 civic plaza 拡張と Ch9 百貨店が 2 段ピーク。Ch11 で Stage 4 工業港湾への handoff（`oil_stained_concrete` 予告）。
