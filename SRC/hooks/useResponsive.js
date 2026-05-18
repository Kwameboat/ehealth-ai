import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const SIDEBAR_WIDTH = 280;

/**
 * Breakpoints:
 * - small phone: width < 380
 * - phone: width < 600
 * - tablet: 600–899
 * - desktop: >= 900
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isSmallPhone = width < 380;
    const isPhone = width < 600;
    const isTablet = width >= 600 && width < 900;
    const isDesktop = width >= 900;

    const horizontalPadding = isSmallPhone ? 14 : isPhone ? 16 : 20;

    return {
      width,
      height,
      isSmallPhone,
      isPhone,
      isTablet,
      isDesktop,
      isWide: isDesktop,
      horizontalPadding,
      showSidebar: isDesktop,
      sidebarWidth: SIDEBAR_WIDTH,
      contentMaxWidth: isDesktop
        ? Math.min(960, width - SIDEBAR_WIDTH - 40)
        : isTablet
          ? Math.min(720, width - 40)
          : width,
      quickCardWidth: isDesktop
        ? 220
        : isTablet
          ? (width - horizontalPadding * 2 - 12) / 2
          : Math.min(width * 0.78, 300),
      useQuickGrid: isTablet,
      heroTitleSize: isSmallPhone ? 24 : isPhone ? 28 : isTablet ? 32 : 36,
      heroLineHeight: isSmallPhone ? 30 : isPhone ? 36 : isTablet ? 40 : 44,
      heroSubSize: isSmallPhone ? 14 : 15,
      messageMaxWidth: isDesktop ? 560 : isTablet ? 500 : width * 0.9,
      showBottomNav: !isDesktop,
      showOnlinePill: isTablet || isDesktop,
    };
  }, [width, height]);
}
