# Open Source License Audit

Kana Sprint keeps a reproducible local dependency license audit before App Store submission.

This is an automated dependency and local-asset license screen, not legal advice.

## Summary

- Risk: PASS
- Local ready: Yes
- Lockfile version: 3
- Runtime packages: 515
- Total lockfile packages: 519
- Dev-only packages: 4
- Direct runtime dependencies: 18
- Distinct runtime licenses: 14
- Unknown runtime licenses: 0
- Prohibited runtime licenses: 0
- Runtime packages needing notice/review: 13
- Content rights risk: PASS
- Runtime assets: 6 PNG / 3 audio

## Runtime License Distribution

| License | Packages |
| --- | ---: |
| (BSD-3-Clause OR GPL-2.0) | 1 |
| (MIT OR Apache-2.0) | 1 |
| (MIT OR CC0-1.0) | 2 |
| 0BSD | 1 |
| Apache-2.0 | 13 |
| BlueOak-1.0.0 | 6 |
| BSD-2-Clause | 4 |
| BSD-3-Clause | 9 |
| CC-BY-4.0 | 1 |
| ISC | 29 |
| MIT | 433 |
| MPL-2.0 | 12 |
| Python-2.0 | 1 |
| Unlicense | 2 |

## Direct Runtime Dependencies

| Package | Version | License | Classification |
| --- | --- | --- | --- |
| @expo/metro-runtime | 56.0.16 | MIT | permissive |
| @react-native-async-storage/async-storage | 2.2.0 | MIT | permissive |
| expo | 56.0.15 | MIT | permissive |
| expo-asset | 56.0.19 | MIT | permissive |
| expo-audio | 56.0.12 | MIT | permissive |
| expo-build-properties | 56.0.22 | MIT | permissive |
| expo-constants | 56.0.20 | MIT | permissive |
| expo-haptics | 56.0.3 | MIT | permissive |
| expo-localization | 56.0.6 | MIT | permissive |
| expo-speech | 56.0.3 | MIT | permissive |
| expo-splash-screen | 56.0.12 | MIT | permissive |
| expo-status-bar | 56.0.4 | MIT | permissive |
| expo-system-ui | 56.0.5 | MIT | permissive |
| react | 19.2.3 | MIT | permissive |
| react-dom | 19.2.3 | MIT | permissive |
| react-native | 0.85.3 | MIT | permissive |
| react-native-google-mobile-ads | 16.3.4 | Apache-2.0 | permissive |
| react-native-web | 0.21.2 | MIT | permissive |

## Runtime Notice Or Review Packages

| Package | Version | License | Classification |
| --- | --- | --- | --- |
| lightningcss | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-android-arm64 | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-darwin-arm64 | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-darwin-x64 | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-freebsd-x64 | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-linux-arm-gnueabihf | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-linux-arm64-gnu | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-linux-arm64-musl | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-linux-x64-gnu | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-linux-x64-musl | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-win32-arm64-msvc | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| lightningcss-win32-x64-msvc | 1.32.0 | MPL-2.0 | weak-copyleft-notice |
| node-forge | 1.4.0 | (BSD-3-Clause OR GPL-2.0) | dual-license-permissive-option |

If this audit fails, replace or review the flagged package before App Store submission.
