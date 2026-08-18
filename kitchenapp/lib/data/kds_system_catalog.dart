/// Canonical feature list for System 3 · Live KDS.
class KdsSystemCatalog {
  const KdsSystemCatalog._();

  static const title = 'Live KDS (Kitchen Display System)';

  static const kdsFeatures = [
    'Real-time KOT display',
    'Auto refresh',
    'Live order synchronization',
    'Category-wise display',
    'Section-wise display',
    'Chef-wise display',
    'Timeline view',
    'Queue view',
    'Priority-only view',
    'VIP-only view',
  ];

  static const smartDisplayFeatures = [
    'Color coded statuses',
    'Delay blinking alerts',
    'Priority sound alerts',
    'Drag-drop priority sorting',
    'Live preparation timers',
  ];

  static const kotInformation = [
    'Order ID',
    'Table number',
    'Room number',
    'Guest type',
    'Order items',
    'Add-ons',
    'Modifiers',
    'Allergy alerts',
    'Cooking notes',
    'VIP tags',
    'Delivery type',
  ];

  static const statusTypes = [
    'New order',
    'Accepted',
    'Preparing',
    'Ready',
    'Served',
    'Delayed',
    'Cancelled',
    'Rejected',
    'Re-fire requested',
  ];

  static const kdsFeatureCount = 10;
  static const smartDisplayFeatureCount = 5;
  static const kotInformationCount = 11;
  static const statusTypeCount = 9;
}
