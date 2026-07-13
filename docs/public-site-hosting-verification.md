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
| page-root | PASS | 200 | 4666 | 328 | ok |
| page-support | PASS | 200 | 4741 | 194 | ok |
| page-privacy | PASS | 200 | 5391 | 214 | ok |
| page-licenses | PASS | 200 | 7919 | 183 | ok |
| page-zh-Hans | PASS | 200 | 4597 | 177 | ok |
| page-zh-Hans-support | PASS | 200 | 4622 | 193 | ok |
| page-zh-Hans-privacy | PASS | 200 | 5112 | 185 | ok |
| page-zh-Hans-licenses | PASS | 200 | 7872 | 193 | ok |
| page-zh-Hant | PASS | 200 | 4597 | 190 | ok |
| page-zh-Hant-support | PASS | 200 | 4622 | 190 | ok |
| page-zh-Hant-privacy | PASS | 200 | 5124 | 186 | ok |
| page-zh-Hant-licenses | PASS | 200 | 7878 | 192 | ok |
| page-en | PASS | 200 | 4666 | 191 | ok |
| page-en-support | PASS | 200 | 4741 | 191 | ok |
| page-en-privacy | PASS | 200 | 5391 | 186 | ok |
| page-en-licenses | PASS | 200 | 7919 | 196 | ok |
| page-fr | PASS | 200 | 4694 | 186 | ok |
| page-fr-support | PASS | 200 | 4976 | 197 | ok |
| page-fr-privacy | PASS | 200 | 5745 | 184 | ok |
| page-fr-licenses | PASS | 200 | 7920 | 189 | ok |
| page-it | PASS | 200 | 4668 | 207 | ok |
| page-it-support | PASS | 200 | 4855 | 196 | ok |
| page-it-privacy | PASS | 200 | 5511 | 178 | ok |
| page-it-licenses | PASS | 200 | 7913 | 193 | ok |
| page-de | PASS | 200 | 4675 | 228 | ok |
| page-de-support | PASS | 200 | 4846 | 210 | ok |
| page-de-privacy | PASS | 200 | 5495 | 499 | ok |
| page-de-licenses | PASS | 200 | 7913 | 192 | ok |
| page-es-ES | PASS | 200 | 4683 | 188 | ok |
| page-es-ES-support | PASS | 200 | 4925 | 217 | ok |
| page-es-ES-privacy | PASS | 200 | 5541 | 268 | ok |
| page-es-ES-licenses | PASS | 200 | 7928 | 181 | ok |
| page-ko | PASS | 200 | 4754 | 211 | ok |
| page-ko-support | PASS | 200 | 4911 | 183 | ok |
| page-ko-privacy | PASS | 200 | 5619 | 191 | ok |
| page-ko-licenses | PASS | 200 | 7929 | 179 | ok |
| page-pl | PASS | 200 | 4678 | 190 | ok |
| page-pl-support | PASS | 200 | 4859 | 186 | ok |
| page-pl-privacy | PASS | 200 | 5463 | 184 | ok |
| page-pl-licenses | PASS | 200 | 7918 | 181 | ok |
| page-pt-BR | PASS | 200 | 4687 | 176 | ok |
| page-pt-BR-support | PASS | 200 | 4887 | 178 | ok |
| page-pt-BR-privacy | PASS | 200 | 5532 | 212 | ok |
| page-pt-BR-licenses | PASS | 200 | 7929 | 184 | ok |
| sitemap | PASS | 200 | 3736 | 183 | ok |

## Commands

- `npm run site:localized`
- `npm run site:manifest`
- `npm run site:deploy-audit`
- `npm run site:verify-hosting`
- `npm run release:store-ready`
