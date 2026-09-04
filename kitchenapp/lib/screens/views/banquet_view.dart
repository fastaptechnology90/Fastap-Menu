import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/banquet/banquet_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/banquet/banquet_widgets.dart';

class BanquetView extends StatelessWidget {
  const BanquetView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.banquetLoading && controller.banquet == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.banquet;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.banquetErrorMessage ??
            'Event & banquet system unavailable',
        onRetry: () => controller.refreshBanquet(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.panelBorder),
          ),
          child: Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'System 27 · Event & Banquet Kitchen System',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Bulk prep · buffet · scheduling · guests · counters',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.banquetLoading
                    ? null
                    : () => controller.refreshBanquet(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.banquetActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.banquetActionMessage!,
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 960;
            final main = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bulk meal preparation',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                if (snapshot.bulkPrepJobs.isEmpty)
                  const _EmptyBox(message: 'No bulk prep jobs')
                else
                  ...snapshot.bulkPrepJobs.map(
                    (job) => BulkPrepJobCard(
                      job: job,
                      onAction: (action) => controller.performBanquetAction(
                        eventId: job.eventId,
                        action: action,
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                Text(
                  'Event meal scheduling',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                if (snapshot.eventSchedules.isEmpty)
                  const _EmptyBox(message: 'No scheduled events')
                else
                  ...snapshot.eventSchedules.map(
                    (event) => EventScheduleCard(
                      event: event,
                      onAction: (action) => _handleEventAction(
                        controller,
                        event,
                        action,
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                Text(
                  'Buffet coordination',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                BuffetStationList(stations: snapshot.buffetStations),
                const SizedBox(height: 8),
                Text(
                  'Guest count preparation',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                GuestCountPlanList(plans: snapshot.guestCountPlans),
                const SizedBox(height: 8),
                Text(
                  'Multi-counter coordination',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                CounterCoordinationList(counters: snapshot.counterCoordination),
              ],
            );
            final side = BanquetSidePanel(
              stats: snapshot.stats,
              flags: snapshot.banquetFeatures,
              onStartSchedule: controller.startBanquetSchedule,
              processing: controller.banquetLoading,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: main),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: side),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                main,
                const SizedBox(height: 16),
                side,
              ],
            );
          },
        ),
      ],
    );
  }

  void _handleEventAction(
    KitchenCommandController controller,
    EventSchedule event,
    String action,
  ) {
    if (action == 'adjust_guest_count') {
      controller.performBanquetAction(
        eventId: event.id,
        action: action,
        guestCount: event.guestCount,
      );
      return;
    }

    if (action == 'assign_counter') {
      controller.performBanquetAction(
        eventId: event.id,
        action: action,
        counterName: 'Main buffet counter',
      );
      return;
    }

    controller.performBanquetAction(
      eventId: event.id,
      action: action,
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
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
