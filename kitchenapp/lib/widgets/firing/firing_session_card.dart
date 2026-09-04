import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/firing/course_firing_snapshot.dart';

class FiringSessionCard extends StatelessWidget {
  const FiringSessionCard({
    super.key,
    required this.session,
    required this.onCourseAction,
    required this.onSessionAction,
  });

  final FiringSession session;
  final void Function(String action, String courseType) onCourseAction;
  final void Function(String action) onSessionAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: session.vip ? AppColors.premium : AppColors.panelBorder,
          width: session.vip ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                session.vip
                    ? Icons.workspace_premium_outlined
                    : Icons.table_restaurant_outlined,
                color: session.vip ? AppColors.premium : AppColors.primary,
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  session.location,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
              _Tag(
                label: session.servingModeLabel,
                color: AppColors.info,
              ),
              if (session.vip)
                _Tag(label: 'VIP', color: AppColors.premium),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${session.guestType} · ${session.deliveryType} · ${session.pacing.tableMinutesSinceSeat}m seated',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _PacingChip(
                icon: Icons.person_outline,
                label: session.pacing.guestReady
                    ? 'Guest ready'
                    : 'Guest pacing',
                color: session.pacing.guestReady
                    ? AppColors.primary
                    : AppColors.warning,
              ),
              if (session.pacing.syncDelayMinutes > 0)
                _PacingChip(
                  icon: Icons.sync_problem_outlined,
                  label: '${session.pacing.syncDelayMinutes}m sync delay',
                  color: AppColors.danger,
                ),
              _PacingChip(
                icon: Icons.timer_outlined,
                label: '${session.pacing.targetGapMinutes}m course gap',
                color: AppColors.info,
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...session.courses.map(
            (course) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _CourseRow(
                course: course,
                onAction: (action) => onCourseAction(action, course.type),
              ),
            ),
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: session.sessionActions
                .map(
                  (action) => OutlinedButton(
                    onPressed: () => onSessionAction(action),
                    child: Text(_sessionActionLabel(action)),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  static String _sessionActionLabel(String action) {
    return switch (action) {
      'sequential_serving' => 'Sequential serving',
      'simultaneous_serving' => 'Simultaneous serving',
      'sync_pacing' => 'Sync pacing',
      _ => action,
    };
  }
}

class _CourseRow extends StatelessWidget {
  const _CourseRow({required this.course, required this.onAction});

  final FiringCourse course;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final color = switch (course.status) {
      'held' => AppColors.warning,
      'ready' => AppColors.primary,
      'served' => AppColors.secondaryText,
      'fired' || 'preparing' => AppColors.info,
      _ => AppColors.panelBorder,
    };

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.chipBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  course.label,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryText,
                  ),
                ),
              ),
              _Tag(label: course.statusLabel, color: color),
              if (course.status != 'pending' && course.status != 'served')
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Text(
                    course.elapsed,
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${course.linkedKot} · ${course.items.join(', ')}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (course.availableActions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: course.availableActions
                  .map(
                    (action) => TextButton(
                      onPressed: () => onAction(action),
                      child: Text(_courseActionLabel(action)),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  static String _courseActionLabel(String action) {
    return switch (action) {
      'fire_starter' => 'Fire starter',
      'fire_main' => 'Fire main',
      'fire_dessert' => 'Fire dessert',
      'hold_starter' => 'Hold starter',
      'hold_main' => 'Hold main',
      'hold_dessert' => 'Hold dessert',
      'resume_starter' => 'Resume starter',
      'resume_main' => 'Resume main',
      'resume_dessert' => 'Resume dessert',
      'mark_served_starter' => 'Mark served',
      'mark_served_main' => 'Mark served',
      'mark_served_dessert' => 'Mark served',
      _ => action,
    };
  }
}

class FiringSmartPanel extends StatelessWidget {
  const FiringSmartPanel({
    super.key,
    required this.flags,
    required this.stats,
    required this.coordinationBoard,
    required this.onSyncAll,
    required this.syncing,
  });

  final SmartFiringFlags flags;
  final FiringStats stats;
  final List<FiringCoordinationItem> coordinationBoard;
  final VoidCallback onSyncAll;
  final bool syncing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Panel(
          title: 'Smart firing',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Table pacing', flags.tablePacing),
              _FlagChip('Guest pacing', flags.guestPacing),
              _FlagChip('Delay sync', flags.delaySynchronization),
              _FlagChip('Multi-course', flags.multiCourseCoordination),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Firing stats',
          child: Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat(label: 'Tables', value: '${stats.totalSessions}'),
              _Stat(label: 'Active fires', value: '${stats.activeFires}'),
              _Stat(label: 'Held', value: '${stats.heldCourses}'),
              _Stat(label: 'VIP', value: '${stats.vipSessions}'),
              _Stat(label: 'Sync alerts', value: '${stats.syncAlerts}'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Multi-course coordination',
          child: coordinationBoard.isEmpty
              ? Text(
                  'No active coordination lanes.',
                  style: TextStyle(color: AppColors.secondaryText),
                )
              : Column(
                  children: coordinationBoard
                      .map(
                        (item) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            radius: 14,
                            backgroundColor:
                                AppColors.primary.withValues(alpha: 0.12),
                            child: Text(
                              '${item.etaMinutes}m',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          title: Text(
                            item.location,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text('${item.nextAction} · ${item.mode}'),
                        ),
                      )
                      .toList(),
                ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: syncing ? null : onSyncAll,
            icon: syncing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.sync_outlined),
            label: const Text('Sync all table pacing'),
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
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
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

class _PacingChip extends StatelessWidget {
  const _PacingChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 16, color: color),
      label: Text(label),
      backgroundColor: color.withValues(alpha: 0.08),
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
