/**
 * ADMOB CONFIGURATION SETUP GUIDE:
 * 
 * 1. SET UP ADMOB ACCOUNT:
 *    - Create an account at https://admob.google.com
 *    - Add your app in the AdMob dashboard
 *    - For Android: Use your package name (e.g., com.yourcompany.yourapp)
 *    - For iOS: Use your bundle identifier
 * 
 * 2. CREATE AD UNITS:
 *    - Go to "Apps" → Select your app → "Add ad unit"
 *    - Choose banner ad type (or other types you need)
 *    - Give it a name and create
 *    - Copy the generated Ad Unit ID (format: ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy)
 * 
 * 3. REPLACE THIS AD UNIT ID:
 *    - Replace the realAdUnitId below with your own Ad Unit ID
 *    - Keep the TestIds.BANNER for development/testing
 *    - Test ads will show in development mode and on web
 * 
 * 4. REQUIRED INSTALLATION:
 *    - Install the package: yarn add react-native-google-mobile-ads
 *    - For iOS: Run `cd ios && pod install`
 *    - Android setup: Update android/build.gradle and AndroidManifest.xml
 *      (See package docs for details: https://github.com/invertase/react-native-google-mobile-ads)
 * 
 * 5. IMPORTANT NOTES:
 *    - Never use live ads during development (use test IDs)
 *    - AdMob requires app-ads.txt setup for production
 *    - Android apps need to target API level 33+
 *    - iOS requires App Tracking Transparency permission for personalized ads
 * 
 * 6. TESTING:
 *    - Use the test ID during development
 *    - Test on a real device for accurate ad behavior
 *    - Check console logs for ad loading errors
 */

// Ad Unit ID Configuration
export const realAdUnitId = 'ca-app-pub-8991036550543596/5607079076'; // ⚠️ REPLACE WITH YOUR OWN AD UNIT ID
