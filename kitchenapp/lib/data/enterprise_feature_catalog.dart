import '../models/enterprise_feature_system.dart';

class EnterpriseFeatureCatalog {
  const EnterpriseFeatureCatalog._();

  static const systems = [
    EnterpriseFeatureSystem(
      number: 1,
      title: 'Authentication & Security System',
      groups: [
        FeatureGroup(
          title: 'Login Methods',
          items: [
            'Mobile OTP login',
            'PIN login',
            'Password login',
            'QR staff login',
            'NFC login',
            'Face recognition login',
            'Fingerprint login',
          ],
        ),
        FeatureGroup(
          title: 'Staff Roles',
          items: [
            'Head chef',
            'Sous chef',
            'Line cook',
            'Tandoor chef',
            'Chinese chef',
            'Beverage chef',
            'Dessert chef',
            'Bakery chef',
            'Kitchen helper',
            'Kitchen manager',
            'Expeditor',
            'Packing staff',
            'Waiter',
            'Housekeeping',
          ],
        ),
        FeatureGroup(
          title: 'Security Features',
          items: [
            'Shift-based login',
            'Device binding',
            'Session timeout',
            'Multi-device restriction',
            'Emergency logout',
            'Geo restriction',
            'Activity tracking',
            'Permission control',
            'Secure session handling',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 2,
      title: 'Kitchen Dashboard System',
      groups: [
        FeatureGroup(
          title: 'Dashboard Widgets',
          items: [
            'Active orders',
            'Delayed orders',
            'VIP orders',
            'Priority orders',
            'Section workload',
            'Staff availability',
            'Pending KOTs',
            'Completed orders',
            'Rejected orders',
            'Rush alerts',
          ],
        ),
        FeatureGroup(
          title: 'Real-Time Metrics',
          items: [
            'Kitchen efficiency',
            'Average preparation time',
            'Delay ratio',
            'Order backlog',
            'Peak kitchen load',
            'Staff productivity',
            'Live preparation speed',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 3,
      title: 'Live KDS (Kitchen Display System)',
      groups: [
        FeatureGroup(
          title: 'KDS Features',
          items: [
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
          ],
        ),
        FeatureGroup(
          title: 'Smart Display Features',
          items: [
            'Color coded statuses',
            'Delay blinking alerts',
            'Priority sound alerts',
            'Drag-drop priority sorting',
            'Live preparation timers',
          ],
        ),
        FeatureGroup(
          title: 'KOT Information',
          items: [
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
          ],
        ),
        FeatureGroup(
          title: 'KDS Status Types',
          items: [
            'New order',
            'Accepted',
            'Preparing',
            'Ready',
            'Served',
            'Delayed',
            'Cancelled',
            'Rejected',
            'Re-fire requested',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 4,
      title: 'Multi Kitchen Section Management',
      groups: [
        FeatureGroup(
          title: 'Kitchen Sections',
          items: [
            'Main kitchen',
            'Tandoor section',
            'Chinese section',
            'Beverage section',
            'Dessert section',
            'Bakery section',
            'Bar section',
            'Grill section',
            'Fry section',
            'Salad section',
            'Pizza section',
          ],
        ),
        FeatureGroup(
          title: 'Smart Routing',
          items: [
            'Auto section assignment',
            'Multi-section splitting',
            'Parallel preparation',
            'AI load balancing',
            'Smart chef allocation',
            'Queue optimization',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 5,
      title: 'Advanced Order Processing System',
      groups: [
        FeatureGroup(
          title: 'Order Actions',
          items: [
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
          ],
        ),
        FeatureGroup(
          title: 'Smart Processing Features',
          items: [
            'Auto queue sorting',
            'AI priority handling',
            'VIP prioritization',
            'Rush hour optimization',
            'Batch cooking management',
            'Smart cooking sequence',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 6,
      title: 'Food Firing & Course Management',
      groups: [
        FeatureGroup(
          title: 'Course Controls',
          items: [
            'Fire starter',
            'Fire main course',
            'Fire dessert',
            'Hold course',
            'Resume course',
            'Sequential serving',
            'Simultaneous serving',
          ],
        ),
        FeatureGroup(
          title: 'Smart Firing Features',
          items: [
            'Table pacing',
            'Guest pacing',
            'Delay synchronization',
            'Multi-course coordination',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 7,
      title: 'Food Preparation Management',
      groups: [
        FeatureGroup(
          title: 'Preparation Features',
          items: [
            'Recipe guidance',
            'Step-by-step cooking flow',
            'Preparation timers',
            'Auto cooking alerts',
            'Ingredient checklist',
            'Portion guidance',
            'Preparation sequence management',
          ],
        ),
        FeatureGroup(
          title: 'Preparation Modes',
          items: [
            'Standard preparation',
            'Fast preparation',
            'Premium preparation',
            'Bulk preparation',
            'Scheduled preparation',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 8,
      title: 'Modifier & Customization Management',
      groups: [
        FeatureGroup(
          title: 'Modifier Types',
          items: [
            'Extra spicy',
            'No onion',
            'No garlic',
            'Jain preparation',
            'Allergy modifiers',
            'Extra cheese',
            'Half-half customization',
            'Side replacement',
          ],
        ),
        FeatureGroup(
          title: 'Smart Modifier Alerts',
          items: [
            'Allergy flashing alerts',
            'Priority modifiers',
            'Chef confirmation required',
            'Modifier acknowledgment tracking',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 9,
      title: 'Food Allergy & Safety Engine',
      groups: [
        FeatureGroup(
          title: 'Allergy Types',
          items: [
            'Nut allergy',
            'Dairy allergy',
            'Gluten allergy',
            'Seafood allergy',
            'Egg allergy',
          ],
        ),
        FeatureGroup(
          title: 'Safety Features',
          items: [
            'Allergy color coding',
            'Mandatory chef confirmation',
            'Cross contamination warnings',
            'Dedicated prep warnings',
            'Safety SOP reminders',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 10,
      title: 'Chef Task Management System',
      groups: [
        FeatureGroup(
          title: 'Task Features',
          items: [
            'Chef assignment',
            'Task transfer',
            'Multi-chef coordination',
            'Skill-based assignment',
            'Shift-based assignment',
            'Section workload balancing',
          ],
        ),
        FeatureGroup(
          title: 'Task Status',
          items: [
            'Assigned',
            'In progress',
            'Waiting',
            'Completed',
            'Delayed',
            'Escalated',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 11,
      title: 'AI Kitchen Assistant',
      groups: [
        FeatureGroup(
          title: 'AI Features',
          items: [
            'Smart preparation suggestions',
            'Delay prediction',
            'Rush prediction',
            'Smart cooking sequence',
            'Smart chef allocation',
            'Ingredient optimization',
            'AI workload balancing',
            'Preparation optimization',
          ],
        ),
        FeatureGroup(
          title: 'Voice AI Commands',
          items: [
            'Mark ready',
            'Delay 5 minutes',
            'Out of stock',
            'Need assistance',
            'Re-fire item',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 12,
      title: 'Order Priority Engine',
      groups: [
        FeatureGroup(
          title: 'Priority Types',
          items: [
            'VIP order',
            'Express order',
            'Room service priority',
            'Event priority',
            'Delivery priority',
            'Child meal priority',
          ],
        ),
        FeatureGroup(
          title: 'Priority Actions',
          items: [
            'Queue jump',
            'Flash alert',
            'Sound alert',
            'Auto escalation',
            'Auto reassignment',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 13,
      title: 'Kitchen Communication System',
      groups: [
        FeatureGroup(
          title: 'Communication Features',
          items: [
            'Waiter \u2194 kitchen chat',
            'Voice notes',
            'Delay updates',
            'Item availability alerts',
            'Chef announcements',
            'Broadcast messages',
          ],
        ),
        FeatureGroup(
          title: 'Smart Alerts',
          items: [
            'Out of stock alerts',
            'Delay warnings',
            'Urgent order alerts',
            'Modification requests',
            'Re-fire requests',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 14,
      title: 'Inventory & Stock Integration',
      groups: [
        FeatureGroup(
          title: 'Inventory Features',
          items: [
            'Live ingredient deduction',
            'Stock validation',
            'Ingredient alerts',
            'Low stock alerts',
            'Batch tracking',
            'Expiry tracking',
          ],
        ),
        FeatureGroup(
          title: 'Smart Inventory Features',
          items: [
            'Auto stock synchronization',
            'AI shortage prediction',
            'Ingredient substitution suggestions',
            'Recipe stock validation',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 15,
      title: 'Recipe & Food Costing System',
      groups: [
        FeatureGroup(
          title: 'Recipe Features',
          items: [
            'Standard recipes',
            'Ingredient quantities',
            'Portion standards',
            'Preparation videos',
            'Cooking SOPs',
          ],
        ),
        FeatureGroup(
          title: 'Costing Features',
          items: [
            'Ingredient costing',
            'Per plate costing',
            'Waste tracking',
            'Profit analysis',
            'Cost fluctuation tracking',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 16,
      title: 'Prep Station Management System',
      groups: [
        FeatureGroup(
          title: 'Prep Stations',
          items: [
            'Cutting station',
            'Sauce station',
            'Grill station',
            'Fry station',
            'Beverage station',
            'Dessert prep station',
          ],
        ),
        FeatureGroup(
          title: 'Station Features',
          items: [
            'Station workload tracking',
            'Prep timers',
            'Queue balancing',
            'Staff assignment',
            'Productivity tracking',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 17,
      title: 'Advanced Batch Cooking System',
      groups: [
        FeatureGroup(
          title: 'Batch Features',
          items: [
            'Bulk preparation tracking',
            'Batch timing',
            'Batch expiry tracking',
            'Batch reuse tracking',
            'Production forecasting',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 18,
      title: 'Delay & Escalation System',
      groups: [
        FeatureGroup(
          title: 'Delay Features',
          items: [
            'Delay timer',
            'Delay reason logging',
            'Auto escalation',
            'Delay history',
            'Bottleneck detection',
          ],
        ),
        FeatureGroup(
          title: 'Escalation Flow',
          items: ['Chef alert', 'Kitchen manager alert', 'Operations alert'],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 19,
      title: 'Quality Control System',
      groups: [
        FeatureGroup(
          title: 'QC Features',
          items: [
            'Food quality checklist',
            'Presentation validation',
            'Temperature validation',
            'Hygiene validation',
            'Supervisor approval',
          ],
        ),
        FeatureGroup(
          title: 'Audit Features',
          items: [
            'Random audits',
            'QC scoring',
            'Complaint tracking',
            'Rejected food tracking',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 20,
      title: 'Customer Return & Re-fire System',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Wrong item replacement',
            'Burnt item replacement',
            'Re-fire request',
            'Priority remake',
            'Complaint tagging',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 21,
      title: 'Expeditor Management System',
      groups: [
        FeatureGroup(
          title: 'Expeditor Features',
          items: [
            'Final order validation',
            'Multi-section coordination',
            'Table synchronization',
            'Dispatch approval',
            'Packaging verification',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 22,
      title: 'Packing & Delivery Preparation System',
      groups: [
        FeatureGroup(
          title: 'Packing Features',
          items: [
            'Delivery packing',
            'Room service packing',
            'Takeaway packing',
            'Event packing',
            'Spill-proof checks',
          ],
        ),
        FeatureGroup(
          title: 'Packing Labels',
          items: [
            'Customer name',
            'Order ID',
            'Delivery type',
            'Allergy notes',
            'Special instructions',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 23,
      title: 'Delivery Aggregator System',
      groups: [
        FeatureGroup(
          title: 'Supported Platforms',
          items: ['Swiggy', 'Zomato', 'ONDC'],
        ),
        FeatureGroup(
          title: 'Features',
          items: [
            'Aggregator order sync',
            'Pickup countdown',
            'Rider waiting alerts',
            'Dispatch tracking',
            'Delivery preparation timers',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 24,
      title: 'Bar & Beverage Kitchen System',
      groups: [
        FeatureGroup(
          title: 'Beverage Features',
          items: [
            'Drink preparation queue',
            'Bartender assignment',
            'Cocktail customization',
            'Beverage timers',
            'Recipe guidance',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 25,
      title: 'Bakery & Dessert Management',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Dessert preparation queue',
            'Bakery production tracking',
            'Cake customization',
            'Event dessert planning',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 26,
      title: 'Cloud Kitchen Management',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Multi-brand order management',
            'Brand-wise segregation',
            'Delivery order handling',
            'Kitchen load balancing',
            'Shared inventory visibility',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 27,
      title: 'Event & Banquet Kitchen System',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Bulk meal preparation',
            'Buffet coordination',
            'Event meal scheduling',
            'Guest count preparation',
            'Multi-counter coordination',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 28,
      title: 'Room Service Kitchen System',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Room-wise order tracking',
            'VIP room priority',
            'Scheduled room delivery',
            'Tray management',
            'Mini-bar synchronization',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 29,
      title: 'Cleaning & Hygiene Management',
      groups: [
        FeatureGroup(
          title: 'Hygiene Features',
          items: [
            'Cleaning schedules',
            'Hygiene checklists',
            'Equipment sanitization',
            'Food safety tracking',
            'Deep cleaning management',
          ],
        ),
        FeatureGroup(
          title: 'Compliance Features',
          items: [
            'FSSAI SOP tracking',
            'Hygiene audit logs',
            'Staff hygiene verification',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 30,
      title: 'Equipment Management System',
      groups: [
        FeatureGroup(
          title: 'Equipment Types',
          items: [
            'Ovens',
            'Refrigerators',
            'Fryers',
            'Coffee machines',
            'Grills',
            'Dishwashers',
          ],
        ),
        FeatureGroup(
          title: 'Features',
          items: [
            'Equipment health tracking',
            'AMC reminders',
            'Maintenance tickets',
            'Breakdown alerts',
            'Usage analytics',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 31,
      title: 'Smart Energy & Gas Monitoring',
      groups: [
        FeatureGroup(
          title: 'Monitoring Features',
          items: [
            'Gas leak alerts',
            'Energy usage tracking',
            'Smart shutdown alerts',
            'High temperature alerts',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 32,
      title: 'IoT Device Integration System',
      groups: [
        FeatureGroup(
          title: 'Smart Devices',
          items: [
            'Smart ovens',
            'Smart fryers',
            'Smart refrigerators',
            'Smart coffee machines',
          ],
        ),
        FeatureGroup(
          title: 'IoT Features',
          items: [
            'Temperature monitoring',
            'Auto maintenance alerts',
            'Smart usage analytics',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 33,
      title: 'Staff Performance System',
      groups: [
        FeatureGroup(
          title: 'Performance Metrics',
          items: [
            'Orders completed',
            'Preparation speed',
            'Delay ratio',
            'Complaint ratio',
            'Quality score',
            'Productivity score',
          ],
        ),
        FeatureGroup(
          title: 'Incentive Features',
          items: ['Speed incentives', 'Quality rewards', 'Performance bonuses'],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 34,
      title: 'Staff Shift Management',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Shift start/end',
            'Attendance tracking',
            'Break tracking',
            'Overtime tracking',
            'Shift swap',
            'Shift handover notes',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 35,
      title: 'Staff Fatigue & Wellness AI',
      groups: [
        FeatureGroup(
          title: 'AI Features',
          items: [
            'Burnout prediction',
            'Slow performance detection',
            'Overwork alerts',
            'Break recommendations',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 36,
      title: 'Live Alert Engine',
      groups: [
        FeatureGroup(
          title: 'Alert Types',
          items: [
            'Delay alerts',
            'VIP alerts',
            'Emergency alerts',
            'Low stock alerts',
            'Equipment alerts',
            'Hygiene alerts',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 37,
      title: 'Panic & Emergency System',
      groups: [
        FeatureGroup(
          title: 'Emergency Types',
          items: [
            'Fire emergency',
            'Gas leakage',
            'Equipment blast',
            'Staff injury',
            'Food contamination',
          ],
        ),
        FeatureGroup(
          title: 'Emergency Features',
          items: [
            'Panic button',
            'Emergency broadcasts',
            'Evacuation alerts',
            'Incident escalation',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 38,
      title: 'Offline Mode & Failover System',
      groups: [
        FeatureGroup(
          title: 'Offline Features',
          items: [
            'Offline KDS',
            'Offline order sync',
            'Offline preparation tracking',
            'Queue recovery',
            'Auto sync restoration',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 39,
      title: 'Analytics & Reporting System',
      groups: [
        FeatureGroup(
          title: 'Kitchen Reports',
          items: [
            'Preparation reports',
            'Delay reports',
            'Waste reports',
            'Productivity reports',
            'Peak hour reports',
          ],
        ),
        FeatureGroup(
          title: 'AI Analytics',
          items: [
            'Rush prediction',
            'Demand forecasting',
            'Staff prediction',
            'Slow item detection',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 40,
      title: 'Live Kitchen Heatmap System',
      groups: [
        FeatureGroup(
          title: 'Heatmap Features',
          items: [
            'Busy station mapping',
            'Delay hotspots',
            'Staff density tracking',
            'Rush visualization',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 41,
      title: 'Hardware Integration System',
      groups: [
        FeatureGroup(
          title: 'Supported Devices',
          items: [
            'Kitchen display screens',
            'Tablets',
            'Thermal printers',
            'Smartwatches',
            'NFC devices',
            'Barcode scanners',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 42,
      title: 'Smartwatch Support',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Order alerts',
            'Delay alerts',
            'Emergency alerts',
            'Task notifications',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 43,
      title: 'Multi Branch & Central Kitchen System',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Central kitchen support',
            'Recipe synchronization',
            'Branch kitchen sync',
            'Shared inventory visibility',
            'Demand forecasting',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 44,
      title: 'Audit & Compliance System',
      groups: [
        FeatureGroup(
          title: 'Audit Features',
          items: [
            'Action logs',
            'Food safety logs',
            'Hygiene logs',
            'Staff activity logs',
            'Incident logs',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 45,
      title: 'Backup & Recovery System',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Auto backup',
            'Manual backup',
            'Cloud synchronization',
            'Recovery restore',
            'Data recovery',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 46,
      title: 'Sandbox & Training Mode',
      groups: [
        FeatureGroup(
          title: 'Features',
          items: [
            'Demo kitchen',
            'Staff practice mode',
            'SOP training',
            'Kitchen simulations',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 47,
      title: 'Hidden Enterprise Features',
      groups: [
        FeatureGroup(
          title: 'Hidden Systems',
          items: [
            'Soft delete recovery',
            'Restore deleted orders',
            'Action replay',
            'Version logs',
            'Device tracking',
            'Session logs',
            'Emergency lockdown mode',
            'Queue recovery engine',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 48,
      title: 'Future AI Expansion Features',
      groups: [
        FeatureGroup(
          title: 'Future Features',
          items: [
            'AI cooking assistant',
            'AI robotic kitchen integration',
            'AI plating suggestions',
            'AI waste reduction engine',
            'AI preparation automation',
          ],
        ),
      ],
    ),
    EnterpriseFeatureSystem(
      number: 49,
      title: 'Waiter Auto Assignment System',
      groups: [
        FeatureGroup(
          title: 'Waiter App (Auto Assignment)',
          items: [
            'Auto task allocation',
            'Order ready notifications',
            'Delivery confirmation',
            'Workload balance algorithm',
            'In-hotel navigation (future)',
            'No manual waiter calling',
          ],
        ),
        FeatureGroup(
          title: 'Notification Types',
          items: [
            'Order ready · table alert',
            'VIP table priority',
            'Room service pickup',
            'Delivery confirmation reminder',
          ],
        ),
      ],
    ),
  ];

  static int get totalFeatureCount {
    return systems.fold(0, (total, system) => total + system.featureCount);
  }

  static int get totalGroupCount {
    return systems.fold(0, (total, system) => total + system.groups.length);
  }

  static int get criticalSystemCount {
    return 11;
  }
}
