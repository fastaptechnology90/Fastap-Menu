import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/safety/allergy_safety_snapshot.dart';

class SafetyCaseCard extends StatelessWidget {
  const SafetyCaseCard({
    super.key,
    required this.safetyCase,
    required this.onAction,
  });

  final SafetyCase safetyCase;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final borderColor = _colorForCode(safetyCase.colorCode);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor, width: 1.5),
        boxShadow: safetyCase.severity == 'critical'
            ? [
                BoxShadow(
                  color: borderColor.withValues(alpha: 0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.health_and_safety_outlined, color: borderColor, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  safetyCase.kotNumber,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
              _Tag(label: safetyCase.statusLabel, color: borderColor),
              if (safetyCase.vip)
                const _Tag(label: 'VIP', color: AppColors.premium),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${safetyCase.location} · ${safetyCase.section} · ${safetyCase.assignedChef}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: safetyCase.allergyTypes
                .map((type) => _Tag(label: type, color: borderColor))
                .toList(),
          ),
          const SizedBox(height: 8),
          Text(
            safetyCase.items.join(', '),
            style: const TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _StatusChip(
                label: safetyCase.chefConfirmed ? 'Chef confirmed' : 'Chef pending',
                color: safetyCase.chefConfirmed ? AppColors.primary : AppColors.danger,
              ),
              _StatusChip(
                label: safetyCase.sopAcknowledged ? 'SOP ack' : 'SOP pending',
                color: safetyCase.sopAcknowledged ? AppColors.primary : AppColors.warning,
              ),
              if (safetyCase.crossContaminationRisk)
                const _StatusChip(
                  label: 'Cross-contam risk',
                  color: AppColors.danger,
                ),
              if (safetyCase.dedicatedPrepRequired)
                const _StatusChip(
                  label: 'Dedicated prep',
                  color: AppColors.info,
                ),
            ],
          ),
          const SizedBox(height: 10),
          ...safetyCase.warnings.map(
            (warning) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_rounded, size: 14, color: borderColor),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      warning,
                      style: TextStyle(
                        color: borderColor,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: safetyCase.availableActions
                .map(
                  (action) => OutlinedButton(
                    onPressed: () => onAction(action),
                    style: action == 'escalate'
                        ? OutlinedButton.styleFrom(foregroundColor: AppColors.danger)
                        : null,
                    child: Text(_actionLabel(action)),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  static Color _colorForCode(String code) {
    return switch (code) {
      'danger' => AppColors.danger,
      'warning' => AppColors.warning,
      'info' => AppColors.info,
      _ => AppColors.primary,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'confirm_chef' => 'Chef confirm',
      'acknowledge_sop' => 'Acknowledge SOP',
      'mark_contained' => 'Mark contained',
      'clear_case' => 'Clear case',
      'escalate' => 'Escalate',
      _ => action,
    };
  }
}

class SafetyBoardPanel extends StatelessWidget {
  const SafetyBoardPanel({
    super.key,
    required this.stats,
    required this.safetyFeatures,
    required this.allergyTypes,
  });

  final SafetyStats stats;
  final SafetyFeatureFlags safetyFeatures;
  final List<String> allergyTypes;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Panel(
          title: 'Safety features',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Color coding', safetyFeatures.allergyColorCoding),
              _FlagChip('Chef confirm', safetyFeatures.mandatoryChefConfirmation),
              _FlagChip('Cross-contam', safetyFeatures.crossContaminationWarnings),
              _FlagChip('Dedicated prep', safetyFeatures.dedicatedPrepWarnings),
              _FlagChip('SOP reminders', safetyFeatures.safetySopReminders),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Safety stats',
          child: Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat(label: 'Cases', value: '${stats.totalCases}'),
              _Stat(label: 'Active', value: '${stats.activeCases}'),
              _Stat(label: 'Critical', value: '${stats.criticalCases}'),
              _Stat(label: 'Chef pending', value: '${stats.pendingChefConfirm}'),
              _Stat(label: 'SOP pending', value: '${stats.pendingSopAck}'),
              _Stat(label: 'Cross-contam', value: '${stats.crossContaminationAlerts}'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Allergy types monitored',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: allergyTypes
                .map(
                  (type) => Chip(
                    avatar: const Icon(
                      Icons.coronavirus_outlined,
                      size: 16,
                      color: AppColors.danger,
                    ),
                    label: Text(type),
                    backgroundColor: AppColors.danger.withValues(alpha: 0.08),
                  ),
                )
                .toList(),
          ),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
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

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: 6),
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

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
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
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
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
