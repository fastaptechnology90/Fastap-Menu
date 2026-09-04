import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/priority/order_priority_snapshot.dart';

class PriorityOrderCard extends StatelessWidget {
  const PriorityOrderCard({
    super.key,
    required this.order,
    required this.onAction,
  });

  final PriorityOrder order;
  final void Function(String action) onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: order.flashAlert ? AppColors.warning : AppColors.panelBorder,
          width: order.flashAlert ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(order.base.priorityIcon, color: AppColors.premium, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  order.base.title,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _PriorityTag(label: order.priorityLabel),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${order.base.location} · ${order.base.section}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _MetaChip('Score ${order.priorityScore}'),
              _MetaChip('Queue #${order.queuePosition}'),
              if (order.flashAlert) const _MetaChip('Flash alert'),
              if (order.soundAlert) const _MetaChip('Sound alert'),
              if (order.escalated) const _MetaChip('Escalated'),
            ],
          ),
          if (order.availableActions.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: order.availableActions
                  .map(
                    (action) => OutlinedButton(
                      onPressed: () => onAction(action),
                      child: Text(_actionLabel(action)),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'queue_jump' => 'Queue jump',
      'flash_alert' => 'Flash alert',
      'sound_alert' => 'Sound alert',
      'auto_escalate' => 'Auto escalate',
      'auto_reassign' => 'Auto reassign',
      _ => action,
    };
  }
}

class PriorityLanesPanel extends StatelessWidget {
  const PriorityLanesPanel({super.key, required this.lanes});

  final List<PriorityLane> lanes;

  @override
  Widget build(BuildContext context) {
    if (lanes.isEmpty) {
      return Text(
        'No active priority lanes for this section.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: lanes
          .map(
            (lane) => Container(
              width: 180,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.chipBackground,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lane.label,
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${lane.count} orders',
                    style: TextStyle(
                      color: AppColors.premium,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class PriorityAlertsPanel extends StatelessWidget {
  const PriorityAlertsPanel({super.key, required this.alerts});

  final List<PriorityAlert> alerts;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return Text(
        'No active flash, sound, or escalation alerts.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: alerts
          .map(
            (alert) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _alertColor(alert.type).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _alertColor(alert.type).withValues(alpha: 0.25),
                ),
              ),
              child: Text(
                alert.message,
                style: TextStyle(
                  color: _alertColor(alert.type),
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  static Color _alertColor(String type) {
    return switch (type) {
      'flash' => AppColors.warning,
      'sound' => AppColors.info,
      'escalation' => AppColors.danger,
      _ => AppColors.primary,
    };
  }
}

class PriorityEnginePanel extends StatelessWidget {
  const PriorityEnginePanel({
    super.key,
    required this.flags,
    required this.stats,
    required this.onReprioritize,
    required this.reprioritizing,
  });

  final PriorityEngineFlags flags;
  final PriorityStats stats;
  final VoidCallback onReprioritize;
  final bool reprioritizing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Panel(
          title: 'Priority lanes',
          child: Wrap(
            spacing: 12,
            runSpacing: 10,
            children: [
              _Stat('VIP', stats.vip),
              _Stat('Express', stats.express),
              _Stat('Room svc', stats.roomService),
              _Stat('Event', stats.event),
              _Stat('Delivery', stats.delivery),
              _Stat('Child meal', stats.childMeal),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Engine capabilities',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('VIP lane', flags.vipPrioritization),
              _FlagChip('Express', flags.expressLane),
              _FlagChip('Room service', flags.roomServicePriority),
              _FlagChip('Event', flags.eventPriority),
              _FlagChip('Delivery', flags.deliveryPriority),
              _FlagChip('Child meal', flags.childMealPriority),
              _FlagChip('Queue jump', flags.queueJump),
              _FlagChip('Flash alert', flags.flashAlert),
              _FlagChip('Sound alert', flags.soundAlert),
              _FlagChip('Auto escalate', flags.autoEscalation),
              _FlagChip('Auto reassign', flags.autoReassignment),
            ],
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: reprioritizing ? null : onReprioritize,
          icon: reprioritizing
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.low_priority, size: 18),
          label: const Text('Reprioritize queue'),
        ),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _PriorityTag extends StatelessWidget {
  const _PriorityTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.premium.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: AppColors.premium,
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label),
      visualDensity: VisualDensity.compact,
      backgroundColor: AppColors.chipBackground,
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
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
