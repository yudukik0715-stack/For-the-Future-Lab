# For the Future Lab

自分の知識・思考・経験・未来への構想を一つの場所に集めて、つなげながら育てていく「自分だけの知識の部屋」。

## いまの本体（`docs/`）

空っぽから自分で組み立てるワークスペース。GitHub Pages（Settings → Pages → ブランチ `/docs`）で公開している。

- **ページ**：なんでも書ける1枚。`# 見出し` `- 箇条書き` `**太字**` `==マーカー==` が使える
- **部屋（種類）**：「論文」「研究テーマ」など、自分で作る入れ物。記録する項目（テキスト、数値、日付、選択、タグ、チェック、URL、★評価、別の項目とのつながり）を自由に決められる
- **見え方**：同じ部屋を 表・カード・ボード で見られる
- **つながり**：本文に `[[ページ名]]` と書くとリンクになり、相手のページに「参照しているページ」が出る
- **検索**：🔍 か ⌘K / Ctrl+K
- **ひな形**：研究テーマ、論文・本、統計、学習ログ、アイデア、未来の構想（使わなくてもいい）
- **画像**：ホーム・部屋・ページにカバー画像、本文に画像（写真を選ぶ／貼り付け／URL）。ギャラリー表示で画像カードとして並ぶ
- **見た目**：白とシルバー（ダークはグラファイト）。フォントは設定で「まるゴシック／ころころ／すっきり／明朝」から選べる
- **バックアップ**：設定 → 書き出す／読み込む

### 構成

| ファイル | 役割 |
|---|---|
| `docs/index.html` | 画面の見た目（CSS） |
| `docs/js/app.js` | 画面と操作 |
| `docs/js/store.js` | データの保存（端末内 / Supabase の切り替え） |
| `docs/js/config.js` | Supabase の URL と anon key（空なら端末内に保存） |
| `supabase/schema.sql` | Supabase に作る表と、自分のデータだけ見られる設定 |

## iPad と iPhone で同期する（Supabase）

1. supabase.com でプロジェクトを作る（リージョンは Tokyo）
2. SQL Editor に `supabase/schema.sql` を貼って Run。画像を使うなら `supabase/storage.sql` も同じように Run
3. Authentication → URL Configuration の Site URL に公開URL（`https://yudukik0715-stack.github.io/For-the-Future-Lab/`）を入れる
4. Project URL と anon / publishable key を `docs/js/config.js` に書く（service_role / secret key は書かない）

ログインは「メールアドレス＋パスワード」。はじめての端末では「登録」し、確認メールのリンクを押してからログインする。

## これまでの案（`proposals/`）

- `proposals/a-dashboard.html` ほか：最初の3案
- `proposals/v2-safari/`：書庫・大学・チューター付きの版（Safari 版）
- `lab/`：同じ版の claude.ai アーティファクト用
