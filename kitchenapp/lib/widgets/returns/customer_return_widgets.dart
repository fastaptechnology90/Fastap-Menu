import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/returns/customer_return_snapshot.dart';

class ReturnRequestCard extends StatelessWidget {
  const ReturnRequestCard({
    super.key,
    required this.request,
    required this.onAction,
  });

  final ReturnRequest request;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final typeColor = switch (request.returnType) {
      'wrong_item' => AppColors.warning,
      'burnt_item' => AppColors.danger,
      'refire' => AppColors.info,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: request.priorityRemake ? AppColors.danger : typeColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  request.kotNumber,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: _typeLabel(request.returnType), color: typeColor),
              if (request.priorityRemake) ...[
                const SizedBox(width: 8),
                _Tag(label: 'Priority remake', color: AppColors.danger),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${request.dishName} · ${request.location}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            request.reason,
            style: TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (request.complaintTags.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: request.complaintTags
                  .map(
                    (tag) => _Tag(
                      label: tag,
                      color: AppColors.premium,
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: request.availableActions
                .map(
                  (action) => action == 'resolve'
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
      ),
    );
  }

  static String _typeLabel(String type) {
    return switch (type) {
      'wrong_item' => 'Wrong item',
      'burnt_item' => 'Burnt item',
      'refire' => 'Re-fire',
      _ => type,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'wrong_item_replacement' => 'Wrong item',
      'burnt_item_replacement' => 'Burnt item',
      'refire_request' => 'Re-fire',
      'priority_remake' => 'Priority remake',
      'tag_complaint' => 'Tag complaint',
      'resolve' => 'Resolve',
      'dismiss' => 'Dismiss',
      _ => action,
    };
  }
}

class ReturnSidePanel extends StatelessWidget {
  const ReturnSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.processing,
  });

  final ReturnStats stats;
  final ReturnFeatureFlags flags;
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
            'Return queue metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Open returns', '${stats.openReturns}'),
          _StatRow('Priority remakes', '${stats.priorityRemakes}'),
          _StatRow('Re-fire queue', '${stats.refireQueue}'),
          _StatRow('Complaint tags', '${stats.complaintTags}'),
          _StatRow('Wrong item cases', '${stats.wrongItemCount}'),
          _StatRow('Burnt item cases', '${stats.burntItemCount}'),
          _StatRow('Resolved today', '${stats.resolvedToday}'),
          const SizedBox(height: 16),
          Text(
            'Active return modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          ...[
            ('Wrong item replacement', flags.wrongItemReplacement),
            ('Burnt item replacement', flags.burntItemReplacement),
            ('Re-fire request', flags.refireRequest),
            ('Priority remake', flags.priorityRemake),
            ('Complaint tagging', flags.complaintTagging),
          ].map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(
                    entry.$2 ? Icons.check_circle : Icons.circle_outlined,
                    size: 16,
                    color: entry.$2 ? AppColors.primary : AppColors.secondaryText,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      entry.$1,
                      style: TextStyle(
                        color: AppColors.bodyText,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (processing) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(minHeight: 2),
          ],
        ],
      ),
    );
  }
}

class ComplaintTagList extends StatelessWidget {
  const ComplaintTagList({super.key, required this.tags});

  final List<ComplaintTagEntry> tags;

  @override
  Widget build(BuildContext context) {
    if (tags.isEmpty) {
      return const _EmptyList(message: 'No complaint tags logged');
    }

    return Column(
      children: tags
          .map(
            (entry) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.premium.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.premium.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.kotNumber,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          entry.tag,
                          style: TextStyle(
                            color: AppColors.bodyText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(
                    label: entry.severity,
                    color: entry.severity == 'high'
                        ? AppColors.danger
                        : AppColors.warning,
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class ReturnHistoryList extends StatelessWidget {
  const ReturnHistoryList({super.key, required this.history});

  final List<ReturnHistoryEntry> history;

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return const _EmptyList(message: 'No return history yet');
    }

    return Column(
      children: history
          .map(
            (entry) => Container(
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
                  Text(
                    entry.kotNumber,
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    entry.summary,
                    style: TextStyle(
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
                fontSize: 12,
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

class _EmptyList extends StatelessWidget {
  const _EmptyList({required this.message});

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
