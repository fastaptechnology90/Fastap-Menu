import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/banquet/banquet_snapshot.dart';

class BulkPrepJobCard extends StatelessWidget {
  const BulkPrepJobCard({
    super.key,
    required this.job,
    required this.onAction,
  });

  final BulkPrepJob job;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  job.eventName,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: job.status, color: AppColors.warning),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${job.location} · ${job.guestCount} guests',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            job.menuItems.join(' · '),
            style: TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w600,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _Meta('Section', job.section),
              _Meta('Timer', job.timerLabel),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: job.availableActions
                .map(
                  (action) => action == 'complete_event'
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
      'start_bulk_prep' => 'Start bulk prep',
      'coordinate_buffet' => 'Coordinate buffet',
      'complete_event' => 'Complete',
      'hold_event' => 'Hold',
      _ => action,
    };
  }
}

class EventScheduleCard extends StatelessWidget {
  const EventScheduleCard({
    super.key,
    required this.event,
    required this.onAction,
  });

  final EventSchedule event;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Row(
            children: [
              Expanded(
                child: Text(
                  event.eventName,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _Tag(label: event.status, color: AppColors.info),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${event.startTime} · ${event.mealType} · ${event.guestCount} guests · ${event.location}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: event.availableActions
                .map(
                  (action) => OutlinedButton(
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
      'schedule_meal' => 'Schedule',
      'adjust_guest_count' => 'Adjust guests',
      'assign_counter' => 'Assign counter',
      'start_bulk_prep' => 'Start prep',
      'coordinate_buffet' => 'Buffet sync',
      'complete_event' => 'Complete',
      'hold_event' => 'Hold',
      _ => action,
    };
  }
}

class BuffetStationList extends StatelessWidget {
  const BuffetStationList({super.key, required this.stations});

  final List<BuffetStation> stations;

  @override
  Widget build(BuildContext context) {
    if (stations.isEmpty) {
      return const _EmptyBox(message: 'No buffet stations configured');
    }

    return Column(
      children: stations
          .map(
            (station) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.premium.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.premium.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          station.stationName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${station.location} · ${station.courses.join(', ')}',
                          style: TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${station.servingPercent}%',
                    style: TextStyle(
                      color: AppColors.premium,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _Tag(label: station.status, color: AppColors.premium),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class GuestCountPlanList extends StatelessWidget {
  const GuestCountPlanList({super.key, required this.plans});

  final List<GuestCountPlan> plans;

  @override
  Widget build(BuildContext context) {
    if (plans.isEmpty) {
      return const _EmptyBox(message: 'No guest count plans');
    }

    return Column(
      children: plans
          .map(
            (plan) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
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
                          plan.eventName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${plan.confirmedGuests} confirmed · +${plan.bufferGuests} buffer · ${plan.preparedServings} prepared',
                          style: TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(label: plan.status, color: AppColors.info),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class CounterCoordinationList extends StatelessWidget {
  const CounterCoordinationList({super.key, required this.counters});

  final List<CounterCoordination> counters;

  @override
  Widget build(BuildContext context) {
    if (counters.isEmpty) {
      return const _EmptyBox(message: 'No counters assigned');
    }

    return Column(
      children: counters
          .map(
            (counter) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
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
                          counter.counterName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${counter.assignedChef} · ${counter.linkedEvent} · queue ${counter.queueDepth}',
                          style: TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(label: counter.status, color: AppColors.primary),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class BanquetSidePanel extends StatelessWidget {
  const BanquetSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onStartSchedule,
    required this.processing,
  });

  final BanquetStats stats;
  final BanquetFeatureFlags flags;
  final VoidCallback onStartSchedule;
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
            'Banquet metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active events', '${stats.activeEvents}'),
          _StatRow('Bulk prep jobs', '${stats.bulkPrepJobs}'),
          _StatRow('Buffet live', '${stats.buffetLive}'),
          _StatRow('Scheduled meals', '${stats.scheduledMeals}'),
          _StatRow('Total guests', '${stats.totalGuests}'),
          _StatRow('Completed today', '${stats.completedToday}'),
          const SizedBox(height: 16),
          Text(
            'Active banquet modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Bulk meal prep', flags.bulkMealPreparation),
          _FeatureChip('Buffet coordination', flags.buffetCoordination),
          _FeatureChip('Event scheduling', flags.eventMealScheduling),
          _FeatureChip('Guest count prep', flags.guestCountPreparation),
          _FeatureChip('Multi-counter sync', flags.multiCounterCoordination),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onStartSchedule,
              icon: const Icon(Icons.event_available, size: 18),
              label: const Text('Schedule new event'),
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
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          TextSpan(
            text: value,
            style: TextStyle(
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
              style: TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
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
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
