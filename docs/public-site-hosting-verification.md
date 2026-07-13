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
| page-root | PASS | 200 | 4658 | 99 | ok |
| page-support | PASS | 200 | 4733 | 11 | ok |
| page-privacy | PASS | 200 | 5383 | 9 | ok |
| page-licenses | PASS | 200 | 8242 | 10 | ok |
| page-zh-Hans | PASS | 200 | 4589 | 10 | ok |
| page-zh-Hans-support | PASS | 200 | 4614 | 27 | ok |
| page-zh-Hans-privacy | PASS | 200 | 5104 | 10 | ok |
| page-zh-Hans-licenses | PASS | 200 | 8195 | 12 | ok |
| page-zh-Hant | PASS | 200 | 4589 | 13 | ok |
| page-zh-Hant-support | PASS | 200 | 4614 | 10 | ok |
| page-zh-Hant-privacy | PASS | 200 | 5116 | 9 | ok |
| page-zh-Hant-licenses | PASS | 200 | 8201 | 10 | ok |
| page-en | PASS | 200 | 4658 | 8 | ok |
| page-en-support | PASS | 200 | 4733 | 10 | ok |
| page-en-privacy | PASS | 200 | 5383 | 11 | ok |
| page-en-licenses | PASS | 200 | 8242 | 9 | ok |
| page-fr | PASS | 200 | 4686 | 8 | ok |
| page-fr-support | PASS | 200 | 4968 | 9 | ok |
| page-fr-privacy | PASS | 200 | 5737 | 11 | ok |
| page-fr-licenses | PASS | 200 | 8243 | 9 | ok |
| page-it | PASS | 200 | 4660 | 9 | ok |
| page-it-support | PASS | 200 | 4847 | 13 | ok |
| page-it-privacy | PASS | 200 | 5503 | 8 | ok |
| page-it-licenses | PASS | 200 | 8236 | 9 | ok |
| page-de | PASS | 200 | 4667 | 8 | ok |
| page-de-support | PASS | 200 | 4838 | 11 | ok |
| page-de-privacy | PASS | 200 | 5487 | 9 | ok |
| page-de-licenses | PASS | 200 | 8236 | 9 | ok |
| page-es-ES | PASS | 200 | 4675 | 9 | ok |
| page-es-ES-support | PASS | 200 | 4917 | 8 | ok |
| page-es-ES-privacy | PASS | 200 | 5533 | 12 | ok |
| page-es-ES-licenses | PASS | 200 | 8251 | 9 | ok |
| page-ko | PASS | 200 | 4746 | 14 | ok |
| page-ko-support | PASS | 200 | 4903 | 8 | ok |
| page-ko-privacy | PASS | 200 | 5611 | 9 | ok |
| page-ko-licenses | PASS | 200 | 8252 | 9 | ok |
| page-pl | PASS | 200 | 4670 | 10 | ok |
| page-pl-support | PASS | 200 | 4851 | 9 | ok |
| page-pl-privacy | PASS | 200 | 5455 | 8 | ok |
| page-pl-licenses | PASS | 200 | 8241 | 9 | ok |
| page-pt-BR | PASS | 200 | 4679 | 9 | ok |
| page-pt-BR-support | PASS | 200 | 4879 | 10 | ok |
| page-pt-BR-privacy | PASS | 200 | 5524 | 9 | ok |
| page-pt-BR-licenses | PASS | 200 | 8252 | 9 | ok |
| sitemap | PASS | 200 | 3736 | 9 | ok |

## Commands

- `npm run site:localized`
- `npm run site:manifest`
- `npm run site:deploy-audit`
- `npm run site:verify-hosting`
- `npm run release:store-ready`
