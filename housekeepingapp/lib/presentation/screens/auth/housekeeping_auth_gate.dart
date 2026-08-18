import 'package:flutter/material.dart';
import 'package:kitchenapp/core/constants/app_durations.dart';
import 'package:kitchenapp/core/storage/app_preferences.dart';
import 'package:kitchenapp/presentation/screens/auth/login_screen.dart';
import 'package:kitchenapp/presentation/screens/main/main_shell_screen.dart';
import 'package:kitchenapp/presentation/screens/onboarding/onboarding_screen.dart';
import 'package:kitchenapp/presentation/screens/splash/splash_screen.dart';
import 'package:kitchenapp/state/controllers/auth_controller.dart';
import 'package:kitchenapp/widgets/auth/activity_tracker.dart';

import '../../../state/controllers/housekeeping_auth_controller.dart';

enum HousekeepingAppFlow {
  bootstrapping,
  onboarding,
  unauthenticated,
  authenticated,
}

class HousekeepingAuthGate extends StatefulWidget {
  const HousekeepingAuthGate({super.key});

  @override
  State<HousekeepingAuthGate> createState() => _HousekeepingAuthGateState();
}

class _HousekeepingAuthGateState extends State<HousekeepingAuthGate> {
  late final HousekeepingAuthController _auth;
  HousekeepingAppFlow _flow = HousekeepingAppFlow.bootstrapping;

  @override
  void initState() {
    super.initState();
    _auth = HousekeepingAuthController();
    _auth.addListener(_onAuthChanged);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await Future<void>.delayed(AppDurations.splashDelay);
    final onboardingDone = await AppPreferences().isOnboardingComplete();
    await _auth.bootstrap();

    if (!mounted) return;

    if (_auth.isAuthenticated) {
      setState(() => _flow = HousekeepingAppFlow.authenticated);
      return;
    }

    setState(
      () => _flow = onboardingDone
          ? HousekeepingAppFlow.unauthenticated
          : HousekeepingAppFlow.onboarding,
    );
  }

  void _onAuthChanged() {
    if (_auth.isAuthenticated) {
      setState(() => _flow = HousekeepingAppFlow.authenticated);
    } else if (_auth.status == AuthStatus.unauthenticated &&
        _flow == HousekeepingAppFlow.authenticated) {
      setState(() => _flow = HousekeepingAppFlow.unauthenticated);
    }
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChanged);
    _auth.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return switch (_flow) {
      HousekeepingAppFlow.bootstrapping => const SplashScreen(),
      HousekeepingAppFlow.onboarding => OnboardingScreen(
          onComplete: () =>
              setState(() => _flow = HousekeepingAppFlow.unauthenticated),
        ),
      HousekeepingAppFlow.unauthenticated => LoginScreen(auth: _auth),
      HousekeepingAppFlow.authenticated => ActivityTracker(
          auth: _auth,
          child: MainShellScreen(auth: _auth),
        ),
    };
  }
}
