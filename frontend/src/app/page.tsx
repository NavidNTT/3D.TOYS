
import type { Metadata } from 'next';
import Link from 'next/link';
import CategoryStrip from '@/src/components/home/CategoryStrip';
import FeaturedProductHero from '@/src/components/home/FeaturedProductHero';
import ProductCard from '@/src/components/products/ProductCard';
import Container from '@/src/components/ui/Container';
import EmptyState from '@/src/components/ui/EmptyState';
import Section from '@/src/components/ui/Section';
import {
  ALL_CATEGORIES_LABEL,
  ALL_CATEGORIES_PATH,
  ALL_PRODUCTS_LABEL,
  ALL_PRODUCTS_PATH,
  productPath,
} from '@/src/lib/catalog';
import { resolveTheme } from '@/src/lib/theme';
import { getAllCategories } from '@/src/services/categoryService';
import { getProducts } from '@/src/services/productService';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '3D.TOYS — دنیای اسباب‌بازی‌های سه‌بعدی',
  description:
    'دنیای اسباب‌بازی‌ها را کشف کن، محصولات را سه‌بعدی ببین و با خیال راحت خرید کن.',
};

const TRUST_ITEMS = [
  {
    icon: '↻',
    number: '01',
    title: 'قبل از خرید ببین',
    body: 'محصولات سه‌بعدی را از زوایای مختلف بررسی کن و بعد تصمیم بگیر.',
    color: 'bg-[#E2EAFF]',
  },
  {
    icon: '↗',
    number: '02',
    title: 'خرید راحت و سریع',
    body: 'محصول موردنظرت را پیدا کن و مستقیم به صفحه خرید آن برو.',
    color: 'bg-[#FFE3D6]',
  },
  {
    icon: '✳',
    number: '03',
    title: 'دنیایی برای کشف',
    body: 'در میان دسته‌بندی‌ها بچرخ و اسباب‌بازی بعدی‌ات را پیدا کن.',
    color: 'bg-[#E8F5C9]',
  },
];

export default async function HomePage() {
  const [categories, { items: products }] = await Promise.all([
    getAllCategories(),
    getProducts({ per_page: 8, in_stock: true }),
  ]);

  const featured =
    products.find((product) => product.media_3d?.url) ??
    products[0] ??
    null;

  const featuredTheme = resolveTheme(featured?.category?.theme_config);

  return (
    <main className="overflow-hidden pb-16">
      <Container className="py-6 sm:py-10">

        {/* HERO */}
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#F0EDE5] px-5 py-8 sm:rounded-[2.5rem] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          {/* Decorative shapes */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-20 -z-10 h-64 w-64 rounded-full bg-[#C7EF63]/50 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 right-1/3 -z-10 h-64 w-64 rounded-full bg-[#2455F5]/10 blur-3xl"
          />

          <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-6">
            {/* Text leads on mobile so the headline is above the fold; on
                desktop the grid puts it in the first (right-hand) column. */}
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-3.5 py-2 text-xs font-bold text-[#2455F5]">
                <span className="h-2 w-2 rounded-full bg-[#2455F5]" />
                دنیای جدید خرید اسباب‌بازی
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black tracking-[0.18em] text-black/45">
                  DISCOVER. ROTATE. PLAY.
                </p>

                <h1 className="font-display text-4xl leading-[1.5] tracking-tight text-[#22231F] sm:text-5xl lg:text-6xl xl:text-7xl">
                  فقط نگاه نکن،
                  <span className="block text-[#2455F5]">
                    کشفش کن!
                  </span>
                </h1>

                <p className="max-w-md text-sm leading-8 text-[#55564F] sm:text-base">
                  قبل از خرید، اسباب‌بازی موردعلاقه‌ات را از هر زاویه
                  ببین. اینجا انتخاب محصول، بخشی از ماجراجویی است.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href={ALL_PRODUCTS_PATH}
                  className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#2455F5] px-6 py-3.5 text-sm font-bold text-white shadow-[0_8px_0_#1939A8] transition hover:-translate-y-0.5 hover:bg-[#1945DE] hover:shadow-[0_10px_0_#1939A8] active:translate-y-1 active:shadow-none"
                >
                  {ALL_PRODUCTS_LABEL}
                  <span aria-hidden="true" className="text-lg transition-transform group-hover:-translate-x-1">
                    ←
                  </span>
                </Link>

                <Link
                  href={ALL_CATEGORIES_PATH}
                  className="inline-flex items-center justify-center rounded-full border-2 border-[#22231F]/15 bg-white/60 px-6 py-3.5 text-sm font-bold text-[#22231F] transition hover:border-[#2455F5] hover:bg-white"
                >
                  {ALL_CATEGORIES_LABEL}
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-xs font-medium text-[#66665F]">
                <span className="flex items-center gap-2">
                  <span className="text-[#2455F5]">✳</span>
                  تجربه‌ی متفاوت محصول
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[#F07845]">✳</span>
                  انتخاب آگاهانه‌تر
                </span>
              </div>
            </div>

            {/* Featured product stage */}
            <div className="relative mx-auto w-full max-w-[580px]">
              {/* Corner stickers live on the studio card's edge — outside the
                  frame padding — so they never sit on top of the product. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -top-3 z-20 grid h-11 w-11 rotate-12 place-items-center rounded-xl bg-[#C7EF63] text-xl text-[#25281E] shadow-lg sm:-right-3 sm:-top-4 sm:h-14 sm:w-14 sm:text-2xl"
              >
                ✳
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-3 -left-2 z-20 grid h-9 w-9 -rotate-12 place-items-center rounded-full bg-[#FF714B] text-lg font-black text-white shadow-lg sm:-bottom-4 sm:-left-3 sm:h-12 sm:w-12 sm:text-xl"
              >
                +
              </div>

              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-[#E2E8F5] p-3 shadow-[0_24px_70px_-35px_rgba(36,85,245,0.35)] sm:rounded-[2.25rem] sm:p-5">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-50"
                  style={{
                    backgroundImage:
                      'radial-gradient(#2455F5 0.8px, transparent 0.8px)',
                    backgroundSize: '18px 18px',
                  }}
                />

                <div className="relative z-10 flex items-center justify-between gap-3 px-2 pb-3 sm:px-3">
                  <span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-black tracking-wider text-[#2455F5] sm:text-xs">
                    3D PRODUCT STUDIO
                  </span>
                  <span className="text-xs font-bold text-[#353F57]/65">
                    FEATURED DROP <span dir="ltr">✳ 01</span>
                  </span>
                </div>

                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#2455F5]/10"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#2455F5]/20"
                  />

                  <div className="relative z-10 min-h-[260px] sm:min-h-[370px]">
                    <FeaturedProductHero
                      posterUrl={featured?.media_3d?.thumbnail_url ?? null}
                      alt={featured?.title ?? 'اسباب‌بازی ویژه'}
                      accentColor={featuredTheme.glow}
                    />
                  </div>

                </div>

                <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/75 px-4 py-3 backdrop-blur-sm sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#77776F]">
                      انتخاب ویژه‌ی ما
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-[#22231F] sm:text-base">
                      {featured?.title ?? 'ماجراجویی از اینجا شروع می‌شود'}
                    </p>
                  </div>

                  {featured ? (
                    <Link
                      href={productPath(featured.slug)}
                      className="shrink-0 rounded-full bg-[#22231F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#2455F5]"
                    >
                      کشف محصول ←
                    </Link>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#22231F] px-4 py-2.5 text-xs font-bold text-white">
                      به‌زودی
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-3 text-center text-[10px] font-medium text-[#77776F] sm:text-xs">
                مدل و پیش‌نمایش محصول به اطلاعات موجود در فروشگاه وابسته است.
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between border-t border-black/10 pt-5">
            <span className="text-[10px] font-black tracking-[0.2em] text-black/40 sm:text-xs">
              A NEW WAY TO SHOP
            </span>
            <span className="text-xs font-bold text-[#55564F]">
              بچرخان. بررسی کن. انتخاب کن.
            </span>
          </div>
        </section>

        {/* CATEGORIES */}
        <Section labelledBy="categories-heading">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-[10px] font-black tracking-[0.18em] text-[#2455F5]">
                FIND YOUR NEXT FAVORITE
              </p>
              <h2
                id="categories-heading"
                className="font-display text-2xl text-[#22231F] sm:text-3xl"
              >
                از کجا شروع کنیم؟
              </h2>
            </div>

            <Link
              href={ALL_CATEGORIES_PATH}
              className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-xs font-bold text-[#33342F] transition hover:border-[#2455F5] hover:text-[#2455F5]"
            >
              همه دسته‌بندی‌ها ←
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-black/[0.04] bg-white p-3 shadow-[0_12px_40px_-30px_rgba(0,0,0,0.2)] sm:p-5">
            <CategoryStrip categories={categories} />
          </div>
        </Section>

        {/* FEATURED PRODUCTS */}
        <Section labelledBy="featured-heading">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-black tracking-[0.18em] text-[#F07845]">
                HANDPICKED FOR YOU
              </p>
              <h2
                id="featured-heading"
                className="font-display text-2xl text-[#22231F] sm:text-3xl"
              >
                انتخاب‌های جذاب
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#77776F]">
                چند محصول برای شروع ماجراجویی بعدی تو.
              </p>
            </div>

            <Link
              href={ALL_PRODUCTS_PATH}
              className="group inline-flex items-center gap-2 rounded-full bg-[#C7EF63] px-5 py-3 text-xs font-black text-[#25281E] transition hover:bg-[#B6E64A]"
            >
              {ALL_PRODUCTS_LABEL}
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-black/15 bg-white/70 p-6 sm:p-10">
              <EmptyState
                icon="🧸"
                title="هنوز محصولی منتشر نشده است"
                description="به‌زودی اسباب‌بازی‌های جدید اضافه می‌شوند."
              />
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <li key={product.id} className="min-w-0">
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* TRUST / VALUE PROPOSITION */}
        <Section labelledBy="trust-heading">
          <div className="overflow-hidden rounded-[2rem] bg-[#22231F] p-5 text-white sm:rounded-[2.5rem] sm:p-9 lg:p-12">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-black tracking-[0.18em] text-[#C7EF63]">
                  MORE THAN JUST A TOY STORE
                </p>
                <h2
                  id="trust-heading"
                  className="font-display text-2xl leading-relaxed sm:text-3xl"
                >
                  خریدی که با اطمینان شروع می‌شود.
                </h2>
              </div>
              <span aria-hidden="true" className="text-4xl text-[#C7EF63]">
                ✳
              </span>
            </div>

            <ul className="grid gap-3 sm:grid-cols-3">
              {TRUST_ITEMS.map((item) => (
                <li
                  key={item.number}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5 transition hover:bg-white/[0.08] sm:p-6"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <span
                      className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl text-[#22231F] ${item.color}`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-xs font-black tracking-widest text-white/30">
                      / {item.number}
                    </span>
                  </div>

                  <h3 className="font-display text-lg text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-white/55">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden rounded-[2rem] bg-[#C7EF63] px-6 py-8 sm:rounded-[2.5rem] sm:px-10 sm:py-10">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 -top-12 text-[180px] font-black leading-none text-black/[0.045]"
          >
            3D
          </span>

          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-[10px] font-black tracking-[0.18em] text-black/50">
                YOUR NEXT DISCOVERY STARTS HERE
              </p>
              <h2 className="font-display text-2xl leading-relaxed text-[#22231F] sm:text-3xl">
                اسباب‌بازی بعدی‌ات منتظرته!
              </h2>
              <p className="mt-2 text-sm leading-7 text-black/60">
                همه محصولات را ببین و انتخابت را شروع کن.
              </p>
            </div>

            <Link
              href={ALL_PRODUCTS_PATH}
              className="inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-[#22231F] px-6 py-4 text-sm font-bold text-white transition hover:-translate-y-1 hover:bg-[#2455F5]"
            >
              {ALL_PRODUCTS_LABEL}
              <span aria-hidden="true">←</span>
            </Link>
          </div>
        </section>

      </Container>
    </main>
  );
}
