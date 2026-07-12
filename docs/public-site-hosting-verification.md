# Public Site Hosting Verification

This verification performs live HTTPS requests after the public support/privacy site has been hosted. Without production URLs it records a pending state and stays non-blocking for local release verification.

## Summary

- Status: PASS
- Ready: Yes
- URL configuration ready: Yes
- Production base URL: Yes
- Checked URLs: 45
- Passed URLs: 45
- Failed URLs: 0
- Expected page routes: 44
- Expected locales: 10
- Timeout: 8000ms

## URL State

| URL | Value | Status |
| --- | --- | --- |
| Base URL | https://johnshinsei.github.io/kana-sprint-site | Ready |
| Support URL | https://johnshinsei.github.io/kana-sprint-site/support | Ready |
| Privacy URL | https://johnshinsei.github.io/kana-sprint-site/privacy | Ready |
| Marketing URL | https://johnshinsei.github.io/kana-sprint-site | Ready |

## Results

| Endpoint | Result | HTTP | Bytes | Duration ms | Detail |
| --- | --- | ---: | ---: | ---: | --- |
| page-root | PASS | 200 | 4666 | 83 | ok |
| page-support | PASS | 200 | 4741 | 11 | ok |
| page-privacy | PASS | 200 | 5391 | 10 | ok |
| page-licenses | PASS | 200 | 7919 | 12 | ok |
| page-zh-Hans | PASS | 200 | 4597 | 11 | ok |
| page-zh-Hans-support | PASS | 200 | 4622 | 13 | ok |
| page-zh-Hans-privacy | PASS | 200 | 5112 | 8 | ok |
| page-zh-Hans-licenses | PASS | 200 | 7872 | 10 | ok |
| page-zh-Hant | PASS | 200 | 4597 | 11 | ok |
| page-zh-Hant-support | PASS | 200 | 4622 | 10 | ok |
| page-zh-Hant-privacy | PASS | 200 | 5124 | 11 | ok |
| page-zh-Hant-licenses | PASS | 200 | 7878 | 10 | ok |
| page-en | PASS | 200 | 4666 | 16 | ok |
| page-en-support | PASS | 200 | 4741 | 9 | ok |
| page-en-privacy | PASS | 200 | 5391 | 9 | ok |
| page-en-licenses | PASS | 200 | 7919 | 9 | ok |
| page-fr | PASS | 200 | 4694 | 9 | ok |
| page-fr-support | PASS | 200 | 4976 | 10 | ok |
| page-fr-privacy | PASS | 200 | 5745 | 9 | ok |
| page-fr-licenses | PASS | 200 | 7920 | 8 | ok |
| page-it | PASS | 200 | 4668 | 10 | ok |
| page-it-support | PASS | 200 | 4855 | 9 | ok |
| page-it-privacy | PASS | 200 | 5511 | 9 | ok |
| page-it-licenses | PASS | 200 | 7913 | 9 | ok |
| page-de | PASS | 200 | 4675 | 9 | ok |
| page-de-support | PASS | 200 | 4846 | 9 | ok |
| page-de-privacy | PASS | 200 | 5495 | 9 | ok |
| page-de-licenses | PASS | 200 | 7913 | 10 | ok |
| page-es-ES | PASS | 200 | 4683 | 11 | ok |
| page-es-ES-support | PASS | 200 | 4925 | 10 | ok |
| page-es-ES-privacy | PASS | 200 | 5541 | 8 | ok |
| page-es-ES-licenses | PASS | 200 | 7928 | 9 | ok |
| page-ko | PASS | 200 | 4754 | 9 | ok |
| page-ko-support | PASS | 200 | 4911 | 19 | ok |
| page-ko-privacy | PASS | 200 | 5619 | 9 | ok |
| page-ko-licenses | PASS | 200 | 7929 | 8 | ok |
| page-pl | PASS | 200 | 4678 | 9 | ok |
| page-pl-support | PASS | 200 | 4859 | 8 | ok |
| page-pl-privacy | PASS | 200 | 5463 | 8 | ok |
| page-pl-licenses | PASS | 200 | 7918 | 9 | ok |
| page-pt-BR | PASS | 200 | 4687 | 8 | ok |
| page-pt-BR-support | PASS | 200 | 4887 | 9 | ok |
| page-pt-BR-privacy | PASS | 200 | 5532 | 9 | ok |
| page-pt-BR-licenses | PASS | 200 | 7929 | 8 | ok |
| sitemap | PASS | 200 | 3736 | 8 | ok |

## Commands

- `npm run site:localized`
- `npm run site:manifest`
- `npm run site:deploy-audit`
- `npm run site:verify-hosting`
- `npm run release:store-ready`
