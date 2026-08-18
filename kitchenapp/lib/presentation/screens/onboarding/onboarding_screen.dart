import 'package:flutter/material.dart';

import 'package:kitchenapp/core/config/app_variant_content.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/storage/app_preferences.dart';
import 'package:kitchenapp/presentation/widgets/common/app_logo.dart';
import 'package:kitchenapp/presentation/widgets/common/primary_button.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onComplete});

  final VoidCallback onComplete;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  int _page = 0;

  static List<OnboardingPageData> get _pages => AppVariantContent.onboardingPages;

  Future<void> _finish() async {
    await AppPreferences().setOnboardingComplete();
    widget.onComplete();
  }

  void _next() {
    if (_page < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
      return;
    }
    _finish();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _finish,
                child: const Text(
                  'Skip',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _pages.length,
                onPageChanged: (index) => setState(() => _page = index),
                itemBuilder: (context, index) {
                  final page = _pages[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            color: page.color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(32),
                          ),
                          child: Icon(page.icon, size: 56, color: page.color),
                        ),
                        const SizedBox(height: 36),
                        Text(
                          page.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: AppColors.primaryText,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          page.subtitle,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 16,
                            height: 1.5,
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_pages.length, (index) {
                final active = index == _page;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: active ? 28 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: active ? AppColors.primary : AppColors.panelBorder,
                    borderRadius: BorderRadius.circular(8),
                  ),
                );
              }),
            ),
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: PrimaryButton(
                label: _page == _pages.length - 1 ? 'Get Started' : 'Continue',
                icon: _page == _pages.length - 1
                    ? Icons.arrow_forward_rounded
                    : Icons.chevron_right_rounded,
                onPressed: _next,
              ),
            ),
            const SizedBox(height: 8),
            const AppLogo(size: 40, showTagline: false),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
