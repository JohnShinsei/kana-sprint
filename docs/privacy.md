# Privacy Policy Draft

Kana Sprint itself does not collect personal data.

The app stores gameplay progress, high scores, combo records, daily streaks, daily goal progress, learned-item counts, selected difficulty, language settings, and music settings locally on the user's device. Users can reset local progress in Settings. This data is not transmitted to the developer or any third party.

The current codebase does not use analytics SDKs, tracking, account login, location, contacts, camera, microphone, background audio, or push notifications. The iOS privacy manifest declares no collected data and no tracking for the current build.

Kana Sprint includes an optional rewarded-ad entry point backed by Google Mobile Ads when valid AdMob IDs are configured for an EAS build. The rewarded ad is used only for the continue-run flow, and ad requests default to non-personalized ads.

When Google UMP reports that ad privacy options are required, the app shows an Ad privacy entry in Settings so users can open the UMP privacy options form.

When live Google Mobile Ads are enabled, Google's Mobile Ads SDK may receive ad-related data such as IP address, approximate/general location derived from IP address, crash logs, performance data, Device ID or advertising identifiers, advertising data, and product interaction data such as ad views or app interaction events. Google may use that data for ad serving, fraud prevention, diagnostics, advertising features, and SDK performance. Kana Sprint does not use this data to create user accounts, store gameplay progress off-device, or sell user data.

The App Store privacy details must match the final build, including the Google Mobile Ads SDK privacy manifest and the live rewarded-ad configuration. Review Apple's App Privacy Details and Google's current Mobile Ads data disclosure guidance before setting `APP_STORE_PRIVACY_ANSWERS_REVIEWED=1`.

If this policy changes in a future version, the App Store privacy details and this policy should be updated before release.
