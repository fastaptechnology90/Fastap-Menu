import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/ai/ai_assistant_snapshot.dart';

class AiSuggestionCard extends StatelessWidget {
  const AiSuggestionCard({
    super.key,
    required this.suggestion,
    required this.onApply,
  });

  final AiSuggestion suggestion;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    final impactColor = suggestion.impact == 'high'
        ? AppColors.danger
        : AppColors.info;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.lightbulb_outline,
                color: AppColors.premium,
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  suggestion.title,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: suggestion.impact, color: impactColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            suggestion.detail,
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${suggestion.category} · ${(suggestion.confidence * 100).round()}% confidence',
            style: const TextStyle(
              color: AppColors.premium,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: onApply,
              child: const Text('Apply suggestion'),
            ),
          ),
        ],
      ),
    );
  }
}

class AiInsightList extends StatelessWidget {
  const AiInsightList({super.key, required this.insights});

  final List<AiInsight> insights;

  @override
  Widget build(BuildContext context) {
    if (insights.isEmpty) {
      return const Text(
        'No AI insights for this section.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: insights
          .map(
            (insight) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _severityColor(insight.severity).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _severityColor(insight.severity).withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    insight.title,
                    style: TextStyle(
                      color: _severityColor(insight.severity),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    insight.detail,
                    style: const TextStyle(
                      color: AppColors.bodyText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  static Color _severityColor(String severity) {
    return switch (severity) {
      'critical' => AppColors.danger,
      'high' => AppColors.warning,
      _ => AppColors.info,
    };
  }
}

class AiVoicePanel extends StatelessWidget {
  const AiVoicePanel({
    super.key,
    required this.commands,
    required this.onCommand,
  });

  final List<AiVoiceCommand> commands;
  final ValueChanged<String> onCommand;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: commands
          .map(
            (command) => ActionChip(
              avatar: const Icon(Icons.mic_outlined, size: 16),
              label: Text(command.label),
              onPressed: () => onCommand(command.command),
            ),
          )
          .toList(),
    );
  }
}

class AiPredictionsPanel extends StatelessWidget {
  const AiPredictionsPanel({
    super.key,
    required this.predictions,
    required this.featureFlags,
    required this.stats,
  });

  final AiPredictions predictions;
  final AiFeatureFlags featureFlags;
  final AiAssistantStats stats;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Panel(
          title: 'AI predictions',
          child: Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat(label: 'Rush in', value: '${predictions.rushInMinutes}m'),
              _Stat(
                label: 'Delay risk',
                value: '${predictions.delayRiskOrders}',
              ),
              _Stat(
                label: 'Prep score',
                value: '${(predictions.prepOptimizationScore * 100).round()}%',
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Recommended chef',
          child: Text(
            predictions.recommendedChef,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'AI features active',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Smart prep', featureFlags.smartPreparationSuggestions),
              _FlagChip('Delay predict', featureFlags.delayPrediction),
              _FlagChip('Rush predict', featureFlags.rushPrediction),
              _FlagChip('Cook sequence', featureFlags.smartCookingSequence),
              _FlagChip('Chef allocate', featureFlags.smartChefAllocation),
              _FlagChip('Ingredients', featureFlags.ingredientOptimization),
              _FlagChip('Workload', featureFlags.aiWorkloadBalancing),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Assistant stats',
          child: Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat(label: 'Suggestions', value: '${stats.activeSuggestions}'),
              _Stat(label: 'High impact', value: '${stats.highImpact}'),
              _Stat(label: 'Insights', value: '${stats.insights}'),
              _Stat(label: 'Voice cmds', value: '${stats.voiceCommands}'),
            ],
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
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
        color: enabled ? AppColors.premium : AppColors.secondaryText,
      ),
      label: Text(label),
      backgroundColor: enabled
          ? AppColors.premium.withValues(alpha: 0.08)
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
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
