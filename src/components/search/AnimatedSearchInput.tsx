import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  DEFAULT_SEED_PLACEHOLDERS,
  resolveActivePlaceholders,
  sanitizePlaceholderAnimationConfig,
} from '../../../shared/searchHelpers.ts';
import type { PublicSearchConfig } from '../../types/domain.ts';

interface AnimatedSearchInputProps {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  device: 'desktop' | 'mobile';
  config?: PublicSearchConfig | null;
  ariaLabel?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaActiveDescendant?: string;
  inputClassName?: string;
  placeholderClassName?: string;
  clearButtonClassName?: string;
  autoFocus?: boolean;
  /** Optional index override to preview a specific placeholder message immediately */
  previewMessageText?: string | null;
}

export function AnimatedSearchInput({
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  onClear,
  device,
  config,
  ariaLabel = 'Search for products',
  ariaExpanded,
  ariaControls,
  ariaActiveDescendant,
  inputClassName = 'w-full h-10 pl-4 pr-8 bg-transparent text-sm text-slate-900 focus:outline-none',
  placeholderClassName = 'text-sm text-slate-400',
  clearButtonClassName = 'right-1.5 text-slate-400 hover:text-slate-700',
  autoFocus = false,
  previewMessageText = null,
}: AnimatedSearchInputProps) {
  const anim = useMemo(
    () => sanitizePlaceholderAnimationConfig(config?.placeholderAnimation || DEFAULT_PLACEHOLDER_ANIMATION_CONFIG),
    [config?.placeholderAnimation]
  );

  const activeMessages = useMemo(() => {
    if (previewMessageText && previewMessageText.trim()) {
      return [previewMessageText.trim()];
    }
    const source =
      config?.placeholders && config.placeholders.length > 0
        ? config.placeholders
        : DEFAULT_SEED_PLACEHOLDERS;
    const resolved = resolveActivePlaceholders(source, device);
    return resolved.length > 0
      ? resolved.map((m) => m.text)
      : [anim.fallbackStaticText || DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.fallbackStaticText];
  }, [config?.placeholders, device, anim.fallbackStaticText, previewMessageText]);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [phase, setPhase] = useState<'initial_delay' | 'typing' | 'pausing' | 'erasing' | 'between' | 'done'>(
    'initial_delay'
  );
  const charIndexRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const listener = (ev: MediaQueryListEvent) => setPrefersReducedMotion(ev.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  const deviceAllowed = device === 'desktop' ? anim.desktopEnabled : anim.mobileEnabled;
  const shouldAnimate =
    anim.enabled &&
    deviceAllowed &&
    !prefersReducedMotion &&
    activeMessages.length > 0 &&
    value.length === 0 &&
    !(isFocused && anim.pauseOnFocus);

  // Reset cycle cleanly whenever active message set or transition config changes
  useEffect(() => {
    setMessageIndex(0);
    charIndexRef.current = 0;
    if (anim.transitionBehavior !== 'type_and_erase') {
      setDisplayedText(activeMessages[0] || anim.fallbackStaticText);
    } else {
      setDisplayedText('');
      setPhase('initial_delay');
    }
  }, [activeMessages.join('||'), anim.transitionBehavior, anim.fallbackStaticText]);

  useEffect(() => {
    if (!shouldAnimate) return;

    const currentFullText = activeMessages[messageIndex % activeMessages.length] || anim.fallbackStaticText;
    const graphemes = Array.from(currentFullText);

    if (anim.transitionBehavior === 'fade_cycle' || anim.transitionBehavior === 'instant_cycle') {
      setDisplayedText(currentFullText);
      if (activeMessages.length <= 1 && !anim.loop) return;
      const timer = window.setTimeout(() => {
        setMessageIndex((prev) => {
          const next = prev + 1;
          if (!anim.loop && next >= activeMessages.length) return prev;
          return next % activeMessages.length;
        });
      }, anim.pauseAfterCompleteMs + anim.delayBeforeNextMs);
      return () => window.clearTimeout(timer);
    }

    // Type-and-erase sequential state machine
    let timer = 0;

    if (phase === 'initial_delay') {
      timer = window.setTimeout(() => {
        charIndexRef.current = 0;
        setPhase('typing');
      }, anim.startDelayMs);
    } else if (phase === 'typing') {
      if (charIndexRef.current < graphemes.length) {
        timer = window.setTimeout(() => {
          charIndexRef.current += 1;
          setDisplayedText(graphemes.slice(0, charIndexRef.current).join(''));
        }, anim.typingSpeedMs);
      } else {
        setPhase('pausing');
      }
    } else if (phase === 'pausing') {
      const isLastNonLoop = !anim.loop && messageIndex >= activeMessages.length - 1;
      if (isLastNonLoop) {
        setPhase('done');
        return;
      }
      timer = window.setTimeout(() => {
        setPhase('erasing');
      }, anim.pauseAfterCompleteMs);
    } else if (phase === 'erasing') {
      if (charIndexRef.current > 0) {
        timer = window.setTimeout(() => {
          charIndexRef.current -= 1;
          setDisplayedText(graphemes.slice(0, charIndexRef.current).join(''));
        }, anim.erasingSpeedMs);
      } else {
        setPhase('between');
      }
    } else if (phase === 'between') {
      timer = window.setTimeout(() => {
        const nextIdx = (messageIndex + 1) % activeMessages.length;
        setMessageIndex(nextIdx);
        charIndexRef.current = 0;
        setPhase('typing');
      }, anim.delayBeforeNextMs);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [
    shouldAnimate,
    phase,
    displayedText,
    messageIndex,
    activeMessages,
    anim.typingSpeedMs,
    anim.erasingSpeedMs,
    anim.pauseAfterCompleteMs,
    anim.delayBeforeNextMs,
    anim.startDelayMs,
    anim.loop,
    anim.transitionBehavior,
    anim.fallbackStaticText,
  ]);

  const staticFallback =
    activeMessages[0] || anim.fallbackStaticText || DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.fallbackStaticText;

  const visibleOverlayText = useMemo(() => {
    if (value.length > 0) return '';
    if (!anim.enabled || !deviceAllowed || prefersReducedMotion) {
      return anim.fallbackStaticText || staticFallback;
    }
    if (isFocused && anim.pauseOnFocus) {
      return displayedText || staticFallback;
    }
    if (anim.transitionBehavior !== 'type_and_erase') {
      return activeMessages[messageIndex % activeMessages.length] || staticFallback;
    }
    return displayedText;
  }, [
    value.length,
    anim.enabled,
    anim.fallbackStaticText,
    anim.pauseOnFocus,
    anim.transitionBehavior,
    deviceAllowed,
    prefersReducedMotion,
    isFocused,
    displayedText,
    staticFallback,
    activeMessages,
    messageIndex,
  ]);

  const cursorStyle = {
    '--search-cursor-blink': `${anim.cursorBlinkSpeedMs}ms`,
  } as React.CSSProperties;

  return (
    <div className="relative flex-1 min-w-0 flex items-center">
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setIsFocused(false);
          if (anim.resumeOnBlur && value.length === 0 && phase === 'done' && anim.loop) {
            setPhase('typing');
          }
          onBlur?.();
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder=""
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-activedescendant={ariaActiveDescendant}
        aria-autocomplete={ariaControls ? 'list' : undefined}
        className={`${inputClassName} [&::-webkit-search-cancel-button]:hidden`}
      />

      {value.length === 0 && (
        <div
          aria-hidden="true"
          data-testid={`animated-placeholder-${device}`}
          className={`pointer-events-none select-none absolute inset-y-0 left-0 right-2 flex items-center overflow-hidden whitespace-nowrap pl-4 pr-2 ${placeholderClassName}`}
        >
          <span
            key={anim.transitionBehavior === 'fade_cycle' ? `${messageIndex}-${visibleOverlayText}` : 'typing'}
            className={`truncate ${
              anim.transitionBehavior === 'fade_cycle' ? 'search-placeholder-fade' : ''
            }`}
          >
            {visibleOverlayText}
          </span>
          {anim.showCursor && shouldAnimate && anim.transitionBehavior === 'type_and_erase' && (
            <span
              style={cursorStyle}
              className="search-placeholder-cursor text-[#16A34A] font-semibold ml-[1px] shrink-0"
            >
              {anim.cursorChar || '|'}
            </span>
          )}
        </div>
      )}

      {value.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (onClear) onClear();
            else onChange('');
          }}
          aria-label="Clear search"
          className={`absolute top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${clearButtonClassName}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
