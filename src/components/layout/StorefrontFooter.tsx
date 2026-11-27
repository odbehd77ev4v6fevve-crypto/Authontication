import { useEffect, useState } from 'react';
import {
  DEFAULT_FOOTER_CONFIG,
  normalizeFooterConfig,
  type FooterConfigPayload,
  type StorePaymentMethodFlag,
} from '../../../shared/footerHelpers.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { openAdminAuthModal } from '../../features/auth/authSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { StoreSettings } from '../../types/domain.ts';
import { FooterRenderer } from './FooterRenderer.tsx';

interface PublicFooterResponse {
  enabled: boolean;
  footer: FooterConfigPayload | null;
  enabledPaymentChannels?: StorePaymentMethodFlag[];
}

export function StorefrontFooter({ storeSettings }: { storeSettings?: StoreSettings | null }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [publicFooterData, setPublicFooterData] = useState<PublicFooterResponse | null>(null);
  const [loadedFromApi, setLoadedFromApi] = useState(false);

  useEffect(() => {
    let active = true;
    const loadFooter = () => {
      apiRequest<PublicFooterResponse>('/api/footer/public')
        .then((res) => {
          if (!active) return;
          setPublicFooterData(res);
          setLoadedFromApi(true);
        })
        .catch(() => {
          if (!active) return;
          // Graceful fallback to StoreSettings/DEFAULT_FOOTER_CONFIG if DB unavailable
          setLoadedFromApi(false);
        });
    };

    loadFooter();
    window.addEventListener('novara:cms-updated', loadFooter);
    return () => {
      active = false;
      window.removeEventListener('novara:cms-updated', loadFooter);
    };
  }, [Boolean(user)]);

  if (loadedFromApi && publicFooterData) {
    if (!publicFooterData.enabled || !publicFooterData.footer) {
      return null;
    }
    return (
      <FooterRenderer
        config={publicFooterData.footer}
        storePaymentMethods={
          publicFooterData.enabledPaymentChannels?.length
            ? publicFooterData.enabledPaymentChannels
            : storeSettings?.paymentMethods
        }
        isAuthenticated={Boolean(user)}
        onAdminAccessClick={() => dispatch(openAdminAuthModal({ returnTo: '/admin' }))}
      />
    );
  }

  // Fallback rendering when database or /api/footer/public is temporarily unavailable (503)
  const fallbackConfig = normalizeFooterConfig({
    ...DEFAULT_FOOTER_CONFIG,
    brand: {
      ...DEFAULT_FOOTER_CONFIG.brand,
      storeName: storeSettings?.storeName || DEFAULT_FOOTER_CONFIG.brand.storeName,
      tagline: storeSettings?.tagline || DEFAULT_FOOTER_CONFIG.brand.tagline,
      description:
        storeSettings?.footerSettings?.description || DEFAULT_FOOTER_CONFIG.brand.description,
      logoUrl: storeSettings?.footerSettings?.footerLogoUrl || '',
      contactEmail:
        storeSettings?.supportEmail || DEFAULT_FOOTER_CONFIG.brand.contactEmail,
      contactPhone:
        storeSettings?.supportPhone || DEFAULT_FOOTER_CONFIG.brand.contactPhone,
      businessAddress:
        storeSettings?.businessAddress || DEFAULT_FOOTER_CONFIG.brand.businessAddress,
    },
    payments: {
      ...DEFAULT_FOOTER_CONFIG.payments,
      enabled: storeSettings?.footerSettings?.showPaymentLogos ?? true,
    },
    bottomBar: {
      ...DEFAULT_FOOTER_CONFIG.bottomBar,
      companyName: storeSettings?.storeName || DEFAULT_FOOTER_CONFIG.bottomBar.companyName,
    },
  });

  return (
    <FooterRenderer
      config={fallbackConfig}
      storePaymentMethods={storeSettings?.paymentMethods}
      isAuthenticated={Boolean(user)}
      onAdminAccessClick={() => dispatch(openAdminAuthModal({ returnTo: '/admin' }))}
    />
  );
}
