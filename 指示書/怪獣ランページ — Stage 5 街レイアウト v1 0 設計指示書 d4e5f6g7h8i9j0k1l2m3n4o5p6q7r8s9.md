# 怪獣ランページ — Stage 5 街レイアウト v1.0 設計指示書

<aside>
📋

**このドキュメントの位置づけ（v1.0 新規設計版）**

Stage 5「城下町・祭礼 CASTLE TOWN」の **再配置のための設計指示書**。Stage 1 v6.3 と同じフォーマット。**ゲーム全体のフィナーレチャンク（GOAL）を含む**特別なステージ。

**Stage 1 v6.3 の §2 / §4 / §5 / §6 / §6.5 / §6.6 はそのまま継承**。Stage 5 では Stage 固有のコンセプト・取り巻き辞書・連続軸 + **ゴール演出ガイド** を §1 / §3 / §4.5 / §6.5 / §10 で書き直す。

</aside>

<aside>
🎆

**Stage 5 のテーマ宣言**

Stage 4 末尾の港湾終端（夕方）から、世界が一転して **祝祭** に切り替わる。**鳥居の参道 → 屋台通り → メリーゴーランドや観覧車のテーマパーク → そして最後に天守閣（城）** へ。怪獣としての旅の終着点。プレイヤーは祭りの熱気を引き裂き、ゲームのラスボスとも言える **巨大な城** を破壊するための舞台へ向かう。

**コアトーン**: 赤と金 / 提灯の連続帯 / 屋台の賑わい / 風船と旗 / 太鼓の振動 / 観覧車とコースターの曲線 / 夕焼けから夜への色温度 / 天守閣の威光

**Stage 4 との対比**: Stage 4 は鋼鉄・油・無人 → Stage 5 は紙提灯・赤絨毯・人が密集。Stage 1-4 を旅して来たプレイヤーへの **祝祭** であり、同時に **クライマックス**。

</aside>

<aside>
🆕

**v1.0 の方針**

- Stage 1 v6.3 の **公園モデル 4 層構造** と **SemanticCluster** 継承
- 道路は **中央 `_AVE` のみ固定**（Stage 1 v6.2 方針継承）
- **12 チャンク + GOAL** で構成（Ch0-Ch11、Ch11 が `isGoal: true`）
- 連続軸: **赤絨毯 (`red_carpet` ground) / 提灯帯 (chouchin) / 屋台連続 (yatai) / 旗ガーランド (flag_pole + banner_pole) / 太鼓広場 (matsuri_drum)**
- **テーマパーク要素** が他 Stage にない: `carousel` / `roller_coaster` / `ferris_wheel` (★) / `big_tent` / `castle` (★★ GOAL)
- **§10 ゴール演出ガイド** を新設し、Ch11 の `castle` 配置と「決戦の舞台」表現を専用記述
- 既存実装の Stage 5（11 チャンク、C5 が park_break、C10 が isGoal）を **コンセプトのみ引き継ぎ**、本指示書では 12 chunks + Ch11 GOAL に再構成

</aside>

---

# §1 Stage 5 の実コンセプト

## 全体像

- タイトル: **城下町・祭礼** (CASTLE TOWN)
- 12 チャンク（北→南、y=9600 → 12000、Stage 4 末尾を継ぐ）
- プレイヤーは怪獣として **祭りの熱気** を駆け抜け、最後に **天守閣** に到達する
- チャンク高さ = 200
- 世界幅 X ∈ [-180, +180]

## 4 Acts + GOAL

| Act | チャンク | テーマ | シグネチャ要素 |
| --- | --- | --- | --- |
| Act I | Ch0-2 | 祭り入場 | 鳥居ゲート / 屋台通り 1・2 / 提灯帯 |
| Act II | Ch3-5 | 広場エリア | メリーゴーランド / 盆踊り / 公園休憩 |
| Act III | Ch6-8 | 大型アトラクション | コースター / 観覧車 ★ / 第 2 コースター |
| Act IV | Ch9-10 | 祭りクライマックス | カーニバルテント / 巨大バルーン |
| **GOAL** | **Ch11** | **天守閣決戦** | **castle ★★** + 応援メリー × 2 + 太鼓広場 + 全面赤絨毯 |

## 既存の連続軸

- 主要通り x=0 のファサード連続
- **赤絨毯 `red_carpet` ground** Ch0-Ch11 全チャンク（中央 avenue を貫く）
- **提灯帯 chouchin** 全チャンク（Stage 2 の歓楽街よりさらに密、上空 + 店前）
- **屋台連続 yatai** Ch0-Ch10（avenue 沿い）
- **旗ガーランド** `banner_pole` + `flag_pole` 全チャンク（上空 y=8-22）
- **太鼓 matsuri_drum** Ch0 / Ch4 / Ch6-Ch11（祭りの振動を表現）
- 縦道路は **中央 `_AVE` のみ固定**
- ground 基調は **red_carpet + checker_tile + tile** （Act IV まで）→ **red_carpet 全面 + stone_pavement 中心** （Ch11 GOAL）

## 時間帯と人流グラデ

| Act | 時間帯 | 人流 |
| --- | --- | --- |
| Act I | 夕方 17:00 | 家族客 / カップル / 子供 (child × 多) |
| Act II | 夕方 18:00 | 家族客 / カップル / 子供 / 屋台店主 |
| Act III | 夕暮 19:00 | カップル / 友人グループ / 観光客 |
| Act IV | 夜 20:00 | 観客 / 屋台客 / 太鼓奏者 |
| **GOAL** | **夜 20:30** | **儀式参加者 / 太鼓奏者 × 多 / 城前応援団** |

---

# §3 Act レベル方針

## Act I — 祭り入場（Ch0-2）

**テーマ**: Stage 4 末尾の `red_carpet` 予告から、本格的な祭りの入口へ。**鳥居ゲート → 屋台通り 2 連** と続き、Stage 5 のトーン（赤絨毯 + 提灯 + 屋台）を確立する。

- **Ch0**: **鳥居ゲート** + 大提灯（avenue 跨ぐ chouchin 巨大）+ 屋台 × 5-6 + チケットブース
- **Ch1**: 屋台通り 1（yatai × 8-10、提灯帯密、子供と家族）
- **Ch2**: 屋台通り 2（yatai × 8-10、抽選会テント、噴水パビリオン）

**人流**: 家族客 × 多 (adult mix + child × 多)、カップル × 中、屋台店主 × 4-5、cat × 1
**連続軸**: chouchin 帯 (上空 y=8-15 + 店前 y=22-32)、yatai 連続、`red_carpet` 中央帯

## Act II — 広場エリア（Ch3-5）

**テーマ**: 広場の **遊びの中心**。メリーゴーランド、盆踊り、公園休憩。Act I の入場の興奮から、家族で楽しめる広場へ。

- **Ch3**: **メリーゴーランド広場**（`carousel` × 1-2 中央、観客テント、風船バルーン）
- **Ch4**: **盆踊り広場**（中央に太鼓 matsuri_drum × 4、yatai 観客、提灯大群）
- **Ch5**: **公園休憩**（穏やかな区画、Act II→III の呼吸点）

**人流**: 家族客 × 多、子供 × 多、太鼓奏者 × 4 (Ch4)、観客 × 中
**連続軸**: `red_carpet` 中央帯継続、`checker_tile` ground (広場感)、`balloon_cluster` 上空

## Act III — 大型アトラクション（Ch6-8）

**テーマ**: テーマパーク本格化。コースター・観覧車という **垂直のスケール感**。Stage 1-4 の建物スケールとは違う、曲線と鉄骨の遊具。

- **Ch6**: **ジェットコースター**（`roller_coaster` × 2 並列、観客テント、行列）
- **Ch7**: **大観覧車** ★ ランドマーク（`ferris_wheel` 1 棟、上空に風船、Stage 5 の Act III 山）
- **Ch8**: **第 2 コースター + カーニバル**（`roller_coaster` × 2 + `carousel` 中央 + 観客テント）

**人流**: カップル × 多、友人グループ × 中、観光客 × 中、観客 × 多 (Ch6-Ch8 のテント周辺)
**連続軸**: `red_carpet` 中央帯、`balloon_cluster` 各遊具上空、`signal_tower` (コースター発券・安全)

## Act IV — 祭りクライマックス（Ch9-10）

**テーマ**: テーマパークの **狂騒のピーク**。バルーンアーチ、カーニバルテント、屋台と遊具の融合。Ch11 GOAL への助走。

- **Ch9**: **テント + バルーンアーチ**（`big_tent` × 4 観客席、`balloon_cluster` × 6 上空、噴水パビリオン）
- **Ch10**: **クライマックス前の集約**（`yatai` × 多、提灯大群、太鼓広場予兆、Ch11 城への参道予告）

**人流**: 観客 × 多 (各テント)、屋台客 × 多、太鼓奏者 × 2 (Ch10 予兆)、子供 × 多
**連続軸**: 全シグネチャ収束（chouchin / yatai / banner_pole / matsuri_drum / balloon_cluster）

## **GOAL — 天守閣決戦（Ch11）**

**テーマ**: ゲーム全体の **クライマックス**。中央に **天守閣 (`castle`、w=70 h=110)** が立ち、応援メリー × 2、太鼓広場、屋台、提灯、風船で **同心円状に城を囲む** 構造。全面赤絨毯の「王座の間」感。

- **Ch11 (isGoal: true)**: castle 中央 + 城前広場 + 応援機構（メリー × 2、太鼓 × 4、屋台 × 8、提灯群、風船 × 11、桜並木）

**人流**: 儀式参加者 × 多、太鼓奏者 × 4、城前応援団 × 多、子供 × 中
**連続軸**: 全シグネチャ収束、`red_carpet` 全面、`stone_pavement` 城中心

詳細は **§10 ゴール演出ガイド** に。

## Act 間の連続軸サマリ

- 桜並木は Ch11 のみ（決戦の舞台シグネチャ）
- 提灯は全チャンク継続、密度は Ch11 で最大
- 屋台は Ch0-Ch10 で連続、Ch11 では「城を囲む」位置に変化
- 人流は **家族 → 子供多 → カップル → 観客 → 儀式参加者** とグラデ
- ground: **red_carpet 中央帯（全チャンク）→ Ch11 で全面 red_carpet**

---

# §3.6 ヒーロー / アンビエント階層（Stage 5 のジグザグ流れ）

| Chunk | ヒーロー位置 | テーマ |
| --- | --- | --- |
| Ch0 | merged (全) | 鳥居ゲート + 大提灯 |
| Ch1 | merged (全) | 屋台通り 1 |
| Ch2 | merged (全) | 屋台通り 2 |
| Ch3 | merged (全) | メリーゴーランド広場 |
| Ch4 | merged (全) | 盆踊り広場（太鼓中央） |
| Ch5 | merged (全) | 公園休憩（呼吸点） |
| Ch6 | merged (全) | ジェットコースター |
| Ch7 | merged (全) | **大観覧車** ★ ランドマーク |
| Ch8 | merged (全) | 第 2 コースター + カーニバル |
| Ch9 | merged (全) | テント + バルーンアーチ |
| Ch10 | merged (全) | クライマックス前の集約 |
| **Ch11** | **merged (全) GOAL** | **天守閣 ★★** |

**Stage 5 の特徴**: 全チャンクが **merged ヒーロー**。Stage 4 と同じ「中央集約型」だが、Stage 4 の鋼鉄に対して Stage 5 は **赤絨毯と提灯**。クライマックスは Ch7 観覧車（h=48 w=44）と **Ch11 天守閣（h=110 w=70）の 2 段ピーク**。

---

# §4.5 Stage 5 固有の建物→取り巻き辞書

| 建物 | 必須取り巻き | 補助取り巻き | 痕跡 |
| --- | --- | --- | --- |
| `yatai` (屋台) | parasol + chouchin × 1 + popcorn_cart × 0-1 | bench × 1-2 (客) + balloon_cluster | (店主が痕跡) |
| `big_tent` | flag_pole × 1 + bench × 4-6 (観客) | banner_pole × 2 + balloon_cluster | (痕跡控えめ) |
| `carousel` | balloon_cluster (頂上 1-2) + ticket_booth (代替: garage) + flag_pole | bench × 2 + flower_planter_row | (痕跡: 子供) |
| `roller_coaster` | signal_tower + barrier × 4 + ticket_booth (代替: garage) + flag_pole | bench × 2 + balloon_cluster | (痕跡控えめ、迫力が主役) |
| `ferris_wheel` | balloon_cluster × 2 (頂上アクセント) + flag_pole + banner_pole × 4 | bench × 6 (周囲) + flower_bed × 4 | (痕跡控えめ、ランドマーク) |
| `fountain_pavilion` | flower_bed × 4 + flower_planter_row × 4 + bench × 4 | flag_pole + banner_pole | (痕跡: 水しぶき → spawnAmbient で water) |
| `castle` (★ GOAL のみ) | balloon_cluster × 11 (頂上群) + banner_pole × 5 (旗) + matsuri_drum × 4 (応援太鼓) + flag_pole × 3 (儀式) + sakura_tree × 2 (参道) | flower_bed × 4 + bench × 4 + parasol × 2 + carousel × 2 (応援メリー) + popcorn_cart × 2 | (痕跡: 儀式参加者の humans) |
| `chaya` (祭り版) | noren + chouchin × 2 + bench × 2 (客) + a_frame_sign | parasol + flower_bed | bicycle |
| `wagashi` (祭り版) | chouchin + noren + parasol + a_frame_sign | bench + potted_plant | (痕跡: 子供の家族) |

**祭り固有の集合体（建物 + 家具のセット）**:
- **鳥居ゲートセット (Ch0)**: `torii` (家具、x=0, y=22 大提灯と兼ねる) + `chouchin` (上空 y=8 大、avenue 跨ぐ) + `flag_pole` × 4 + `banner_pole` × 4
- **屋台セット**: `yatai` × 4-10 + `parasol` × 4 + `chouchin` × 数 (各屋台 1) + `bench` × 多 (準対称、客)
- **太鼓広場セット**: `matsuri_drum` × 4 (準対称、x=±25, y=±25 の四方) + `flag_pole` × 3 + `bench` × 8 (観客輪)
- **カーニバルセット (Ch9)**: `big_tent` × 4 + `balloon_cluster` × 6 + `banner_pole` × 4
- **GOAL 城セット (Ch11)**: §10 で詳述

---

# §5 Stage 5 の道路設計

**Stage 5 でも固定するのは中央 `_AVE` のみ**。横道路（`_MID_HR` 含む）と他の縦道路はチャンクのコンセプトに沿って都度設計する。

## Act ごとの道路性格

| Act | 道路性格 | 設計のヒント |
| --- | --- | --- |
| Act I 祭り入場 | 中央通り、屋台が両脇 | Ch0 鳥居 + 大提灯下は `_AVE` のみ（鳥居が威圧感）+ `red_carpet` 大パッチで参道。Ch1-2 屋台通りは `_AVE` のみ + 屋台中央集約 |
| Act II 広場 | 広場感、道路最小 | Ch3-Ch5 は `_AVE` のみ + ground 大パッチ（`checker_tile` / `red_carpet`）で広場化 |
| Act III アトラクション | 遊具下の通行、観覧車基礎 | Ch6 コースター下は `_AVE` のみ + ground `concrete`。Ch7 観覧車基礎は `_AVE` のみ + 周囲 `tile`。Ch8 は `_AVE` + `_MID_HR` |
| Act IV クライマックス | テント間の通路 | Ch9 は `_AVE` のみ + テント間 ground、Ch10 は `_AVE` + `_MID_HR` で集約感 |
| **GOAL** | **城前の参道** | **Ch11 は `_AVE` のみ**（城の威光を活かす）+ `red_carpet` 全面 + `stone_pavement` 城中心 |

## ground による領域表現

- **赤絨毯帯** `red_carpet`: 全チャンクの avenue 中央 (x=0, 帯幅 60-100)
- **広場床** `checker_tile`: Ch3-Ch5（メリー / 盆踊り / 公園）の中央 80×80
- **石畳** `stone_pavement`: Ch0 鳥居参道 (x=0, y=88, 80×40)、Ch11 城中心 (x=0, y=130, 100×100)
- **アトラクション基礎** `asphalt`: Ch6 コースター (x=0, y=68, 200×60)、Ch8 第 2 コースター
- **タイル** `tile`: Ch7 観覧車台座 (x=0, y=68, 80×60)
- **芝**: `grass` 周囲のクッション (Ch3-Ch5 の余白)

---

# §6.5 Stage 5 で使う実 union

## 建物 (BuildingSize)

**主役（Stage 5 で多用）**: `yatai` / `big_tent` / `carousel` / `roller_coaster` / `ferris_wheel` / `fountain_pavilion` / `castle` (★ Ch11 のみ)

**Act I 祭り入場 / 屋台街**: `chaya` / `wagashi` / `sushi_ya` (祭り版)

**脇役（背景）**: `garage` (チケットブース見立て) / `shed`

**避けたい**: `tower` / `skyscraper` / `office` / `department_store` / `clock_tower` / `radio_tower` (Stage 3 専用)、`warehouse` / `crane_gantry` / `container_stack` / `silo` / `factory_stack` (Stage 4 専用)、`snack` / `love_hotel` / `pachinko` / `karaoke` / `business_hotel` (Stage 2 専用)、`kominka` / `pagoda` / `tahoto` / `shrine` (Stage 5 では祭り型の和風のみ、寺社系は控える)

## 家具 (FurnitureType)

**Stage 5 シグネチャ（祭り・テーマパーク）**: `chouchin` (×多) / `noren` / `a_frame_sign` / `parasol` / `bench` / `flag_pole` / `banner_pole` / `matsuri_drum` / `balloon_cluster` / `popcorn_cart` / `flower_bed` / `flower_planter_row` / `sakura_tree` (Ch11 のみ)

**Ch0 鳥居**: `torii` (中央配置) / `koma_inu` × 0-2 (祭りでは控えめ)

**コースター・観覧車基礎**: `signal_tower` / `barrier` (発券安全) / `ticket_booth` (代替: garage 建物)

**Ch11 GOAL**: `matsuri_drum` × 8 (応援太鼓 + 最背面)、`balloon_cluster` × 11 (城頂上群)、`banner_pole` × 5 (旗ガーランド)、`flag_pole` × 3、`sakura_tree` × 2 (参道)、`bench` × 多

**生活痕跡**: `garbage` / `bicycle` (屋台店主用) / `cat` (Stage 5 では最小限)

**避けたい**: Stage 4 工業家具 (`drum_can` / `cargo_container` / `forklift` / `buoy` / `cable_junction_box` / `electric_box` / `fire_extinguisher`)、Stage 3 公共家具 (`atm` / `taxi_rank_sign` / `bus_stop`)、Stage 2 ネオン (`puddle_reflection` は最小限ならOK)

## 地面 (GroundType)

- **基調**: `red_carpet` (全チャンクの avenue 中央)
- **広場**: `checker_tile` (Ch3-Ch5)
- **石畳**: `stone_pavement` (Ch0 鳥居 / Ch11 城)
- **アトラクション**: `asphalt` (Ch6 / Ch8 コースター基礎)、`tile` (Ch7 観覧車台座)
- **クッション**: `grass` (周囲、Ch3-Ch5 の余白)
- **避けたい**: `harbor_water` / `steel_plate` / `oil_stained_concrete` / `rust_deck` / `hazard_stripe` (Stage 4 専用)、`residential_tile` / `dirt` / `gravel` / `moss` (Stage 1/3 専用)、`fallen_leaves` (Ch0 のみ少量許容)

---

# §6.6 SemanticCluster の Stage 5 適用ガイド

## hero クラスタの focal 候補

- **オープンスペース型** (基本形 A): Ch0 鳥居 (`focal: torii` 家具) / Ch3 メリー広場 (`focal: carousel` 建物) / Ch4 太鼓広場 (`focal: matsuri_drum` 中央 1 個 or `big_tent` 太鼓櫓見立て) / Ch5 公園 / Ch9 テント中央
- **焦点建物型** (基本形 B): Ch6 roller_coaster / Ch7 ferris_wheel ★ / Ch8 roller_coaster / **Ch11 castle ★★ GOAL**

## ambient クラスタの focal 候補

- 全 merged のため ambient セルは少ない
- もしあれば: 屋台 (`yatai`) や `chaya` / `wagashi` を ambient cell の focal に

## boundary 候補（Stage 5 固有）

- `flower_planter_row` × 多 (広場の輪郭、祭り感)
- `flower_bed` × 多 (アトラクション周辺)
- `bench` 列 (観客輪、観覧車・コースター周辺)
- `barrier` (コースター・観覧車の安全帯のみ)
- **避ける**: `hedge` / `wood_fence` / `bamboo_fence` (祭りには地味すぎ、Ch11 で少量のみ)

## access 候補（Stage 5 固有）

- `chouchin` 列 (上空、参道感)
- `banner_pole` 列 (旗ガーランド)
- `street_lamp` × 少 (祭りでは提灯が主光源)
- `popcorn_cart` (屋台と屋台の間)
- `manhole_cover` × 少 (avenue 横断)

## livingTrace 候補（Stage 5 固有）

- `bench` (観客の溜まり、家族の休憩)
- `popcorn_cart` (屋台の痕跡)
- `bicycle` (屋台店主用、Ch0 / Ch10)
- `cat` × 少 (祭り中は野良猫が逃げる、Ch5 公園で 1 匹のみ)
- `garbage` (Ch9 / Ch10 の祭り後の片付け予兆)
- **避ける**: `laundry_pole` / `mailbox` / `potted_plant` (住宅向け)

---

# §9 詳細フェーズ: 各チャンクレイアウト

<aside>
🛣️

**道路注意**: 各チャンクの道路指定は **コンセプトに沿って都度設計**。固定するのは `_AVE`（x=0）のみ。Stage 5 では祭りの「広場感」を最大化するため、横道路は最小限。Ch11 GOAL では `_AVE` のみで城の威光を活かす。

</aside>

## Act I — 祭り入場

### Ch0: 鳥居ゲート + 大提灯

**ヒーロー**: **merged 全マージ = ヒーロー**（祭りの入口）

**merged 4 層**:
- **焦点**: `torii` 家具 (x=0, y=22) ★ 鳥居ゲート + `chouchin` 大 (x=0, y=8 上空、avenue 跨ぐ) + `chouchin` (x=-30/+30, y=15)
- **取り巻き（鳥居周辺）**: `flag_pole` × 4 (準対称、x=-50/-20/+20/+50, y=12 上空)、`banner_pole` × 4 (x=-130/-70/70/130, y=18)、`matsuri_drum` × 2 (x=-30/30, y=68 太鼓配置)、`yatai` × 4-6 (x=-150/-100/100/150, y=68 屋台 4 連)
- **境界**: `flower_planter_row` × 4 (x=-150/-50/50/150, y=88)、`bench` × 4 (準対称、参拝待ち)
- **動線**: 参道 `stone_pavement` 帯 (x=0, y=88, 80×40)、`popcorn_cart` × 2 (x=-90/90, y=78)

**アンビエント (狭い)**:
- **SW**: `chaya` × 2 (x=-150/-90, y=130) + `noren` + `bench`
- **SE**: `wagashi` × 2 (x=90/150, y=130) + `chouchin` + `parasol`

**人配置**: 家族客 × 多 10 人、子供 × 6 (鳥居前)、屋台店主 × 4、太鼓奏者 × 2

**地面パッチ**:
- 基調: `red_carpet` 中央帯 (x=0, y=100, 100×200)
- NW 鳥居参道: `stone_pavement` (x=0, y=88, 80×40)
- 周囲: `checker_tile` (Ch3-Ch5 への予告)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: []`（鳥居の威圧感を活かす、横道路ゼロ）

**Handoff (Stage 4 Ch11 → Stage 5 Ch0)**:
- **並木**: `red_carpet` パッチが連続軸として継続、Ch0 で全幅化
- **歩道**: `concrete` から `red_carpet` 全面へ
- **電柱/電線**: 4 隅で対、`chouchin` 連続帯に Stage 切替
- **予兆**: 鳥居 + 大提灯が Stage 5 のトーンを完全宣言

### Ch1: 屋台通り 1（merged）

**ヒーロー**: **merged 全マージ = ヒーロー**

**merged 4 層**:
- **焦点**: `yatai` × 8 (x=-160/-110/-60/-10/40/90/130/160, y=68 微妙な不揃い: -160/-108/-58/-12/42/93/132/162) ★ 屋台連続
- **取り巻き**: 各屋台 `parasol` × 1 + `chouchin` × 1 (上空 y=58)、`bench` × 多 (屋台間に客 6 人)、`popcorn_cart` × 2 (西東端)
- **境界**: `flower_planter_row` × 4 (avenue 端)、`banner_pole` × 4 (上空)
- **動線**: `chouchin` 上空帯 × 6 (y=8、avenue 全幅)

**アンビエント (狭い)**:
- **SW**: `chaya` × 2 (x=-130/-70, y=130) + `noren` + `bench` × 2 (休憩)
- **SE**: `wagashi` (x=130, y=130) + `chouchin` + `parasol`

**人配置**: 家族客 × 多 12 人、子供 × 8、屋台店主 × 4、カップル × 2

**地面パッチ**: `red_carpet` 中央帯、屋台前 `tile` 帯 (x=0, y=88, 360×30)、周囲 `checker_tile`

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: []`

### Ch2: 屋台通り 2 + 抽選会テント（merged）

**ヒーロー**: **merged 全マージ = ヒーロー**

**merged 4 層**:
- **焦点**: `yatai` × 7 (x=-150/-100/-50/0/50/100/150, y=68 微不揃い: -148/-103/-52/0/53/97/152)
- **取り巻き**: `big_tent` (中央休憩、x=0, y=130) 抽選会、`fountain_pavilion` (x=130, y=68) 噴水、`balloon_cluster` × 4 (上空 y=15)、`bench` × 多 (周囲)
- **境界**: `flower_bed` × 6 (各屋台間、不揃い)、`flower_planter_row` × 4
- **動線**: `popcorn_cart` × 2、`chouchin` 上空帯

**人配置**: 家族客 × 多 10 人、子供 × 6、屋台店主 × 4、抽選参加者 × 4

**地面パッチ**: `red_carpet` 中央帯、`checker_tile` 大 (x=0, y=100, 360×100)、噴水周辺 `tile`

---

## Act II — 広場エリア

### Ch3: メリーゴーランド広場（merged）

**ヒーロー**: **merged = ヒーロー**（基本形 A 大広場）

**merged 4 層**:
- **焦点**: `carousel` (x=-50, y=68) + `carousel` (x=50, y=68) ツインメリー（Stage 5 Act II の山）
- **取り巻き**: 各メリー周辺 `balloon_cluster` × 2 (上空 y=20-25)、`big_tent` × 2 (観客席、x=-130/130, y=130)、`yatai` × 6 (x=-160/-90/-20/20/90/160, y=130 周囲屋台)、`bench` × 4 (準対称、x=-100/-50/50/100, y=160)
- **境界**: `flower_planter_row` × 4 (x=±170, y=80 / y=170)、`banner_pole` × 2
- **動線**: `flag_pole` × 2 (x=-50/50, y=58 メリー頂上)、`ticket_booth` × 2 (`garage` 建物代替、x=-130/130, y=22)、`popcorn_cart` × 2

**人配置**: 家族客 × 多、子供 × 8 (メリー周辺)、観客 × 6 (テント)

**地面パッチ**: `red_carpet` 中央帯、メリー周囲 `checker_tile` 大 (x=0, y=80, 280×60)、`grass` 周囲クッション

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: []`

### Ch4: 盆踊り広場（太鼓中央）

**ヒーロー**: **merged = ヒーロー**

**merged 4 層**:
- **焦点**: `matsuri_drum` × 4 (準対称、x=-25/+25/0/0, y=68/68/40/100 = 中央十字 4 個) ★ 太鼓櫓見立て
- **取り巻き**: `big_tent` (太鼓櫓、x=0, y=22) + `yatai` × 8 (周囲、x=-150/-100/-50/50/100/150 上下段) + `bench` × 8 (観客輪、準対称 8 方向)
- **境界**: `chouchin` 上空大群 × 12 (avenue 全幅、y=8 と y=22)、`flag_pole` × 3 (x=-30/0/30, y=12)
- **動線**: `popcorn_cart` × 2、`balloon_cluster` × 4 (上空)

**人配置**: 家族客 × 多、太鼓奏者 × 4 ★、観客 × 多 12 人 (bench)、屋台店主 × 4

**地面パッチ**: `red_carpet` 中央 + `checker_tile` 全面広場 (x=0, y=100, 360×140)

### Ch5: 公園休憩（呼吸点）

**ヒーロー**: **merged = ヒーロー**（穏やかな広場、Act II→III 呼吸）

**merged 4 層**:
- **焦点**: `fountain` (x=0, y=100) 中央噴水
- **取り巻き**: `bench` × 8 (周囲、八方向)、`flower_bed` × 6 (周囲)、`tree` × 4 (周囲、街路樹的に)、`flower_planter_row` × 4
- **境界**: `flower_planter_row` × 4 (広場輪郭)
- **動線**: `street_lamp` × 2、`balloon_cluster` × 2 (上空)

**アンビエント (狭い)**:
- **SW**: `yatai` × 2 (x=-130/-70, y=130) + 客 bench
- **SE**: `chaya` (x=130, y=130) + `noren`

**人配置**: 家族客 × 中、子供 × 4、休憩客 × 多、cat × 1（Stage 5 で唯一）

**地面パッチ**: `grass` 大 (x=0, y=130, 280×100) + `red_carpet` 中央帯 (avenue) + 噴水周辺 `tile`

---

## Act III — 大型アトラクション

### Ch6: ジェットコースター

**ヒーロー**: **merged = ヒーロー**

**merged 4 層**:
- **焦点**: `roller_coaster` × 2 (x=-60/60, y=68) 並列ツインコースター ★
- **取り巻き**: `big_tent` × 2 (観客、x=-130/130, y=130)、`signal_tower` × 2 (x=-90/90, y=58 安全)、`barrier` × 4 (基礎)、`ticket_booth` × 2 (発券、`garage` 代替, x=-100/100, y=22)
- **境界**: `flag_pole` × 2 (x=-60/60, y=8 頂上旗)、`flower_planter_row` × 2
- **動線**: `chaya` × 2 (x=-160/160, y=130) + 待ち列 `bench` × 6

**人配置**: カップル × 多、観光客 × 中、観客 × 多 (テント)、行列 × 4-6 (発券前)

**地面パッチ**: `red_carpet` 中央帯、コースター下 `asphalt` (x=0, y=88, 240×60)

### Ch7: 大観覧車 ★ ランドマーク

**ヒーロー**: **merged = ヒーロー**

**merged 4 層**:
- **焦点**: `ferris_wheel` (x=0, y=68) ★ Stage 5 Act III の山
- **取り巻き**: `balloon_cluster` × 2 (頂上アクセント、x=-15/15, y=8)、`flag_pole` × 2 (準対称 x=-30/30, y=58)、`banner_pole` × 4 (周囲 y=20)、`bench` × 6 (周囲輪)、`flower_bed` × 4
- **境界**: `flower_planter_row` × 4 (x=±170, y=80 / y=170)
- **動線**: `chaya` × 2 (x=-130/130, y=130) + `noren`、`big_tent` × 2 (x=-90/90, y=130 観客)

**人配置**: カップル × 多 (観覧車待ち)、観客 × 中、観光客 × 中

**地面パッチ**: `red_carpet` 中央帯、観覧車台座 `tile` (x=0, y=80, 100×60)、周囲 `checker_tile`

### Ch8: 第 2 コースター + カーニバル

**ヒーロー**: **merged = ヒーロー**

**merged 4 層**:
- **焦点**: `roller_coaster` × 2 (x=-100/100, y=68) + `carousel` (x=0, y=68) 中央彩り
- **取り巻き**: `big_tent` × 2 (観客、x=-130/130, y=130)、`signal_tower` × 2、`ticket_booth` × 2 (代替: garage)、`balloon_cluster` × 4 (上空)
- **境界**: `flag_pole` × 2、`flower_planter_row` × 2
- **動線**: `bench` × 6 (待ち列)

**人配置**: カップル × 多、友人 × 中、子供 × 中、観客 × 多

---

## Act IV — 祭りクライマックス

### Ch9: テント + バルーンアーチ

**ヒーロー**: **merged = ヒーロー**

**merged 4 層**:
- **焦点**: `big_tent` × 4 (準対称、x=-150/-50/50/150, y=68 ショー会場 4 連)
- **取り巻き**: `balloon_cluster` × 6 (上空、不均等、x=-120/-60/-20/+30/+80/+140, y=15)、`fountain_pavilion` (x=0, y=130) 中央噴水、`carousel` (x=0, y=22) 奥)、`bench` × 多 (観客)
- **境界**: `banner_pole` × 4 (上空旗)、`flag_pole` × 2、`flower_bed` × 6
- **動線**: `popcorn_cart` × 4 (テント間)、`chouchin` 上空大群 × 8

**人配置**: 観客 × 多 15 人、子供 × 6、屋台客 × 4

**地面パッチ**: `red_carpet` 全幅 (x=0, y=130, 360×100)、各テント前 `checker_tile`

### Ch10: クライマックス前の集約（Ch11 GOAL 予告）

**ヒーロー**: **merged = ヒーロー**

**merged 4 層**:
- **焦点**: 城前広場の予兆（`carousel` × 1 中央 + `big_tent` × 2 観客 + `matsuri_drum` × 2 太鼓予兆）
- **取り巻き**: `yatai` × 多 (avenue 沿い、x=-150/-100/-50/50/100/150, y=68 / y=130)、`chouchin` 大群 (上空 + 店前)、`balloon_cluster` × 4
- **境界**: `flower_planter_row` × 4、`flag_pole` × 4 (城方向を指す)
- **動線**: `popcorn_cart` × 2、`bench` × 多

**人配置**: 観客 × 多、太鼓奏者 × 2 (予兆)、子供 × 多

**地面パッチ**: `red_carpet` 全幅、`checker_tile` (周囲)、Ch11 への移行で `stone_pavement` 予告 (avenue 中央)

**道路**: `verticalRoads: [_AVE]` / `horizontalRoads: [_MID_HR]`

---

# §10 GOAL 演出ガイド (Ch11 天守閣決戦)

<aside>
🏯

**Ch11 は ゲーム全体のフィナーレチャンク**。`isGoal: true` をセット。castle (`w=70, h=110`) を中央に配置し、応援機構（メリー × 2、太鼓 × 4、屋台 × 8、提灯群、風船 × 11、桜並木）が同心円状に城を囲む。

**演出のキーワード**: 「決戦の舞台」「儀式の中心」「ファンタジー城」「全面赤絨毯」「上空に風船の花束」「城前応援団」

</aside>

## Ch11: 天守閣決戦 (isGoal: true)

**ヒーロー**: **merged 全マージ = HERO GOAL**

### 城セット（4 層構造の最終形）

#### 焦点 (focal)
- **`castle` (x=0, y=40)** ★★ ランドマーク
  - **w=70, h=110** で建物中で最大
  - 上端 y=40 は天守閣の屋根、下端 y=150 は石垣
  - 視覚的に avenue 中央を完全に占有

#### 取り巻き 1: 上空（風船 + 旗）
- `balloon_cluster` × 11 (天頂 y=4-14、不揃い、x=-150/-110/-75/-40/-15/+10/+35/+70/+100/+130/+155, y=4-14)
- `banner_pole` × 5 (x=-100/-50/0/+50/+100, y=18 旗ガーランド)
- `flag_pole` × 3 (x=-30/0/+30, y=12 儀式)

#### 取り巻き 2: 城前広場（応援機構）
- **応援メリー × 2**: `carousel` (x=-117, y=68) + `carousel` (x=+117, y=68) 城を囲む
- **観客テント × 2**: `big_tent` (x=-140, y=130) + `big_tent` (x=+140, y=130)
- **応援太鼓 × 4** (中段 + 最背面):
  - 中段: `matsuri_drum` (x=-25, y=165) + `matsuri_drum` (x=+25, y=165)
  - 最背面: `matsuri_drum` (x=0, y=132) + `matsuri_drum` (x=0, y=175)
- **城前屋台 × 8**: `yatai` (x=-170/-100/-60/-30/+30/+60/+100/+170, y=132-178 微妙な不揃い)

#### 境界 (boundary): 参道
- `sakura_tree` × 2 (準対称、x=-30/+30, y=88) ★ Stage 5 唯一の桜
- `flower_bed` × 4 (準対称、x=-100/-50/+50/+100, y=170)
- `flower_planter_row` × 4 (x=-150/-50/+50/+150, y=88 / y=170)

#### 動線 (access): 城へ向かう参道
- `ticket_booth` × 2 (代替: garage 建物、x=-85/+85, y=128 城ゲート)
- `popcorn_cart` × 2 (x=-110/+110, y=148)
- `parasol` × 2 (x=-50/+50, y=170 屋台補強)
- `street_lamp` × 2 (x=-65/+65, y=88 参道照明)
- **赤絨毯帯**: `red_carpet` 全面 (x=0, y=130, 360×140) ★ 「王座の間」感

#### 痕跡 (livingTrace): 儀式参加者
- 城前に humans × 12（儀式参加者・太鼓奏者 × 4・城前応援団・チケットゲート）
- `bench` × 6 (観客の溜まり、`big_tent` 周辺)

### 人配置（詳細）

| 役割 | 配置 | 数 |
| --- | --- | --- |
| 太鼓奏者 | matsuri_drum × 4 の隣 | 4 |
| 城前応援団 (大人) | x=-90/-30/+30/+90, y=145 | 4 |
| 城前応援団 (子供) | x=-50/+50, y=160 | 2 |
| 屋台客 | 各 yatai 前 | 4 |
| 観客 (テント) | big_tent × 2 の前 | 4 |
| 儀式の中心 | x=0, y=145 (城真下) | 1 |

### ground

- **基調**: `red_carpet` 全面 (x=0, y=100, 360×200) ★ 決戦の舞台
- **城中心**: `stone_pavement` 大円 (x=0, y=130, 100×100) 城の敷地
- **参道脇**: `checker_tile` (x=±100, y=88, 80×30) 桜並木下
- **広場**: `tile` (x=0, y=78, 200×40) 城前広場
- **避ける**: `grass` / `dirt` / `oil_stained_concrete` 等は GOAL 感に合わない

### 道路

- `verticalRoads: [_AVE]`（城の威光を活かす、追加なし）
- `horizontalRoads: []`（横道路ゼロ、城へ参道が一直線）

### Handoff (Ch10 → Ch11 GOAL)

- **連続軸**: `red_carpet` が Ch10 → Ch11 で **全幅化**
- **提灯**: Ch10 の店前から Ch11 で **城の周囲を取り囲む**形に変化
- **太鼓**: Ch10 で 2 個予兆 → Ch11 で 4 個 + 4 個（最背面）= 8 個に倍増
- **電柱/電線**: 4 隅で対、ただし Ch11 では密度落として城の威光を邪魔しない

### TS スケルトン（例示、castle 焦点）

```ts
{ patternId: 's5_raw', isGoal: true, raw: ((): RawChunkBody => {
  const out: RawChunkBody = {
    buildings: [], furniture: [], humans: [], grounds: [],
    horizontalRoads: [],
    verticalRoads: [_AVE],
  };
  // ★★ GOAL: castle
  const castle = $B(out, 'castle', 0, 40);
  // 応援メリー × 2 (城を囲む)
  const meryW = $B(out, 'carousel', -117, 68);
  const meryE = $B(out, 'carousel', +117, 68);
  // 観客テント × 2
  $B(out, 'big_tent', -140, 130);
  $B(out, 'big_tent', +140, 130);
  // 城前屋台 × 8 (微不揃い)
  $B(out, 'yatai', -170, 132); $B(out, 'yatai', -100, 132);
  $B(out, 'yatai',  -60, 178); $B(out, 'yatai',  -30, 132);
  $B(out, 'yatai',   30, 178); $B(out, 'yatai',   60, 132);
  $B(out, 'yatai',  100, 178); $B(out, 'yatai',  170, 132);
  // 応援太鼓 × 4
  const drum1 = $F(out, 'matsuri_drum', -25, 165);
  const drum2 = $F(out, 'matsuri_drum', +25, 165);
  $F(out, 'matsuri_drum', 0, 132);
  $F(out, 'matsuri_drum', 0, 175);
  // 風船 × 11
  $F(out, 'balloon_cluster', -150, 4); /* ... 11 個 */
  // 旗ガーランド × 5
  $F(out, 'banner_pole', -100, 18); /* ... 5 個 */
  // 桜並木 × 2 (参道)
  $F(out, 'sakura_tree', -30, 88);
  $F(out, 'sakura_tree', +30, 88);
  // ground
  out.grounds = [
    _G('red_carpet', 0, 100, 360, 200),       // 全面赤絨毯
    _G('stone_pavement', 0, 130, 100, 100),    // 城中心
    _G('tile', 0, 78, 200, 40),                // 城前広場
  ];
  out.humans = [
    _H(0, 145),     // 儀式の中心
    /* ... 12 人配置 */
  ];
  // GOAL HERO クラスタ
  _CLUSTER(out, {
    id: 'ch11.merged.castle_finale',
    role: 'hero', cell: 'merged',
    focal: castle,
    companions: [meryW, meryE, drum1, drum2],
    // boundary, access, livingTrace は配列 index で指定
  });
  return out;
})() },
```

### 演出効果（実装ヒント）

- **環境パーティクル** (v6.3 SemanticCluster の spawnAmbient): castle の focal 種別を新たに追加し、**金粉 / 桜吹雪 / firefly** を高密度で emit する
- **太鼓の振動**: matsuri_drum × 4 + 4 を破壊した時、画面シェイクを通常の 2 倍にする
- **GOAL アナウンス**: `isGoal: true` のチャンクに到達したときに UI で「GOAL」演出（既存 ui.ts の振る舞いに依存）

---

# §8 変更履歴

- **v1.0（本版）**: Stage 5 「城下町・祭礼 CASTLE TOWN」の新規設計指示書。既存実装は 11 chunks (C0-C10) で C5 が park_break、C10 が isGoal だったが、本指示書では **12 chunks (Ch0-Ch11) + Ch11 が GOAL** に再構成し、Stage 1-4 と統一。4 Acts: Act I 祭り入場（鳥居 + 屋台通り 2 連）/ Act II 広場（メリー / 盆踊り / 公園休憩）/ Act III 大型アトラクション（コースター / 観覧車 ★ / 第 2 コースター）/ Act IV クライマックス（テント + バルーン）+ **GOAL Ch11 天守閣決戦**。Stage 4 と同じ **中央集約型ジグザグ**（全 merged ヒーロー）だが、Stage 4 の鋼鉄に対して **赤絨毯と提灯** が支配。クライマックスは Ch7 観覧車（ferris_wheel）と **Ch11 天守閣 castle (w=70 h=110) ★★** の 2 段ピーク。§10 で Ch11 GOAL の castle 配置・応援機構（メリー × 2、太鼓 × 4 + 4、屋台 × 8、風船 × 11、桜並木）を詳細記述。`red_carpet` 全面 + `stone_pavement` 城中心の「王座の間」演出。
