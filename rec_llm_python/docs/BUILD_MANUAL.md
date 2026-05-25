# RecLLM ビルドマニュアル (Build Manual)

## 前提条件

- Python 3.11 以上
- pip (Python パッケージマネージャー)
- FFmpeg + FFprobe (音声処理用)
- Git (ソースコード管理)

## 開発環境セットアップ

### 1. リポジトリクローン

```bash
git clone https://github.com/stackahmedo/rec_llm.git
cd rec_llm/rec_llm_python
```

### 2. 仮想環境作成

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

### 3. 依存関係インストール

```bash
pip install -r requirements.txt
pip install pyinstaller  # ビルド用
pip install pytest       # テスト用
```

### 4. FFmpeg配置

Windows:
- https://ffmpeg.org/download.html からダウンロード
- `ffmpeg.exe` と `ffprobe.exe` をプロジェクトルートに配置

macOS:
```bash
brew install ffmpeg
```

### 5. 動作確認

```bash
python -m pytest tests/ -v
```

全テスト（69件）がパスすることを確認。

## アプリケーション起動（開発モード）

```bash
python -m app.main
```

ブラウザで http://127.0.0.1:8765 にアクセス。

## Windows EXE ビルド

### 1. ビルド実行

```bash
python build/build_windows.py
```

### 2. 出力確認

```
dist/RecLLM/
├── RecLLM.exe          # メインアプリケーション
├── ffmpeg.exe          # 音声処理
├── ffprobe.exe         # メタデータ取得
├── _internal/          # Python ランタイム + パッケージ
└── app/ui/static/      # Web UI ファイル
```

### 3. テスト実行

```bash
dist/RecLLM/RecLLM.exe
```

- デスクトップウィンドウが開くことを確認
- http://127.0.0.1:8765/api/health が `{"status":"ok"}` を返すことを確認

## インストーラー作成（オプション）

Inno Setup を使用:

1. https://jrsoftware.org/isinfo.php からインストール
2. `build/installer.iss` を編集
3. Inno Setup Compiler で実行
4. `output/RecLLM_Setup_x.x.x.exe` が生成される

## トラブルシューティング

### PyInstaller ビルドエラー

```
ModuleNotFoundError: No module named 'xxx'
```

→ `build/build_windows.py` の `--hidden-import` に追加

### FFmpeg not found

→ `ffmpeg.exe` がプロジェクトルートまたは `dist/RecLLM/` に存在することを確認

### WeasyPrint インストール失敗 (Windows)

WeasyPrint は GTK ランタイムが必要:
```bash
pip install weasyprint
```
GTK: https://github.com/nickvdyck/weasyprint-win/releases

代替: PDF出力をHTML形式で保存（WeasyPrint不要）

### アンチウイルス誤検知

PyInstaller製EXEはアンチウイルスに誤検知されることがある:
- コード署名証明書の取得を推奨
- Windows Defender の除外設定

## 依存関係一覧

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| fastapi | >=0.115.0 | Web API フレームワーク |
| uvicorn | >=0.32.0 | ASGI サーバー |
| httpx | >=0.27.0 | 非同期 HTTP クライアント |
| python-multipart | >=0.0.9 | ファイルアップロード |
| watchdog | >=4.0.0 | フォルダ監視 |
| jinja2 | >=3.1.0 | テンプレートエンジン |
| python-docx | >=1.1.0 | DOCX 生成 |
| pydantic | >=2.9.0 | データバリデーション |
| weasyprint | >=62.0 | PDF 生成 |
| pywebview | >=5.0 | デスクトップウィンドウ |
| pyinstaller | >=6.0 | EXE パッケージング |
| pytest | >=8.0 | テストフレームワーク |

## リリースチェックリスト

- [ ] 全テストパス (`pytest tests/ -v`)
- [ ] ビルド成功 (`python build/build_windows.py`)
- [ ] EXE起動確認
- [ ] API疎通確認 (`/api/health`)
- [ ] 音声ファイルインポート確認
- [ ] 文字起こし実行確認
- [ ] PDF/TXT エクスポート確認
- [ ] 検索機能確認
- [ ] クリーンWindows PCでの動作確認
