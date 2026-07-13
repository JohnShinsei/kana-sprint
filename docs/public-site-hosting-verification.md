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
| page-root | PASS | 200 | 4658 | 267 | ok |
| page-support | PASS | 200 | 4733 | 190 | ok |
| page-privacy | PASS | 200 | 5383 | 185 | ok |
| page-licenses | PASS | 200 | 8242 | 184 | ok |
| page-zh-Hans | PASS | 200 | 4589 | 172 | ok |
| page-zh-Hans-support | PASS | 200 | 4614 | 185 | ok |
| page-zh-Hans-privacy | PASS | 200 | 5104 | 194 | ok |
| page-zh-Hans-licenses | PASS | 200 | 8195 | 189 | ok |
| page-zh-Hant | PASS | 200 | 4589 | 191 | ok |
| page-zh-Hant-support | PASS | 200 | 4614 | 179 | ok |
| page-zh-Hant-privacy | PASS | 200 | 5116 | 180 | ok |
| page-zh-Hant-licenses | PASS | 200 | 8201 | 190 | ok |
| page-en | PASS | 200 | 4658 | 177 | ok |
| page-en-support | PASS | 200 | 4733 | 181 | ok |
| page-en-privacy | PASS | 200 | 5383 | 183 | ok |
| page-en-licenses | PASS | 200 | 8242 | 173 | ok |
| page-fr | PASS | 200 | 4686 | 180 | ok |
| page-fr-support | PASS | 200 | 4968 | 178 | ok |
| page-fr-privacy | PASS | 200 | 5737 | 181 | ok |
| page-fr-licenses | PASS | 200 | 8243 | 225 | ok |
| page-it | PASS | 200 | 4660 | 194 | ok |
| page-it-support | PASS | 200 | 4847 | 180 | ok |
| page-it-privacy | PASS | 200 | 5503 | 181 | ok |
| page-it-licenses | PASS | 200 | 8236 | 177 | ok |
| page-de | PASS | 200 | 4667 | 185 | ok |
| page-de-support | PASS | 200 | 4838 | 185 | ok |
| page-de-privacy | PASS | 200 | 5487 | 179 | ok |
| page-de-licenses | PASS | 200 | 8236 | 181 | ok |
| page-es-ES | PASS | 200 | 4675 | 180 | ok |
| page-es-ES-support | PASS | 200 | 4917 | 177 | ok |
| page-es-ES-privacy | PASS | 200 | 5533 | 176 | ok |
| page-es-ES-licenses | PASS | 200 | 8251 | 190 | ok |
| page-ko | PASS | 200 | 4746 | 189 | ok |
| page-ko-support | PASS | 200 | 4903 | 177 | ok |
| page-ko-privacy | PASS | 200 | 5611 | 178 | ok |
| page-ko-licenses | PASS | 200 | 8252 | 178 | ok |
| page-pl | PASS | 200 | 4670 | 190 | ok |
| page-pl-support | PASS | 200 | 4851 | 189 | ok |
| page-pl-privacy | PASS | 200 | 5455 | 179 | ok |
| page-pl-licenses | PASS | 200 | 8241 | 178 | ok |
| page-pt-BR | PASS | 200 | 4679 | 183 | ok |
| page-pt-BR-support | PASS | 200 | 4879 | 180 | ok |
| page-pt-BR-privacy | PASS | 200 | 5524 | 189 | ok |
| page-pt-BR-licenses | PASS | 200 | 8252 | 176 | ok |
| sitemap | PASS | 200 | 3736 | 176 | ok |

## Commands

- `npm run site:localized`
- `npm run site:manifest`
- `npm run site:deploy-audit`
- `npm run site:verify-hosting`
- `npm run release:store-ready`
