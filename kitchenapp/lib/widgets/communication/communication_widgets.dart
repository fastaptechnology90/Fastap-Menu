import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/communication/kitchen_communication_snapshot.dart';

class CommunicationThreadCard extends StatelessWidget {
  const CommunicationThreadCard({
    super.key,
    required this.thread,
    required this.selected,
    required this.onTap,
  });

  final CommunicationThread thread;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary.withValues(alpha: 0.08)
              : AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.panelBorder,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    thread.waiterName,
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                if (thread.unreadCount > 0)
                  CircleAvatar(
                    radius: 10,
                    backgroundColor: AppColors.danger,
                    child: Text(
                      '${thread.unreadCount}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${thread.kotNumber} · ${thread.location}',
              style: TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CommunicationMessageList extends StatelessWidget {
  const CommunicationMessageList({super.key, required this.messages});

  final List<CommunicationMessage> messages;

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) {
      return Text(
        'No messages in this thread yet.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: messages
          .map(
            (message) => Align(
              alignment: message.senderRole == 'kitchen'
                  ? Alignment.centerRight
                  : Alignment.centerLeft,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 420),
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: message.senderRole == 'kitchen'
                      ? AppColors.primary.withValues(alpha: 0.1)
                      : AppColors.chipBackground,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.panelBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (message.type == 'voice')
                          const Icon(Icons.mic, size: 14),
                        if (message.type == 'delay_update')
                          const Icon(Icons.schedule, size: 14),
                        if (message.type == 'modification_request')
                          const Icon(Icons.edit_note, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          message.sender,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      message.body,
                      style: TextStyle(
                        color: AppColors.bodyText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class CommunicationAlertCard extends StatelessWidget {
  const CommunicationAlertCard({
    super.key,
    required this.alert,
    required this.onAction,
  });

  final CommunicationAlert alert;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final color = _severityColor(alert.severity);

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
            alert.title,
            style: TextStyle(color: color, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            alert.detail,
            style: TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (alert.status == 'open' && alert.availableActions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: alert.availableActions
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

  static Color _severityColor(String severity) {
    return switch (severity) {
      'critical' => AppColors.danger,
      'high' => AppColors.warning,
      _ => AppColors.info,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'acknowledge' => 'Acknowledge',
      'respond' => 'Respond',
      'resolve' => 'Resolve',
      _ => action,
    };
  }
}

class AnnouncementList extends StatelessWidget {
  const AnnouncementList({super.key, required this.announcements});

  final List<ChefAnnouncement> announcements;

  @override
  Widget build(BuildContext context) {
    if (announcements.isEmpty) {
      return Text(
        'No chef announcements.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: announcements
          .map(
            (item) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.body,
                    style: TextStyle(
                      color: AppColors.bodyText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.author} · ${item.scope}',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
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

class BroadcastList extends StatelessWidget {
  const BroadcastList({super.key, required this.broadcasts});

  final List<KitchenBroadcast> broadcasts;

  @override
  Widget build(BuildContext context) {
    if (broadcasts.isEmpty) {
      return Text(
        'No broadcast messages.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: broadcasts
          .map(
            (item) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.message,
                    style: TextStyle(
                      color: AppColors.bodyText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.author} · ${item.scope}',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
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

class CommunicationStatsPanel extends StatelessWidget {
  const CommunicationStatsPanel({
    super.key,
    required this.stats,
    required this.flags,
  });

  final CommunicationStats stats;
  final CommunicationFeatureFlags flags;

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
            'Communication hub',
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
              _Stat('Threads', stats.threads),
              _Stat('Unread', stats.unreadMessages),
              _Stat('Alerts', stats.openAlerts),
              _Stat('Voice', stats.voiceNotes),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Waiter chat', flags.waiterKitchenChat),
              _FlagChip('Voice notes', flags.voiceNotes),
              _FlagChip('Delay updates', flags.delayUpdates),
              _FlagChip('Availability', flags.itemAvailabilityAlerts),
              _FlagChip('Announcements', flags.chefAnnouncements),
              _FlagChip('Broadcasts', flags.broadcastMessages),
              _FlagChip('Out of stock', flags.outOfStockAlerts),
              _FlagChip('Mod requests', flags.modificationRequests),
              _FlagChip('Re-fire', flags.refireRequests),
            ],
          ),
        ],
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
