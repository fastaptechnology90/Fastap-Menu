/// Canonical feature list for System 5 · Advanced Order Processing.
class OrderProcessingSystemCatalog {
  const OrderProcessingSystemCatalog._();

  static const title = 'Advanced Order Processing System';

  static const orderActions = [
    'Accept order',
    'Reject order',
    'Hold order',
    'Start preparation',
    'Mark ready',
    'Mark delayed',
    'Reassign order',
    'Cancel item',
    'Modify item',
    'Re-fire item',
  ];

  static const smartProcessingFeatures = [
    'Auto queue sorting',
    'AI priority handling',
    'VIP prioritization',
    'Rush hour optimization',
    'Batch cooking management',
    'Smart cooking sequence',
  ];

  /// API action keys mapped to catalog labels (same order as [orderActions]).
  static const orderActionKeys = [
    'accept',
    'reject',
    'hold',
    'prepare',
    'ready',
    'delay',
    'reassign',
    'cancel_item',
    'modify_item',
    'refire',
  ];

  static const orderActionCount = 10;
  static const smartProcessingFeatureCount = 6;
}
