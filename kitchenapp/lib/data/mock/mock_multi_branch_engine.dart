import 'mock_section_registry.dart';

class MockMultiBranchRegistry {
  MockMultiBranchRegistry._();

  static final List<Map<String, dynamic>> _central = _seedCentral();
  static final List<Map<String, dynamic>> _recipes = _seedRecipes();
  static final List<Map<String, dynamic>> _branches = _seedBranches();
  static final List<Map<String, dynamic>> _inventory = _seedInventory();
  static final List<Map<String, dynamic>> _forecasts = _seedForecasts();
  static int _syncedToday = 16;

  static List<Map<String, dynamic>> centralFor(String section) {
    return _filterSection(_central, section).map(_serializeCentral).toList();
  }

  static List<Map<String, dynamic>> recipesFor(String section) {
    return _filterSection(_recipes, section).map(_serializeRecipe).toList();
  }

  static List<Map<String, dynamic>> branchesFor(String section) {
    return _filterSection(_branches, section).map(_serializeBranch).toList();
  }

  static List<Map<String, dynamic>> inventoryFor(String section) {
    return _filterSection(_inventory, section).map(_serializeInventory).toList();
  }

  static List<Map<String, dynamic>> forecastsFor(String section) {
    return _filterSection(_forecasts, section).map(_serializeForecast).toList();
  }

  static Map<String, dynamic> performCentralAction({
    required String kitchenId,
    required String action,
  }) {
    final hub = _find(_central, kitchenId);
    if (hub == null) {
      throw ArgumentError('Central kitchen hub not found');
    }

    final name = hub['hubName'] as String;

    switch (action) {
      case 'activate_hub':
        hub['status'] = 'active';
        hub['productionLoad'] = (hub['productionLoad'] as int) + 10;
        _syncedToday++;
        return {'success': true, 'message': 'Central hub activated · $name'};
      case 'pause_production':
        hub['status'] = 'paused';
        hub['productionLoad'] = 0;
        return {'success': true, 'message': 'Production paused · $name'};
      case 'escalate_demand':
        hub['status'] = 'surge';
        hub['productionLoad'] = (hub['productionLoad'] as int) + 20;
        return {'success': true, 'message': 'Demand escalated · $name'};
      default:
        throw ArgumentError('Unknown central kitchen action: $action');
    }
  }

  static Map<String, dynamic> performRecipeAction({
    required String syncId,
    required String action,
  }) {
    final job = _find(_recipes, syncId);
    if (job == null) {
      throw ArgumentError('Recipe sync job not found');
    }

    final pack = job['recipePack'] as String;

    switch (action) {
      case 'push_recipes':
        job['status'] = 'synced';
        _syncedToday++;
        return {'success': true, 'message': 'Recipes pushed · $pack'};
      case 'schedule_sync':
        job['status'] = 'scheduled';
        return {'success': true, 'message': 'Recipe sync scheduled · $pack'};
      case 'resolve_conflict':
        job['status'] = 'resolved';
        return {'success': true, 'message': 'Recipe conflict resolved · $pack'};
      default:
        throw ArgumentError('Unknown recipe sync action: $action');
    }
  }

  static Map<String, dynamic> performBranchAction({
    required String branchId,
    required String action,
  }) {
    final branch = _find(_branches, branchId);
    if (branch == null) {
      throw ArgumentError('Branch kitchen not found');
    }

    final name = branch['branchName'] as String;

    switch (action) {
      case 'sync_branch':
        branch['status'] = 'synced';
        branch['syncLagMinutes'] = 0;
        _syncedToday++;
        return {'success': true, 'message': 'Branch synced · $name'};
      case 'pause_branch':
        branch['status'] = 'paused';
        return {'success': true, 'message': 'Branch paused · $name'};
      case 'reroute_orders':
        branch['status'] = 'rerouting';
        branch['syncLagMinutes'] = (branch['syncLagMinutes'] as int) - 4;
        return {'success': true, 'message': 'Orders rerouted · $name'};
      default:
        throw ArgumentError('Unknown branch kitchen action: $action');
    }
  }

  static Map<String, dynamic> performInventoryAction({
    required String inventoryId,
    required String action,
  }) {
    final item = _find(_inventory, inventoryId);
    if (item == null) {
      throw ArgumentError('Shared inventory item not found');
    }

    final name = item['itemName'] as String;

    switch (action) {
      case 'rebalance_stock':
        item['branchesLow'] = 0;
        item['status'] = 'balanced';
        return {'success': true, 'message': 'Stock rebalanced · $name'};
      case 'reserve_central':
        item['status'] = 'reserved';
        return {'success': true, 'message': 'Central stock reserved · $name'};
      case 'alert_branches':
        item['status'] = 'alert_sent';
        return {'success': true, 'message': 'Branch alerts sent · $name'};
      default:
        throw ArgumentError('Unknown shared inventory action: $action');
    }
  }

  static Map<String, dynamic> performForecastAction({
    required String forecastId,
    required String action,
  }) {
    final forecast = _find(_forecasts, forecastId);
    if (forecast == null) {
      throw ArgumentError('Demand forecast not found');
    }

    final name = forecast['forecastName'] as String;

    switch (action) {
      case 'approve_forecast':
        forecast['status'] = 'approved';
        return {'success': true, 'message': 'Forecast approved · $name'};
      case 'adjust_forecast':
        forecast['expectedChange'] = '+18%';
        forecast['status'] = 'adjusted';
        return {'success': true, 'message': 'Forecast adjusted · $name'};
      case 'publish_forecast':
        forecast['status'] = 'published';
        _syncedToday++;
        return {'success': true, 'message': 'Forecast published · $name'};
      default:
        throw ArgumentError('Unknown demand forecast action: $action');
    }
  }

  static Map<String, dynamic> syncAll() {
    for (final branch in _branches) {
      branch['status'] = 'synced';
      branch['syncLagMinutes'] = 0;
    }
    for (final job in _recipes) {
      if (job['status'] == 'pending') {
        job['status'] = 'synced';
      }
    }
    _syncedToday += 8;
    return {
      'success': true,
      'message': 'All branches and recipes synced · ${_branches.length} branches',
    };
  }

  static int get syncedToday => _syncedToday;

  static List<Map<String, dynamic>> _filterSection(
    List<Map<String, dynamic>> items,
    String section,
  ) {
    if (section == 'All') {
      return items;
    }
    return items.where((item) => item['section'] == section).toList();
  }

  static Map<String, dynamic>? _find(
    List<Map<String, dynamic>> items,
    String id,
  ) {
    for (final item in items) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeCentral(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'hubName': item['hubName'],
      'section': item['section'],
      'branchesServed': item['branchesServed'],
      'productionLoad': item['productionLoad'],
      'status': item['status'],
      'availableActions': const [
        'activate_hub',
        'pause_production',
        'escalate_demand',
      ],
    };
  }

  static Map<String, dynamic> _serializeRecipe(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'recipePack': item['recipePack'],
      'targetBranch': item['targetBranch'],
      'section': item['section'],
      'version': item['version'],
      'status': item['status'],
      'availableActions': const [
        'push_recipes',
        'schedule_sync',
        'resolve_conflict',
      ],
    };
  }

  static Map<String, dynamic> _serializeBranch(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'branchName': item['branchName'],
      'section': item['section'],
      'syncLagMinutes': item['syncLagMinutes'],
      'ordersToday': item['ordersToday'],
      'status': item['status'],
      'availableActions': const [
        'sync_branch',
        'pause_branch',
        'reroute_orders',
      ],
    };
  }

  static Map<String, dynamic> _serializeInventory(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'itemName': item['itemName'],
      'section': item['section'],
      'centralStock': item['centralStock'],
      'branchesLow': item['branchesLow'],
      'status': item['status'],
      'availableActions': const [
        'rebalance_stock',
        'reserve_central',
        'alert_branches',
      ],
    };
  }

  static Map<String, dynamic> _serializeForecast(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'forecastName': item['forecastName'],
      'section': item['section'],
      'expectedChange': item['expectedChange'],
      'confidence': item['confidence'],
      'windowLabel': item['windowLabel'],
      'status': item['status'],
      'availableActions': const [
        'approve_forecast',
        'adjust_forecast',
        'publish_forecast',
      ],
    };
  }

  static List<Map<String, dynamic>> _seedCentral() {
    return [
      {
        'id': 'MB-CK-001',
        'hubName': 'Main central commissary',
        'section': 'Main',
        'branchesServed': 4,
        'productionLoad': 78,
        'status': 'active',
      },
      {
        'id': 'MB-CK-002',
        'hubName': 'Banquet prep hub',
        'section': 'Continental',
        'branchesServed': 2,
        'productionLoad': 52,
        'status': 'syncing',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedRecipes() {
    return [
      {
        'id': 'MB-RCP-001',
        'recipePack': 'Main menu v2.4',
        'targetBranch': 'Downtown branch',
        'section': 'Main',
        'version': 'v2.4',
        'status': 'pending',
      },
      {
        'id': 'MB-RCP-002',
        'recipePack': 'Tandoor marinades pack',
        'targetBranch': 'Airport express',
        'section': 'Tandoor',
        'version': 'v1.8',
        'status': 'synced',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedBranches() {
    return [
      {
        'id': 'MB-BRN-001',
        'branchName': 'Downtown kitchen',
        'section': 'Main',
        'syncLagMinutes': 12,
        'ordersToday': 186,
        'status': 'out_of_sync',
      },
      {
        'id': 'MB-BRN-002',
        'branchName': 'Airport express kitchen',
        'section': 'Main',
        'syncLagMinutes': 0,
        'ordersToday': 142,
        'status': 'synced',
      },
      {
        'id': 'MB-BRN-003',
        'branchName': 'Banquet satellite kitchen',
        'section': 'Continental',
        'syncLagMinutes': 6,
        'ordersToday': 96,
        'status': 'syncing',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedInventory() {
    return [
      {
        'id': 'MB-INV-001',
        'itemName': 'Chicken breast · central pool',
        'section': 'Main',
        'centralStock': '842 kg',
        'branchesLow': 3,
        'status': 'low',
      },
      {
        'id': 'MB-INV-002',
        'itemName': 'Basmati rice · shared pool',
        'section': 'Main',
        'centralStock': '1.2 t',
        'branchesLow': 0,
        'status': 'ok',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedForecasts() {
    return [
      {
        'id': 'MB-FCT-001',
        'forecastName': 'Weekend lunch surge',
        'section': 'Main',
        'expectedChange': '+22%',
        'confidence': 'high',
        'windowLabel': 'Sat–Sun lunch',
        'status': 'approved',
      },
      {
        'id': 'MB-FCT-002',
        'forecastName': 'Banquet season ramp',
        'section': 'Continental',
        'expectedChange': '+35%',
        'confidence': 'medium',
        'windowLabel': 'Next 14 days',
        'status': 'draft',
      },
    ];
  }
}

class MockMultiBranchEngine {
  const MockMultiBranchEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final centralKitchens = MockMultiBranchRegistry.centralFor(section);
    final recipeSyncJobs = MockMultiBranchRegistry.recipesFor(section);
    final branchKitchens = MockMultiBranchRegistry.branchesFor(section);
    final sharedInventory = MockMultiBranchRegistry.inventoryFor(section);
    final demandForecasts = MockMultiBranchRegistry.forecastsFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'centralKitchens': centralKitchens,
      'recipeSyncJobs': recipeSyncJobs,
      'branchKitchens': branchKitchens,
      'sharedInventory': sharedInventory,
      'demandForecasts': demandForecasts,
      'stats': {
        'activeCentralHubs': centralKitchens
            .where((item) => item['status'] == 'active' || item['status'] == 'surge')
            .length,
        'pendingRecipeSyncs': recipeSyncJobs
            .where((item) => item['status'] == 'pending')
            .length,
        'branchesOutOfSync': branchKitchens
            .where((item) =>
                item['status'] == 'out_of_sync' || item['status'] == 'syncing')
            .length,
        'lowStockItems': sharedInventory
            .where((item) => item['status'] == 'low')
            .length,
        'publishedForecasts': demandForecasts
            .where((item) => item['status'] == 'published')
            .length,
        'syncedToday': MockMultiBranchRegistry.syncedToday,
      },
      'multiBranchFeatures': {
        'centralKitchenSupport': centralKitchens.isNotEmpty,
        'recipeSynchronization': recipeSyncJobs.isNotEmpty,
        'branchKitchenSync': branchKitchens.isNotEmpty,
        'sharedInventoryVisibility': sharedInventory.isNotEmpty,
        'demandForecasting': demandForecasts.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
