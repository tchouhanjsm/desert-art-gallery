import Link from "next/link";

export const metadata = {
  title: "私たちについて",
  description: "ラージャスターン州ジャイサルメールを拠点とするDesert Art Galleryについてご紹介します。",
};

export default function StoryPage() {
  return (
    <div className="atelier-story-page">
      <header className="atelier-story-masthead">
        <div className="section-kicker">ジャイサルメール · ラージャスターン州</div>
        <h1>テキスタイルと品物、<br /><em>その背景。</em></h1>
        <p>ラージャスターン州ジャイサルメールから。</p>
      </header>

      <figure className="atelier-story-visual">
        <div className="atelier-story-visual-art" role="img" aria-label="テキスタイルをイメージした幾何学模様のデザインです。商品写真ではありません。">
          <span className="atelier-story-visual-monogram">DAG</span>
          <span className="atelier-story-visual-caption">素材 · 記憶 · 手仕事</span>
        </div>
        <figcaption><span>デザインスタディ · テキスタイルパターン</span><span>ギャラリーのオリジナル写真は準備中</span></figcaption>
      </figure>

      <div className="atelier-story-content">
        <article className="atelier-story-article">
          <span className="section-kicker">ギャラリーの考え方</span>
          <h2>品物をよく見て、<br /><em>その魅力を知る。</em></h2>
          <p>Desert Art Galleryは、ラージャスターン州ジャイサルメールを拠点としています。テキスタイルや品物そのものの表情と、その品物を理解するための情報を大切にしています。</p>
          <p>公開する商品には、ギャラリーが確認できる情報を掲載します。素材、寸法、状態、来歴、在庫状況を推測で補うことはせず、一点ずつ確認します。</p>

          <h3>つくり手への敬意</h3>
          <p>手仕事には、人や地域が受け継いできた知識と時間、仕事が込められています。つくり手のお名前、プロフィール、写真、制作工程は、ご本人が内容と使用方法を確認し、承諾した場合にのみ掲載します。</p>

          <h3>商品についてのご相談</h3>
          <p>気になる商品がございましたら、商品名または商品ページのリンクと、お届け先の国を添えてお問い合わせください。お支払いの前に、商品内容、最終価格、配送費用について書面での確認をお願いいたします。</p>
        </article>

        <aside className="atelier-story-aside">
          <div className="atelier-story-aside-mark">DAG</div>
          <span>拠点</span>
          <strong>ジャイサルメール</strong>
          <span>ラージャスターン州 · インド</span>
          <div className="atelier-story-aside-rule" />
          <p>テキスタイル。品物。ストーリー。</p>
          <Link className="text-link" href="/shop">商品を見る</Link>
        </aside>
      </div>

      <section className="atelier-story-close">
        <span className="section-kicker">お問い合わせ</span>
        <h2>気になる商品はありますか？</h2>
        <p>商品名またはリンクとご質問をお送りください。確認できる情報をご案内します。</p>
        <Link className="button-primary" href="/contact">お問い合わせ</Link>
      </section>
    </div>
  );
}
