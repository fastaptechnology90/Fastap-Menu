import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/chef_tasks/chef_task_snapshot.dart';
import '../../models/staff_performance/staff_performance_snapshot.dart';
import '../../models/staff_wellness/staff_wellness_snapshot.dart';
import '../../state/auth_controller.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/auth/auth_security_panel.dart';
import '../../widgets/common/panel_card.dart';
import '../../widgets/common/station_load.dart';
import '../../widgets/common/timeline_item.dart';
import '../../widgets/layout/responsive_columns.dart';

class StaffCommandView extends StatefulWidget {
  const StaffCommandView({
    super.key,
    required this.auth,
    required this.controller,
  });

  final AuthController auth;
  final KitchenCommandController controller;

  @override
  State<StaffCommandView> createState() => _StaffCommandViewState();
}

class _StaffCommandViewState extends State<StaffCommandView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _ensureData());
  }

  Future<void> _ensureData() async {
    final tasks = <Future<void>>[];
    if (widget.controller.chefTasks == null) {
      tasks.add(widget.controller.refreshChefTasks());
    }
    if (widget.controller.staffPerformance == null) {
      tasks.add(widget.controller.refreshStaffPerformance());
    }
    if (widget.controller.staffWellness == null) {
      tasks.add(widget.controller.refreshStaffWellness());
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  bool get _loading =>
      widget.controller.chefTaskLoading &&
      widget.controller.chefTasks == null;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([widget.auth, widget.controller]),
      builder: (context, _) {
        if (_loading) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(child: CircularProgressIndicator()),
          );
        }

        final chefTasks = widget.controller.chefTasks;
        if (chefTasks == null) {
          return _StaffCommandError(
            message:
                widget.controller.chefTaskErrorMessage ??
                'Staff command data unavailable',
            onRetry: () => Future.wait([
              widget.controller.refreshChefTasks(),
              widget.controller.refreshStaffPerformance(),
              widget.controller.refreshStaffWellness(),
            ]),
          );
        }

        return ResponsiveColumns(
          children: [
            AuthSecurityPanel(auth: widget.auth),
            _ChefTaskPreviewPanel(snapshot: chefTasks),
            _WellnessPreviewPanel(
              performance: widget.controller.staffPerformance,
              wellness: widget.controller.staffWellness,
              loading:
                  widget.controller.staffPerformanceLoading ||
                  widget.controller.staffWellnessLoading,
            ),
          ],
        );
      },
    );
  }
}

class _ChefTaskPreviewPanel extends StatelessWidget {
  const _ChefTaskPreviewPanel({required this.snapshot});

  final ChefTaskSnapshot? snapshot;

  @override
  Widget build(BuildContext context) {
    final tasks = snapshot?.tasks.take(3).toList() ?? const <ChefTask>[];

    return PanelCard(
      title: 'Chef Task Board',
      icon: Icons.assignment_ind_outlined,
      expandChild: false,
      child: tasks.isEmpty
          ? Text(
              'No active chef tasks for your section.',
              style: TextStyle(color: AppColors.secondaryText, fontSize: 13),
            )
          : Column(
              children: [
                for (final task in tasks)
                  TimelineItem(
                    title: task.assignedChef,
                    subtitle: task.title,
                    meta: task.statusLabel,
                    color: _taskColor(task.priority),
                  ),
              ],
            ),
    );
  }

  static Color _taskColor(String priority) {
    return switch (priority) {
      'critical' || 'urgent' => AppColors.danger,
      'high' => AppColors.warning,
      'medium' => AppColors.info,
      _ => AppColors.premium,
    };
  }
}

class _WellnessPreviewPanel extends StatelessWidget {
  const _WellnessPreviewPanel({
    required this.performance,
    required this.wellness,
    required this.loading,
  });

  final StaffPerformanceSnapshot? performance;
  final StaffWellnessSnapshot? wellness;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final stats = performance?.stats;
    final wellnessStats = wellness?.stats;

    return PanelCard(
      title: 'Performance & Wellness',
      icon: Icons.monitor_heart_outlined,
      expandChild: false,
      trailing: loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : null,
      child: Column(
        children: [
          StationLoad(
            name: 'Orders completed',
            value: stats == null
                ? 0
                : (stats.avgProductivity / 100).clamp(0.0, 1.0),
            meta: stats == null
                ? 'Syncing…'
                : '${stats.staffTracked} staff tracked',
            color: AppColors.primary,
          ),
          StationLoad(
            name: 'Delay ratio',
            value: stats == null
                ? 0
                : (stats.avgDelayRatio / 100).clamp(0.0, 1.0),
            meta: stats == null ? '—' : '${stats.avgDelayRatio}% avg delay',
            color: AppColors.info,
          ),
          StationLoad(
            name: 'Fatigue risk',
            value: wellnessStats == null
                ? 0
                : (wellnessStats.avgRiskScore / 100).clamp(0.0, 1.0),
            meta: wellnessStats == null
                ? '—'
                : '${wellnessStats.pendingBreaks} break alerts',
            color: AppColors.warning,
          ),
        ],
      ),
    );
  }
}

class _StaffCommandError extends StatelessWidget {
  const _StaffCommandError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined, color: AppColors.secondaryText),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.secondaryText),
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
