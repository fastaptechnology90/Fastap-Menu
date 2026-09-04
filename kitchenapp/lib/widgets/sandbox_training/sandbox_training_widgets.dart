import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/sandbox_training/sandbox_training_snapshot.dart';

class DemoKitchenList extends StatelessWidget {
  const DemoKitchenList({
    super.key,
    required this.environments,
    required this.onAction,
  });

  final List<DemoKitchenEnvironment> environments;
  final ValueChanged<(DemoKitchenEnvironment env, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _TrainingList(
      emptyMessage: 'No demo kitchens',
      items: environments
          .map(
            (env) => _TrainingCard(
              title: env.environmentName,
              subtitle:
                  '${env.section} · ${env.simulatedOrders} orders · ${env.scenarioLabel}',
              tagLabel: env.status,
              tagColor: env.status == 'active'
                  ? AppColors.premium
                  : AppColors.secondaryText,
              actions: env.availableActions,
              primaryActions: const {'launch_demo'},
              onAction: (action) => onAction((env, action)),
            ),
          )
          .toList(),
    );
  }
}

class PracticeSessionList extends StatelessWidget {
  const PracticeSessionList({
    super.key,
    required this.sessions,
    required this.onAction,
  });

  final List<PracticeSession> sessions;
  final ValueChanged<(PracticeSession session, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _TrainingList(
      emptyMessage: 'No practice sessions',
      items: sessions
          .map(
            (session) => _TrainingCard(
              title: session.sessionName,
              subtitle:
                  '${session.section} · ${session.traineeName} · ${session.roleLabel}',
              tagLabel: session.status,
              tagColor: session.status == 'in_progress'
                  ? AppColors.primary
                  : AppColors.info,
              actions: session.availableActions,
              primaryActions: const {'start_practice'},
              onAction: (action) => onAction((session, action)),
            ),
          )
          .toList(),
    );
  }
}

class SopTrainingList extends StatelessWidget {
  const SopTrainingList({
    super.key,
    required this.modules,
    required this.onAction,
  });

  final List<SopTrainingModule> modules;
  final ValueChanged<(SopTrainingModule module, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _TrainingList(
      emptyMessage: 'No SOP training modules',
      items: modules
          .map(
            (module) => _TrainingCard(
              title: module.moduleName,
              subtitle:
                  '${module.section} · ${module.completionPercent}% · ${module.assigneeCount} assigned',
              tagLabel: module.status,
              tagColor: module.completionPercent >= 100
                  ? AppColors.primary
                  : AppColors.warning,
              actions: module.availableActions,
              primaryActions: const {'start_training', 'mark_complete'},
              onAction: (action) => onAction((module, action)),
            ),
          )
          .toList(),
    );
  }
}

class KitchenSimulationList extends StatelessWidget {
  const KitchenSimulationList({
    super.key,
    required this.simulations,
    required this.onAction,
  });

  final List<KitchenSimulation> simulations;
  final ValueChanged<(KitchenSimulation simulation, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _TrainingList(
      emptyMessage: 'No kitchen simulations',
      items: simulations
          .map(
            (simulation) => _TrainingCard(
              title: simulation.simulationName,
              subtitle:
                  '${simulation.section} · ${simulation.difficulty} · ${simulation.durationLabel}',
              tagLabel: simulation.status,
              tagColor: simulation.difficulty == 'critical'
                  ? AppColors.danger
                  : AppColors.premium,
              actions: simulation.availableActions,
              primaryActions: const {'run_simulation'},
              onAction: (action) => onAction((simulation, action)),
            ),
          )
          .toList(),
    );
  }
}

class SandboxTrainingSidePanel extends StatelessWidget {
  const SandboxTrainingSidePanel({
    super.key,
    required this.stats,
    required this.features,
    required this.onLaunchAll,
    required this.processing,
  });

  final SandboxTrainingStats stats;
  final SandboxTrainingFeatureFlags features;
  final VoidCallback onLaunchAll;
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
            'Training metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active demos', '${stats.activeDemos}'),
          _StatRow('Practice in progress', '${stats.practiceInProgress}'),
          _StatRow('SOP modules pending', '${stats.sopModulesPending}'),
          _StatRow('Simulations ready', '${stats.simulationsReady}'),
          _StatRow('Trainees active', '${stats.traineesActive}'),
          _StatRow('Sessions today', '${stats.sessionsToday}'),
          const SizedBox(height: 16),
          Text(
            'Training features',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Demo kitchen', features.demoKitchen),
          _FeatureChip('Staff practice mode', features.staffPracticeMode),
          _FeatureChip('SOP training', features.sopTraining),
          _FeatureChip('Kitchen simulations', features.kitchenSimulations),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onLaunchAll,
              icon: const Icon(Icons.school_outlined, size: 18),
              label: const Text('Launch sandbox'),
            ),
          ),
        ],
      ),
    );
  }
}

class _TrainingList extends StatelessWidget {
  const _TrainingList({required this.emptyMessage, required this.items});

  final String emptyMessage;
  final List<Widget> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return _EmptyBox(message: emptyMessage);
    }

    return Column(children: items);
  }
}

class _TrainingCard extends StatelessWidget {
  const _TrainingCard({
    required this.title,
    required this.subtitle,
    required this.tagLabel,
    required this.tagColor,
    required this.actions,
    required this.primaryActions,
    required this.onAction,
  });

  final String title;
  final String subtitle;
  final String tagLabel;
  final Color tagColor;
  final List<String> actions;
  final Set<String> primaryActions;
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
                  title,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _Tag(label: tagLabel, color: tagColor),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: actions
                  .map(
                    (action) => primaryActions.contains(action)
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
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'launch_demo' => 'Launch',
      'reset_demo' => 'Reset',
      'extend_demo' => 'Extend',
      'start_practice' => 'Start',
      'pause_practice' => 'Pause',
      'complete_practice' => 'Complete',
      'start_training' => 'Start',
      'assign_staff' => 'Assign',
      'mark_complete' => 'Complete',
      'run_simulation' => 'Run',
      'pause_simulation' => 'Pause',
      'reset_simulation' => 'Reset',
      _ => action,
    };
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
            color: active ? AppColors.premium : AppColors.secondaryText,
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
