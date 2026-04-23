# PWA化対応ファイル一式

## 配置方法

リポジトリのルート（`index.html` と同じディレクトリ）に以下を配置してください:

```
municipality-tracker-main/
├─ index.html               ← 置き換え（PWAメタタグ + SW登録スクリプト追加済み）
├─ manifest.json            ← 新規追加
├─ service-worker.js        ← 新規追加
├─ icon-192.png             ← 新規追加
├─ icon-512.png             ← 新規追加
├─ icon-512-maskable.png    ← 新規追加（Android用）
├─ apple-touch-icon.png     ← 新規追加（iOS用）
├─ favicon-32.png           ← 新規追加
├─ favicon-16.png           ← 新規追加
├─ robots.txt               ← 変更なし
└─ data/                    ← 変更なし
```

Python で JSON を出力する既存のパイプラインは**一切変更不要**です。

## 動作確認

1. GitHub Pages にプッシュ後、数分待つ
2. ブラウザで URL にアクセス
3. Chrome の DevTools → Application → Service Workers で登録を確認
4. スマホ（Chrome/Safari）でアクセスし、メニューから「**ホーム画面に追加**」を選択

### iOS での注意点

- Safari を使う必要あり（Chrome では「ホーム画面に追加」ができない）
- 初回は Safari のアドレスバー「共有」ボタン → 「ホーム画面に追加」
- PWAモードで起動するとフルスクリーン表示になる

## 更新時の運用

### コードだけ更新した場合（index.html、SW本体など）

1. `service-worker.js` の先頭 `CACHE_VERSION` を `v1` → `v2` のように上げる
2. コミット＆プッシュ
3. 次回ユーザーがアクセスした時に新SWがインストールされ、次々回リロードで反映

### データだけ更新した場合（data/*.json の更新）

- `CACHE_VERSION` を上げる必要はなし
- Network First 戦略なので、ユーザーが開いた瞬間に最新データが取得される
- オフライン時は前回キャッシュが使われる

## キャッシュ事故が起きた場合の緊急対応

ユーザー側で不整合が起きた場合:

1. DevTools → Application → Storage → "Clear site data"
2. または、URLの末尾に `?nocache=1` のようなパラメータを付けてリロード（そのままでは効かないが、SWに強制リロード機能を追加する時の目印として）

SW本体にコード埋め込み済みのキャッシュ全クリア機能:
```js
// コンソールで実行
navigator.serviceWorker.controller.postMessage({type: 'CLEAR_CACHE'});
```
