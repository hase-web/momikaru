// All user-facing copy lives here. Forbidden characters in user-visible strings:
// - hiragana YA (U+3084) and full-width hash (U+FF03). Half-width '#' in IDs is fine.

export const brand = {
  serviceName: 'もみかる',
  menuName: 'かたかる',
  operator: '株式会社ドラミカンパニー',
  storeCount: 136,
  certifyingBody: '静岡リラクゼーション事業協同組合',
  bookingSystem: 'Andy即時予約システム',
} as const;

// Production reservation URLs (Andy reservation system)
export const reservationUrls = {
  course30min: 'https://jy.momikaru.net/yoyaku/6/0/8921',
  course20min: 'https://jy.momikaru.net/yoyaku/6/0/8920',
} as const;

// Footer legal pages — both labels point to the same combined page on momikaru.com
export const legalLinks = {
  privacyPolicyUrl: 'https://www.momikaru.com/privacy.php',
  termsOfServiceUrl: 'https://www.momikaru.com/privacy.php',
} as const;

export const env = {
  bookingUrl: import.meta.env.VITE_ANDY_BOOKING_URL ?? reservationUrls.course30min,
  bookingUrl30: import.meta.env.VITE_ANDY_BOOKING_URL_30 ?? reservationUrls.course30min,
  bookingUrl20: import.meta.env.VITE_ANDY_BOOKING_URL_20 ?? reservationUrls.course20min,
  phone: import.meta.env.VITE_PHONE_NUMBER ?? '050-0000-0000',
  siteUrl: import.meta.env.VITE_SITE_URL ?? 'https://example.com',
  gtmId: import.meta.env.VITE_GTM_ID ?? '',
  metaPixelId: import.meta.env.VITE_META_PIXEL_ID ?? '',
} as const;

// Feature flags — toggle visibility of LP sections without removing code.
export const featureFlags = {
  // Section 13 (近くの店舗を探す). 1 店舗運営中は false。複数店舗化で true に変更。
  showStoreLocations: false,
} as const;

// 総本店の店舗情報(フッターに表示)
export const storeInfo = {
  brandName: 'もみかる 総本店',
  address: '静岡県静岡市駿河区西脇 11-1 2F',
  hours: '午前10:00〜深夜2:00(最終受付/深夜1:00)',
} as const;

export const corporateInfo = {
  legalName: '株式会社ドラミカンパニー',
  copyrightYear: 2026,
} as const;

// Section 1: Hero
export const hero = {
  main: '肩、かるっ。',
  sub: '肩こり・首集中メニュー「かたかる」',
  lead:
    '肩こりは、放っておくと一日に確実に影響していきます。「肩がこっています」と伝えたのに、なぜか全身まんべんなく——そんな失敗、もう繰り返さなくていい。かたかるは、30分間ずっと、肩と首だけに集中するメニューです。今度こそ、お金も時間も、ちゃんとあなたの肩のために使われます。',
  prices: {
    primary: {
      duration: '30分',
      price: '2,700円',
      badge: 'おすすめ',
      sub: '深い部分まで、じっくり',
    },
    secondary: {
      duration: '20分',
      price: '2,000円',
      sub: '中層まで・短時間版',
    },
  },
  ctaPrimary: '空席を確認する',
  ctaPrimarySub: 'Andy予約へ',
  ctaSecondary: '店舗に電話する',
} as const;

// Section 2: Stolen things
export const stolenThings = {
  heading: '肩こりが、あなたから奪っているもの',
  lead:
    '「肩がこっている」は、ただの不快感ではありません。慢性化した肩こりは、気づかないうちに、あなたの一日のいろいろな場面に確実に影響しています。',
  items: [
    {
      index: 1,
      title: '仕事のパフォーマンス',
      body:
        '午後の会議で、相手の話が頭に入らない。資料を読んでも文字が滑る。「歳のせいかも」と思っていませんか? それは年齢ではなく、肩と首が重くなり、頭まですっきりしない感覚が出ている状態かもしれません。本来出せるはずの集中力と判断力が、肩の重さで出しきれていない状態かもしれません。',
    },
    {
      index: 2,
      title: '良質な睡眠',
      body:
        '朝起きても、スッキリしない。週末を寝て過ごしても、疲れが抜けない。これは、首と肩の重さが、休んでいる間も抜けていないサインです。深い睡眠が取れない毎日が、翌日の体力にも影響していきます。',
    },
    {
      index: 3,
      title: '大切な人との時間の質',
      body:
        '肩が重いと、家族の話を聞き流してしまう。子供との会話に集中しきれない。一緒にいるのに、心はそこにいない時間が、肩こりとともに少しずつ増えていきます。本人も家族も気づきにくいけれど、確実に進行する変化です。',
    },
    {
      index: 4,
      title: '「以前の自分」',
      body:
        '鏡を見ると、姿勢が崩れている。表情がいつも疲れている。気づけば、頭痛薬とカフェインで一日を凌いでいる。元気だった頃の自分に、もう少し近づきたい。その違和感は、肩こりが日常に影響しているサインです。',
    },
  ],
  closing:
    '肩こりは、放置していい不調ではありません。今日の重さは、明日のあなたに影響していきます。だから、解放するなら、早いほうがいい。',
  closingHighlight: '今日の重さは、明日のあなたに影響していきます。',
} as const;

// Section 3: Empathy checklist
export const empathy = {
  heading: 'もみほぐしに通って、こんな経験はありませんか?',
  lead:
    '月に1度、もみほぐしに通っている。それなのに、なぜか満足感が物足りない。そんな声を、お客様からよくいただきます。',
  items: [
    '「肩がこってる」とお伝えしたのに、全身まんべんなく揉まれて終わった',
    '一番ほぐして欲しかった首回りが、ほとんど触れられないまま終了した',
    '60分のコースを受けたのに、肝心のところがまだ残っている気がする',
    '上手な施術者にあたると最高だけど、ハズレた日のモヤモヤが大きい',
    '「もう少しここを」と言いづらくて、なんとなく終わってしまう',
    '結局、頭痛は消えないまま帰ってきた',
  ],
} as const;

// Section 5: Solution
export const solution = {
  heading: 'メニューそのものを、「集中」に変えました。',
  lead:
    'もみかるは、お客様が一番訴える「肩」「首」「腰」「背中」「ふくらはぎ・もも」を分解し、部位ごとの集中ケアメニューに再設計しました。その第一弾が「かたかる」です。',
  features: [
    {
      index: 1,
      title: '肩と首だけを、30分間ずっと',
      body:
        'メニューレベルで「肩と首だけ」とお約束しています。施術者の判断・解釈に依存せず、誰についても同じ集中ケアが構造として保証されます。',
    },
    {
      index: 2,
      title: '「ハズレ」が、ほぼなくなる',
      body:
        '全身ケアでは施術者の腕で仕上がりに差が出ます。一方で部位特化メニューは、施術範囲が絞られているぶん技術の標準化が進みます。だから誰についても、安定した満足感が得られます。「上手な人を探す旅」から、お客様を解放します。',
    },
    {
      index: 3,
      title: '30分2,700円という、本気の集中ケア',
      body:
        '深い部分までじっくり時間をかける30分の集中ケアが、業界相場に比べ安価な料金で受けられます。慢性化した肩こりに、しっかり時間をかけてアプローチするために設計したコースです。',
    },
  ],
} as const;

// Section 8: Pricing
export const pricing = {
  heading: 'もみかるが本気で設計したのは、30分です。',
  lead:
    'かたかるには30分と20分の2つのコースがあります。もみかるが本気で設計し、自信を持っておすすめするのは、30分コースです。両コースとも施術範囲は同じ「肩と首」ですが、かけられる時間の深さが違います。\n\n特に重要なのが「9〜18分」の、深い部分へのアプローチ。慢性化した肩こりの「重さの正体」は、この深い部分にあります。30分コースだからこそ、ここに10分以上の時間を確保できる。これが20分コースとの本質的な違いです。',
  leadHighlight: 'もみかるが本気で設計し、自信を持っておすすめするのは、30分コース',
  plans: [
    {
      id: '30',
      duration: '30分',
      price: '2,700円',
      badge: 'おすすめ',
      isPrimary: true,
      area: '肩と首',
      depth: 'じっくりと、深い部分まで',
      approach: 'ほぐし、深い部分への圧、多方向からのケア、ストレッチ、仕上げ流し',
      use: '慢性化した肩こり、根っこからほぐしたい日、初めての方',
      perMinute: '90円',
      cta: 'このコースで予約する',
    },
    {
      id: '20',
      duration: '20分',
      price: '2,000円',
      badge: '短時間版',
      isPrimary: false,
      area: '肩と首',
      depth: '表層から中層を中心に',
      approach: 'ほぐし、軽めの圧、仕上げ流し',
      use: '軽めのコリ、ランチタイム・仕事の合間、30分を経験済みのリピーターの維持ケア',
      perMinute: '100円',
      cta: 'このコースで予約する',
    },
  ],
  recommendation: {
    heading: 'プラン選びに迷ったら',
    body:
      '初めての方は、必ず30分コースをお選びください。慢性化した肩こりは、表層をほぐしただけでは戻ってしまいます。一度しっかり深い部分までほぐして「根っこ」をケアしたうえで、20分コースで維持していく——これが、もみかるが提案する通い方です。',
    highlight: '初めての方は、必ず30分コースをお選びください。',
  },
} as const;

// Section 9: Existing menu position
export const existingMenuPosition = {
  heading: '全身もみほぐしを、置き換えるものではありません。',
  paragraphs: [
    'もみかるには、これまで通りの「全身もみほぐし」もあります。「かたかる」は、それに代わるものではなく、目的に応じて使い分けるためのメニューです。',
  ],
  paragraphsHighlight: '目的に応じて使い分けるためのメニュー',
  katakaruDays: {
    title: 'こんな日に「かたかる」',
    items: [
      '肩と首だけが特に重く、そこを集中してケアしたい',
      '仕事の合間に短時間で立ち寄りたい',
      '全身もみほぐしの前に、特に気になる部位を念入りにほぐしたい',
    ],
  },
  fullBodyDays: {
    title: 'こんな日に「全身もみほぐし」',
    items: [
      '全体的に疲れが溜まっており、ゆっくり時間を使いたい',
      '自分でも凝っている場所を特定できない、漠然とした疲労感',
      'リラックスを目的に、長めの時間を確保したい',
    ],
  },
  closing: '両方を組み合わせて使うお客様から、より高い満足の声をいただいています。',
} as const;

// Section 10: Series
export const series = {
  heading: '「かたかる」は、シリーズの始まりです。',
  lead:
    'もみかるは、お客様の「ここを集中して欲しい」という声に応えるため、部位別の集中ケアメニューをシリーズ化しています。',
  items: [
    {
      name: 'かたかる',
      area: '肩・首',
      tags: 'デスクワーク、スマホ首、頭の重さに',
      isCurrent: true,
    },
    {
      name: 'こしかる',
      area: '腰',
      tags: '立ち仕事、長時間運転、座りっぱなしに',
      isCurrent: false,
    },
    {
      name: 'あしかる',
      area: 'ふくらはぎ・もも',
      tags: '立ち仕事、運動後、むくみに',
      isCurrent: false,
    },
    {
      name: 'せなかる',
      area: '背中・肩甲骨',
      tags: '猫背、呼吸の浅さ、上半身のだるさに',
      isCurrent: false,
    },
  ],
  combo: {
    heading: '自分専用の組み合わせを作る',
    body:
      'その日の凝りに合わせて選べる、セミオーダー型のケアです。たとえば、デスクワーク中心の方は「かたかる + せなかる」。立ち仕事中心の方は「こしかる + あしかる」。4つすべてを組み合わせれば、自分専用の「全身もみほぐし」が完成します。',
    finalLabel: '4つ組み合わせれば、自分専用の全身もみほぐし',
  },
} as const;

// Section 13: Stores
export type Store = {
  name: string;
  region: string;
  address: string;
  phone: string;
  bookingUrl: string;
};

export const storeRegions = ['静岡', '富山', '岐阜'] as const;
export type StoreRegion = (typeof storeRegions)[number];

export const stores: Store[] = [
  // 静岡
  {
    name: 'もみかる 静岡呉服町店',
    region: '静岡',
    address: '静岡県静岡市葵区呉服町X-X-X',
    phone: '054-000-0001',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 浜松駅前店',
    region: '静岡',
    address: '静岡県浜松市中区砂山町X-X-X',
    phone: '053-000-0002',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 沼津駅南店',
    region: '静岡',
    address: '静岡県沼津市大手町X-X-X',
    phone: '055-000-0003',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 三島本町店',
    region: '静岡',
    address: '静岡県三島市本町X-X-X',
    phone: '055-100-0004',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 富士本市場店',
    region: '静岡',
    address: '静岡県富士市本市場X-X-X',
    phone: '0545-00-0005',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 藤枝駅前店',
    region: '静岡',
    address: '静岡県藤枝市駅前X-X-X',
    phone: '054-100-0006',
    bookingUrl: env.bookingUrl,
  },

  // 富山
  {
    name: 'もみかる 富山総曲輪店',
    region: '富山',
    address: '富山県富山市総曲輪X-X-X',
    phone: '076-000-0007',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 高岡駅南店',
    region: '富山',
    address: '富山県高岡市駅南X-X-X',
    phone: '0766-00-0008',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 富山駅前店',
    region: '富山',
    address: '富山県富山市新富町X-X-X',
    phone: '076-100-0009',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 砺波本町店',
    region: '富山',
    address: '富山県砺波市本町X-X-X',
    phone: '0763-00-0010',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 黒部三日市店',
    region: '富山',
    address: '富山県黒部市三日市X-X-X',
    phone: '0765-00-0011',
    bookingUrl: env.bookingUrl,
  },

  // 岐阜
  {
    name: 'もみかる 岐阜柳ケ瀬店',
    region: '岐阜',
    address: '岐阜県岐阜市柳ケ瀬通X-X-X',
    phone: '058-000-0012',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 岐阜駅前店',
    region: '岐阜',
    address: '岐阜県岐阜市橋本町X-X-X',
    phone: '058-100-0013',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 大垣本町店',
    region: '岐阜',
    address: '岐阜県大垣市本町X-X-X',
    phone: '0584-00-0014',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 各務原中央店',
    region: '岐阜',
    address: '岐阜県各務原市那加新加納町X-X-X',
    phone: '058-200-0015',
    bookingUrl: env.bookingUrl,
  },
  {
    name: 'もみかる 多治見駅前店',
    region: '岐阜',
    address: '岐阜県多治見市音羽町X-X-X',
    phone: '0572-00-0016',
    bookingUrl: env.bookingUrl,
  },
];

export const storesSection = {
  heading: '近くの店舗を探す',
  lead: 'お近くの店舗を選んで、Andy予約またはお電話でご来店ください。',
} as const;

// Section 15: Final CTA
export const finalCta = {
  heading: '肩、軽くしましょう。',
  body:
    '肩と首に、30分間ずっと集中。深い部分まで、じっくりと。誰についても、ハズレの少ない安心を。今日の重さは、今日のうちに解放してください。',
  ctaPrimary: '30分コースで予約する',
  ctaPrimarySub: 'Andy予約へ',
  ctaSecondary: '20分コースで予約する',
  ctaSecondarySub: 'Andy予約へ',
  ctaTertiary: 'または、店舗に電話する',
} as const;

export const footer = {
  copyright: `© ${new Date().getFullYear()} ${brand.operator}`,
  links: [
    { label: 'プライバシーポリシー', href: '/privacy' },
    { label: '特定商取引法に基づく表記', href: '/tokushoho' },
  ],
} as const;

export const stickyCta = {
  call: '電話予約',
  book: 'WEB予約',
} as const;

// SEO meta (also embedded in index.html)
export const seo = {
  title: '肩・首集中ケア「かたかる」 30分2,700円 | もみかる',
  description:
    '「肩がこってる」と伝えたのに全身まんべんなく揉まれた経験はありませんか? かたかるは、肩と首だけに30分集中するメニュー。深い部分まで届く施術で、誰についてもハズレの少ない安心を。全国136店舗のもみかる。',
} as const;
