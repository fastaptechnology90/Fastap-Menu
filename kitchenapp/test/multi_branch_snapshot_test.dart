import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/multi_branch/multi_branch_snapshot.dart';

void main() {
  test('multi branch snapshot parses API payload', () {
    final snapshot = MultiBranchSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'centralKitchens': [
        {
          'id': 'MB-CK-001',
          'hubName': 'Main central commissary',
          'section': 'Main',
          'branchesServed': 4,
          'productionLoad': 78,
          'status': 'active',
          'availableActions': ['activate_hub'],
        },
      ],
      'recipeSyncJobs': [
        {
          'id': 'MB-RCP-001',
          'recipePack': 'Main menu v2.4',
          'targetBranch': 'Downtown branch',
          'section': 'Main',
          'version': 'v2.4',
          'status': 'pending',
          'availableActions': ['push_recipes'],
        },
      ],
      'branchKitchens': [
        {
          'id': 'MB-BRN-001',
          'branchName': 'Downtown kitchen',
          'section': 'Main',
          'syncLagMinutes': 12,
          'ordersToday': 186,
          'status': 'out_of_sync',
          'availableActions': ['sync_branch'],
        },
      ],
      'sharedInventory': [
        {
          'id': 'MB-INV-001',
          'itemName': 'Chicken breast · central pool',
          'section': 'Main',
          'centralStock': '842 kg',
          'branchesLow': 3,
          'status': 'low',
          'availableActions': ['rebalance_stock'],
        },
      ],
      'demandForecasts': [
        {
          'id': 'MB-FCT-001',
          'forecastName': 'Weekend lunch surge',
          'section': 'Main',
          'expectedChange': '+22%',
          'confidence': 'high',
          'windowLabel': 'Sat–Sun lunch',
          'status': 'approved',
          'availableActions': ['publish_forecast'],
        },
      ],
      'stats': {
        'activeCentralHubs': 1,
        'pendingRecipeSyncs': 1,
        'branchesOutOfSync': 1,
        'lowStockItems': 1,
        'publishedForecasts': 0,
        'syncedToday': 16,
      },
      'multiBranchFeatures': {
        'centralKitchenSupport': true,
        'recipeSynchronization': true,
        'branchKitchenSync': true,
        'sharedInventoryVisibility': true,
        'demandForecasting': true,
      },
    });

    expect(snapshot.centralKitchens.first.productionLoad, 78);
    expect(snapshot.branchKitchens.first.syncLagMinutes, 12);
    expect(snapshot.multiBranchFeatures.demandForecasting, isTrue);
    expect(snapshot.stats.syncedToday, 16);
  });
}
