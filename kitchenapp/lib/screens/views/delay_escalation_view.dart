import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/delays/delay_escalation_widgets.dart';

class DelayEscalationView extends StatelessWidget {
  const DelayEscalationView({
    super.key,
    required this.controller,
    this.embedded = false,
  });

  final KitchenCommandController controller;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    if (controller.delayEscalationLoading &&
        controller.delayEscalation == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.delayEscalation;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.delayEscalationErrorMessage ??
            'Delay & escalation system unavailable',
        onRetry: () => controller.refreshDelayEscalation(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!embedded)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 10,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'System 18 · Delay & Escalation System',
                      style: TextStyle(
                        color: AppColors.primaryText,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Delay timers · reason log · auto escalate · bottlenecks',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                OutlinedButton.icon(
                  onPressed: controller.delayEscalationLoading
                      ? null
                      : () => controller.refreshDelayEscalation(),
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Refresh'),
                ),
              ],
            ),
          ),
        if (controller.delayEscalationActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.delayEscalationActionMessage!,
              style: const TextStyle(
                color: AppColors.danger,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 960;
            final main = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Delayed orders',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.delayedOrders.map(
                  (order) => DelayedOrderCard(
                    order: order,
                    onLogReason: () => controller.logDelayReason(
                      orderId: order.orderId,
                      reason: 'Kitchen backlog · ${order.section}',
                    ),
                    onAction: (action) => controller.performDelayEscalationAction(
                      orderId: order.orderId,
                      action: action,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Active escalations',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.escalations.map(
                  (alert) => EscalationAlertCard(alert: alert),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Bottleneck detection',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                BottleneckList(bottlenecks: snapshot.bottlenecks),
                const SizedBox(height: 12),
                const Text(
                  'Delay history',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                DelayHistoryList(history: snapshot.history),
              ],
            );
            final side = DelayEscalationSidePanel(
              stats: snapshot.stats,
              flags: snapshot.delayFeatures,
              onAutoEscalate: controller.autoEscalateAllDelays,
              processing: controller.delayEscalationLoading,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: main),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: side),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                main,
                const SizedBox(height: 16),
                side,
              ],
            );
          },
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
