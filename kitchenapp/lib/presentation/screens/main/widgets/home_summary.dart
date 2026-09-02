import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/core/theme/app_text_styles.dart';
import 'package:kitchenapp/core/theme/dashboard_tone.dart';
import 'package:kitchenapp/models/dashboard/dashboard_metric_item.dart';
import 'package:kitchenapp/models/dashboard/dashboard_widget_item.dart';
import 'package:kitchenapp/models/kitchen_order.dart';
import 'package:kitchenapp/widgets/dashboard/compact_order_tile.dart';

/// Shared decorative helpers for the home screen.
class HomeDecor {
  const HomeDecor._();

  static BoxShadow softShadow([Color? color]) => BoxShadow(
        color: (color ?? AppColors.primary).withValues(alpha: 0.12),
        blurRadius: 18,
        offset: const Offset(0, 8),
      );

  static List<Color> statGradient(Color tone, int index) {
    final base = [
      tone.withValues(alpha: 0.14),
      tone.withValues(alpha: 0.04),
    ];
    if (index.isOdd) {
      return base.reversed.toList();
    }
    return base;
  }
}

class HomeSectionTitle extends StatelessWidget {
  const HomeSectionTitle({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 4,
          height: 36,
          margin: const EdgeInsets.only(top: 2, right: AppSpacing.md),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                AppColors.primary,
                AppColors.primary.withValues(alpha: 0.35),
              ],
            ),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.sectionHeader(context),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.secondaryText,
                    fontWeight: FontWeight.w500,
                    height: 1.25,
                  ),
                ),
              ],
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

/// Horizontal strip of all dashboard widgets for a compact home layout.
class HomeWidgetStrip extends StatelessWidget {
  const HomeWidgetStrip({super.key, required this.widgets});

  final List<DashboardWidgetItem> widgets;

  static const cardMinHeight = 128.0;
  static const cardWidth = 138.0;

  @override
  Widget build(BuildContext context) {
    if (widgets.isEmpty) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: cardMinHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
        itemCount: widgets.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (context, index) => SizedBox(
          width: cardWidth,
          child: _HomeStatCard(item: widgets[index], index: index),
        ),
      ),
    );
  }
}

/// Horizontal strip of real-time kitchen metrics.
class HomeMetricsStrip extends StatelessWidget {
  const HomeMetricsStrip({super.key, required this.metrics});

  final List<DashboardMetricItem> metrics;

  static const stripHeight = 92.0;
  static const cardWidth = 172.0;

  @override
  Widget build(BuildContext context) {
    if (metrics.isEmpty) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: stripHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
        itemCount: metrics.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (context, index) => SizedBox(
          width: cardWidth,
          child: _HomeMetricCard(metric: metrics[index]),
        ),
      ),
    );
  }
}

class _HomeStatCard extends StatelessWidget {
  const _HomeStatCard({required this.item, required this.index});

  final DashboardWidgetItem item;
  final int index;

  @override
  Widget build(BuildContext context) {
    final tone = DashboardTone.colorFor(item.tone);

    return SizedBox(
      height: HomeWidgetStrip.cardMinHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
          border: Border.all(color: AppColors.panelBorder),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
          child: Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned(
                right: -10,
                top: -10,
                child: Icon(
                  DashboardTone.iconForWidget(item.key),
                  size: 64,
                  color: tone.withValues(alpha: 0.08),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.max,
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: tone.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        DashboardTone.iconForWidget(item.key),
                        size: 16,
                        color: tone,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      item.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.secondaryText,
                        letterSpacing: 0.2,
                        height: 1.1,
                      ),
                    ),
                    const Spacer(),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        item.value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: tone.withValues(alpha: 0.95),
                          height: 1,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeMetricCard extends StatelessWidget {
  const _HomeMetricCard({required this.metric});

  final DashboardMetricItem metric;

  @override
  Widget build(BuildContext context) {
    final tone = DashboardTone.colorFor(metric.tone);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: tone.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                DashboardTone.iconForMetric(metric.key),
                color: tone,
                size: 18,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    metric.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.secondaryText,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    metric.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppColors.primaryText,
                      height: 1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeOrderPreview extends StatelessWidget {
  const HomeOrderPreview({
    super.key,
    required this.orders,
    required this.onViewAll,
    this.onAction,
    this.deliveryMode = false,
    this.myName,
    this.roomDeliveries = false,
  });

  final List<KitchenOrder> orders;
  final VoidCallback onViewAll;
  final Future<void> Function(String orderId, String action)? onAction;
  // Waiter app: show only the orders assigned to me that are ready/on-the-way,
  // with Start Delivery / Delivered actions.
  final bool deliveryMode;
  final String? myName;
  // Housekeeping delivers room orders; waiter delivers table orders.
  final bool roomDeliveries;

  @override
  Widget build(BuildContext context) {
    final preview = deliveryMode
        ? (orders
            .where(
              (o) =>
                  (o.rawStatus == 'ready' ||
                      o.rawStatus == 'serving' ||
                      o.rawStatus == 'served') &&
                  (roomDeliveries ? o.isRoom : !o.isRoom) &&
                  o.waiterName != null &&
                  myName != null &&
                  o.waiterName!.trim().toLowerCase() ==
                      myName!.trim().toLowerCase(),
            )
            .toList()
          // Delivered orders sink to the bottom; still-to-deliver stay on top.
          ..sort((a, b) =>
              (a.rawStatus == 'served' ? 1 : 0) -
              (b.rawStatus == 'served' ? 1 : 0)))
        : orders;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HomeSectionTitle(
          title: deliveryMode ? 'My deliveries' : 'Active orders',
          subtitle: deliveryMode
              ? (preview.isEmpty
                  ? 'Nothing to deliver yet'
                  : '${preview.where((o) => o.rawStatus != 'served').length} to deliver · ${preview.where((o) => o.rawStatus == 'served').length} delivered')
              : (preview.isEmpty
                  ? 'Queue is clear'
                  : '${orders.length} KOT${orders.length == 1 ? '' : 's'} in progress'),
          trailing: deliveryMode
              ? null
              : TextButton.icon(
                  onPressed: onViewAll,
                  icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                  label: const Text('KDS'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    textStyle: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (preview.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.xxxl,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
              border: Border.all(color: AppColors.panelBorder),
              boxShadow: [HomeDecor.softShadow()],
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
                  child: const Icon(
                    Icons.check_circle_outline_rounded,
                    color: AppColors.primary,
                    size: 28,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  deliveryMode ? 'No deliveries yet' : 'All caught up!',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryText,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  deliveryMode
                      ? 'Orders assigned to you will show here once the kitchen marks them ready.'
                      : 'No active orders right now.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 84,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: preview.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
              itemBuilder: (context, index) => SizedBox(
                width: 292,
                child: CompactOrderTile(
                  order: preview[index],
                  onAction: onAction,
                  deliveryMode: deliveryMode,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class HomeQuickActions extends StatelessWidget {
  const HomeQuickActions({
    super.key,
    required this.actions,
    required this.onAction,
  });

  final List<HomeQuickAction> actions;
  final ValueChanged<HomeQuickAction> onAction;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 108,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
        itemCount: actions.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (context, index) {
          final action = actions[index];
          return Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => onAction(action),
              borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
              child: Ink(
                width: 84,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
                  border: Border.all(
                    color: action.accent.withValues(alpha: 0.2),
                  ),
                  boxShadow: [HomeDecor.softShadow(action.accent)],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            action.accent.withValues(alpha: 0.22),
                            action.accent.withValues(alpha: 0.08),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(action.icon, color: action.accent, size: 24),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      action.label,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primaryText,
                        height: 1.15,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class HomeQuickAction {
  const HomeQuickAction(
    this.label,
    this.icon,
    this.navIndex,
    this.accent,
  );

  final String label;
  final IconData icon;
  final int navIndex;
  final Color accent;
}
