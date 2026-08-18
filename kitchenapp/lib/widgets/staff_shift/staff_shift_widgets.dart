import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/staff_shift/staff_shift_snapshot.dart';

class StaffShiftCard extends StatelessWidget {
  const StaffShiftCard({
    super.key,
    required this.record,
    required this.onAction,
  });

  final StaffShiftRecord record;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (record.shiftStatus) {
      'on_shift' => AppColors.primary,
      'on_break' => AppColors.warning,
      'overtime' => AppColors.danger,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  record.staffName,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: record.shiftLabel, color: AppColors.info),
              const SizedBox(width: 8),
              _Tag(label: record.shiftStatus, color: statusColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${record.role} · ${record.section} · attendance ${record.attendanceStatus}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _MetricChip('Clock in', record.clockInTime),
              _MetricChip('Clock out', record.clockOutTime),
              _MetricChip('Break', '${record.breakMinutes} min'),
              _MetricChip('Overtime', '${record.overtimeMinutes} min'),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: record.availableActions
                .map(
                  (action) => action == 'start_shift' ||
                          action == 'end_shift' ||
                          action == 'end_break'
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
      'start_shift' => 'Start shift',
      'end_shift' => 'End shift',
      'start_break' => 'Start break',
      'end_break' => 'End break',
      'mark_overtime' => 'Mark OT',
      'request_swap' => 'Request swap',
      _ => action,
    };
  }
}

class ShiftSwapList extends StatelessWidget {
  const ShiftSwapList({
    super.key,
    required this.swaps,
    required this.onAction,
  });

  final List<ShiftSwapRequest> swaps;
  final ValueChanged<(ShiftSwapRequest swap, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (swaps.isEmpty) {
      return const _EmptyBox(message: 'No shift swap requests');
    }

    return Column(
      children: swaps
          .map(
            (swap) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          swap.requesterName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: swap.status, color: AppColors.info),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${swap.section} · ${swap.shiftLabel} · swap with ${swap.targetStaffName}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  if (swap.availableActions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: swap.availableActions
                          .map(
                            (action) => action == 'approve_swap'
                                ? FilledButton(
                                    onPressed: () => onAction((swap, action)),
                                    child: Text(_actionLabel(action)),
                                  )
                                : OutlinedButton(
                                    onPressed: () => onAction((swap, action)),
                                    child: Text(_actionLabel(action)),
                                  ),
                          )
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'approve_swap' => 'Approve',
      'reject_swap' => 'Reject',
      _ => action,
    };
  }
}

class ShiftHandoverList extends StatelessWidget {
  const ShiftHandoverList({
    super.key,
    required this.notes,
    required this.onAction,
  });

  final List<ShiftHandoverNote> notes;
  final ValueChanged<(ShiftHandoverNote note, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (notes.isEmpty) {
      return const _EmptyBox(message: 'No handover notes');
    }

    return Column(
      children: notes
          .map(
            (note) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${note.fromStaff} → ${note.toStaff}',
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: note.status, color: AppColors.warning),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${note.section} · ${note.notePreview}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  if (note.availableActions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: note.availableActions
                          .map(
                            (action) => OutlinedButton(
                              onPressed: () => onAction((note, action)),
                              child: Text(_actionLabel(action)),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'acknowledge_handover' => 'Acknowledge',
      'add_handover_note' => 'Update note',
      _ => action,
    };
  }
}

class StaffShiftSidePanel extends StatelessWidget {
  const StaffShiftSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onSyncAll,
    required this.processing,
  });

  final StaffShiftStats stats;
  final StaffShiftFeatureFlags flags;
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
            'Shift metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('On shift now', '${stats.onShiftNow}'),
          _StatRow('On break', '${stats.onBreak}'),
          _StatRow('Overtime active', '${stats.overtimeActive}'),
          _StatRow('Late arrivals', '${stats.lateArrivals}'),
          _StatRow('Pending swaps', '${stats.pendingSwaps}'),
          _StatRow('Open handovers', '${stats.openHandovers}'),
          const SizedBox(height: 16),
          const Text(
            'Active modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Shift start/end', flags.shiftStartEnd),
          _FeatureChip('Attendance tracking', flags.attendanceTracking),
          _FeatureChip('Break tracking', flags.breakTracking),
          _FeatureChip('Overtime tracking', flags.overtimeTracking),
          _FeatureChip('Shift swap', flags.shiftSwap),
          _FeatureChip('Handover notes', flags.shiftHandoverNotes),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onSyncAll,
              icon: const Icon(Icons.sync, size: 18),
              label: const Text('Sync shift board'),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip(this.label, this.value);

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
            fontSize: 11,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 14,
          ),
        ),
      ],
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
