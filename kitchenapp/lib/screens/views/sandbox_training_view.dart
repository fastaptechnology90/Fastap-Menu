import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/sandbox_training/sandbox_training_widgets.dart';

class SandboxTrainingView extends StatelessWidget {
  const SandboxTrainingView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.sandboxTrainingLoading &&
        controller.sandboxTraining == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.sandboxTraining;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.sandboxTrainingErrorMessage ??
            'Sandbox & training unavailable',
        onRetry: () => controller.refreshSandboxTraining(),
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
                    'System 46 · Sandbox & Training Mode',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Demo kitchen · practice · SOP · simulations',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.sandboxTrainingLoading
                    ? null
                    : () => controller.refreshSandboxTraining(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.sandboxTrainingActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.premium.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border:
                  Border.all(color: AppColors.premium.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.sandboxTrainingActionMessage!,
              style: TextStyle(
                color: AppColors.premium,
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
                const _SectionTitle('Demo kitchen'),
                DemoKitchenList(
                  environments: snapshot.demoKitchens,
                  onAction: (entry) => controller.performDemoKitchenAction(
                    demoId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Staff practice mode'),
                PracticeSessionList(
                  sessions: snapshot.practiceSessions,
                  onAction: (entry) => controller.performPracticeSessionAction(
                    sessionId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('SOP training'),
                SopTrainingList(
                  modules: snapshot.sopTrainings,
                  onAction: (entry) => controller.performSopTrainingAction(
                    sopId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Kitchen simulations'),
                KitchenSimulationList(
                  simulations: snapshot.kitchenSimulations,
                  onAction: (entry) => controller.performSimulationAction(
                    simulationId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
              ],
            );
            final side = SandboxTrainingSidePanel(
              stats: snapshot.stats,
              features: snapshot.trainingFeatures,
              onLaunchAll: controller.launchAllSandboxTraining,
              processing: controller.sandboxTrainingLoading,
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
        style: TextStyle(
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
          Text(message, style: TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
