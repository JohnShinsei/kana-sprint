# Public Site Hosting Handoff

Use this handoff to publish the generated support, privacy, license, and localized public pages before App Store metadata submission.

## Summary

- Risk: PASS
- Local deploy package ready: Yes
- External hosting verified: Yes
- External hosting pending: No
- URL configuration ready: Yes
- GitHub Pages workflow ready: Yes
- Hosting control files ready: Yes
- Hosting verification status: PASS
- Hosting verification checks: 45/45
- Routes: 44
- Locales: 10

## What To Publish

- Deploy root: `site`
- Deploy as web root: Yes
- Page count: 44
- Control files: `site/robots.txt`, `site/_headers`, `site/_redirects`
- GitHub Pages workflow: `.github/workflows/deploy-site.yml`

## URL Plan

| URL | Value | Status |
| --- | --- | --- |
| Base URL | https://johnshinsei.github.io/kana-sprint-site | Ready |
| Support URL | https://johnshinsei.github.io/kana-sprint-site/support | Ready |
| Privacy URL | https://johnshinsei.github.io/kana-sprint-site/privacy | Ready |
| Marketing URL | https://johnshinsei.github.io/kana-sprint-site | Ready |
| Open source notices URL | https://johnshinsei.github.io/kana-sprint-site/licenses | Ready |

## Hosting Options

| Option | Local readiness | Steps |
| --- | --- | --- |
| GitHub Pages | Ready | Commit the repository with the generated site/ folder and .github/workflows/deploy-site.yml. In GitHub repository settings, enable Pages with GitHub Actions as the source. Run the Deploy public site workflow manually, or let it run after pushing to main. Use the deployed HTTPS origin as APP_STORE_BASE_URL. |
| Netlify static deploy | Ready | Drag and drop the site/ folder, or configure the project publish directory as site. Do not add a build command; the generated site/ folder is already the deploy root. Preserve nested locale routes and the generated _headers file. Use the production HTTPS site URL as APP_STORE_BASE_URL. |
| Cloudflare Pages | Ready | Create a Pages project with the repository or direct upload flow. Set the output directory to site and leave the build command empty unless your provider requires one. Preserve robots.txt, _headers, _redirects, and every locale subdirectory. Use the production HTTPS Pages URL as APP_STORE_BASE_URL. |
| Any static HTTPS host | Ready | Upload the full site/ directory as the web root, not as a nested /site path. Confirm /support/, /privacy/, /licenses/, and locale routes such as /zh-Hans/privacy/ resolve without auth. If the host ignores _redirects, configure trailing-slash redirects for support, privacy, licenses, and locale routes. Use APP_STORE_BASE_URL when every generated route is hosted under one origin; otherwise set explicit support and privacy URLs. |

## Environment Values

| Key | Value or hint | Status | Note |
| --- | --- | --- | --- |
| `APP_STORE_BASE_URL` | https://johnshinsei.github.io/kana-sprint-site | Ready | Preferred. Enables localized support/privacy/license links and sitemap generation. |
| `APP_STORE_SUPPORT_URL` | <production HTTPS support URL> | Pending | Only needed if support is not APP_STORE_BASE_URL/support. |
| `APP_STORE_PRIVACY_URL` | <production HTTPS privacy URL> | Pending | Only needed if privacy is not APP_STORE_BASE_URL/privacy. |
| `APP_STORE_MARKETING_URL` | <production HTTPS marketing URL> | Ready | Optional App Store marketing URL. APP_STORE_BASE_URL can fill it. |

EAS production env commands:

- `eas env:create --name APP_STORE_BASE_URL --environment production --visibility plaintext`
- `eas env:create --name APP_STORE_SUPPORT_URL --environment production --visibility plaintext`
- `eas env:create --name APP_STORE_PRIVACY_URL --environment production --visibility plaintext`

## Route Sample

| Locale | Kind | Route | File |
| --- | --- | --- | --- |
| en | landing | `/` | `site/index.html` |
| en | support | `/support/` | `site/support/index.html` |
| en | privacy | `/privacy/` | `site/privacy/index.html` |
| en | licenses | `/licenses/` | `site/licenses/index.html` |
| zh-Hans | landing | `/zh-Hans/` | `site/zh-Hans/index.html` |
| zh-Hans | support | `/zh-Hans/support/` | `site/zh-Hans/support/index.html` |
| zh-Hans | privacy | `/zh-Hans/privacy/` | `site/zh-Hans/privacy/index.html` |
| zh-Hans | licenses | `/zh-Hans/licenses/` | `site/zh-Hans/licenses/index.html` |
| zh-Hant | landing | `/zh-Hant/` | `site/zh-Hant/index.html` |
| zh-Hant | support | `/zh-Hant/support/` | `site/zh-Hant/support/index.html` |
| zh-Hant | privacy | `/zh-Hant/privacy/` | `site/zh-Hant/privacy/index.html` |
| zh-Hant | licenses | `/zh-Hant/licenses/` | `site/zh-Hant/licenses/index.html` |
| en | landing | `/en/` | `site/en/index.html` |
| en | support | `/en/support/` | `site/en/support/index.html` |
| en | privacy | `/en/privacy/` | `site/en/privacy/index.html` |
| en | licenses | `/en/licenses/` | `site/en/licenses/index.html` |

## Verification Order

1. npm run site:localized
1. npm run site:manifest
1. npm run site:deploy-audit
1. npm run site:hosting-handoff
1. Host the site/ directory on the selected provider
1. Set APP_STORE_BASE_URL or explicit APP_STORE_SUPPORT_URL and APP_STORE_PRIVACY_URL
1. npm run site:verify-hosting
1. npm run metadata:preview
1. npm run release:status
1. npm run release:store-ready
