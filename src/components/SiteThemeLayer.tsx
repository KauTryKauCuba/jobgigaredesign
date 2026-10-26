import { getAuthUser } from "@/lib/auth-user";
import { bannerDismissCookie, bannerVersion, resolveSiteTheme } from "@/lib/site-themes";
import { cssVarsToText, effectPalette, themeCssVars, type ThemeAudience } from "@/lib/site-themes-shared";
import { isSuperadminEmail } from "@/lib/superadmin";
import SiteThemeBanner from "./SiteThemeBanner";
import SiteThemeEffects from "./SiteThemeEffects";
import SiteThemePreviewBar from "./SiteThemePreviewBar";

/**
 * One side's live theme (or a superadmin's preview): overrides the brand
 * colour variables for the whole document, and adds the banner above the
 * navbar and the effect. Renders nothing at all with no theme on, so the
 * page is exactly the default design.
 */
export default async function SiteThemeLayer({ audience }: { audience: ThemeAudience }) {
  const resolved = await resolveSiteTheme(audience, async () => isSuperadminEmail((await getAuthUser())?.email));
  if (!resolved) return null;
  const { theme, preview, bannerDismissed } = resolved;
  const showBanner = theme.banner.enabled && !!theme.banner.text && !bannerDismissed;

  return (
    <>
      {/* Every value is a checked #RRGGBB colour (see themeCssVars), so this is safe to inline. */}
      <style
        dangerouslySetInnerHTML={{ __html: `:root{${cssVarsToText(themeCssVars(audience, theme.colors))}}` }}
      />
      {preview && <SiteThemePreviewBar name={theme.name} live={theme.isActive} />}
      {showBanner && (
        <SiteThemeBanner
          // Remount (re-open) when the superadmin changes the theme.
          key={bannerVersion(theme)}
          banner={theme.banner}
          cookieName={bannerDismissCookie(audience)}
          // A preview's dismiss just hides it for this page view.
          version={preview ? null : bannerVersion(theme)}
        />
      )}
      <SiteThemeEffects
        effect={theme.effect}
        scope={theme.effectScope}
        audience={audience}
        palette={effectPalette(theme.colors)}
        main={theme.colors.main}
      />
    </>
  );
}
