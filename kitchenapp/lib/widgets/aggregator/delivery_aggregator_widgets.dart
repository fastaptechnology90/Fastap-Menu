import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/aggregator/delivery_aggregator_snapshot.dart';

class AggregatorOrderCard extends StatelessWidget {
  const AggregatorOrderCard({
    super.key,
    required this.order,
    required this.onAction,
  });

  final AggregatorOrder order;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final platformColor = switch (order.platform) {
      'Swiggy' => const Color(0xFFFC8019),
      'Zomato' => const Color(0xFFE23744),
      'ONDC' => AppColors.primary,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: order.riderWaiting ? AppColors.danger : platformColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  order.kotNumber,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: order.platform, color: platformColor),
              if (order.riderWaiting) ...[
                const SizedBox(width: 8),
                const _Tag(label: 'Rider waiting', color: AppColors.danger),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Text(
            order.itemsSummary,
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _Meta('Pickup', order.countdownLabel),
              _Meta('Prep timer', order.prepTimerLabel),
              _Meta('Sync', order.syncStatus),
              _Meta('Dispatch', order.dispatchStatus),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: order.availableActions
                .map(
                  (action) => action == 'dispatch'
                      ? FilledButton(
                          onPressed: () => onAction(action),
                          child: Text(_actionLabel(action)),
                        )
                      : OutlinedButton(
                          onPressed: () => onAction(action),
                          child: Text(_actionLabel(action)),
                        ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'sync_order' => 'Sync',
      'acknowledge_rider' => 'Ack rider',
      'start_prep_timer' => 'Start prep',
      'ready_for_pickup' => 'Ready pickup',
      'dispatch' => 'Dispatch',
      'extend_countdown' => 'Extend',
      _ => action,
    };
  }
}

class RiderAlertList extends StatelessWidget {
  const RiderAlertList({super.key, required this.alerts});

  final List<RiderAlert> alerts;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyList(message: 'No rider waiting alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.danger.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${alert.kotNumber} · ${alert.platform}',
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          alert.message,
                          style: const TextStyle(
                            color: AppColors.bodyText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(
                    label: alert.severity,
                    color: alert.severity == 'high'
                        ? AppColors.danger
                        : AppColors.warning,
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class DispatchTrackingList extends StatelessWidget {
  const DispatchTrackingList({super.key, required this.entries});

  final List<DispatchTrackingEntry> entries;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const _EmptyList(message: 'No dispatch tracking events');
    }

    return Column(
      children: entries
          .map(
            (entry) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${entry.kotNumber} · ${entry.platform}',
                      style: const TextStyle(
                        color: AppColors.primaryText,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  _Tag(label: entry.status, color: AppColors.info),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class AggregatorSidePanel extends StatelessWidget {
  const AggregatorSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onSyncAll,
    required this.processing,
  });

  final AggregatorStats stats;
  final AggregatorFeatureFlags flags;
  final VoidCallback onSyncAll;
  final bool processing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Aggregator metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active orders', '${stats.activeOrders}'),
          _StatRow('Swiggy', '${stats.swiggyOrders}'),
          _StatRow('Zomato', '${stats.zomatoOrders}'),
          _StatRow('ONDC', '${stats.ondcOrders}'),
          _StatRow('Rider alerts', '${stats.riderAlerts}'),
          _StatRow('Awaiting pickup', '${stats.awaitingPickup}'),
          _StatRow('Dispatched today', '${stats.dispatchedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Platforms & modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          ...[
            ('Swiggy', flags.swiggy),
            ('Zomato', flags.zomato),
            ('ONDC', flags.ondc),
            ('Order sync', flags.aggregatorOrderSync),
            ('Pickup countdown', flags.pickupCountdown),
            ('Rider alerts', flags.riderWaitingAlerts),
            ('Dispatch tracking', flags.dispatchTracking),
            ('Prep timers', flags.deliveryPrepTimers),
          ].map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(
                    entry.$2 ? Icons.check_circle : Icons.circle_outlined,
                    size: 16,
                    color: entry.$2 ? AppColors.primary : AppColors.secondaryText,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      entry.$1,
                      style: const TextStyle(
                        color: AppColors.bodyText,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onSyncAll,
              icon: const Icon(Icons.sync, size: 18),
              label: const Text('Sync all orders'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 10,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _EmptyList extends StatelessWidget {
  const _EmptyList({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
