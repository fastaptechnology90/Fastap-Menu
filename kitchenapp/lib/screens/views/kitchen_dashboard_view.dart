import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../models/dashboard/dashboard_snapshot.dart';
import '../../models/kitchen_order.dart';
import '../../presentation/screens/main/widgets/home_summary.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/dashboard/compact_order_tile.dart';
import '../../widgets/dashboard/dashboard_status_bar.dart';
import '../../widgets/dashboard/dashboard_widget_grid.dart';
import '../../widgets/dashboard/realtime_metrics_bar.dart';
import '../../widgets/dashboard/rush_alerts_panel.dart';
import '../../widgets/dashboard/section_workload_panel.dart';
import '../../widgets/kitchen/order_card.dart';

class KitchenDashboardView extends StatefulWidget {
  const KitchenDashboardView({
    super.key,
    required this.controller,
    this.useExpandedBody = false,
  });

  final KitchenCommandController controller;

  /// When true, tab pages fill remaining height (full-screen module view).
  final bool useExpandedBody;

  @override
  State<KitchenDashboardView> createState() => _KitchenDashboardViewState();
}

class _KitchenDashboardViewState extends State<KitchenDashboardView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = ['Overview', 'Metrics', 'Floor', 'Orders'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        if (widget.controller.loading && widget.controller.dashboard == null) {
          return const _DashboardLoading();
        }

        final dashboard = widget.controller.dashboard;
        if (dashboard == null) {
          return _ErrorState(
            message: widget.controller.errorMessage ?? 'Dashboard unavailable',
            onRetry: widget.controller.refreshDashboard,
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DashboardStatusBar(
              controller: widget.controller,
              onRefresh: widget.controller.refreshDashboard,
            ),
            if (widget.controller.errorMessage != null) ...[
              const SizedBox(height: AppSpacing.md),
              _ErrorBanner(
                message: widget.controller.errorMessage!,
                onRetry: widget.controller.refreshDashboard,
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            _DashboardTabBar(
              controller: _tabController,
              dashboard: dashboard,
            ),
            const SizedBox(height: AppSpacing.lg),
            if (widget.useExpandedBody)
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _OverviewTab(
                      controller: widget.controller,
                      dashboard: dashboard,
                      scrollable: true,
                    ),
                    _MetricsTab(
                      controller: widget.controller,
                      dashboard: dashboard,
                      scrollable: true,
                    ),
                    _FloorTab(
                      controller: widget.controller,
                      dashboard: dashboard,
                      scrollable: true,
                    ),
                    _OrdersTab(
                      controller: widget.controller,
                      orders: dashboard.orders,
                      scrollable: true,
                    ),
                  ],
                ),
              )
            else
              AnimatedBuilder(
                animation: _tabController,
                builder: (context, _) {
                  return switch (_tabController.index) {
                    0 => _OverviewTab(
                        controller: widget.controller,
                        dashboard: dashboard,
                      ),
                    1 => _MetricsTab(
                        controller: widget.controller,
                        dashboard: dashboard,
                      ),
                    2 => _FloorTab(
                        controller: widget.controller,
                        dashboard: dashboard,
                      ),
                    _ => _OrdersTab(
                        controller: widget.controller,
                        orders: dashboard.orders,
                      ),
                  };
                },
              ),
          ],
        );
      },
    );
  }
}

class _DashboardTabBar extends StatelessWidget {
  const _DashboardTabBar({
    required this.controller,
    required this.dashboard,
  });

  final TabController controller;
  final DashboardSnapshot dashboard;

  @override
  Widget build(BuildContext context) {
    final badges = [
      null,
      null,
      dashboard.rushAlerts.isEmpty ? null : '${dashboard.rushAlerts.length}',
      dashboard.orders.isEmpty ? null : '${dashboard.orders.length}',
    ];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.panelBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TabBar(
        controller: controller,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        dividerHeight: 0,
        indicatorSize: TabBarIndicatorSize.tab,
        indicator: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.secondaryText,
        labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
        unselectedLabelStyle:
            const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        padding: const EdgeInsets.all(6),
        tabs: [
          for (var i = 0; i < _KitchenDashboardViewState._tabs.length; i++)
            Tab(
              height: 38,
              child: _TabLabel(
                label: _KitchenDashboardViewState._tabs[i],
                badge: badges[i],
              ),
            ),
        ],
      ),
    );
  }
}

class _TabLabel extends StatelessWidget {
  const _TabLabel({required this.label, this.badge});

  final String label;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label),
        if (badge != null) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              badge!,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ],
    );
  }
}

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({
    required this.controller,
    required this.dashboard,
    this.scrollable = false,
  });

  final KitchenCommandController controller;
  final DashboardSnapshot dashboard;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    return _TabScroll(
      scrollable: scrollable,
      onRefresh: controller.refreshDashboard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const HomeSectionTitle(
            title: 'Kitchen overview',
            subtitle: 'Live KPIs for the selected section',
          ),
          const SizedBox(height: AppSpacing.md),
          DashboardWidgetGrid(widgets: dashboard.widgets),
        ],
      ),
    );
  }
}

class _MetricsTab extends StatelessWidget {
  const _MetricsTab({
    required this.controller,
    required this.dashboard,
    this.scrollable = false,
  });

  final KitchenCommandController controller;
  final DashboardSnapshot dashboard;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    return _TabScroll(
      scrollable: scrollable,
      onRefresh: controller.refreshDashboard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const HomeSectionTitle(
            title: 'Real-time metrics',
            subtitle: 'Efficiency, backlog & prep speed',
          ),
          const SizedBox(height: AppSpacing.md),
          RealtimeMetricsBar(metrics: dashboard.metrics),
        ],
      ),
    );
  }
}

class _FloorTab extends StatelessWidget {
  const _FloorTab({
    required this.controller,
    required this.dashboard,
    this.scrollable = false,
  });

  final KitchenCommandController controller;
  final DashboardSnapshot dashboard;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    return _TabScroll(
      scrollable: scrollable,
      onRefresh: controller.refreshDashboard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const HomeSectionTitle(
            title: 'Floor status',
            subtitle: 'Workload balance and rush signals',
          ),
          const SizedBox(height: AppSpacing.md),
          SectionWorkloadPanel(workloads: dashboard.sectionWorkload),
          const SizedBox(height: AppSpacing.md),
          RushAlertsPanel(alerts: dashboard.rushAlerts),
        ],
      ),
    );
  }
}

class _OrdersTab extends StatelessWidget {
  const _OrdersTab({
    required this.controller,
    required this.orders,
    this.scrollable = false,
  });

  final KitchenCommandController controller;
  final List<KitchenOrder> orders;
  final bool scrollable;

  void _markReady(KitchenOrder order) {
    final id = order.id;
    if (id != null && id.isNotEmpty) {
      controller.performKdsAction(id, 'ready');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (scrollable) {
      return RefreshIndicator(
        onRefresh: controller.refreshDashboard,
        color: AppColors.primary,
        child: _OrdersList(orders: orders, scrollable: true, onReady: _markReady),
      );
    }
    return _OrdersList(orders: orders, onReady: _markReady);
  }
}

class _TabScroll extends StatelessWidget {
  const _TabScroll({
    required this.child,
    this.scrollable = false,
    this.onRefresh,
  });

  final Widget child;
  final bool scrollable;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    if (!scrollable) return child;

    final content = SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: ClampingScrollPhysics(),
      ),
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: child,
    );

    if (onRefresh == null) return content;

    return RefreshIndicator(
      onRefresh: onRefresh!,
      color: AppColors.primary,
      child: content,
    );
  }
}

class _OrdersList extends StatelessWidget {
  const _OrdersList({
    required this.orders,
    this.scrollable = false,
    this.onReady,
  });

  final List<KitchenOrder> orders;
  final bool scrollable;
  final void Function(KitchenOrder order)? onReady;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return const _OrdersEmptyState();
    }

    if (scrollable) {
      return ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(
          parent: ClampingScrollPhysics(),
        ),
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        itemCount: orders.length + 1,
        separatorBuilder: (_, index) => index == 0
            ? const SizedBox(height: AppSpacing.md)
            : const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          if (index == 0) {
            return HomeSectionTitle(
              title: 'Live order queue',
              subtitle: '${orders.length} KOT${orders.length == 1 ? '' : 's'} in progress',
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${orders.length}',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
              ),
            );
          }
          return CompactOrderTile(order: orders[index - 1]);
        },
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final useCompact = constraints.maxWidth < 900;
        final visible = useCompact ? orders.take(8).toList() : orders;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            HomeSectionTitle(
              title: 'Live order queue',
              subtitle:
                  'Showing ${visible.length} of ${orders.length} KOT${orders.length == 1 ? '' : 's'}',
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${orders.length}',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            if (useCompact)
              ...visible.map(
                (order) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: CompactOrderTile(order: order),
                ),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: constraints.maxWidth > 1120 ? 3 : 2,
                  crossAxisSpacing: AppSpacing.md,
                  mainAxisSpacing: AppSpacing.md,
                  mainAxisExtent: 320,
                ),
                itemCount: visible.length,
                itemBuilder: (context, index) => OrderCard(
                  order: visible[index],
                  onReady: onReady == null
                      ? null
                      : () => onReady!(visible[index]),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _OrdersEmptyState extends StatelessWidget {
  const _OrdersEmptyState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const HomeSectionTitle(
          title: 'Live order queue',
          subtitle: 'No tickets in this section',
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.xxxl,
          ),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
            border: Border.all(color: AppColors.panelBorder),
          ),
          child: Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_circle_outline_rounded,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Queue is clear',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AppColors.primaryText,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'No active orders for this section.',
                style: TextStyle(color: AppColors.secondaryText),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DashboardLoading extends StatelessWidget {
  const _DashboardLoading();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(
          height: 140,
          child: Center(child: CircularProgressIndicator()),
        ),
        const SizedBox(height: AppSpacing.lg),
        Container(
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            border: Border.all(color: AppColors.panelBorder),
          ),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xxl),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.cloud_off_outlined, color: AppColors.danger),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.bodyText, height: 1.5),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.warning.withValues(alpha: 0.14),
            AppColors.warning.withValues(alpha: 0.06),
          ],
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: AppColors.warning),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.bodyText,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
