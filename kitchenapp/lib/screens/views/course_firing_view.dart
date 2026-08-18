import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/firing/course_firing_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/firing/firing_session_card.dart';

class CourseFiringView extends StatelessWidget {
  const CourseFiringView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.firingLoading && controller.courseFiring == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.courseFiring;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.firingErrorMessage ?? 'Course firing unavailable',
        onRetry: () => controller.refreshFiring(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.panelBorder),
          ),
          child: Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'System 6 · Food Firing & Course Management',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Fire courses · hold/resume · sequential & simultaneous serving',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.firingLoading
                    ? null
                    : () => controller.refreshFiring(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.firingActionMessage != null) ...[
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
              controller.firingActionMessage!,
              style: const TextStyle(
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
            final sessions = _SessionsPanel(
              snapshot: snapshot,
              onCourseAction: (sessionId, action, courseType) {
                controller.performFiringAction(
                  sessionId: sessionId,
                  action: action,
                  courseType: courseType,
                );
              },
              onSessionAction: (sessionId, action) {
                controller.performFiringAction(
                  sessionId: sessionId,
                  action: action,
                );
              },
            );
            final smart = FiringSmartPanel(
              flags: snapshot.smartFiring,
              stats: snapshot.stats,
              coordinationBoard: snapshot.coordinationBoard,
              onSyncAll: () => controller.syncAllFiringPacing(),
              syncing: controller.firingLoading,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: sessions),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: smart),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                sessions,
                const SizedBox(height: 16),
                smart,
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SessionsPanel extends StatelessWidget {
  const _SessionsPanel({
    required this.snapshot,
    required this.onCourseAction,
    required this.onSessionAction,
  });

  final CourseFiringSnapshot snapshot;
  final void Function(String sessionId, String action, String courseType)
      onCourseAction;
  final void Function(String sessionId, String action) onSessionAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Active tables · ${snapshot.sessions.length} sessions',
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 12),
        if (snapshot.sessions.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: const Text(
              'No dine-in or banquet sessions match this section filter.',
              style: TextStyle(color: AppColors.secondaryText),
            ),
          )
        else
          ...snapshot.sessions.map(
            (session) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: FiringSessionCard(
                session: session,
                onCourseAction: (action, courseType) =>
                    onCourseAction(session.id, action, courseType),
                onSessionAction: (action) => onSessionAction(session.id, action),
              ),
            ),
          ),
      ],
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
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
