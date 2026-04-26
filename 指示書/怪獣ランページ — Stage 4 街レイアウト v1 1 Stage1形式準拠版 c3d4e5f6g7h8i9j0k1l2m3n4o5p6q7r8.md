# 怪獣ランページ — Stage 4 街レイアウト v1.1 Stage1形式準拠版

<aside>
📋

**このドキュメントの位置づけ（v1.1 Stage1形式準拠版）**

Stage 4「工業港湾 HARBOR」の **再配置のための設計指示書**。Stage 1 v6.3 と同じフォーマット。

**Stage 1 v6.3 の §2 / §4 / §5 / §6 / §6.5 / §6.6 はそのまま継承**。Stage 4 では Stage 固有のコンセプト・取り巻き辞書・連続軸を §1 / §3 / §4.5 / §6.5 で書き直す。

</aside>

<aside>
⚓

**Stage 4 のテーマ宣言**

Stage 3 末尾の都市公園（朝〜昼）から、空の色がくすんだ青灰色に変わり、塩風と油の匂いが漂う **港湾と重工業地帯** へ。**漁港 → コンテナヤード → 重工業（製鉄・石油・発電）** という産業のスケールアップを追体験する 12 チャンク。

**コアトーン**: 鋼鉄 / コンクリート / 油の匂い / 鉛色の空 / 港の海面（harbor_water）/ 危険警告ストライプ / クレーンの垂直性 / 直線とグリッド

**Stage 3 との対比**: Stage 3 は整然・朝・ガラス・人多い → Stage 4 は工業・正午〜夕方・鉄と油・人少ない（労働者のみ）。

</aside>

<aside>
🆕

**v1.0 の方針**

- Stage 1 v6.3 の **公園モデル 4 層構造** と **SemanticCluster** 継承
- 道路は **中央 `_AVE` のみ固定**（Stage 1 v6.2 方針継承）
- 12 チャンクで構成（既存実装は 9 チャンクだが、4 Acts × 3 チャンクで再構成）
- 連続軸: **海岸線軸（buoy + guardrail）/ 危険警告軸（hazard_stripe + traffic_cone + barrier）/ 電力軸（power_pole + cable_junction_box）/ パイプライン軸（drum_can + water_tank）**
- **建物の絶対スケール感** が他 Stage と異なる: crane_gantry (h=78) / factory_stack (h=62) / silo / container_stack 等の巨大工業構造物が「ランドマーク」になる
- **人流が極端に少ない**: 漁師・港湾労働者・運転手・警備員のみ、Stage 3 の通勤客の波はない
- ground は **harbor_water + steel_plate + oil_stained_concrete + rust_deck + hazard_stripe** が支配

</aside>

---

# §1 Stage 4 の実コンセプト

## 全体像

- タイトル: **工業港湾** (HARBOR)
- 12 チャンク（北→南、y=7200 → 9600、Stage 3 末尾を継ぐ）
- プレイヤーは怪獣として **漁港 → コンテナヤード → 重工業** を縦断する
- チャンク高さ = 200
- 世界幅 X ∈ [-180, +180]

## 4 Acts

| Act | チャンク | テーマ | シグネチャ要素 |
| --- | --- | --- | --- |
| Act I | Ch0-2 | 漁港 (Fishing Harbor) | 港神社 / 桟橋 / 漁市場 / 造船所予兆 |
| Act II | Ch3-5 | コンテナヤード (Container Yard) | ゲート / ガントリークレーン ★ / コンテナ山 / 港湾線路 |
| Act III | Ch6-8 | 重工業地帯 (Heavy Industry) | 製鉄所 / 石油タンク / 発電所 / 化学工場 |
| Act IV | Ch9-11 | 港湾の終端 | 廃工場 / 倉庫街 / Stage 5 への handoff（祭り予兆） |

## 既存の連続軸

- 主要通り x=0 の avenue 連続（Stage 1-3 から継承だが、ここでは「工場間の搬入路」感）
- **海岸線軸** Ch0-Ch2（西側 x=-150 帯に `buoy` + `guardrail_short` で海面を暗示）
- **危険警告軸** Ch3-Ch11（`hazard_stripe` ground + `traffic_cone` + `barrier` の連続）
- **電力軸** 全チャンク（`power_pole` + `cable_junction_box` 全幅、Stage 1 より遥かに密）
- **パイプライン軸** Ch6-Ch8（`drum_can` + `water_tank` + `electric_box` で工業配管を表現）
- 縦道路は **中央 `_AVE` のみ固定**
- ground 基調は Act ごとに変わる:
  - Act I: `harbor_water` (西側帯) + `wood_deck` (古い桟橋) + `concrete` (岸壁)
  - Act II: `steel_plate` 全面 + `hazard_stripe` (警告)
  - Act III: `oil_stained_concrete` 全面 + `rust_deck` (タンク基礎)
  - Act IV: `oil_stained_concrete` 縮小 + `concrete` 増 (祭り予兆)

## 時間帯と人流グラデ

| Act | 時間帯 | 人流 |
| --- | --- | --- |
| Act I | 朝〜正午 | 漁師 (adult_m × 数) / 市場の客 / 神社参拝者 (Stage 3 余韻) |
| Act II | 正午〜午後 | コンテナ運転手 / フォークリフト操作員 / 警備員 |
| Act III | 午後〜夕方 | 工場労働者 / 化学プラント技師 / トラック運転手 |
| Act IV | 夕方 | ほぼ無人 / 警備員 1-2 / 残業労働者 / 祭りへ向かう人（Stage 5 予告） |

---

# §3 Act レベル方針

## Act I — 漁港（Ch0-2）

**テーマ**: Stage 3 の都市公園から、海風が吹く **漁港エリア** へ。木造桟橋、魚市場、港神社、kura（蔵）が連なり、Stage 3 の整然と Stage 4 の工業の **境界** を演出する。

- **Ch0**: 港神社 (`shrine`) + 桟橋 (`wood_deck` 帯) + buoy 群（西海岸線）
- **Ch1**: 魚市場通り（`warehouse` 冷蔵庫 + `sushi_ya` + `chaya`）、フォークリフト多数
- **Ch2**: 造船所予兆（`silo` × 2、`factory_stack` 1 棟、Act II ガントリーへの予告）

**人流**: 漁師 × 4-5 (Ch0-1)、市場の客 × 3-4 (Ch1)、神社参拝者 × 2 (Ch0、Stage 3 余韻)
**連続軸**: `buoy` 連続 (西側 x=-150 帯)、`guardrail_short` で海岸線、`drum_can` 散在

## Act II — コンテナヤード（Ch3-5）

**テーマ**: 整然とした巨大ヤード。**ゲート → クレーン → コンテナ山 → 港湾線路** という産業の流れ。Stage 4 のクライマックスは Ch4 のガントリークレーン（h=78、Stage 4 全体で最も高いランドマーク）。

- **Ch3**: コンテナゲート（ゲートハウス × 2、`signal_tower`、`barrier`、ヤード入口の警告帯）
- **Ch4**: **ガントリークレーン × 2 ★** ランドマーク（avenue を跨ぐ巨大構造物）+ コンテナ群
- **Ch5**: コンテナ山頂点 + 港湾線路（`railway_track` × 7、貨物列車）

**人流**: コンテナ運転手 × 3、フォークリフト操作員 × 2、警備員 × 2、信号員 × 1 (Ch4)
**連続軸**: `hazard_stripe` ground 大パッチ (Ch3-Ch5 全面)、`traffic_cone` 列、`signal_tower` 計 4 本

## Act III — 重工業地帯（Ch6-8）

**テーマ**: **製鉄 → 石油 → 発電 → 化学**。Stage 4 で最も「重い」セクション。`factory_stack` の煙突から蒸気、`silo` のタンク群、`water_tank` のパイプ網。

- **Ch6**: 製鉄所（`factory_stack` × 2 + `silo` × 3 + 鉄屑見立て `rock`）
- **Ch7**: 石油タンク群（`silo` × 8 連続、オイルタンク見立て、パイプライン）
- **Ch8**: 発電所 + 化学工場（`factory_stack` × 3 大煙突 + 変電所 `electric_box` × 6）

**人流**: 工場労働者 × 3-4、化学プラント技師 × 2 (Ch8)、トラック運転手 × 2、警備員 × 1
**連続軸**: `oil_stained_concrete` 全面、`drum_can` × 多 (Ch6-7)、`water_tank` × 多 (Ch7)、`cable_junction_box` × 多 (Ch8)、`fire_extinguisher` × 数 (Ch8 化学工場)

## Act IV — 港湾の終端（Ch9-11）

**テーマ**: 工業地帯の **クールダウン**。廃工場、倉庫街、Stage 5 への祭りの予兆。

- **Ch9**: 廃工場 + 倉庫街（`warehouse` × 4、人気の少ない区画）
- **Ch10**: 港湾事務所 + 守衛所（`fire_station` + `police_station`、警備の中枢）
- **Ch11**: 港湾の終端 + Stage 5 祭りの予兆（赤い看板 / `chouchin` 数本 / Stage 5 への移行 ground 切替）

**人流**: 警備員 × 2 (Ch10)、残業労働者 × 1、祭りへ向かう人 × 2 (Ch11、adult mix、提灯持ち)
**連続軸**: `oil_stained_concrete` 減 → `concrete` 増、Ch11 で `chouchin` 復活（Stage 5 予兆）

## Act 間の連続軸サマリ

- 海岸線軸 (`buoy`) は Ch0-Ch2 のみ、それ以降は内陸
- 危険警告軸 (`hazard_stripe`) は Act II-III で支配的
- 電力軸 (`cable_junction_box`) は Act III で爆発的に増加
- 人流は **少 → さらに少 → 極少 → 祭りへの予感** とグラデ
- ground: **harbor_water → steel_plate → oil_stained_concrete → concrete (Stage 5 予兆)**

---

# §3.6 ヒーロー / アンビエント階層（Stage 4 のジグザグ流れ）

| Chunk | ヒーロー位置 | テーマ |
| --- | --- | --- |
| Ch0 | NW | 港神社 + 桟橋 |
| Ch1 | merged (NW+NE) | 漁市場通り |
| Ch2 | NE | 造船所（silo + factory_stack 予兆） |
| Ch3 | merged (全) | コンテナゲート |
| Ch4 | merged (全) | **ガントリークレーン × 2 ★** ランドマーク（クライマックス） |
| Ch5 | merged (全) | コンテナ山 + 港湾線路 |
| Ch6 | merged (全) | 製鉄所 |
| Ch7 | merged (全) | 石油タンク群 |
| Ch8 | merged (全) | 発電所 + 化学工場 |
| Ch9 | NE | 廃工場 + 倉庫街 |
| Ch10 | merged (NW+SW) | 港湾事務所 |
| Ch11 | SE | Stage 5 祭り予兆 |

**Stage 4 の特徴**: Ch3-Ch8 の 6 チャンクが **全マージ ヒーロー**。これは「工業地帯は単一の巨大構造物が支配する」という意図的な設計。Stage 1-3 のジグザグと違い、**中央集約型**。Ch4 ガントリーがピーク。

---

# §4.5 Stage 4 固有の建物→取り巻き辞書

| 建物 | 必須取り巻き | 補助取り巻き | 痕跡 |
| --- | --- | --- | --- |
| `shrine` (港神社) | torii + stone_lantern × 2 + offering_box + sando_stone_pillar × 2 | koma_inu × 2 + bamboo_water_fountain | fallen_leaves (ground) |
| `warehouse` | sign_board + power_pole + traffic_cone × 2 + barrier | drum_can × 2 + pallet_stack | dumpster |
| `crane_gantry` | flag_pole + signal_tower + hazard_stripe (大、ground) + bollard × 4 | barrier × 2 + traffic_cone × 4 | (痕跡控えめ、巨大構造物が主役) |
| `container_stack` | flag_pole + signal_tower + barrier + traffic_cone × 2 | hazard_stripe (周辺) | (痕跡控えめ) |
| `silo` | water_tank × 2 + drum_can × 4 + power_pole + cable_junction_box | hazard_stripe (周辺) | (痕跡控えめ) |
| `factory_stack` | water_tank × 2 + drum_can × 4 + electric_box | cable_junction_box + sign_board | (痕跡: 蒸気 → spawnAmbient で steam) |
| `garage` (港湾) | traffic_cone × 2 + barrier + drum_can | sign_board + bicycle_rack | bicycle |
| `gas_station` | traffic_cone × 3 + vending + sign_board (大) | flag_pole + barrier | bicycle |
| `fire_station` | flag_pole + traffic_cone × 2 + bicycle_rack + fire_extinguisher × 2 | bench + barrier | (痕跡控えめ) |
| `police_station` | flag_pole × 2 + bicycle_rack + traffic_cone × 2 | bench + post_box | bicycle |
| `sushi_ya` (漁港版) | chouchin × 2 + noren + a_frame_sign | milk_crate_stack + bicycle_rack | bicycle |
| `kura` (港湾蔵) | wood_fence × 2 + drum_can × 2 + milk_crate_stack | sign_board + potted_plant (錆びた) | (痕跡: 古い網) |
| `chaya` (港町) | noren + chouchin + bench × 2 + a_frame_sign | potted_plant + bicycle_rack | bicycle |

**港湾固有の集合体（建物 + 家具のセット）**:
- **桟橋セット**: `wood_deck` (ground 大) + `buoy` × 3 + `guardrail_short` × 4 + `drum_can` × 2
- **ガントリーセット**: `crane_gantry` × 2 + `flag_pole` × 2 (頂上) + `signal_tower` × 2 + `hazard_stripe` ground 大 + `bollard` × 6 + `barrier` × 4
- **タンクファームセット**: `silo` × 4-8 + `water_tank` × 4-6 + `drum_can` × 6 + `cable_junction_box` × 2 + `electric_box` × 2

---

# §5 Stage 4 の道路設計

**Stage 4 でも固定するのは中央 `_AVE` のみ**。横道路（`_MID_HR` 含む）と他の縦道路はチャンクのコンセプトに沿って都度設計する。

## Act ごとの道路性格

| Act | 道路性格 | 設計のヒント |
| --- | --- | --- |
| Act I 漁港 | 海岸線、桟橋、市場の搬入路 | Ch0 は `_AVE` のみ + 西側 `harbor_water` で海岸表現。Ch1 は `_AVE` + `_MID_HR` 市場通り。Ch2 は `_AVE` + 短い `_VR` (ゲート搬入) |
| Act II コンテナ | ヤードの搬入動線、ゲート前 | Ch3 ゲート前は `_AVE` + `_TOP_HR` (ゲート上端) + `_HR(60, ...)` (検問帯)。Ch4 ガントリー下は `_AVE` のみ (クレーンの威圧感を活かす)。Ch5 コンテナ山は `_AVE` + `_MID_HR` + `_VR` (列車線路 = `railway_track` 家具で表現) |
| Act III 重工業 | 工場間の搬入路、パイプライン跨線 | Ch6-Ch8 は `_AVE` + `_MID_HR` + 必要なら `_VR(±60, 0, 100)` (タンク間搬入)。`hazard_stripe` ground を多用 |
| Act IV 終端 | 道路減、Stage 5 移行 | Ch9 は `_AVE` + `_MID_HR`、Ch10 は `_AVE` + 守衛所前 `_HR` 短い、Ch11 は `_AVE` のみ + Stage 5 への ground 切替 |

## ground による領域表現

- **海面**: `harbor_water` (Ch0 西側 dx=-180〜-100 帯)
- **桟橋**: `wood_deck` (Ch0-Ch1 西側帯)
- **岸壁**: `oil_stained_concrete` (Ch1-Ch2 中央帯)
- **ヤード**: `steel_plate` (Ch3-Ch5 全面)
- **警告帯**: `hazard_stripe` (Ch3-Ch8 で散在、特に焦点周辺)
- **工場床**: `oil_stained_concrete` (Ch6-Ch8 全面)
- **タンク基礎**: `rust_deck` (Ch7 silo 下)
- **港湾事務所前**: `concrete` (Ch9-Ch11)
- **Stage 5 予告**: Ch11 で `red_carpet` 小パッチ（祭りの参道予告）

---

# §6.5 Stage 4 で使う実 union

## 建物 (BuildingSize)

**主役（Stage 4 で多用）**: `warehouse` / `crane_gantry` / `container_stack` / `silo` / `factory_stack` / `gas_station` / `fire_station` / `police_station`

**Act I 漁港**: `shrine` / `kura` / `sushi_ya` / `chaya` / `ramen` (船員の食事)

**脇役（背景）**: `garage` / `shed` / `parking`

**Act IV Stage 5 予告**: `chaya` / `wagashi` (Ch11 のみ、祭りの予兆)

**避けたい**: `tower` / `skyscraper` / `department_store` / `clock_tower` / `radio_tower` (Stage 3 専用)、`carousel` / `roller_coaster` / `ferris_wheel` / `castle` / `yatai` / `big_tent` (Stage 5 専用)、`kominka` / `pagoda` / `tahoto` / `dojo` (和風住宅、Stage 1/3 専用)

## 家具 (FurnitureType)

**Stage 4 シグネチャ（港湾・工業）**: `drum_can` / `cargo_container` / `forklift` / `buoy` / `pallet_stack` / `water_tank` / `electric_box` / `cable_junction_box` / `signal_tower` / `barrier` / `traffic_cone` / `guardrail_short` / `power_pole` / `power_line` / `fire_extinguisher` / `flag_pole` (頂上掲揚)

**Act I 漁港**: `torii` (Ch0 神社のみ) / `stone_lantern` (Ch0) / `offering_box` (Ch0) / `koma_inu` (Ch0) / `noren` (Ch1 sushi_ya) / `chouchin` (Ch1 chaya のみ)

**生活痕跡**: `garbage` / `recycling_bin` / `dumpster` / `bicycle` / `cat` (港の野良猫、Ch0-Ch1 / Ch9-Ch11 の人気減少エリアに配置)

**Stage 5 予兆 (Ch11)**: `chouchin` × 2-3 (祭りの予告として)

**避けたい**: `play_structure` / `swing_set` / `slide` / `sandbox` / `jungle_gym` (Stage 1/6 公園用)、`sakura_tree` / `bonsai` / `koi_pond` (和風)、`balloon_cluster` / `matsuri_drum` / `popcorn_cart` (Stage 5 祭り)、`statue` / `clock_tower` (Stage 3 オフィス)

## 地面 (GroundType)

- **基調 Act I**: `harbor_water` (西帯) / `wood_deck` (桟橋) / `concrete` (岸壁) / `oil_stained_concrete` (船着場)
- **基調 Act II**: `steel_plate` / `hazard_stripe` / `concrete`
- **基調 Act III**: `oil_stained_concrete` / `rust_deck` / `hazard_stripe` / `steel_plate`
- **基調 Act IV**: `oil_stained_concrete` 減 → `concrete` 増、Ch11 で `red_carpet` (Stage 5 予告)
- **避けたい**: `grass` / `dirt` / `residential_tile` / `tile` (公共・住宅向け)、`stone_pavement` (Ch0 の神社のみ許容)、`fallen_leaves` (Ch0 神社のみ)

---

# §6.6 SemanticCluster の Stage 4 適用ガイド

## hero クラスタの focal 候補

- **オープンスペース型** (基本形 A): Ch0 港神社 (`focal: torii` 家具 or `shrine` 建物) / Ch1 市場通り (`focal: warehouse` 中央) / Ch4 ガントリー下 (`focal: crane_gantry` 建物)
- **焦点建物型** (基本形 B): Ch2 silo（造船所予兆）/ Ch6 factory_stack（製鉄）/ Ch7 silo 群の中央タンク / Ch8 factory_stack 大煙突 / Ch10 fire_station + police_station
- **マージ巨大型**: Ch3-Ch8 の 6 チャンクは **merged ヒーロー**、avenue 中央に巨大構造物（クレーン / コンテナ山 / 工場）

## ambient クラスタの focal 候補

- 各セルに 1 つ、ヒーローでない建物（warehouse / garage / shed）
- ただし **Stage 4 は ambient セルが少ない**（merged hero が多いため）

## boundary 候補（Stage 4 固有）

- `barrier` × 多 (工業区画の輪郭)
- `traffic_cone` 列 (作業区画)
- `guardrail_short` (海岸線、Ch0-Ch2 のみ)
- `bollard` × 多 (車両規制)
- **避ける**: `hedge` / `wood_fence` / `flower_planter_row` (住宅・公共向け、Ch0 神社の wood_fence のみ許容)

## access 候補（Stage 4 固有）

- `signal_tower` (Ch3-Ch5 ヤード信号)
- `traffic_cone` (作業導線)
- `forklift` (動線の主役)
- `street_lamp` × 少 (Stage 4 では街灯少ない、工業照明は building 自体)
- `manhole_cover` (avenue 横断、Stage 1-3 と同じ)

## livingTrace 候補（Stage 4 固有）

- `dumpster` (warehouse 裏)
- `pallet_stack` (搬入痕跡)
- `drum_can` (工業痕跡)
- `bicycle` (Ch0-Ch1 の港町、Ch10 の事務所)
- `cat` (Ch0-Ch1 / Ch9-Ch11 の人気減少エリア)
- `garbage` (Ch9 廃工場)
- **避ける**: `laundry_pole` / `laundry_balcony` / `mailbox` / `potted_plant` (住宅向け、ほぼ使わない)

---

# §9 詳細フェーズ: 各チャンクレイアウト

<aside>
🛣️

**道路注意**: 各チャンクの道路指定は **コンセプトに沿って都度設計**。固定するのは `_AVE`（x=0）のみ。Stage 4 では巨大構造物（クレーン / コンテナ / 工場）を **建物として配置**、道路は最小限にしてランドマーク感を活かす。

</aside>

## Act I — 漁港

### Ch0: 港神社と桟橋（Stage 3 → Stage 4 切替）

**ヒーロー**: **NW = ヒーロー**（港神社、Stage 3 余韻 + Stage 4 開始の境界）

**NW 4 層**:
- **焦点**: `shrine` (x=-100, y=22) + `torii` 家具 (x=-130, y=58) ★ 鳥居ゲート
- **取り巻き**: `stone_lantern` × 2 (準対称、x=-160/-100, y=88)、`offering_box` (x=-100, y=68)、`koma_inu` × 2 (x=-130/-70, y=78)、`bamboo_water_fountain` (x=-160, y=78)、`sando_stone_pillar` × 2 (x=-100/-160, y=92)
- **境界**: `wood_fence` × 4 (神社の境内輪郭)、`bamboo_fence` × 2
- **動線**: 参道 `stone_pavement` 帯 (x=-100, y=80, 80×40)、`fallen_leaves` ground × 2

**アンビエント**:
- **NE**: `chaya` (x=130, y=22) + `noren` + `bench` × 2
- **SW**: 桟橋セット（`wood_deck` 大 ground + `buoy` × 3 + `guardrail_short` × 4 + `drum_can` × 2）
- **SE**: `kura` × 2 (x=80/140, y=130) + `sign_board` + `bicycle` (痕跡)

**人配置**: 神社参拝者 × 2 (NW、Stage 3 余韻)、漁師 × 3 (SW 桟橋)、市場の客 × 2 (NE 茶屋)、cat × 2 (SE 蔵裏)

**地面パッチ**:
- 基調: `concrete` 全面
- NW 神社: `stone_pavement` (x=-100, y=78, 100×80) + `fallen_leaves` × 2
- SW 桟橋: `wood_deck` 大 (x=-130, y=130, 100×120) + `harbor_water` (x=-180, y=180, 50×100) 海面アクセント
- NE 茶屋: `concrete` (店前)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**取り巻き 3 パターン**:
- facade 沿い (y=22): `mailbox` × 2 (chaya 茶屋)、`sign_board` × 2 (kura 蔵)
- 焦点囲み: NW 神社の torii + stone_lantern × 2 + offering_box + koma_inu × 2 + sando_stone_pillar × 2
- 歩道沿い: `buoy` × 3 (海岸線)、`guardrail_short` × 4

**生活の痕跡 / スケール / 向き**:
- 痕跡: SE bicycle (kura 帰属)、SW 桟橋 drum_can
- スケール: 大 `shrine` / 中 `kura`/`chaya` / 小 `stone_lantern` × 2・`buoy` × 3
- 向き: torii は avenue 向き、koma_inu は内向き対、buoy は海面向き

**Handoff (Stage 3 Ch11 → Stage 4 Ch0)**:
- **並木**: 街路樹 → 神社の `pine_tree` × 2 (x=-170/-30, y=68) で和の余韻
- **歩道**: `concrete` から `stone_pavement` (神社) → `wood_deck` (桟橋) へ
- **電柱/電線**: 4 隅で対 (Stage 4 で密度上昇)
- **予兆**: SW 桟橋の `harbor_water` と `buoy` が Stage 4 港湾感を開始

### Ch1: 漁市場通り

**ヒーロー**: **NW+NE merged = ヒーロー**（市場通り、3-4 軒並び）

**merged 4 層**:
- **焦点**: `warehouse` (x=-100, y=22) 冷蔵庫 + `sushi_ya` (x=0, y=22) 港寿司 + `chaya` (x=100, y=22) + `ramen` (x=160, y=22) 船員の食事
- **取り巻き**: 各店 `chouchin` (y=22 facade 帯) + `noren` (店前 y=28-32) + `a_frame_sign` (y=58)、`forklift` × 2 (x=-50/+50, y=68)、`pallet_stack` × 4 (各倉庫前)、`milk_crate_stack` × 4
- **境界**: `barrier` × 2 (x=-178/178, y=68)、`traffic_cone` × 4
- **動線**: `forklift` × 2、`drum_can` × 4 (散在)、`signal_tower` (x=0, y=78)

**アンビエント**:
- **SW**: 桟橋 (`wood_deck` 帯 + `buoy` × 2)
- **SE**: `kura` × 2 + `bicycle` (痕跡) + `cat`

**人配置**: 漁師 × 4、市場の客 × 4、フォークリフト操作員 × 2

**地面パッチ**: `concrete` 基調、市場前 `oil_stained_concrete` 帯 (x=0, y=58, 360×40)、SW 桟橋 `wood_deck`

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 4 (各店)、`chouchin` × 2 (sushi_ya/chaya)
- 焦点囲み: 市場通りの forklift × 2 + pallet_stack × 4 + drum_can × 4
- 歩道沿い: `signal_tower`、`barrier` × 2 (作業区画)

**生活の痕跡 / スケール / 向き**:
- 痕跡: SE 蔵の bicycle、SW 桟橋 buoy × 2
- スケール: 大 `warehouse` / 中 `sushi_ya`/`chaya`/`ramen` / 小 `forklift` × 2・`pallet_stack` × 4
- 向き: noren は店前向き、forklift は搬入口向き

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch2: 造船所予兆

**ヒーロー**: **NE = ヒーロー**（造船所、Act II ガントリーへの予告）

**NE 4 層**:
- **焦点**: `silo` × 2 (x=80/140, y=22) + `factory_stack` (x=110, y=68) ★ 初の煙突
- **取り巻き**: `water_tank` × 4 (周囲)、`drum_can` × 6 (散在)、`crane_gantry` 予告は無し（Ch4 で登場）、`signal_tower` (x=110, y=88)
- **境界**: `barrier` × 4、`hazard_stripe` ground 帯 (x=110, y=70, 80×30)
- **動線**: `forklift` × 2、`pallet_stack` × 4

**アンビエント**:
- **NW**: `warehouse` (x=-100, y=22) + `garage` (x=-160, y=22) + `dumpster` (痕跡)
- **SW**: `kura` (x=-100, y=130) + `cat` (痕跡)
- **SE**: `garage` × 2 + `bicycle` (痕跡)

**人配置**: 造船員 × 3、警備員 × 1、cat × 1

**地面パッチ**: `concrete` 基調、NE 造船所 `oil_stained_concrete` 大 (x=110, y=58, 140×120) + `hazard_stripe`

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

---

## Act II — コンテナヤード
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 2 (warehouse)、`barrier` × 2 (危険警告)
- 焦点囲み: NE 造船所の water_tank × 4 + drum_can × 6 + signal_tower
- 歩道沿い: `forklift` × 2、`pallet_stack` × 4

**生活の痕跡 / スケール / 向き**:
- 痕跡: NW dumpster、SE bicycle、SW cat
- スケール: 大 `silo` × 2・`factory_stack` / 中 `warehouse`/`garage` / 小 `drum_can` × 6
- 向き: factory_stack は天向き (煙突)、forklift は搬入口向き

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch3: コンテナゲート（merged hero）

**ヒーロー**: **merged 全マージ = ヒーロー**（ゲート + ヤード入口）

**merged 4 層**:
- **焦点**: `warehouse` × 2 (x=-130/130, y=22) ゲートハウス + `container_stack` × 3 (x=-50/0/50, y=68) ★ 初コンテナ
- **取り巻き**: `signal_tower` × 2 (x=-90/90, y=58)、`barrier` × 6 (検問区画)、`traffic_cone` × 8 (作業帯)、`flag_pole` × 2 (x=-130/130, y=8)
- **境界**: `hazard_stripe` ground 大 (x=0, y=78, 360×40)、`barrier` × 4 (x=±178, y=78)
- **動線**: `forklift` × 4、`signal_tower` × 2

**アンビエント**: 全部 merged のため最小限

**人配置**: 警備員 × 3、運転手 × 4、信号員 × 2

**地面パッチ**: `steel_plate` 全面 (x=0, y=100, 360×200)、ヤード前 `hazard_stripe` 大、ゲート前 `concrete` 帯

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR, _TOP_HR, _HR(60, -180, 180)]` — ゲート上端 + 検問帯
**取り巻き 3 パターン**:
- facade 沿い (y=22): `flag_pole` × 2 (ゲート)、`signal_tower` × 2
- 焦点囲み: ゲート前の barrier × 6 + traffic_cone × 8 + flag_pole × 2
- 歩道沿い: `forklift` × 4、`signal_tower` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: 工業区画は痕跡控えめ、各 warehouse 前 dumpster
- スケール: 大 `warehouse` × 2 / 中 `container_stack` × 3 / 小 `barrier` × 6・`traffic_cone` × 8
- 向き: signal_tower は天向き、barrier はヤード入口向き

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch4: ガントリークレーン × 2 ★ ランドマーク

**ヒーロー**: **merged 全マージ = ヒーロー**（Stage 4 のクライマックス）

**merged 4 層**:
- **焦点**: `crane_gantry` (x=-60, y=68) + `crane_gantry` (x=60, y=68) 巨大ツインクレーン ★★（h=78、avenue を跨ぐ）
- **取り巻き**: `container_stack` × 6 (周囲、x=-130/-90/-30/30/90/130, y=130-150) + `signal_tower` × 4 (準対称、x=-100/-30/30/100, y=58)
- **境界**: `hazard_stripe` ground 大全面、`barrier` × 8、`bollard` × 6
- **動線**: `forklift` × 4、`flag_pole` × 2 (x=-60/60, y=2 クレーン頂上)、`traffic_cone` × 6

**人配置**: 運転手 × 4、警備員 × 2、信号員 × 2、フォークリフト操作員 × 3

**地面パッチ**: `steel_plate` 全面 + `hazard_stripe` 大パッチ × 2 (クレーン下、x=-60/60, y=80, 80×60)、`oil_stained_concrete` 帯

**道路**: `verticalRoads: [_AVE]`（クレーンの威圧感を活かすため横道路最小）/ `horizontalRoads: [_MID_HR]`
**取り巻き 3 パターン**:
- facade 沿い (y=22): クレーン基礎 `flag_pole` × 2 頂上、`signal_tower` × 4 準対称
- 焦点囲み: ツインクレーン下の hazard_stripe 大 + barrier × 8 + bollard × 6
- 歩道沿い: `forklift` × 4、`traffic_cone` × 6

**生活の痕跡 / スケール / 向き**:
- 痕跡: 痕跡なし (重工業の威圧感)
- スケール: 大 `crane_gantry` × 2 (h=78) / 中 `container_stack` × 6 / 小 `signal_tower` × 4・`barrier` × 8
- 向き: クレーンアームは avenue 跨ぎ、signal_tower は天向き

**アンビエント 3 セル**: 既存指定どおり、4 セル中 3 セルがアンビエント (各セル痕跡 1 個以上)

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch5: コンテナ山 + 港湾線路

**ヒーロー**: **merged = ヒーロー**

**merged 4 層**:
- **焦点**: `container_stack` × 8 (積み重ねの山、x=-130/-90/-50/-10/30/70/110/150, y=68 不揃い高さ) + `silo` × 2 (Act III 予兆、x=-150/150, y=130)
- **取り巻き**: `railway_track` × 7 (港湾線路、x=-180→180 全幅、y=140 跨線)、`signal_tower` × 2 (x=-90/90, y=128)、`barrier` × 4
- **境界**: `hazard_stripe` 帯 (x=0, y=88, 360×30)、`bollard` × 4
- **動線**: `forklift` × 3、`drum_can` × 6 (散在)

**アンビエント**: 最小限

**人配置**: 運転手 × 3、信号員 × 1、警備員 × 1

**地面パッチ**: `steel_plate` 上半 + `oil_stained_concrete` 下半（線路沿い）

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]` (線路は `railway_track` 家具で表現)

---

## Act III — 重工業地帯
**取り巻き 3 パターン**:
- facade 沿い (y=22): `signal_tower` × 2 (列車信号)、`flag_pole`
- 焦点囲み: コンテナ山 8 個 + signal_tower × 2 + barrier × 4
- 歩道沿い: `railway_track` × 7 (港湾線路、avenue 全幅 y=140)

**生活の痕跡 / スケール / 向き**:
- 痕跡: 痕跡控えめ、forklift × 3 と drum_can が動線痕跡
- スケール: 大 `container_stack` × 8 / 中 `silo` × 2 / 小 `drum_can` × 6・`railway_track` × 7
- 向き: 線路は avenue 跨ぎ、container は積み重ね方向

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch6: 製鉄所

**ヒーロー**: **merged = ヒーロー**（製鉄所ランドマーク）

**merged 4 層**:
- **焦点**: `factory_stack` × 2 (x=-50/50, y=22) ★ 双煙突 + `silo` × 3 (x=-130/0/130, y=68)
- **取り巻き**: `water_tank` × 4 (周囲、配管見立て)、`drum_can` × 8 (散在)、`rock` × 4 (鉄屑見立て、ground レベル)、`electric_box` × 2、`cable_junction_box` × 2
- **境界**: `barrier` × 6、`hazard_stripe` 警告帯 × 4
- **動線**: `forklift` × 2、`flag_pole` × 2 (x=-50/50, y=8)

**人配置**: 製鉄労働者 × 4、技師 × 1

**地面パッチ**: `oil_stained_concrete` 全面 + `rust_deck` 中央帯 (x=0, y=120, 200×60) + `hazard_stripe` × 4

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`
**取り巻き 3 パターン**:
- facade 沿い (y=22): `flag_pole` × 2 (双煙突 x=-50/+50, y=8)、`hazard_stripe` 大
- 焦点囲み: 製鉄所の water_tank × 4 + drum_can × 8 + electric_box × 2 + cable_junction_box × 2
- 歩道沿い: `forklift` × 2、`barrier` × 6

**生活の痕跡 / スケール / 向き**:
- 痕跡: 痕跡なし (重工業)
- スケール: 大 `factory_stack` × 2 (双煙突) / 中 `silo` × 3 / 小 `drum_can` × 8・`rock` × 4 (鉄屑)
- 向き: factory_stack は天向き、water_tank は配管向き

**アンビエント 3 セル**: 既存指定どおり、4 セル中 3 セルがアンビエント (各セル痕跡 1 個以上)

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch7: 石油タンク群

**ヒーロー**: **merged = ヒーロー**（巨大タンクファーム）

**merged 4 層**:
- **焦点**: `silo` × 8 (オイルタンク見立て、x=-160/-110/-60/-10/40/90/130/170, y=68 横一列、Stage 4 で最も連続的なシグネチャ)
- **取り巻き**: `water_tank` × 6 (パイプ分岐、各タンク間、y=88)、`drum_can` × 8、`pallet_stack` × 4
- **境界**: `barrier` × 8 (各タンク輪郭)、`hazard_stripe` 大全面
- **動線**: `cable_junction_box` × 4、`signal_tower` × 2

**人配置**: 化学プラント技師 × 2、警備員 × 1

**地面パッチ**: `oil_stained_concrete` 全面 + `rust_deck` 各タンク基礎 (8 個) + `hazard_stripe` × 6

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]` （タンク間は道路なし、家具のパイプで連結）

**注意**: §6 行進禁止に抵触する可能性あり（silo × 8 が等間隔）。dx を 50/50/50/50/50/40/40 など微妙にずらすか、高さ y を不揃いに。
**取り巻き 3 パターン**:
- facade 沿い (y=22): `silo` × 8 (オイルタンク横一列)、`hazard_stripe` 全面
- 焦点囲み: タンクファームの water_tank × 6 + drum_can × 8 + pallet_stack × 4
- 歩道沿い: `cable_junction_box` × 4、`signal_tower` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: 痕跡控えめ
- スケール: 大 `silo` × 8 (タンク並び) / 中 `water_tank` × 6 / 小 `drum_can` × 8
- 向き: タンクは天向き、配管は接続向き

**アンビエント 3 セル**: 既存指定どおり、4 セル中 3 セルがアンビエント (各セル痕跡 1 個以上)

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch8: 発電所 + 化学工場

**ヒーロー**: **merged = ヒーロー**

**merged 4 層**:
- **焦点**: `factory_stack` × 3 (x=-100/0/100, y=22) ★ 大煙突 3 本 + `silo` × 2 (x=-50/50, y=130)
- **取り巻き**: `electric_box` × 6 (変電所シグネチャ、x=-130/-90/-50/40/90/130, y=78)、`cable_junction_box` × 4、`fire_extinguisher` × 4 (化学工場安全)、`water_tank` × 4
- **境界**: `barrier` × 6、`hazard_stripe` 警告帯 × 6 (化学工場の重要警告)
- **動線**: `power_pole` × 4 (avenue 端、密)、`power_line` × 4

**人配置**: 化学プラント技師 × 3、警備員 × 1

**地面パッチ**: `oil_stained_concrete` 全面 + `hazard_stripe` × 6 (化学のため警告密)

**道路**: `verticalRoads: [_AVE, _VR(-90, 0, 100)]` (発電所搬入) / `horizontalRoads: [_MID_HR, _HR(60, -180, 180)]` (パイプライン跨線)

---

## Act IV — 港湾の終端
**取り巻き 3 パターン**:
- facade 沿い (y=22): `factory_stack` × 3 (大煙突 x=-100/0/100, y=22)
- 焦点囲み: 発電所の electric_box × 6 + cable_junction_box × 4 + fire_extinguisher × 4 + water_tank × 4
- 歩道沿い: `power_pole` × 4 (avenue 端、密)、`hazard_stripe` × 6

**生活の痕跡 / スケール / 向き**:
- 痕跡: 痕跡なし (危険化学物質)
- スケール: 大 `factory_stack` × 3・`silo` × 2 / 中 `warehouse` / 小 `electric_box` × 6・`fire_extinguisher` × 4
- 向き: 煙突は天向き、化学プラント配管は工場間向き

**アンビエント 3 セル**: 既存指定どおり、4 セル中 3 セルがアンビエント (各セル痕跡 1 個以上)

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch9: 廃工場 + 倉庫街

**ヒーロー**: **NE = ヒーロー**（廃工場、寂しさの始まり）

**NE 4 層**:
- **焦点**: `warehouse` (x=130, y=68) 大 + `warehouse` (x=80, y=22) 小（倉庫街）
- **取り巻き**: `dumpster` × 2、`pallet_stack` × 4、`drum_can` × 6、`barrier` × 2
- **境界**: `barrier` × 2、`traffic_cone` × 2
- **動線**: 最小限

**アンビエント**:
- **NW**: `warehouse` (x=-100, y=22) + `garage` (x=-160, y=22) + `dumpster` (痕跡)
- **SW**: `kura` × 2 (x=-130/-70, y=130) + `cat` × 2 (痕跡: 静寂)
- **SE**: `garage` × 2 (x=80/140, y=130) + `bicycle` (痕跡)

**人配置**: 残業労働者 × 1、警備員 × 1、cat × 3 (静寂の主役)

**地面パッチ**: `oil_stained_concrete` 縮小 → `concrete` 増 (Stage 5 予兆)、ところどころ `hazard_stripe`
**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` × 2 (warehouse 古看板)、`barrier` × 2
- 焦点囲み: NE 廃工場の dumpster × 2 + pallet_stack × 4 + drum_can × 6
- 歩道沿い: `barrier` × 2、`traffic_cone` × 2

**生活の痕跡 / スケール / 向き**:
- 痕跡: NW dumpster、SE bicycle、SW cat × 2 (静寂)
- スケール: 中 `warehouse` × 4・`garage` × 2 / 小 `dumpster` × 2・`pallet_stack` × 4
- 向き: 廃工場の barrier は出入禁止向き、cat は様々

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`（チャンクコンセプトに沿った最小構成）

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch10: 港湾事務所と守衛所

**ヒーロー**: **NW+SW merged = ヒーロー**（港湾事務所 + 消防 + 警察、警備の中枢）

**merged 西側 4 層**:
- **焦点**: `fire_station` (x=-100, y=68) + `police_station` (x=-100, y=130) 連続
- **取り巻き**: `flag_pole` × 4 (各施設前)、`traffic_cone` × 6、`bicycle_rack` × 2 + `bicycle` × 4 (パトロール用)、`fire_extinguisher` × 2
- **境界**: `barrier` × 2、`bollard` × 4
- **動線**: `bench` × 2 (待ち)

**アンビエント**:
- **NE**: `gas_station` (x=130, y=22) + `traffic_cone` × 3 + `vending`
- **SE**: `garage` × 2 + `bicycle` (痕跡)

**人配置**: 警備員 × 3、消防士 × 1、警官 × 1

**地面パッチ**: `concrete` 基調 (oil_stained 減)、SW 警察前 `tile`、NE ガソリン前 `oil_stained_concrete` 小

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`
**取り巻き 3 パターン**:
- facade 沿い (y=22): `flag_pole` × 4 (消防・警察)、`sign_board` × 2
- 焦点囲み: 守衛所前の traffic_cone × 6 + bicycle_rack × 2 + bicycle × 4 + flag_pole × 4
- 歩道沿い: `bench` × 2、`bollard` × 4

**生活の痕跡 / スケール / 向き**:
- 痕跡: bicycle_rack + bicycle × 4 (パトロール用)、SE bicycle
- スケール: 中 `fire_station`/`police_station`/`gas_station` / 小 `traffic_cone` × 6・`flag_pole` × 4
- 向き: flag_pole は avenue 向き、bicycle は出動口向き

**Handoff**: 連続軸 (chouchin帯/街灯/puddle_reflection/manhole_cover/power_pole) を次チャンク y=10 と一致させる。並木は隣接チャンク種別に合わせる。


### Ch11: 港湾の終端 + Stage 5 祭り予兆

**ヒーロー**: **SE = ヒーロー**（Stage 5 への入口、祭りの予感）

**SE 4 層**:
- **焦点**: `chaya` (x=130, y=130) + `wagashi` (x=80, y=130) 茶店と和菓子（祭りの予感）
- **取り巻き**: `chouchin` × 4 (店前 y=125、Stage 5 提灯の予告) + `noren` × 2 + `parasol` × 2、`bench` × 2 (休憩)
- **境界**: `flower_planter_row` × 2、`hedge` × 2 (Stage 5 への切替)
- **動線**: `street_lamp` × 1、`flag_pole` (赤、Stage 5 シグネチャ)

**アンビエント**:
- **NW**: `warehouse` (x=-130, y=22) + `dumpster` (痕跡: Stage 4 余韻)
- **NE**: `garage` × 2 + `bicycle`
- **SW**: `kura` (x=-100, y=130) + `cat` × 2 + `garbage` (痕跡)

**人配置**: 祭りへ向かう人 × 2 (SE、提灯持ち)、警備員 × 1、残業労働者 × 1、cat × 2

**地面パッチ**: `concrete` 基調、SE 茶店前 `red_carpet` 小パッチ (x=110, y=148, 80×40) ★ Stage 5 予告、NW `oil_stained_concrete` 残り

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

**取り巻き 3 パターン**:
- facade 沿い (y=22): `sign_board` (warehouse)、`chouchin` × 4 (Stage 5 予告!)
- 焦点囲み: SE 茶屋『松』の noren × 2 + parasol × 2 + bench × 2 + flag_pole (赤)
- 歩道沿い: `bollard` × 2、`hedge` × 2 (Stage 5 への切替)

**生活の痕跡 / スケール / 向き**:
- 痕跡: NW dumpster (Stage 4 余韻)、SE bicycle、SW cat × 2
- スケール: 中 `chaya`/`wagashi`/`warehouse`/`garage` / 小 `chouchin` × 4 (Stage 5 予告)・`bench` × 2
- 向き: chouchin は店前向き (赤の予告)、Stage 5 の祭り感を hint に

**Handoff (Ch11 → Stage 5 Ch0)**:
- **並木**: 街路樹なし、ground の `red_carpet` パッチが連続軸の予告
- **歩道**: `concrete` から `red_carpet` 帯へ
- **電柱/電線**: 4 隅で対、Stage 5 で `chouchin` 帯に交代
- **予兆**: SE の `chouchin` × 4 + `chaya` + `wagashi` が Stage 5 祭りエリアを完全予告

---

# §8 変更履歴

- **v1.0（本版）**: Stage 4 「工業港湾 HARBOR」の新規設計指示書。既存実装は 9 チャンクだったが、本指示書では **12 チャンク** に拡張し、Stage 1-3 と統一。4 Acts: Act I 漁港（神社 + 桟橋 + 市場 + 造船所予兆）/ Act II コンテナヤード（ゲート + ガントリー ★ + コンテナ山）/ Act III 重工業（製鉄 + 石油 + 発電・化学）/ Act IV 港湾の終端（廃工場 + 守衛所 + Stage 5 予兆）。Stage 1-3 と異なる **中央集約型ジグザグ**: Ch3-Ch8 の 6 チャンクが merged ヒーローで巨大構造物が支配。クライマックスは Ch4 ガントリークレーン × 2（h=78）。Ch11 で `red_carpet` + `chouchin` 4 本が Stage 5 祭りを予告し handoff。`harbor_water` / `steel_plate` / `oil_stained_concrete` / `rust_deck` / `hazard_stripe` の鋼鉄 + 油の ground 構成、人流は極端に少なく、`drum_can` / `forklift` / `cable_junction_box` の工業ディテールが連続軸。
