# Public Site Deploy Audit

This audit prepares the generated `site/` folder for public HTTPS hosting. It does not replace hosting; it verifies that the local deploy package is complete and lists the exact URL checks needed before App Store submission.

## Summary

- Risk: PASS
- Local deploy package ready: Yes
- External hosting ready: Yes
- External hosting pending: No
- Hosting control files ready: Yes
- GitHub Pages workflow ready: Yes
- Sitemap ready: Yes
- Sitemap required now: Yes
- Routes: 44
- Locales: 10
- Missing files: 0
- Missing control files: 0

## URL State

| URL | Value | Status |
| --- | --- | --- |
| Base URL | https://johnshinsei.github.io/kana-sprint-site | Ready |
| Marketing URL | https://johnshinsei.github.io/kana-sprint-site | Ready |
| Support URL | https://johnshinsei.github.io/kana-sprint-site/support | Ready |
| Privacy URL | https://johnshinsei.github.io/kana-sprint-site/privacy | Ready |
| Open source notices URL | https://johnshinsei.github.io/kana-sprint-site/licenses | Ready |

## Deployment Checks

| Check | Status | Action | Evidence |
| --- | --- | --- | --- |
| site-folder | READY | Host the entire site/ folder as the web root. | The deploy root must preserve nested support/privacy/license routes. |
| hosting-control-files | READY | Upload robots.txt, _headers, and _redirects with the site root. | These files are generated beside index.html. |
| github-pages-workflow | READY | Use the GitHub Pages workflow to publish site/ when this repo is hosted on GitHub. | The workflow uploads site/ with the official Pages artifact and deploy actions. |
| sitemap | READY | Set APP_STORE_BASE_URL and rerun the site commands to generate sitemap.xml. | The sitemap is generated only for a production HTTPS base URL. |
| https | READY | Use a production HTTPS origin, not localhost, .test, .local, .example, or example.com. | App Store support and privacy URLs must be public. |
| support-url | READY | Confirm the Support URL opens without auth. | Use APP_STORE_BASE_URL or APP_STORE_SUPPORT_URL. |
| privacy-url | READY | Confirm the Privacy Policy URL opens without auth. | Use APP_STORE_BASE_URL or APP_STORE_PRIVACY_URL. |
| localized-routes | READY | Confirm localized /<locale>/support/, /<locale>/privacy/, and /<locale>/licenses/ routes are served. | Settings uses localized links when APP_STORE_BASE_URL is set. |
| metadata-sync | READY | Rerun metadata preview after setting production URLs. | store.config.js injects the same URL state into EAS Metadata. |

## Hosting Control Files

| File | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `site/robots.txt` | Ready | 23 | 16ceb5ee3e0dc13aa9adf31a3ebbe45a1d965b8c2b9f72eaf84e5911e140ed95 |
| `site/_headers` | Ready | 228 | 64c606f32d8c9c0a308846483f3ee5c1586646f539c80ef3dafabdd21a35b6de |
| `site/_redirects` | Ready | 1057 | 942573909cdd8cc7a6704f355b5366ec30d37e98767887e352fa2c9aca8fe84f |

## Deployment Workflow

- File: `.github/workflows/deploy-site.yml`
- Ready: Yes
- Bytes: 996
- SHA-256: 62cf5f8d846dea521c6491f9e6bb93bfcc2f7cf26aabbcdd79db4f26803c71b9

Sitemap: `site/sitemap.xml`, ready, 44/44 URLs.

## Route Sample

| Locale | Kind | Route | File | Hosted URL |
| --- | --- | --- | --- | --- |
| en | landing | `/` | `site/index.html` | https://johnshinsei.github.io/kana-sprint-site |
| en | support | `/support/` | `site/support/index.html` | https://johnshinsei.github.io/kana-sprint-site/support/ |
| en | privacy | `/privacy/` | `site/privacy/index.html` | https://johnshinsei.github.io/kana-sprint-site/privacy/ |
| en | licenses | `/licenses/` | `site/licenses/index.html` | https://johnshinsei.github.io/kana-sprint-site/licenses/ |
| zh-Hans | landing | `/zh-Hans/` | `site/zh-Hans/index.html` | https://johnshinsei.github.io/kana-sprint-site/zh-Hans/ |
| zh-Hans | support | `/zh-Hans/support/` | `site/zh-Hans/support/index.html` | https://johnshinsei.github.io/kana-sprint-site/zh-Hans/support/ |
| zh-Hans | privacy | `/zh-Hans/privacy/` | `site/zh-Hans/privacy/index.html` | https://johnshinsei.github.io/kana-sprint-site/zh-Hans/privacy/ |
| zh-Hans | licenses | `/zh-Hans/licenses/` | `site/zh-Hans/licenses/index.html` | https://johnshinsei.github.io/kana-sprint-site/zh-Hans/licenses/ |
| zh-Hant | landing | `/zh-Hant/` | `site/zh-Hant/index.html` | https://johnshinsei.github.io/kana-sprint-site/zh-Hant/ |
| zh-Hant | support | `/zh-Hant/support/` | `site/zh-Hant/support/index.html` | https://johnshinsei.github.io/kana-sprint-site/zh-Hant/support/ |
| zh-Hant | privacy | `/zh-Hant/privacy/` | `site/zh-Hant/privacy/index.html` | https://johnshinsei.github.io/kana-sprint-site/zh-Hant/privacy/ |
| zh-Hant | licenses | `/zh-Hant/licenses/` | `site/zh-Hant/licenses/index.html` | https://johnshinsei.github.io/kana-sprint-site/zh-Hant/licenses/ |
| en | landing | `/en/` | `site/en/index.html` | https://johnshinsei.github.io/kana-sprint-site/en/ |
| en | support | `/en/support/` | `site/en/support/index.html` | https://johnshinsei.github.io/kana-sprint-site/en/support/ |
| en | privacy | `/en/privacy/` | `site/en/privacy/index.html` | https://johnshinsei.github.io/kana-sprint-site/en/privacy/ |
| en | licenses | `/en/licenses/` | `site/en/licenses/index.html` | https://johnshinsei.github.io/kana-sprint-site/en/licenses/ |
| fr | landing | `/fr/` | `site/fr/index.html` | https://johnshinsei.github.io/kana-sprint-site/fr/ |
| fr | support | `/fr/support/` | `site/fr/support/index.html` | https://johnshinsei.github.io/kana-sprint-site/fr/support/ |
| fr | privacy | `/fr/privacy/` | `site/fr/privacy/index.html` | https://johnshinsei.github.io/kana-sprint-site/fr/privacy/ |
| fr | licenses | `/fr/licenses/` | `site/fr/licenses/index.html` | https://johnshinsei.github.io/kana-sprint-site/fr/licenses/ |

The full route inventory is in `docs/public-site-deploy-audit.json`.

## Commands

- `npm run site:localized`
- `npm run site:manifest`
- `npm run site:deploy-audit`
- `npm run site:verify-hosting`
- `GitHub Actions: Deploy public site`
- `npm run metadata:preview`
- `npm run release:status`
- `npm run release:store-ready`
