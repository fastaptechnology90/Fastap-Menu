import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/expeditor/expeditor_snapshot.dart';

class ExpeditorTicketCard extends StatelessWidget {
  const ExpeditorTicketCard({
    super.key,
    required this.ticket,
    required this.onAction,
  });

  final ExpeditorTicket ticket;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (ticket.status) {
      'dispatch_ready' => AppColors.primary,
      'validated' => AppColors.info,
      'packaging_verified' => AppColors.warning,
      'on_hold' => AppColors.danger,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ticket.kotNumber,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: _statusLabel(ticket.status), color: statusColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${ticket.summary} · ${ticket.location}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              _Check('Final validation', ticket.finalValidated),
              _Check('Packaging', ticket.packagingVerified),
              _Check('Dispatch approved', ticket.dispatchApproved),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ticket.availableActions
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

  static String _statusLabel(String status) {
    return switch (status) {
      'awaiting_validation' => 'Awaiting validation',
      'validated' => 'Validated',
      'packaging_verified' => 'Packaging OK',
      'dispatch_ready' => 'Dispatch ready',
      'dispatched' => 'Dispatched',
      'on_hold' => 'On hold',
      _ => status,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'validate_final' => 'Validate',
      'verify_packaging' => 'Verify packaging',
      'approve_dispatch' => 'Approve dispatch',
      'dispatch' => 'Dispatch',
      'hold' => 'Hold',
      _ => action,
    };
  }
}

class CoordinationGroupCard extends StatelessWidget {
  const CoordinationGroupCard({
    super.key,
    required this.group,
    required this.onCoordinate,
  });

  final CoordinationGroup group;
  final VoidCallback onCoordinate;

  @override
  Widget build(BuildContext context) {
    final color = group.allReady ? AppColors.primary : AppColors.warning;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  group.location,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: group.syncStatus, color: color),
            ],
          ),
          const SizedBox(height: 10),
          ...group.sections.map(
            (section) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${section.kotNumber} · ${section.section}',
                      style: const TextStyle(
                        color: AppColors.bodyText,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  _Tag(
                    label: section.status,
                    color: section.status == 'ready'
                        ? AppColors.primary
                        : AppColors.info,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: onCoordinate,
            child: const Text('Coordinate sections'),
          ),
        ],
      ),
    );
  }
}

class TableSyncList extends StatelessWidget {
  const TableSyncList({
    super.key,
    required this.entries,
    required this.onSync,
  });

  final List<TableSyncEntry> entries;
  final ValueChanged<String> onSync;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const _EmptyList(message: 'No table sync entries');
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.location,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${entry.kotCount} KOTs · ${entry.syncStatus}',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton(
                    onPressed: entry.syncStatus == 'synced'
                        ? null
                        : () => onSync(entry.tableNumber),
                    child: const Text('Sync'),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class ExpeditorSidePanel extends StatelessWidget {
  const ExpeditorSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onSyncAll,
    required this.processing,
  });

  final ExpeditorStats stats;
  final ExpeditorFeatureFlags flags;
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
            'Expeditor metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Awaiting validation', '${stats.awaitingValidation}'),
          _StatRow('Coordination groups', '${stats.coordinationGroups}'),
          _StatRow('Packaging checks', '${stats.packagingChecks}'),
          _StatRow('Dispatch ready', '${stats.dispatchReady}'),
          _StatRow('Dispatched today', '${stats.dispatchedToday}'),
          _StatRow('Tables synced', '${stats.tablesSynced}'),
          const SizedBox(height: 16),
          const Text(
            'Active expeditor modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          ...[
            ('Final order validation', flags.finalOrderValidation),
            ('Multi-section coordination', flags.multiSectionCoordination),
            ('Table synchronization', flags.tableSynchronization),
            ('Dispatch approval', flags.dispatchApproval),
            ('Packaging verification', flags.packagingVerification),
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
              label: const Text('Sync all tables'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Check extends StatelessWidget {
  const _Check(this.label, this.passed);

  final String label;
  final bool passed;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          passed ? Icons.check_circle : Icons.radio_button_unchecked,
          size: 16,
          color: passed ? AppColors.primary : AppColors.secondaryText,
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.bodyText,
            fontWeight: FontWeight.w600,
            fontSize: 11,
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
