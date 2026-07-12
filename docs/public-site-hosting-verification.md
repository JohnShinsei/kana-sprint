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
| page-root | PASS | 200 | 4666 | 280 | ok |
| page-support | PASS | 200 | 4741 | 180 | ok |
| page-privacy | PASS | 200 | 5391 | 176 | ok |
| page-licenses | PASS | 200 | 7919 | 194 | ok |
| page-zh-Hans | PASS | 200 | 4597 | 178 | ok |
| page-zh-Hans-support | PASS | 200 | 4622 | 179 | ok |
| page-zh-Hans-privacy | PASS | 200 | 5112 | 182 | ok |
| page-zh-Hans-licenses | PASS | 200 | 7872 | 181 | ok |
| page-zh-Hant | PASS | 200 | 4597 | 180 | ok |
| page-zh-Hant-support | PASS | 200 | 4622 | 176 | ok |
| page-zh-Hant-privacy | PASS | 200 | 5124 | 175 | ok |
| page-zh-Hant-licenses | PASS | 200 | 7878 | 178 | ok |
| page-en | PASS | 200 | 4666 | 177 | ok |
| page-en-support | PASS | 200 | 4741 | 170 | ok |
| page-en-privacy | PASS | 200 | 5391 | 179 | ok |
| page-en-licenses | PASS | 200 | 7919 | 175 | ok |
| page-fr | PASS | 200 | 4694 | 175 | ok |
| page-fr-support | PASS | 200 | 4976 | 175 | ok |
| page-fr-privacy | PASS | 200 | 5745 | 178 | ok |
| page-fr-licenses | PASS | 200 | 7920 | 180 | ok |
| page-it | PASS | 200 | 4668 | 181 | ok |
| page-it-support | PASS | 200 | 4855 | 176 | ok |
| page-it-privacy | PASS | 200 | 5511 | 176 | ok |
| page-it-licenses | PASS | 200 | 7913 | 174 | ok |
| page-de | PASS | 200 | 4675 | 176 | ok |
| page-de-support | PASS | 200 | 4846 | 192 | ok |
| page-de-privacy | PASS | 200 | 5495 | 179 | ok |
| page-de-licenses | PASS | 200 | 7913 | 174 | ok |
| page-es-ES | PASS | 200 | 4683 | 180 | ok |
| page-es-ES-support | PASS | 200 | 4925 | 177 | ok |
| page-es-ES-privacy | PASS | 200 | 5541 | 174 | ok |
| page-es-ES-licenses | PASS | 200 | 7928 | 188 | ok |
| page-ko | PASS | 200 | 4754 | 177 | ok |
| page-ko-support | PASS | 200 | 4911 | 175 | ok |
| page-ko-privacy | PASS | 200 | 5619 | 173 | ok |
| page-ko-licenses | PASS | 200 | 7929 | 175 | ok |
| page-pl | PASS | 200 | 4678 | 182 | ok |
| page-pl-support | PASS | 200 | 4859 | 196 | ok |
| page-pl-privacy | PASS | 200 | 5463 | 179 | ok |
| page-pl-licenses | PASS | 200 | 7918 | 177 | ok |
| page-pt-BR | PASS | 200 | 4687 | 178 | ok |
| page-pt-BR-support | PASS | 200 | 4887 | 176 | ok |
| page-pt-BR-privacy | PASS | 200 | 5532 | 175 | ok |
| page-pt-BR-licenses | PASS | 200 | 7929 | 174 | ok |
| sitemap | PASS | 200 | 3736 | 176 | ok |

## Commands

- `npm run site:localized`
- `npm run site:manifest`
- `npm run site:deploy-audit`
- `npm run site:verify-hosting`
- `npm run release:store-ready`
