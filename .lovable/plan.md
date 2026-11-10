# New visual identity: yellow and black, official logo

## What changes
1. **Logo and icon**
   - Take the yellow mark from `m2.jpg` and use it as the browser tab icon, the app icon (512px) and the Apple icon.
   - Use the full logo (`Gemini_Generated_Image_gnb0vsgnb0vsgnb0.jpg`) in the site header in place of the current logo.
   - Replace "formerly GEO-Iraq" with **GEO AGENCY** everywhere: the header, the footer text, printed reports and exported files.
2. **Colors**
   - Main and accent color: golden yellow (#F5B800 / #FAB818), used for buttons, badges and glow effects.
   - Dark mode backgrounds: carbon black (#0A0A0C / #121214).
   - Text on yellow buttons turns black so it stays easy to read.
   - The blue in printed reports and Excel headers changes to the new colors.
3. **Share image**: build a new social preview image from the full logo on black.

## What stays the same
- The landing page text, sections and layout. Only the shared colors and the logo change on it, because they apply across the whole site.
- Tool logic, charging, the ten engines and the database.
- The live site is not published until you approve.

## Checks
- Screenshots of the home page, dashboard and a tool page in light and dark mode to confirm contrast.
- Tests and build pass.

## Technical details
- Tokens in `src/styles.css` (`--primary`, `--accent`, `--ring`, glow/gradient vars, `.dark` backgrounds) converted to oklch.
- Favicon: `magick` to resize to `public/favicon.png` (64px), `public/icon-512.png` and `public/apple-touch-icon.png`; update `__root.tsx` links and remove `favicon.ico` if present.
- Logos copied into `src/assets/` (they replace `maaroof-ai-logo.png` / `maaroof-ai-mark.png` imports); `public/og-maaroof.png` regenerated at 1200x630.
- Text replacements: `SiteHeader.tsx:56`, `PrintAnalysisButton.tsx` (and its `#1e40af` / `#0f2454` colors), `i18n/en.ts` footer (plus ar/ku equivalents), `lib/exports.ts` `PREVIOUS_BRAND`.
- Save the brand colors and the "GEO AGENCY" tagline to project memory.
