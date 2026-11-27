import {
  Award,
  Baby,
  BatteryCharging,
  Bike,
  BookOpen,
  Briefcase,
  Camera,
  Car,
  Compass,
  Cpu,
  Dumbbell,
  Flame,
  Gamepad2,
  Gem,
  Gift,
  Glasses,
  Grid3x3,
  Headphones,
  Heart,
  Home,
  Info,
  Laptop,
  Layers,
  LayoutGrid,
  Monitor,
  MoreHorizontal,
  Music,
  Package,
  Palette,
  Percent,
  Phone,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sofa,
  Sparkles,
  Speaker,
  Star,
  Tablet,
  Tag,
  Trophy,
  Truck,
  Tv,
  Utensils,
  Watch,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { sanitizeSvgMarkup } from '../../../shared/megaMenuHelpers.ts';
import { sanitizeHref } from '../../../shared/security.ts';
import { SafeImage } from '../ui/SafeImage.tsx';

export const NAV_ICON_REGISTRY: Record<string, LucideIcon> = {
  LayoutGrid,
  Smartphone,
  Laptop,
  Headphones,
  Shirt,
  Home,
  Sparkles,
  Trophy,
  BookOpen,
  Gamepad2,
  Watch,
  MoreHorizontal,
  ShoppingBag,
  Flame,
  Zap,
  Tag,
  Percent,
  Star,
  Heart,
  Gift,
  Camera,
  Speaker,
  Tv,
  Monitor,
  Tablet,
  Cpu,
  BatteryCharging,
  Utensils,
  Sofa,
  Baby,
  Car,
  Bike,
  Dumbbell,
  Briefcase,
  Glasses,
  Gem,
  Music,
  Palette,
  Package,
  Truck,
  ShieldCheck,
  Phone,
  Info,
  Award,
  Compass,
  Layers,
  Grid3x3,
};

export const NAV_ICON_NAMES = Object.keys(NAV_ICON_REGISTRY);

function renderSanitizedSvgElement(rawSvg: string, sizePx: number, color?: string) {
  const clean = sanitizeSvgMarkup(rawSvg);
  if (!clean || typeof DOMParser === 'undefined') {
    return <LayoutGrid style={{ width: sizePx, height: sizePx, color }} />;
  }
  try {
    const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      return <LayoutGrid style={{ width: sizePx, height: sizePx, color }} />;
    }
    const viewBox = svgEl.getAttribute('viewBox') || '0 0 24 24';
    const children = Array.from(svgEl.children);

    return (
      <svg
        viewBox={viewBox}
        width={sizePx}
        height={sizePx}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color }}
        aria-hidden="true"
      >
        {children.map((node, idx) => {
          const tag = node.tagName.toLowerCase();
          const common = {
            fill: node.getAttribute('fill') || undefined,
            stroke: node.getAttribute('stroke') || undefined,
            strokeWidth: node.getAttribute('stroke-width') || undefined,
            opacity: node.getAttribute('opacity') || undefined,
          };
          if (tag === 'path') {
            return <path key={idx} d={node.getAttribute('d') || ''} {...common} />;
          }
          if (tag === 'circle') {
            return (
              <circle
                key={idx}
                cx={node.getAttribute('cx') || '0'}
                cy={node.getAttribute('cy') || '0'}
                r={node.getAttribute('r') || '0'}
                {...common}
              />
            );
          }
          if (tag === 'rect') {
            return (
              <rect
                key={idx}
                x={node.getAttribute('x') || '0'}
                y={node.getAttribute('y') || '0'}
                width={node.getAttribute('width') || '0'}
                height={node.getAttribute('height') || '0'}
                rx={node.getAttribute('rx') || undefined}
                {...common}
              />
            );
          }
          if (tag === 'line') {
            return (
              <line
                key={idx}
                x1={node.getAttribute('x1') || '0'}
                y1={node.getAttribute('y1') || '0'}
                x2={node.getAttribute('x2') || '0'}
                y2={node.getAttribute('y2') || '0'}
                {...common}
              />
            );
          }
          if (tag === 'polyline') {
            return <polyline key={idx} points={node.getAttribute('points') || ''} {...common} />;
          }
          if (tag === 'polygon') {
            return <polygon key={idx} points={node.getAttribute('points') || ''} {...common} />;
          }
          if (tag === 'ellipse') {
            return (
              <ellipse
                key={idx}
                cx={node.getAttribute('cx') || '0'}
                cy={node.getAttribute('cy') || '0'}
                rx={node.getAttribute('rx') || '0'}
                ry={node.getAttribute('ry') || '0'}
                {...common}
              />
            );
          }
          return null;
        })}
      </svg>
    );
  } catch {
    return <LayoutGrid style={{ width: sizePx, height: sizePx, color }} />;
  }
}

interface NavIconRendererProps {
  iconType?: 'lucide' | 'svg' | 'image' | 'none';
  iconName?: string;
  iconSvg?: string;
  iconImageUrl?: string;
  iconColor?: string;
  sizePx?: number;
  className?: string;
}

export function NavIconRenderer({
  iconType = 'lucide',
  iconName = 'LayoutGrid',
  iconSvg,
  iconImageUrl,
  iconColor,
  sizePx = 18,
  className = '',
}: NavIconRendererProps) {
  if (iconType === 'none') return null;

  if (iconType === 'image' && iconImageUrl) {
    const safeImg = sanitizeHref(iconImageUrl);
    if (safeImg) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 overflow-hidden ${className}`}
          style={{ width: sizePx, height: sizePx }}
        >
          <SafeImage
            src={safeImg}
            alt=""
            className="w-full h-full object-contain"
          />
        </span>
      );
    }
  }

  if (iconType === 'svg' && iconSvg) {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {renderSanitizedSvgElement(iconSvg, sizePx, iconColor)}
      </span>
    );
  }

  const IconComponent = NAV_ICON_REGISTRY[iconName] || LayoutGrid;
  return (
    <IconComponent
      className={`shrink-0 ${className}`}
      style={{ width: sizePx, height: sizePx, color: iconColor }}
      aria-hidden="true"
    />
  );
}
