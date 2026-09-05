import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <section className="mx-auto max-w-[1920px] px-4 sm:px-8 lg:px-24 py-48">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-24">
          <div className="lg:col-span-8">
            <h1 className="font-display text-4xl sm:text-6xl lg:text-[6rem] font-bold leading-[1.05] tracking-tight mb-12">
              攻略我看過了,
              <br />
              <span className="italic font-normal">但我家不是範例家庭。</span>
            </h1>
            <p className="text-2xl leading-relaxed text-text-secondary max-w-3xl">
              分身有術是一個讓人們按需使用達人經驗的 AI 服務市集。
              我們把達人和過來人的判斷方法,變成能針對你的情況提供引導的服務——
              帶你比較選項,做出自己理解、也適合自己情況的決定。
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end items-start gap-8">
            <Link
              href="/agents"
              className="group flex items-center gap-4 border-b border-text-primary pb-2 text-xl font-medium transition-colors hover:text-accent hover:border-accent"
            >
              探索達人服務
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
            </Link>
            <Link
              href="/agents/new"
              className="group flex items-center gap-4 border-b border-text-tertiary pb-2 text-xl font-medium text-text-secondary transition-colors hover:text-text-primary hover:border-text-primary"
            >
              上架你的經驗
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1920px] px-4 sm:px-8 lg:px-24 pb-48">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-24">
          {[
            {
              role: '達人・過來人',
              description: '把自己的判斷原則、提問方式和案例,整理成可以上架的服務。不必每次都親自回答同樣的問題,使用者依使用付費,你取得收入。',
              action: '上架服務',
              href: '/agents/new',
              statLabel: '收入',
              statValue: '依使用分潤',
            },
            {
              role: '平台',
              description: '代管服務運行、處理付費與分潤,讓經驗不只被看見,也能被使用。你不用先認識對的人,才有機會獲得幫助。',
              action: null,
              href: null,
              statLabel: '服務費',
              statValue: '3%',
            },
            {
              role: '使用者',
              description: '選擇你信任的達人,設定本次預算,說明自己的情況。服務會補問必要的條件、比較不同安排,解釋每個選擇的取捨。',
              action: '探索服務',
              href: '/agents',
              statLabel: '花費',
              statValue: '依使用付費',
            },
          ].map(card => (
            <div key={card.role} className="col-span-12 md:col-span-4 flex flex-col">
              <h3 className="font-display text-4xl font-bold italic mb-8">{card.role}</h3>
              <div className="h-px w-12 bg-text-primary mb-8"></div>
              <div className="flex-grow flex flex-col">
                <p className="text-text-secondary mb-8">{card.description}</p>
                {card.action && card.href ? (
                  <div className="mb-12">
                    <Link href={card.href} className="group inline-flex items-center gap-2 border-b border-text-tertiary pb-1 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary hover:border-text-primary">
                      {card.action}
                      <span className="material-symbols-outlined text-[1rem] transition-transform group-hover:translate-x-1">arrow_forward</span>
                    </Link>
                  </div>
                ) : (
                  <div className="mb-12"></div>
                )}
              </div>
              <div className="bg-surface-dim p-8">
                <div className="text-xs uppercase tracking-widest text-text-secondary mb-4">{card.statLabel}</div>
                <div className="font-display text-4xl font-bold text-accent">{card.statValue}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1920px] px-4 sm:px-8 lg:px-24 pb-48">
        <div className="grid grid-cols-2 md:grid-cols-4 border border-border-subtle divide-y md:divide-y-0 md:divide-x divide-border-subtle">
          {[
            { label: '單次查詢', value: '$0.001 起', subtitle: '小額按次付費' },
            { label: '本次預算', value: '你決定', subtitle: '花多少由你設定' },
            { label: '建議調整', value: '即時', subtitle: '補充限制,建議跟著變' },
            { label: '起步場景', value: '自由行', subtitle: '轉職、在地生活陸續擴充' },
          ].map((stat) => (
            <div key={stat.label} className="p-12">
              <div className="text-xs uppercase tracking-widest text-text-tertiary mb-6">{stat.label}</div>
              <div className="font-display text-5xl font-bold text-text-primary mb-4">{stat.value}</div>
              <div className="text-accent font-medium text-sm">{stat.subtitle}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1920px] px-4 sm:px-8 lg:px-24 pb-48">
        <div className="max-w-3xl">
          <h2 className="font-display text-4xl font-bold mb-8">讓好建議,不必靠人脈。</h2>
          <p className="text-xl leading-relaxed text-text-secondary">
            準備轉職的人,可以使用學長姐整理的履歷與面試方法。
            適應過台灣生活的新住民,可以把辦事與溝通經驗提供給下一個剛抵達的人。
            同一個人在某件事上需要引導,也可能在另一件事上,就是別人需要的過來人。
          </p>
        </div>
      </section>
    </div>
  )
}
