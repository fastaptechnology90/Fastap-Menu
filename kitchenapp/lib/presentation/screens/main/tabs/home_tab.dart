import 'package:flutter/material.dart';

import 'package:kitchenapp/core/config/app_variant_content.dart';
import 'package:kitchenapp/core/config/api_config.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/navigation/module_screen_builder.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/home_summary.dart';
import 'package:kitchenapp/data/staff_role_access_policy.dart';
import 'package:kitchenapp/models/auth/staff_role.dart';
import 'package:kitchenapp/state/auth_controller.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';
import 'package:kitchenapp/widgets/kitchen/section_filter.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({
    super.key,
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  static const _quickActionCatalog = <int, HomeQuickAction>{
    0: HomeQuickAction(
      'Dashboard',
      Icons.dashboard_rounded,
      0,
      AppColors.primary,
    ),
    1: HomeQuickAction('KDS', Icons.monitor_rounded, 1, AppColors.primary),
    5: HomeQuickAction('Prep', Icons.restaurant_rounded, 5, AppColors.primary),
    7: HomeQuickAction('Tasks', Icons.assignment_rounded, 7, AppColors.premium),
    8: HomeQuickAction('Staff', Icons.groups_2_outlined, 8, AppColors.premium),
    12: HomeQuickAction(
      'Communication',
      Icons.forum_outlined,
      12,
      AppColors.premium,
    ),
    13: HomeQuickAction(
      'Inventory',
      Icons.inventory_2_rounded,
      13,
      AppColors.info,
    ),
    20: HomeQuickAction(
      'Expeditor',
      Icons.fact_check_outlined,
      20,
      AppColors.warning,
    ),
    21: HomeQuickAction(
      'Packing',
      Icons.inventory_2_outlined,
      21,
      AppColors.info,
    ),
    22: HomeQuickAction(
      'Delivery',
      Icons.delivery_dining_rounded,
      22,
      AppColors.info,
    ),
    23: HomeQuickAction('Bar', Icons.local_bar_rounded, 23, AppColors.premium),
    24: HomeQuickAction(
      'Bakery',
      Icons.bakery_dining_rounded,
      24,
      AppColors.premium,
    ),
    27: HomeQuickAction(
      'Room service',
      Icons.hotel_rounded,
      27,
      AppColors.info,
    ),
    28: HomeQuickAction(
      'Cleaning',
      Icons.cleaning_services_outlined,
      28,
      AppColors.info,
    ),
    33: HomeQuickAction(
      'Shifts',
      Icons.schedule_rounded,
      33,
      Color(0xff0891b2),
    ),
    35: HomeQuickAction(
      'Alerts',
      Icons.notifications_active_rounded,
      35,
      AppColors.warning,
    ),
    48: HomeQuickAction(
      'Waiter tasks',
      Icons.room_service_rounded,
      48,
      AppColors.primary,
    ),
    49: HomeQuickAction(
      'Modules',
      Icons.apps_rounded,
      49,
      Color(0xff059669),
    ),
  };

  @override
  Widget build(BuildContext context) {
    final user = auth.session?.user;
    final firstName = user?.name.split(' ').first ?? AppVariantContent.defaultFirstName;
    final initials = _initials(user?.name ?? AppVariantContent.defaultFirstName);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final dashboard = controller.dashboard;
        final rushCount = dashboard?.rushAlerts.length ?? 0;
        final loading = controller.loading && dashboard == null;
        final role = user?.role ?? StaffRole.lineCook;
        final permissions = auth.session?.permissions ?? [];
        final quickActions = StaffRoleAccessPolicy.quickActionNavIndices(
          role: role,
          permissions: permissions,
        )
            .map((navIndex) => _quickActionCatalog[navIndex])
            .whereType<HomeQuickAction>()
            .toList();
        final showDashboard = auth.canAccessNav(0);
        final showOrders = auth.canAccessNav(1);
        // Waiter/housekeeping care about the live order list first (what to
        // serve / deliver), so surface it above the pulse & metrics. Kitchen
        // keeps its KDS-focused layout with orders lower down.
        final ordersFirst =
            role == StaffRole.waiter || role == StaffRole.housekeeping;

        Widget orderPreviewSliver() => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl,
                  AppSpacing.lg,
                  AppSpacing.xl,
                  AppSpacing.lg,
                ),
                child: loading
                    ? const SizedBox.shrink()
                    : HomeOrderPreview(
                        orders: dashboard?.orders ?? const [],
                        onAction: controller.performKdsAction,
                        // Waiter sees a focused "My deliveries" list (only the
                        // orders assigned to them) with Start Delivery /
                        // Delivered actions.
                        deliveryMode: role == StaffRole.waiter,
                        myName: user?.name,
                        onViewAll: () => ModuleScreenBuilder.open(
                          context,
                          navIndex: 1,
                          controller: controller,
                          auth: auth,
                        ),
                      ),
              ),
            );

        return RefreshIndicator(
          onRefresh: controller.refreshDashboard,
          color: AppColors.primary,
          backgroundColor: Colors.white,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: ClampingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl,
                    AppSpacing.lg,
                    AppSpacing.xl,
                    0,
                  ),
                  child: _HomeHeader(
                    firstName: firstName,
                    initials: initials,
                    role: user?.role.label ?? 'Staff',
                    section: user?.section ?? AppVariantContent.defaultSection,
                    apiMode: ApiConfig.modeLabel,
                    loading: loading,
                    onRefresh: controller.refreshDashboard,
                  ),
                ),
              ),
              if (rushCount > 0)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.xl,
                      AppSpacing.lg,
                      AppSpacing.xl,
                      0,
                    ),
                    child: _AlertStrip(count: rushCount),
                  ),
                ),
              // Waiter/housekeeping don't have the kitchen (KDS) tab, so
              // showOrders is false for them — but they still need their own
              // order/delivery list. Surface it on the role, not on KDS access.
              if (ordersFirst) orderPreviewSliver(),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl,
                    AppSpacing.xl,
                    AppSpacing.xl,
                    0,
                  ),
                  child: SectionFilter(
                    sections: controller.sections,
                    selected: controller.selectedSection,
                    onChanged: controller.selectSection,
                  ),
                ),
              ),
              if (showDashboard) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.xl,
                      AppSpacing.xl,
                      AppSpacing.xl,
                      0,
                    ),
                    child: HomeSectionTitle(
                      title: switch (role) {
                        StaffRole.waiter => 'Service pulse',
                        StaffRole.housekeeping => 'Housekeeping pulse',
                        _ => "Today's pulse",
                      },
                      subtitle: switch (role) {
                        StaffRole.waiter => 'Floor and delivery overview',
                        StaffRole.housekeeping =>
                          'Rooms, cleaning tasks, and maintenance',
                        _ => 'Swipe for all kitchen KPIs',
                      },
                      trailing: TextButton(
                        onPressed: () => ModuleScreenBuilder.open(
                          context,
                          navIndex: 0,
                          controller: controller,
                          auth: auth,
                        ),
                        child: const Text('Full dashboard'),
                      ),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.xl,
                      AppSpacing.sm,
                      AppSpacing.xl,
                      0,
                    ),
                    child: loading
                        ? const _StatsLoading()
                        : dashboard == null
                            ? _EmptyStats(onRetry: controller.refreshDashboard)
                            : HomeWidgetStrip(widgets: dashboard.widgets),
                  ),
                ),
                if (!loading && dashboard != null)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.xl,
                        AppSpacing.lg,
                        AppSpacing.xl,
                        0,
                      ),
                      child: const HomeSectionTitle(
                        title: 'Real-time metrics',
                        subtitle: 'Swipe for efficiency & backlog',
                      ),
                    ),
                  ),
                if (!loading && dashboard != null)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.xl,
                        AppSpacing.sm,
                        AppSpacing.xl,
                        0,
                      ),
                      child: HomeMetricsStrip(metrics: dashboard.metrics),
                    ),
                  ),
              ],
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl,
                    AppSpacing.lg,
                    AppSpacing.xl,
                    AppSpacing.sm,
                  ),
                  child: HomeSectionTitle(
                    title: 'Quick actions',
                    subtitle: AppVariantContent.homeQuickActionsSubtitle,
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: HomeQuickActions(
                    actions: quickActions,
                    onAction: (action) => ModuleScreenBuilder.open(
                      context,
                      navIndex: action.navIndex,
                      controller: controller,
                      auth: auth,
                    ),
                  ),
                ),
              ),
              if (showOrders && !ordersFirst) orderPreviewSliver(),
              const SliverToBoxAdapter(
                child: SizedBox(height: AppSpacing.xxxl),
              ),
            ],
          ),
        );
      },
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
    required this.firstName,
    required this.initials,
    required this.role,
    required this.section,
    required this.apiMode,
    required this.loading,
    required this.onRefresh,
  });

  final String firstName;
  final String initials;
  final String role;
  final String section;
  final String apiMode;
  final bool loading;
  final VoidCallback onRefresh;

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.chipBackground,
              border: Border.all(color: AppColors.panelBorder, width: 2),
            ),
            alignment: Alignment.center,
            child: Text(
              initials,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w900,
                fontSize: 20,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _greeting,
                  style: const TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  firstName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '$role · $section',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.chipBackground,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.panelBorder),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        apiMode,
                        style: const TextStyle(
                          color: AppColors.bodyText,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: AppColors.chipBackground,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: loading ? null : onRefresh,
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                width: 44,
                height: 44,
                child: Center(
                  child: loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        )
                      : const Icon(
                          Icons.refresh_rounded,
                          color: AppColors.primary,
                          size: 22,
                        ),
                ),
              ),
            ),
          ),
        ],
    );
  }
}

class _AlertStrip extends StatelessWidget {
  const _AlertStrip({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.chipBackground,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.campaign_rounded,
              color: AppColors.warning,
              size: 22,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$count rush alert${count == 1 ? '' : 's'}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    color: AppColors.primaryText,
                    fontSize: 14,
                  ),
                ),
                Text(
                  AppVariantContent.rushAlertHint,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.secondaryText,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.chevron_right_rounded,
            color: AppColors.warning,
          ),
        ],
      ),
    );
  }
}

class _StatsLoading extends StatelessWidget {
  const _StatsLoading();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: HomeWidgetStrip.cardMinHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: 4,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (_, _) => const SizedBox(
          width: HomeWidgetStrip.cardWidth,
          child: _LoadingStatCard(),
        ),
      ),
    );
  }
}

class _LoadingStatCard extends StatelessWidget {
  const _LoadingStatCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: HomeWidgetStrip.cardMinHeight,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

class _EmptyStats extends StatelessWidget {
  const _EmptyStats({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xxl),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        border: Border.all(color: AppColors.panelBorder),
        boxShadow: [HomeDecor.softShadow()],
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.secondaryText.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.cloud_off_outlined,
              color: AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            AppVariantContent.emptyStatsMessage,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton.tonal(
            onPressed: onRetry,
            child: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}

