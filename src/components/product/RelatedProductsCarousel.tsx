import { useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types/domain.ts';
import { ProductCard } from '../ui/ProductCard.tsx';

interface RelatedProductsCarouselProps {
  products: Product[];
  categorySlug?: string;
}

export function RelatedProductsCarousel({ products, categorySlug }: RelatedProductsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!products || products.length === 0) return null;

  const scrollByAmount = (direction: 'prev' | 'next') => {
    if (!trackRef.current) return;
    const width = trackRef.current.clientWidth;
    trackRef.current.scrollBy({
      left: direction === 'next' ? width * 0.75 : -width * 0.75,
      behavior: 'smooth',
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-l-4 border-[#15803D] pl-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">Related Products</h2>
          <p className="text-xs text-slate-500 mt-0.5">You might also like these products</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            <button
              type="button"
              onClick={() => scrollByAmount('prev')}
              aria-label="Scroll related products left"
              className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount('next')}
              aria-label="Scroll related products right"
              className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Link
            to={categorySlug ? `/category/${categorySlug}` : '/shop'}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 hover:text-[#15803D] whitespace-nowrap"
          >
            <span>View All Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory"
      >
        {products.map((item) => (
          <div
            key={item._id}
            className="w-[46%] sm:w-[31%] md:w-[23.5%] lg:w-[19%] min-w-[180px] shrink-0 snap-start"
          >
            <ProductCard product={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
