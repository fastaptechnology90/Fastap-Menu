import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/hygiene/cleaning_hygiene_widgets.dart';

class CleaningHygieneView extends StatelessWidget {
  const CleaningHygieneView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.cleaningHygieneLoading && controller.cleaningHygiene == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.cleaningHygiene;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.cleaningHygieneErrorMessage ??
            'Cleaning & hygiene system unavailable',
        onRetry: () => controller.refreshCleaningHygiene(),
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
                    'System 29 · Cleaning & Hygiene Management',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Schedules · checklists · sanitization · safety · compliance',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.cleaningHygieneLoading
                    ? null
                    : () => controller.refreshCleaningHygiene(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.cleaningHygieneActionMessage != null) ...[
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
              controller.cleaningHygieneActionMessage!,
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
            final main = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Cleaning schedules',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.cleaningSchedules.map(
                  (schedule) => CleaningScheduleCard(
                    schedule: schedule,
                    onAction: (action) => controller.performCleaningHygieneAction(
                      taskId: schedule.id,
                      action: action,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Hygiene checklists',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.hygieneChecklists.map(
                  (checklist) => HygieneChecklistCard(
                    checklist: checklist,
                    onAction: (action) => controller.performCleaningHygieneAction(
                      taskId: checklist.id,
                      action: action,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Equipment sanitization',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.sanitizationTasks.map(
                  (task) => SanitizationTaskCard(
                    task: task,
                    onAction: (action) => controller.performCleaningHygieneAction(
                      taskId: task.id,
                      action: action,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Food safety tracking',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                FoodSafetyList(entries: snapshot.foodSafetyEntries),
                const SizedBox(height: 8),
                const Text(
                  'Deep cleaning management',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                DeepCleaningList(
                  jobs: snapshot.deepCleaningJobs,
                  onAction: (entry) => controller.performCleaningHygieneAction(
                    taskId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Compliance · FSSAI · audits · staff verification',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ComplianceRecordList(
                  records: snapshot.complianceRecords,
                  onAction: (entry) => controller.performCleaningHygieneAction(
                    taskId: entry.$1.id,
                    action: entry.$2,
                    staffName: entry.$1.recordType == 'staff_verification'
                        ? 'Verified staff'
                        : null,
                  ),
                ),
              ],
            );
            final side = CleaningHygieneSidePanel(
              stats: snapshot.stats,
              flags: snapshot.hygieneFeatures,
              onStartAudit: controller.startCleaningHygieneAudit,
              processing: controller.cleaningHygieneLoading,
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
