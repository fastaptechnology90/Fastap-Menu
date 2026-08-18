import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/panic_emergency/panic_emergency_snapshot.dart';

class EmergencyIncidentCard extends StatelessWidget {
  const EmergencyIncidentCard({
    super.key,
    required this.incident,
    required this.onAction,
  });

  final EmergencyIncident incident;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final typeColor = switch (incident.emergencyType) {
      'fire' => AppColors.danger,
      'gas' => AppColors.warning,
      'equipment' => AppColors.danger,
      'injury' => AppColors.info,
      'contamination' => AppColors.warning,
      _ => AppColors.danger,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: incident.severity == 'critical'
            ? AppColors.danger.withValues(alpha: 0.06)
            : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: typeColor.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  incident.title,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: _typeLabel(incident.emergencyType), color: typeColor),
              const SizedBox(width: 8),
              _Tag(label: incident.status, color: AppColors.danger),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${incident.section} · ${incident.severity} · ${incident.reportedAt} · ${incident.reportedBy}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            incident.message,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (incident.availableActions.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: incident.availableActions
                  .map(
                    (action) => _isPrimary(action)
                        ? FilledButton(
                            onPressed: () => onAction(action),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.danger,
                            ),
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
        ],
      ),
    );
  }

  static bool _isPrimary(String action) {
    return action == 'escalate_incident' ||
        action == 'activate_evacuation' ||
        action == 'broadcast_emergency';
  }

  static String _typeLabel(String type) {
    return switch (type) {
      'fire' => 'Fire',
      'gas' => 'Gas',
      'equipment' => 'Equipment',
      'injury' => 'Injury',
      'contamination' => 'Contamination',
      _ => 'Emergency',
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'acknowledge_incident' => 'Acknowledge',
      'escalate_incident' => 'Escalate',
      'resolve_incident' => 'Resolve',
      'activate_evacuation' => 'Evacuate',
      'broadcast_emergency' => 'Broadcast',
      _ => action,
    };
  }
}

class EvacuationAlertList extends StatelessWidget {
  const EvacuationAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<EvacuationAlert> alerts;
  final ValueChanged<(EvacuationAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No evacuation alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          alert.zone,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: alert.status, color: AppColors.warning),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${alert.section} · ${alert.message}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  if (alert.availableActions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: alert.availableActions
                          .map(
                            (action) => OutlinedButton(
                              onPressed: () => onAction((alert, action)),
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
      'confirm_evacuation' => 'Confirm',
      'cancel_evacuation' => 'Cancel',
      'complete_evacuation' => 'Complete',
      _ => action,
    };
  }
}

class EmergencyBroadcastList extends StatelessWidget {
  const EmergencyBroadcastList({super.key, required this.broadcasts});

  final List<EmergencyBroadcast> broadcasts;

  @override
  Widget build(BuildContext context) {
    if (broadcasts.isEmpty) {
      return const _EmptyBox(message: 'No emergency broadcasts');
    }

    return Column(
      children: broadcasts
          .map(
            (broadcast) => Container(
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
                          broadcast.broadcastType,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: broadcast.status, color: AppColors.info),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${broadcast.sentAt} · ${broadcast.message}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
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

class PanicButtonPanel extends StatelessWidget {
  const PanicButtonPanel({
    super.key,
    required this.onTrigger,
    required this.processing,
  });

  final ValueChanged<String> onTrigger;
  final bool processing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Panic button',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Instant emergency trigger · broadcasts all stations',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _PanicChip('Fire', 'fire', onTrigger, processing),
              _PanicChip('Gas', 'gas', onTrigger, processing),
              _PanicChip('Equipment', 'equipment', onTrigger, processing),
              _PanicChip('Injury', 'injury', onTrigger, processing),
              _PanicChip('Contamination', 'contamination', onTrigger, processing),
            ],
          ),
        ],
      ),
    );
  }
}

class PanicEmergencySidePanel extends StatelessWidget {
  const PanicEmergencySidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onSyncAll,
    required this.processing,
  });

  final PanicEmergencyStats stats;
  final PanicEmergencyFeatureFlags flags;
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
            'Emergency metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active incidents', '${stats.activeIncidents}'),
          _StatRow('Critical', '${stats.criticalIncidents}'),
          _StatRow('Evacuations active', '${stats.evacuationsActive}'),
          _StatRow('Broadcasts today', '${stats.broadcastsToday}'),
          _StatRow('Panic triggers', '${stats.panicTriggersToday}'),
          _StatRow('Resolved today', '${stats.resolvedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Emergency modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Fire emergency', flags.fireEmergency),
          _FeatureChip('Gas leakage', flags.gasLeakage),
          _FeatureChip('Equipment blast', flags.equipmentBlast),
          _FeatureChip('Staff injury', flags.staffInjury),
          _FeatureChip('Food contamination', flags.foodContamination),
          _FeatureChip('Panic button', flags.panicButton),
          _FeatureChip('Emergency broadcasts', flags.emergencyBroadcasts),
          _FeatureChip('Evacuation alerts', flags.evacuationAlerts),
          _FeatureChip('Incident escalation', flags.incidentEscalation),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onSyncAll,
              icon: const Icon(Icons.sync, size: 18),
              label: const Text('Sync emergency system'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PanicChip extends StatelessWidget {
  const _PanicChip(this.label, this.type, this.onTrigger, this.processing);

  final String label;
  final String type;
  final ValueChanged<String> onTrigger;
  final bool processing;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: processing ? null : () => onTrigger(type),
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.danger,
        foregroundColor: Colors.white,
      ),
      child: Text(label),
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
            color: active ? AppColors.danger : AppColors.secondaryText,
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
