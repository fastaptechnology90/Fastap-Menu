import 'package:flutter/material.dart';
// ScrollCacheExtent lives in the rendering library and is not re-exported by
// material.dart. `dart fix` migrated `cacheExtent:` to the newer
// `scrollCacheExtent: ScrollCacheExtent.pixels(...)` form but left the import behind,
// which broke the build until this line was added.
import 'package:flutter/rendering.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/navigation/module_screen_builder.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/home_summary.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/kitchen_module_preview.dart';
import 'package:kitchenapp/data/staff_role_access_policy.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/kitchen_tab_widgets.dart';
import 'package:kitchenapp/presentation/widgets/common/role_access_denied.dart';
import 'package:kitchenapp/screens/views/live_kds_view.dart';
import 'package:kitchenapp/state/auth_controller.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';
import 'package:kitchenapp/widgets/kitchen/section_filter.dart';

class KitchenTab extends StatefulWidget {
  const KitchenTab({
    super.key,
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  @override
  State<KitchenTab> createState() => _KitchenTabState();
}

class _KitchenTabState extends State<KitchenTab> {
  static const _tabScrollPhysics = AlwaysScrollableScrollPhysics(
    parent: ClampingScrollPhysics(),
  );

  static const _allTabs = [
    KitchenSubTab('KDS', Icons.monitor_rounded, 1),
    KitchenSubTab('Stations', Icons.grid_view_rounded, 2),
    KitchenSubTab('Flow', Icons.swap_horiz_rounded, 3),
    KitchenSubTab('Fire', Icons.local_fire_department_rounded, 4),
    KitchenSubTab('Prep', Icons.restaurant_rounded, 5),
  ];

  List<KitchenSubTab> _visibleTabs() {
    final session = widget.auth.session;
    if (session == null) {
      return _allTabs;
    }
    final allowed = StaffRoleAccessPolicy.kitchenSubTabNavIndices(
      role: session.user.role,
      permissions: session.permissions,
    );
    return _allTabs.where((tab) => allowed.contains(tab.navIndex)).toList();
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      widget.controller.refreshKds(),
      widget.controller.refreshSections(silent: true),
      widget.controller.refreshProcessing(silent: true),
      widget.controller.refreshFiring(silent: true),
      widget.controller.refreshPrep(silent: true),
    ]);
  }

  List<String?> _badges(List<KitchenSubTab> tabs) {
    final c = widget.controller;
    String? badgeFor(int navIndex) => switch (navIndex) {
          1 => c.kds?.stats.total == null ? null : '${c.kds!.stats.total}',
          2 => c.sectionManagement?.overview.stats.onlineSections == null
              ? null
              : '${c.sectionManagement!.overview.stats.onlineSections}',
          3 => c.processing?.stats.total == null
              ? null
              : '${c.processing!.stats.total}',
          4 => c.courseFiring?.stats.activeFires == null
              ? null
              : '${c.courseFiring!.stats.activeFires}',
          5 => c.prepBoard?.stats.active == null
              ? null
              : '${c.prepBoard!.stats.active}',
          _ => null,
        };
    return tabs.map((tab) => badgeFor(tab.navIndex)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.auth,
      builder: (context, _) {
        final tabs = _visibleTabs();
        if (tabs.isEmpty) {
          return const RoleAccessDenied(
            title: 'Kitchen floor not available',
            message:
                'Your role does not include kitchen floor modules. Use Operations for your assigned tools.',
          );
        }

        return _KitchenTabPanels(
          key: ValueKey(tabs.map((tab) => tab.navIndex).join('-')),
          tabs: tabs,
          controller: widget.controller,
          auth: widget.auth,
          onRefreshAll: _refreshAll,
          badges: _badges(tabs),
        );
      },
    );
  }
}

class _KitchenTabPanels extends StatefulWidget {
  const _KitchenTabPanels({
    super.key,
    required this.tabs,
    required this.controller,
    required this.auth,
    required this.onRefreshAll,
    required this.badges,
  });

  final List<KitchenSubTab> tabs;
  final KitchenCommandController controller;
  final AuthController auth;
  final Future<void> Function() onRefreshAll;
  final List<String?> badges;

  @override
  State<_KitchenTabPanels> createState() => _KitchenTabPanelsState();
}

class _KitchenTabPanelsState extends State<_KitchenTabPanels>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: widget.tabs.length, vsync: this);
    _tabController.addListener(_syncSelectedNav);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncSelectedNav());
  }

  // Tell the controller which board is on screen. Its 15-second poll only
  // refreshes the board matching `selectedNav`, and nothing ever set it — so
  // the KDS went stale until someone pulled to refresh.
  void _syncSelectedNav() {
    if (!mounted || _tabController.indexIsChanging) return;
    final index = _tabController.index;
    if (index < 0 || index >= widget.tabs.length) return;
    widget.controller.selectNav(widget.tabs[index].navIndex);
  }

  @override
  void didUpdateWidget(covariant _KitchenTabPanels oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tabs.length != widget.tabs.length) {
      _tabController.removeListener(_syncSelectedNav);
      _tabController.dispose();
      _tabController = TabController(length: widget.tabs.length, vsync: this);
      _tabController.addListener(_syncSelectedNav);
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncSelectedNav());
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_syncSelectedNav);
    _tabController.dispose();
    super.dispose();
  }

  Widget _paneFor(KitchenSubTab tab) {
    return switch (tab.navIndex) {
      1 => _KdsTabPane(controller: widget.controller),
      2 => _StationsTabPane(
          controller: widget.controller,
          auth: widget.auth,
        ),
      3 => _FlowTabPane(
          controller: widget.controller,
          auth: widget.auth,
        ),
      4 => _FireTabPane(
          controller: widget.controller,
          auth: widget.auth,
        ),
      5 => _PrepTabPane(
          controller: widget.controller,
          auth: widget.auth,
        ),
      _ => const SizedBox.shrink(),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.xl,
            AppSpacing.lg,
            AppSpacing.xl,
            0,
          ),
          child: ListenableBuilder(
            listenable: widget.controller,
            builder: (context, _) => KitchenFloorHeader(
              controller: widget.controller,
              onRefresh: widget.onRefreshAll,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.xl,
            AppSpacing.lg,
            AppSpacing.xl,
            0,
          ),
          child: ListenableBuilder(
            listenable: widget.controller,
            builder: (context, _) => SectionFilter(
              sections: widget.controller.sections,
              selected: widget.controller.selectedSection,
              onChanged: widget.controller.selectSection,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.xl,
            AppSpacing.lg,
            AppSpacing.xl,
            0,
          ),
          child: ListenableBuilder(
            listenable: widget.controller,
            builder: (context, _) => KitchenSubTabBar(
              controller: _tabController,
              tabs: widget.tabs,
              badges: widget.badges,
            ),
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            physics: const ClampingScrollPhysics(),
            children: [
              for (final tab in widget.tabs) _paneFor(tab),
            ],
          ),
        ),
      ],
    );
  }
}

class _KdsTabPane extends StatelessWidget {
  const _KdsTabPane({required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xl,
        0,
      ),
      child: LiveKdsView(
        controller: controller,
        compact: true,
        primaryScroll: true,
      ),
    );
  }
}

class _StationsTabPane extends StatelessWidget {
  const _StationsTabPane({
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    if (controller.sectionsLoading && controller.sectionManagement == null) {
      return const KitchenModuleLoading();
    }

    final snapshot = controller.sectionManagement;
    if (snapshot == null) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        children: [
          KitchenModuleError(
            message: controller.sectionsErrorMessage ?? 'Stations unavailable',
            onRetry: controller.refreshSections,
          ),
        ],
      );
    }

    final stats = snapshot.overview.stats;
    final sections = snapshot.overview.sections.take(4).toList();

    return RefreshIndicator(
      onRefresh: controller.refreshSections,
      color: AppColors.primary,
      child: ListView(
        scrollCacheExtent: ScrollCacheExtent.pixels(400), physics: _KitchenTabState._tabScrollPhysics,
        padding: const EdgeInsets.all(AppSpacing.xl),
        children: [
          const HomeSectionTitle(
            title: 'Station overview',
            subtitle: 'Section load and routing',
          ),
          const SizedBox(height: AppSpacing.md),
          KitchenPreviewStatGrid(
            stats: [
              KitchenPreviewStat(
                'Online',
                '${stats.onlineSections}',
                Icons.check_circle_outline,
                AppColors.primary,
              ),
              KitchenPreviewStat(
                'Total',
                '${stats.totalSections}',
                Icons.grid_view_rounded,
                AppColors.info,
              ),
              KitchenPreviewStat(
                'Busiest',
                stats.busiestSection,
                Icons.local_fire_department_outlined,
                AppColors.warning,
              ),
              KitchenPreviewStat(
                'Avg load',
                '${(stats.avgLoad * 100).round()}%',
                Icons.speed_rounded,
                AppColors.premium,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xxl),
          KitchenPreviewList(
            title: 'Active stations',
            items: [
              for (final section in sections)
                KitchenPreviewRow(
                  title: section.label,
                  subtitle:
                      '${section.activeOrders} orders · ${section.staffAssigned} staff',
                  trailing: section.isOnline ? 'Online' : 'Offline',
                  color: section.isCritical
                      ? AppColors.danger
                      : section.isRush
                          ? AppColors.warning
                          : AppColors.primary,
                  icon: Icons.kitchen_outlined,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          KitchenOpenModuleButton(
            title: 'Open section management',
            subtitle: 'Routing, capacity & chef assignments',
            icon: Icons.grid_view_rounded,
            onTap: () => ModuleScreenBuilder.open(
              context,
              navIndex: 2,
              controller: controller,
              auth: auth,
            ),
          ),
        ],
      ),
    );
  }
}

class _FlowTabPane extends StatelessWidget {
  const _FlowTabPane({
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    if (controller.processingLoading && controller.processing == null) {
      return const KitchenModuleLoading();
    }

    final snapshot = controller.processing;
    if (snapshot == null) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        children: [
          KitchenModuleError(
            message:
                controller.processingErrorMessage ?? 'Processing unavailable',
            onRetry: controller.refreshProcessing,
          ),
        ],
      );
    }

    final stats = snapshot.stats;
    final orders = snapshot.orders.take(4).toList();

    return RefreshIndicator(
      onRefresh: controller.refreshProcessing,
      color: AppColors.primary,
      child: ListView(
        scrollCacheExtent: ScrollCacheExtent.pixels(400), physics: _KitchenTabState._tabScrollPhysics,
        padding: const EdgeInsets.all(AppSpacing.xl),
        children: [
          const HomeSectionTitle(
            title: 'Order processing',
            subtitle: 'Queue flow, holds & batch groups',
          ),
          const SizedBox(height: AppSpacing.md),
          KitchenPreviewStatGrid(
            stats: [
              KitchenPreviewStat(
                'In queue',
                '${stats.total}',
                Icons.queue_rounded,
                AppColors.primary,
              ),
              KitchenPreviewStat(
                'Held',
                '${stats.held}',
                Icons.pause_circle_outline,
                AppColors.warning,
              ),
              KitchenPreviewStat(
                'VIP',
                '${stats.vip}',
                Icons.workspace_premium_outlined,
                AppColors.premium,
              ),
              KitchenPreviewStat(
                'Rush',
                '${stats.rush}',
                Icons.bolt_rounded,
                AppColors.danger,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xxl),
          KitchenPreviewList(
            title: 'Processing queue',
            items: [
              for (final order in orders)
                KitchenPreviewRow(
                  title: order.base.title,
                  subtitle:
                      '${order.base.section} · ${order.base.location}',
                  trailing: order.held ? 'Held' : order.base.status,
                  color: order.base.color,
                  icon: order.base.icon,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          KitchenOpenModuleButton(
            title: 'Open order processing',
            subtitle: 'Smart queue, batch cooking & sequence',
            icon: Icons.swap_horiz_rounded,
            onTap: () => ModuleScreenBuilder.open(
              context,
              navIndex: 3,
              controller: controller,
              auth: auth,
            ),
          ),
        ],
      ),
    );
  }
}

class _FireTabPane extends StatelessWidget {
  const _FireTabPane({
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    if (controller.firingLoading && controller.courseFiring == null) {
      return const KitchenModuleLoading();
    }

    final snapshot = controller.courseFiring;
    if (snapshot == null) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        children: [
          KitchenModuleError(
            message: controller.firingErrorMessage ?? 'Firing unavailable',
            onRetry: controller.refreshFiring,
          ),
        ],
      );
    }

    final stats = snapshot.stats;
    final sessions = snapshot.sessions.take(4).toList();

    return RefreshIndicator(
      onRefresh: controller.refreshFiring,
      color: AppColors.primary,
      child: ListView(
        scrollCacheExtent: ScrollCacheExtent.pixels(400), physics: _KitchenTabState._tabScrollPhysics,
        padding: const EdgeInsets.all(AppSpacing.xl),
        children: [
          const HomeSectionTitle(
            title: 'Course firing',
            subtitle: 'Table pacing and course sync',
          ),
          const SizedBox(height: AppSpacing.md),
          KitchenPreviewStatGrid(
            stats: [
              KitchenPreviewStat(
                'Sessions',
                '${stats.totalSessions}',
                Icons.table_bar_rounded,
                AppColors.primary,
              ),
              KitchenPreviewStat(
                'Active fires',
                '${stats.activeFires}',
                Icons.local_fire_department_rounded,
                AppColors.danger,
              ),
              KitchenPreviewStat(
                'Held',
                '${stats.heldCourses}',
                Icons.pause_rounded,
                AppColors.warning,
              ),
              KitchenPreviewStat(
                'VIP',
                '${stats.vipSessions}',
                Icons.workspace_premium_outlined,
                AppColors.premium,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xxl),
          KitchenPreviewList(
            title: 'Firing sessions',
            items: [
              for (final session in sessions)
                KitchenPreviewRow(
                  title: session.location,
                  subtitle: session.servingModeLabel,
                  trailing: session.vip ? 'VIP' : '${session.courses.length} courses',
                  color: session.vip ? AppColors.premium : AppColors.warning,
                  icon: Icons.local_fire_department_outlined,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          KitchenOpenModuleButton(
            title: 'Open course firing',
            subtitle: 'Coordination board & pacing controls',
            icon: Icons.local_fire_department_rounded,
            onTap: () => ModuleScreenBuilder.open(
              context,
              navIndex: 4,
              controller: controller,
              auth: auth,
            ),
          ),
        ],
      ),
    );
  }
}

class _PrepTabPane extends StatelessWidget {
  const _PrepTabPane({
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    if (controller.prepLoading && controller.prepBoard == null) {
      return const KitchenModuleLoading();
    }

    final snapshot = controller.prepBoard;
    if (snapshot == null) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        children: [
          KitchenModuleError(
            message: controller.prepErrorMessage ?? 'Prep board unavailable',
            onRetry: controller.refreshPrep,
          ),
        ],
      );
    }

    final stats = snapshot.stats;
    final tasks = snapshot.tasks.take(4).toList();

    return RefreshIndicator(
      onRefresh: controller.refreshPrep,
      color: AppColors.primary,
      child: ListView(
        scrollCacheExtent: ScrollCacheExtent.pixels(400), physics: _KitchenTabState._tabScrollPhysics,
        padding: const EdgeInsets.all(AppSpacing.xl),
        children: [
          const HomeSectionTitle(
            title: 'Food preparation',
            subtitle: 'Prep tasks and station load',
          ),
          const SizedBox(height: AppSpacing.md),
          KitchenPreviewStatGrid(
            stats: [
              KitchenPreviewStat(
                'Active',
                '${stats.active}',
                Icons.play_circle_outline,
                AppColors.primary,
              ),
              KitchenPreviewStat(
                'Pending',
                '${stats.pending}',
                Icons.pending_actions_outlined,
                AppColors.info,
              ),
              KitchenPreviewStat(
                'Paused',
                '${stats.paused}',
                Icons.pause_circle_outline,
                AppColors.warning,
              ),
              KitchenPreviewStat(
                'Alerts',
                '${stats.alerts}',
                Icons.notification_important_outlined,
                AppColors.danger,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xxl),
          KitchenPreviewList(
            title: 'Prep tasks',
            items: [
              for (final task in tasks)
                KitchenPreviewRow(
                  title: task.dishName,
                  subtitle: '${task.section} · ${task.assignedChef}',
                  trailing: task.timer,
                  color: task.vip ? AppColors.premium : AppColors.primary,
                  icon: Icons.restaurant_rounded,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          KitchenOpenModuleButton(
            title: 'Open prep board',
            subtitle: 'Full task list, timers & ingredients',
            icon: Icons.restaurant_rounded,
            onTap: () => ModuleScreenBuilder.open(
              context,
              navIndex: 5,
              controller: controller,
              auth: auth,
            ),
          ),
        ],
      ),
    );
  }
}
