import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/packing/packing_delivery_snapshot.dart';

class PackingJobCard extends StatelessWidget {
  const PackingJobCard({
    super.key,
    required this.job,
    required this.onAction,
  });

  final PackingJob job;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final typeColor = switch (job.packingType) {
      'delivery' => AppColors.info,
      'room_service' => AppColors.premium,
      'takeaway' => AppColors.warning,
      'event' => AppColors.primary,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: typeColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  job.kotNumber,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: _typeLabel(job.packingType), color: typeColor),
              const SizedBox(width: 8),
              _Tag(label: job.status, color: AppColors.secondaryText),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${job.itemsSummary} · ${job.customerName}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          PackingLabelPanel(label: job.label),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              _Check('Spill-proof', job.spillProofChecked),
              _Check('Labels printed', job.labelsPrinted),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: job.availableActions
                .map(
                  (action) => action == 'complete_packing'
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

  static String _typeLabel(String type) {
    return switch (type) {
      'delivery' => 'Delivery',
      'room_service' => 'Room service',
      'takeaway' => 'Takeaway',
      'event' => 'Event',
      _ => type,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'start_packing' => 'Start',
      'delivery_pack' => 'Delivery pack',
      'room_service_pack' => 'Room service',
      'takeaway_pack' => 'Takeaway pack',
      'event_pack' => 'Event pack',
      'spill_proof_check' => 'Spill-proof',
      'print_labels' => 'Print labels',
      'complete_packing' => 'Complete',
      'hold_packing' => 'Hold',
      _ => action,
    };
  }
}

class PackingLabelPanel extends StatelessWidget {
  const PackingLabelPanel({super.key, required this.label});

  final PackingLabel label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.panelBorder.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Packing label',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          _LabelRow('Customer', label.customerName),
          _LabelRow('Order ID', label.orderId),
          _LabelRow('Delivery type', label.deliveryType),
          _LabelRow('Allergy notes', label.allergyNotes),
          _LabelRow('Instructions', label.specialInstructions),
        ],
      ),
    );
  }
}

class PackingSidePanel extends StatelessWidget {
  const PackingSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onPrintAll,
    required this.processing,
  });

  final PackingStats stats;
  final PackingFeatureFlags flags;
  final VoidCallback onPrintAll;
  final bool processing;

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
            'Packing metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Queued jobs', '${stats.queuedJobs}'),
          _StatRow('In progress', '${stats.inProgress}'),
          _StatRow('Completed today', '${stats.completedToday}'),
          _StatRow('Delivery packs', '${stats.deliveryPacks}'),
          _StatRow('Room service', '${stats.roomServicePacks}'),
          _StatRow('Takeaway', '${stats.takeawayPacks}'),
          _StatRow('Event packs', '${stats.eventPacks}'),
          _StatRow('Spill-proof checks', '${stats.spillProofChecks}'),
          const SizedBox(height: 16),
          Text(
            'Active packing modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          ...[
            ('Delivery packing', flags.deliveryPacking),
            ('Room service packing', flags.roomServicePacking),
            ('Takeaway packing', flags.takeawayPacking),
            ('Event packing', flags.eventPacking),
            ('Spill-proof checks', flags.spillProofChecks),
            ('Packing labels', flags.packingLabels),
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
                      style: TextStyle(
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
              onPressed: processing ? null : onPrintAll,
              icon: const Icon(Icons.print_outlined, size: 18),
              label: const Text('Print all labels'),
            ),
          ),
        ],
      ),
    );
  }
}

class _LabelRow extends StatelessWidget {
  const _LabelRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
                fontSize: 11,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: AppColors.bodyText,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
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
          style: TextStyle(
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
              style: TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
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
