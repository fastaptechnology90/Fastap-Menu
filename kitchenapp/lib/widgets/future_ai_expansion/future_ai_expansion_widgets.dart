import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/future_ai_expansion/future_ai_expansion_snapshot.dart';

class FutureAiExpansionSidePanel extends StatelessWidget {
  const FutureAiExpansionSidePanel({
    super.key,
    required this.stats,
    required this.features,
    required this.onActivateAll,
    required this.processing,
  });

  final FutureAiExpansionStats stats;
  final FutureAiExpansionFeatureFlags features;
  final VoidCallback onActivateAll;
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
            'Future AI metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active assistants', '${stats.activeAssistants}'),
          _StatRow('Robotic integrations', '${stats.roboticIntegrations}'),
          _StatRow('Plating suggestions', '${stats.platingSuggestions}'),
          _StatRow('Waste insights', '${stats.wasteInsights}'),
          _StatRow('Prep automations', '${stats.prepAutomations}'),
          _StatRow('AI tasks running', '${stats.aiTasksRunning}'),
          const SizedBox(height: 16),
          const Text(
            'Future AI features',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('AI cooking assistant', features.aiCookingAssistant),
          _FeatureChip(
            'AI robotic kitchen integration',
            features.aiRoboticKitchenIntegration,
          ),
          _FeatureChip('AI plating suggestions', features.aiPlatingSuggestions),
          _FeatureChip(
            'AI waste reduction engine',
            features.aiWasteReductionEngine,
          ),
          _FeatureChip(
            'AI preparation automation',
            features.aiPreparationAutomation,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onActivateAll,
              icon: const Icon(Icons.auto_awesome_outlined, size: 18),
              label: const Text('Activate future AI stack'),
              style: FilledButton.styleFrom(backgroundColor: AppColors.premium),
            ),
          ),
        ],
      ),
    );
  }
}

class FutureAiExpansionSection extends StatelessWidget {
  const FutureAiExpansionSection({
    super.key,
    required this.title,
    required this.emptyMessage,
    required this.items,
    required this.onAction,
  });

  final String title;
  final String emptyMessage;
  final List<FutureAiItemView> items;
  final void Function(String id, String action) onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 12),
          child: Text(
            title,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
        ),
        if (items.isEmpty)
          _EmptyBox(message: emptyMessage)
        else
          Column(
            children: items
                .map(
                  (item) => _FutureAiCard(
                    title: item.title,
                    subtitle: item.subtitle,
                    tagLabel: item.tagLabel,
                    tagColor: item.tagColor,
                    actions: item.actions,
                    primaryActions: item.primaryActions,
                    onAction: (action) => onAction(item.id, action),
                  ),
                )
                .toList(),
          ),
      ],
    );
  }
}

class FutureAiItemView {
  const FutureAiItemView({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.tagLabel,
    required this.tagColor,
    required this.actions,
    required this.primaryActions,
  });

  final String id;
  final String title;
  final String subtitle;
  final String tagLabel;
  final Color tagColor;
  final List<String> actions;
  final Set<String> primaryActions;
}

FutureAiItemView cookingAssistantItemView(AiCookingAssistantEntry item) {
  return FutureAiItemView(
    id: item.id,
    title: item.assistantName,
    subtitle: '${item.section} · ${item.dishFocus} · ${item.confidenceLabel}',
    tagLabel: item.status,
    tagColor: AppColors.premium,
    actions: item.availableActions,
    primaryActions: const {'start_assistant'},
  );
}

FutureAiItemView roboticKitchenItemView(AiRoboticKitchenEntry item) {
  return FutureAiItemView(
    id: item.id,
    title: item.robotName,
    subtitle:
        '${item.section} · ${item.stationLabel} · ${item.taskQueue} tasks',
    tagLabel: item.status,
    tagColor: AppColors.info,
    actions: item.availableActions,
    primaryActions: const {'connect_robot', 'run_sequence'},
  );
}

FutureAiItemView platingSuggestionItemView(AiPlatingSuggestionEntry item) {
  return FutureAiItemView(
    id: item.id,
    title: item.suggestionName,
    subtitle: '${item.section} · ${item.dishName} · ${item.styleLabel}',
    tagLabel: item.status,
    tagColor: AppColors.primary,
    actions: item.availableActions,
    primaryActions: const {'apply_suggestion'},
  );
}

FutureAiItemView wasteReductionItemView(AiWasteReductionEntry item) {
  return FutureAiItemView(
    id: item.id,
    title: item.insightName,
    subtitle:
        '${item.section} · ${item.wastePercent.toStringAsFixed(1)}% waste · ${item.savingsLabel}',
    tagLabel: item.status,
    tagColor: AppColors.warning,
    actions: item.availableActions,
    primaryActions: const {'apply_reduction'},
  );
}

FutureAiItemView prepAutomationItemView(AiPrepAutomationEntry item) {
  return FutureAiItemView(
    id: item.id,
    title: item.automationName,
    subtitle:
        '${item.section} · batch ${item.batchSize} · ${item.scheduleLabel}',
    tagLabel: item.status,
    tagColor: AppColors.primary,
    actions: item.availableActions,
    primaryActions: const {'start_automation'},
  );
}

class _FutureAiCard extends StatelessWidget {
  const _FutureAiCard({
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
                  title,
                  style: const TextStyle(
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
            style: const TextStyle(
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
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.premium,
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

  static String _actionLabel(String action) {
    return switch (action) {
      'start_assistant' => 'Start',
      'refine_recipe' => 'Refine',
      'pause_assistant' => 'Pause',
      'connect_robot' => 'Connect',
      'calibrate_station' => 'Calibrate',
      'run_sequence' => 'Run',
      'apply_suggestion' => 'Apply',
      'preview_plate' => 'Preview',
      'reject_suggestion' => 'Reject',
      'analyze_waste' => 'Analyze',
      'apply_reduction' => 'Reduce',
      'schedule_audit' => 'Audit',
      'start_automation' => 'Start',
      'adjust_batch' => 'Adjust',
      'pause_automation' => 'Pause',
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
            color: active ? AppColors.premium : AppColors.secondaryText,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: active ? AppColors.primaryText : AppColors.secondaryText,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
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
