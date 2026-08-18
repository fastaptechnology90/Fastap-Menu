import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/multi_branch/multi_branch_snapshot.dart';

class CentralKitchenList extends StatelessWidget {
  const CentralKitchenList({
    super.key,
    required this.hubs,
    required this.onAction,
  });

  final List<CentralKitchenHub> hubs;
  final ValueChanged<(CentralKitchenHub hub, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _MultiBranchList(
      emptyMessage: 'No central kitchen hubs',
      items: hubs
          .map(
            (hub) => _MultiBranchCard(
              title: hub.hubName,
              subtitle:
                  '${hub.section} · ${hub.branchesServed} branches · ${hub.productionLoad}% load',
              tagLabel: hub.status,
              tagColor: hub.productionLoad > 70
                  ? AppColors.warning
                  : AppColors.primary,
              actions: hub.availableActions,
              primaryActions: const {'activate_hub'},
              onAction: (action) => onAction((hub, action)),
            ),
          )
          .toList(),
    );
  }
}

class RecipeSyncList extends StatelessWidget {
  const RecipeSyncList({
    super.key,
    required this.jobs,
    required this.onAction,
  });

  final List<RecipeSyncJob> jobs;
  final ValueChanged<(RecipeSyncJob job, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _MultiBranchList(
      emptyMessage: 'No recipe sync jobs',
      items: jobs
          .map(
            (job) => _MultiBranchCard(
              title: job.recipePack,
              subtitle:
                  '${job.section} → ${job.targetBranch} · ${job.version}',
              tagLabel: job.status,
              tagColor: job.status == 'pending'
                  ? AppColors.warning
                  : AppColors.primary,
              actions: job.availableActions,
              primaryActions: const {'push_recipes'},
              onAction: (action) => onAction((job, action)),
            ),
          )
          .toList(),
    );
  }
}

class BranchKitchenList extends StatelessWidget {
  const BranchKitchenList({
    super.key,
    required this.branches,
    required this.onAction,
  });

  final List<BranchKitchenNode> branches;
  final ValueChanged<(BranchKitchenNode branch, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _MultiBranchList(
      emptyMessage: 'No branch kitchens',
      items: branches
          .map(
            (branch) => _MultiBranchCard(
              title: branch.branchName,
              subtitle:
                  '${branch.section} · ${branch.ordersToday} orders · ${branch.syncLagMinutes} min lag',
              tagLabel: branch.status,
              tagColor: branch.status == 'out_of_sync'
                  ? AppColors.danger
                  : AppColors.primary,
              actions: branch.availableActions,
              primaryActions: const {'sync_branch'},
              onAction: (action) => onAction((branch, action)),
            ),
          )
          .toList(),
    );
  }
}

class SharedInventoryList extends StatelessWidget {
  const SharedInventoryList({
    super.key,
    required this.items,
    required this.onAction,
  });

  final List<SharedInventoryItem> items;
  final ValueChanged<(SharedInventoryItem item, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _MultiBranchList(
      emptyMessage: 'No shared inventory items',
      items: items
          .map(
            (item) => _MultiBranchCard(
              title: item.itemName,
              subtitle:
                  '${item.section} · Central ${item.centralStock} · ${item.branchesLow} branches low',
              tagLabel: item.status,
              tagColor: item.status == 'low'
                  ? AppColors.warning
                  : AppColors.primary,
              actions: item.availableActions,
              primaryActions: const {'rebalance_stock'},
              onAction: (action) => onAction((item, action)),
            ),
          )
          .toList(),
    );
  }
}

class DemandForecastList extends StatelessWidget {
  const DemandForecastList({
    super.key,
    required this.forecasts,
    required this.onAction,
  });

  final List<DemandForecast> forecasts;
  final ValueChanged<(DemandForecast forecast, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    return _MultiBranchList(
      emptyMessage: 'No demand forecasts',
      items: forecasts
          .map(
            (forecast) => _MultiBranchCard(
              title: forecast.forecastName,
              subtitle:
                  '${forecast.section} · ${forecast.expectedChange} · ${forecast.windowLabel}',
              tagLabel: forecast.confidence,
              tagColor: forecast.status == 'draft'
                  ? AppColors.info
                  : AppColors.premium,
              actions: forecast.availableActions,
              primaryActions: const {'publish_forecast'},
              onAction: (action) => onAction((forecast, action)),
            ),
          )
          .toList(),
    );
  }
}

class MultiBranchSidePanel extends StatelessWidget {
  const MultiBranchSidePanel({
    super.key,
    required this.stats,
    required this.features,
    required this.onSyncAll,
    required this.processing,
  });

  final MultiBranchStats stats;
  final MultiBranchFeatureFlags features;
  final VoidCallback onSyncAll;
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
            'Multi-branch metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Active central hubs', '${stats.activeCentralHubs}'),
          _StatRow('Pending recipe syncs', '${stats.pendingRecipeSyncs}'),
          _StatRow('Branches out of sync', '${stats.branchesOutOfSync}'),
          _StatRow('Low stock items', '${stats.lowStockItems}'),
          _StatRow('Published forecasts', '${stats.publishedForecasts}'),
          _StatRow('Synced today', '${stats.syncedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Multi-branch features',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Central kitchen support', features.centralKitchenSupport),
          _FeatureChip('Recipe synchronization', features.recipeSynchronization),
          _FeatureChip('Branch kitchen sync', features.branchKitchenSync),
          _FeatureChip(
            'Shared inventory visibility',
            features.sharedInventoryVisibility,
          ),
          _FeatureChip('Demand forecasting', features.demandForecasting),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onSyncAll,
              icon: const Icon(Icons.account_tree_outlined, size: 18),
              label: const Text('Sync all branches'),
            ),
          ),
        ],
      ),
    );
  }
}

class _MultiBranchList extends StatelessWidget {
  const _MultiBranchList({
    required this.emptyMessage,
    required this.items,
  });

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

class _MultiBranchCard extends StatelessWidget {
  const _MultiBranchCard({
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
      'activate_hub' => 'Activate',
      'pause_production' => 'Pause',
      'escalate_demand' => 'Escalate',
      'push_recipes' => 'Push',
      'schedule_sync' => 'Schedule',
      'resolve_conflict' => 'Resolve',
      'sync_branch' => 'Sync',
      'pause_branch' => 'Pause',
      'reroute_orders' => 'Reroute',
      'rebalance_stock' => 'Rebalance',
      'reserve_central' => 'Reserve',
      'alert_branches' => 'Alert',
      'approve_forecast' => 'Approve',
      'adjust_forecast' => 'Adjust',
      'publish_forecast' => 'Publish',
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
