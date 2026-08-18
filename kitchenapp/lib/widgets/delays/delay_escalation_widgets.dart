import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/delays/delay_escalation_snapshot.dart';

class DelayedOrderCard extends StatelessWidget {
  const DelayedOrderCard({
    super.key,
    required this.order,
    required this.onAction,
    required this.onLogReason,
  });

  final DelayedOrder order;
  final ValueChanged<String> onAction;
  final VoidCallback onLogReason;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: order.escalated ? AppColors.danger : AppColors.warning,
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
              if (order.escalated)
                const _Tag(label: 'Escalated', color: AppColors.danger),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${order.location} · ${order.section}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _Meta('Timer', order.timerLabel),
              _Meta('Delay', '${order.delayMinutes}m'),
              if (order.delayReason != null) _Meta('Reason', order.delayReason!),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: onLogReason,
                child: const Text('Log reason'),
              ),
              ...order.availableActions
                  .where((action) => action != 'log_reason')
                  .map(
                    (action) => OutlinedButton(
                      onPressed: () => onAction(action),
                      child: Text(_actionLabel(action)),
                    ),
                  ),
            ],
          ),
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'escalate_chef' => 'Chef alert',
      'escalate_manager' => 'Manager alert',
      'escalate_operations' => 'Ops alert',
      'auto_escalate' => 'Auto escalate',
      'resolve' => 'Resolve',
      _ => action,
    };
  }
}

class EscalationAlertCard extends StatelessWidget {
  const EscalationAlertCard({super.key, required this.alert});

  final EscalationAlert alert;

  @override
  Widget build(BuildContext context) {
    final color = switch (alert.level) {
      'operations' => AppColors.danger,
      'kitchen_manager' => AppColors.warning,
      _ => AppColors.info,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            alert.levelLabel,
            style: TextStyle(color: color, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            '${alert.kotNumber} · ${alert.reason}',
            style: const TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class DelayHistoryList extends StatelessWidget {
  const DelayHistoryList({super.key, required this.history});

  final List<DelayHistoryEntry> history;

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return const Text(
        'No delay history logged yet.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: history
          .map(
            (entry) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.chipBackground,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Text(
                '${entry.kotNumber} · ${entry.reason}',
                style: const TextStyle(
                  color: AppColors.bodyText,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class BottleneckList extends StatelessWidget {
  const BottleneckList({super.key, required this.bottlenecks});

  final List<BottleneckInsight> bottlenecks;

  @override
  Widget build(BuildContext context) {
    if (bottlenecks.isEmpty) {
      return const Text(
        'No bottlenecks detected.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: bottlenecks
          .map(
            (item) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: item.severity == 'critical'
                    ? AppColors.danger.withValues(alpha: 0.08)
                    : AppColors.warning.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${item.section} · ${item.delayedOrders} delayed · ${item.bottleneck}',
                style: const TextStyle(
                  color: AppColors.bodyText,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class DelayEscalationSidePanel extends StatelessWidget {
  const DelayEscalationSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onAutoEscalate,
    required this.processing,
  });

  final DelayEscalationStats stats;
  final DelayFeatureFlags flags;
  final VoidCallback onAutoEscalate;
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
            'Escalation overview',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat('Delayed', stats.delayedOrders),
              _Stat('Escalations', stats.openEscalations),
              _Stat('History', stats.historyEvents),
              _Stat('Bottlenecks', stats.bottlenecks),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Delay timer', flags.delayTimer),
              _FlagChip('Reason log', flags.delayReasonLogging),
              _FlagChip('Auto escalate', flags.autoEscalation),
              _FlagChip('Delay history', flags.delayHistory),
              _FlagChip('Bottlenecks', flags.bottleneckDetection),
              _FlagChip('Chef alert', flags.chefAlert),
              _FlagChip('Manager alert', flags.kitchenManagerAlert),
              _FlagChip('Ops alert', flags.operationsAlert),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: processing ? null : onAutoEscalate,
            icon: processing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.notification_important_outlined, size: 18),
            label: const Text('Auto escalate all'),
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

class _Meta extends StatelessWidget {
  const _Meta(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$label: $value',
      style: const TextStyle(
        color: AppColors.secondaryText,
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$value',
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _FlagChip extends StatelessWidget {
  const _FlagChip(this.label, this.enabled);

  final String label;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(
        enabled ? Icons.check_circle : Icons.radio_button_unchecked,
        size: 16,
        color: enabled ? AppColors.primary : AppColors.secondaryText,
      ),
      label: Text(label),
      backgroundColor: enabled
          ? AppColors.primary.withValues(alpha: 0.08)
          : AppColors.chipBackground,
    );
  }
}
