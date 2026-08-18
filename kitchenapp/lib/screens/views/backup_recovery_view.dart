import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/backup_recovery/backup_recovery_widgets.dart';

class BackupRecoveryView extends StatelessWidget {
  const BackupRecoveryView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.backupRecoveryLoading &&
        controller.backupRecovery == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.backupRecovery;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.backupRecoveryErrorMessage ??
            'Backup & recovery unavailable',
        onRetry: () => controller.refreshBackupRecovery(),
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
                    'System 45 · Backup & Recovery System',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Auto · manual · cloud · restore · data recovery',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.backupRecoveryLoading
                    ? null
                    : () => controller.refreshBackupRecovery(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.backupRecoveryActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.backupRecoveryActionMessage!,
              style: const TextStyle(
                color: AppColors.info,
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
                const _SectionTitle('Auto backup'),
                AutoBackupList(
                  jobs: snapshot.autoBackups,
                  onAction: (entry) => controller.performAutoBackupAction(
                    backupId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Manual backup'),
                ManualBackupList(
                  backups: snapshot.manualBackups,
                  onAction: (entry) => controller.performManualBackupAction(
                    backupId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Cloud synchronization'),
                CloudSyncList(
                  jobs: snapshot.cloudSyncJobs,
                  onAction: (entry) => controller.performCloudSyncAction(
                    syncId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Recovery restore'),
                RecoveryRestoreList(
                  points: snapshot.recoveryRestores,
                  onAction: (entry) => controller.performRestoreAction(
                    restoreId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Data recovery'),
                DataRecoveryList(
                  tasks: snapshot.dataRecoveryTasks,
                  onAction: (entry) => controller.performDataRecoveryAction(
                    recoveryId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
              ],
            );
            final side = BackupRecoverySidePanel(
              stats: snapshot.stats,
              features: snapshot.backupFeatures,
              onRunAll: controller.runAllBackupRecovery,
              processing: controller.backupRecoveryLoading,
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 12),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.primaryText,
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
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
