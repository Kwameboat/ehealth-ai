import { CommonActions } from '@react-navigation/native';

/**
 * Go to a screen and clear the back stack (after login, onboarding, etc.).
 * Avoids bare `navigation` which on web is window.navigation, not React Navigation.
 *
 * @param {import('@react-navigation/native').NavigationProp<any>} navigation
 * @param {string} routeName
 */
export function resetToRoute(navigation, routeName) {
  if (!navigation) return;

  if (typeof navigation.reset === 'function') {
    navigation.reset({
      index: 0,
      routes: [{ name: routeName }],
    });
    return;
  }

  if (typeof navigation.dispatch === 'function') {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: routeName }],
      })
    );
    return;
  }

  if (typeof navigation.replace === 'function') {
    navigation.replace(routeName);
    return;
  }

  if (typeof navigation.navigate === 'function') {
    navigation.navigate(routeName);
  }
}
