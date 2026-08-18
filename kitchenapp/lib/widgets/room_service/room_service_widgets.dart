import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/room_service/room_service_snapshot.dart';

class RoomOrderCard extends StatelessWidget {
  const RoomOrderCard({
    super.key,
    required this.order,
    required this.onAction,
  });

  final RoomOrder order;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final priorityColor = order.priority.contains('vip')
        ? AppColors.premium
        : AppColors.primary;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: priorityColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Room ${order.roomNumber} · ${order.kotNumber}',
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: order.guestType, color: priorityColor),
              const SizedBox(width: 8),
              _Tag(label: order.status, color: AppColors.secondaryText),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            order.itemSummary,
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
              _Meta('Section', order.section),
              _Meta('Priority', order.priority),
              _Meta('Timer', order.timerLabel),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: order.availableActions
                .map(
                  (action) => action == 'complete_order' ||
                          action == 'dispatch_tray'
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
      'acknowledge_vip' => 'Ack VIP',
      'start_preparation' => 'Start prep',
      'schedule_delivery' => 'Schedule',
      'assign_tray' => 'Assign tray',
      'sync_minibar' => 'Sync minibar',
      'dispatch_tray' => 'Dispatch',
      'complete_order' => 'Complete',
      'hold_order' => 'Hold',
      _ => action,
    };
  }
}

class VipRoomAlertList extends StatelessWidget {
  const VipRoomAlertList({super.key, required this.alerts});

  final List<VipRoomAlert> alerts;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No VIP room alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.premium.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.premium.withValues(alpha: 0.25),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Room ${alert.roomNumber}',
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${alert.guestName} · ${alert.alertType}',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(label: alert.priority, color: AppColors.premium),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class ScheduledDeliveryList extends StatelessWidget {
  const ScheduledDeliveryList({super.key, required this.deliveries});

  final List<ScheduledDelivery> deliveries;

  @override
  Widget build(BuildContext context) {
    if (deliveries.isEmpty) {
      return const _EmptyBox(message: 'No scheduled room deliveries');
    }

    return Column(
      children: deliveries
          .map(
            (delivery) => Container(
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Room ${delivery.roomNumber} · ${delivery.kotNumber}',
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${delivery.scheduledTime} · ${delivery.itemSummary}',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(label: delivery.status, color: AppColors.info),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class TrayAssignmentList extends StatelessWidget {
  const TrayAssignmentList({super.key, required this.trays});

  final List<TrayAssignment> trays;

  @override
  Widget build(BuildContext context) {
    if (trays.isEmpty) {
      return const _EmptyBox(message: 'No trays assigned');
    }

    return Column(
      children: trays
          .map(
            (tray) => Container(
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${tray.trayId} · Room ${tray.roomNumber}',
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${tray.kotNumber} · ${tray.staffName}',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(
                    label: tray.status,
                    color: tray.status == 'in_transit'
                        ? AppColors.warning
                        : AppColors.primary,
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class MiniBarSyncList extends StatelessWidget {
  const MiniBarSyncList({super.key, required this.items});

  final List<MiniBarSyncItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyBox(message: 'No mini-bar sync items');
    }

    return Column(
      children: items
          .map(
            (item) => Container(
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Room ${item.roomNumber} · ${item.itemName}',
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Qty ${item.quantity} · ${item.lastSyncedAt}',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(
                    label: item.syncStatus,
                    color: item.syncStatus == 'pending'
                        ? AppColors.warning
                        : AppColors.primary,
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class RoomServiceSidePanel extends StatelessWidget {
  const RoomServiceSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onDispatchTrays,
    required this.processing,
  });

  final RoomServiceStats stats;
  final RoomServiceFeatureFlags flags;
  final VoidCallback onDispatchTrays;
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
            'Room service metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active room orders', '${stats.activeRoomOrders}'),
          _StatRow('VIP rooms', '${stats.vipRooms}'),
          _StatRow('Scheduled deliveries', '${stats.scheduledDeliveries}'),
          _StatRow('Trays in transit', '${stats.traysInTransit}'),
          _StatRow('Mini-bar pending', '${stats.miniBarPending}'),
          _StatRow('Completed today', '${stats.completedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Active room modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Room-wise tracking', flags.roomWiseOrderTracking),
          _FeatureChip('VIP room priority', flags.vipRoomPriority),
          _FeatureChip('Scheduled delivery', flags.scheduledRoomDelivery),
          _FeatureChip('Tray management', flags.trayManagement),
          _FeatureChip('Mini-bar sync', flags.miniBarSynchronization),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onDispatchTrays,
              icon: const Icon(Icons.room_service, size: 18),
              label: const Text('Dispatch ready trays'),
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
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
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
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          TextSpan(
            text: value,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ],
      ),
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

class _FeatureChip extends StatelessWidget {
  const _FeatureChip(this.label, this.active);

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(
            active ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: active ? AppColors.primary : AppColors.secondaryText,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: active ? AppColors.primaryText : AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({required this.message});

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
