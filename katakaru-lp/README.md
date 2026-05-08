# かたかる ランディングページ

もみかるFC本部「かたかる」メニュー専用LP。Vite + Vanilla TypeScript + Tailwind + GSAP + Lenis + lottie-web で構築。

## 開発

```bash
npm install
cp .env.example .env
npm run dev
```

`http://localhost:5173` で起動。

## ビルド

```bash
npm run build      # 型検証 + Vite ビルド (dist/)
npm run preview    # ビルド成果物のプレビュー
```

## ディレクトリ

```
src/
  main.ts              全モジュールの初期化エントリ
  styles/main.css      Tailwind ベース + カスタムCSS
  data/content.ts      15セクション分のコピーを集約
  lib/
    gsap-setup.ts      GSAP + ScrollTrigger + SplitText 初期化
    lenis-setup.ts     Lenis 慣性スクロール
    lottie-loader.ts   羽根トランジション用 Lottie ローダー
    analytics.ts       dataLayer ラッパー(GTM想定)
  modules/
    01-hero.ts         セクション1: ヒーロー
    sticky-cta.ts      モバイル下部固定CTA
public/
  images/  プレースホルダー画像
  lottie/  羽根 Lottie JSON 配置先
```

## デプロイ

Vercel または Netlify を想定。`.env` に Andy 予約URL・GTM ID・Pixel ID を設定。

## 制約事項

- 「かたかる」の施術範囲は **肩と首だけ**(肩甲骨・頭部は含めない)
- 30分2,700円を主役、20分2,000円を補完として描写
- 訴求店舗数は「全国136店舗」一本化(直営・FC内訳には触れない)
- 認定講師(静岡リラクゼーション事業協同組合)が複数名在籍
