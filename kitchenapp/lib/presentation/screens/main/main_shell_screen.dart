import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_constants.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/core/theme/app_text_styles.dart';
import 'package:kitchenapp/data/staff_role_access_policy.dart';
import 'package:kitchenapp/presentation/screens/main/tabs/alerts_tab.dart';
import 'package:kitchenapp/presentation/screens/main/tabs/home_tab.dart';
import 'package:kitchenapp/presentation/screens/main/tabs/kitchen_tab.dart';
import 'package:kitchenapp/presentation/screens/main/tabs/operations_tab.dart';
import 'package:kitchenapp/presentation/screens/main/tabs/profile_tab.dart';
import 'package:kitchenapp/state/auth_controller.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';

class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  late final KitchenCommandController _controller;
  int _tabIndex = 0;
  List<MainShellTab> _visibleTabs = MainShellTab.values;

  @override
  void initState() {
    super.initState();
    _controller = KitchenCommandController(auth: widget.auth);
    _controller.bootstrap();
    widget.auth.addListener(_syncVisibleTabs);
    _syncVisibleTabs();
  }

  @override
  void dispose() {
    widget.auth.removeListener(_syncVisibleTabs);
    _controller.dispose();
    super.dispose();
  }

  void _syncVisibleTabs() {
    final next = widget.auth.visibleShellTabs;
    if (listEquals(next, _visibleTabs)) {
      return;
    }
    setState(() {
      _visibleTabs = next;
      if (_tabIndex >= _visibleTabs.length) {
        _tabIndex = 0;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentTab = _visibleTabs[_tabIndex];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              currentTab.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.appBarTitle(context),
            ),
            Text(
              AppConstants.commandCenterTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.appBarSubtitle(context),
            ),
          ],
        ),
        actions: const [SizedBox(width: AppSpacing.sm)],
      ),
      body: IndexedStack(
        index: _tabIndex,
        children: [
          for (final tab in _visibleTabs) _tabFor(tab),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (index) => setState(() => _tabIndex = index),
        destinations: [
          for (final tab in _visibleTabs) _destinationFor(tab),
        ],
      ),
    );
  }

  Widget _tabFor(MainShellTab tab) {
    return switch (tab) {
      MainShellTab.home => HomeTab(controller: _controller, auth: widget.auth),
      MainShellTab.kitchen =>
        KitchenTab(controller: _controller, auth: widget.auth),
      MainShellTab.operations =>
        OperationsTab(controller: _controller, auth: widget.auth),
      MainShellTab.alerts =>
        AlertsTab(controller: _controller, auth: widget.auth),
      MainShellTab.profile =>
        ProfileTab(auth: widget.auth, controller: _controller),
    };
  }

  NavigationDestination _destinationFor(MainShellTab tab) {
    return switch (tab) {
      MainShellTab.home => const NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home_rounded),
          label: 'Home',
        ),
      MainShellTab.kitchen => const NavigationDestination(
          icon: Icon(Icons.soup_kitchen_outlined),
          selectedIcon: Icon(Icons.soup_kitchen_rounded),
          label: 'Kitchen',
        ),
      MainShellTab.operations => const NavigationDestination(
          icon: Icon(Icons.grid_view_outlined),
          selectedIcon: Icon(Icons.grid_view_rounded),
          label: 'Ops',
        ),
      MainShellTab.alerts => const NavigationDestination(
          icon: Icon(Icons.notifications_outlined),
          selectedIcon: Icon(Icons.notifications_rounded),
          label: 'Alerts',
        ),
      MainShellTab.profile => const NavigationDestination(
          icon: Icon(Icons.person_outline_rounded),
          selectedIcon: Icon(Icons.person_rounded),
          label: 'Profile',
        ),
    };
  }
}
