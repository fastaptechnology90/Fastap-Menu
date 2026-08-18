import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../data/enterprise_catalog_filter.dart';
import '../../data/staff_role_access_policy.dart';
import '../../models/auth/staff_role.dart';
import '../../data/enterprise_feature_catalog.dart';
import '../../data/enterprise_system_nav_registry.dart';
import '../../data/feature_module_status_resolver.dart';
import '../../navigation/module_screen_builder.dart';
import '../../state/auth_controller.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/features/final_summary_panel.dart';
import '../../widgets/features/feature_system_card.dart';

class EnterpriseFeaturesView extends StatefulWidget {
  const EnterpriseFeaturesView({
    super.key,
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  @override
  State<EnterpriseFeaturesView> createState() => _EnterpriseFeaturesViewState();
}

class _EnterpriseFeaturesViewState extends State<EnterpriseFeaturesView> {
  final _searchController = TextEditingController();
  EnterpriseCatalogFilter _selectedFilter = EnterpriseCatalogFilter.all;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final liveCount = EnterpriseFeatureCatalog.systems
        .where(
          (system) =>
              FeatureModuleStatusResolver.statusFor(system.number).label ==
              'Live · In-app',
        )
        .length;
    final filteredSystems = EnterpriseCatalogFilterEngine.filter(
      query: _searchController.text,
      category: _selectedFilter,
    ).where((system) => widget.auth.canAccessSystem(system.number)).toList();
    final allowedCount = StaffRoleAccessPolicy.allowedSystemNumbers(
      role: widget.auth.session?.user.role ?? StaffRole.lineCook,
      permissions: widget.auth.session?.permissions ?? [],
    ).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.panelBorder),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Wrap(
            spacing: 18,
            runSpacing: 10,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Text(
                'Complete Enterprise Feature Catalog',
                style: TextStyle(
                  color: AppColors.primaryText,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              _CatalogStat(
                label: 'Live',
                value: '$liveCount/${EnterpriseFeatureCatalog.systems.length}',
              ),
              _CatalogStat(
                label: 'Your modules',
                value: '$allowedCount',
              ),
              _CatalogStat(
                label: 'Showing',
                value: '${filteredSystems.length}',
              ),
              _CatalogStat(
                label: 'Groups',
                value: '${EnterpriseFeatureCatalog.totalGroupCount}',
              ),
              _CatalogStat(
                label: 'Enabled workflows',
                value: '${EnterpriseFeatureCatalog.totalFeatureCount}',
              ),
              _CatalogStat(
                label: 'Critical',
                value: '${EnterpriseFeatureCatalog.criticalSystemCount}',
              ),
            ],
          ),
        ),
        if (liveCount == EnterpriseFeatureCatalog.systems.length) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: const Row(
              children: [
                Icon(Icons.verified, color: AppColors.primary, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Catalog complete — all 49 enterprise systems are live in-app. '
                    'Cards shown here match your staff role permissions.',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        TextField(
          controller: _searchController,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: 'Search systems, workflows, or hooks',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _searchController.text.isEmpty
                ? null
                : IconButton(
                    onPressed: () {
                      _searchController.clear();
                      setState(() {});
                    },
                    icon: const Icon(Icons.close),
                  ),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.panelBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.panelBorder),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: EnterpriseCatalogFilter.values.map((filter) {
            final count = EnterpriseCatalogFilterEngine.countForCategory(filter);
            final selected = _selectedFilter == filter;

            return FilterChip(
              selected: selected,
              label: Text('${filter.label} ($count)'),
              onSelected: (_) {
                setState(() => _selectedFilter = filter);
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        const FinalSummaryPanel(),
        const SizedBox(height: 16),
        if (filteredSystems.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: const Text(
              'No systems match your search or filter.',
              style: TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w700,
              ),
            ),
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth > 1180
                  ? 3
                  : constraints.maxWidth > 760
                  ? 2
                  : 1;

              return Wrap(
                spacing: 14,
                runSpacing: 14,
                children: filteredSystems.map((system) {
                  final width =
                      (constraints.maxWidth - ((columns - 1) * 14)) / columns;
                  final navIndex =
                      EnterpriseSystemNavRegistry.navIndexForSystem(
                    system.number,
                  );

                  return SizedBox(
                    width: width,
                    child: FeatureSystemCard(
                      system: system,
                      onOpenModule: navIndex == null
                          ? () => _showAuthHint(context)
                          : widget.auth.canAccessNav(navIndex)
                              ? () => ModuleScreenBuilder.open(
                                    context,
                                    navIndex: navIndex,
                                    controller: widget.controller,
                                    auth: widget.auth,
                                  )
                              : null,
                    ),
                  );
                }).toList(),
              );
            },
          ),
      ],
    );
  }

  void _showAuthHint(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Authentication & security runs on the login screen. '
          'Sign out from the header to revisit it.',
        ),
      ),
    );
  }
}

class _CatalogStat extends StatelessWidget {
  const _CatalogStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
