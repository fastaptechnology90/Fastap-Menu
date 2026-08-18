import 'package:flutter/material.dart';

import 'package:kitchenapp/core/config/app_variant_content.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/data/enterprise_catalog_filter.dart';
import 'package:kitchenapp/models/enterprise_feature_system.dart';
import 'package:kitchenapp/data/enterprise_system_nav_registry.dart';
import 'package:kitchenapp/navigation/module_screen_builder.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/home_summary.dart';
import 'package:kitchenapp/presentation/widgets/module/ops_alert_widgets.dart';
import 'package:kitchenapp/state/auth_controller.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';

class OperationsTab extends StatefulWidget {
  const OperationsTab({
    super.key,
    required this.controller,
    required this.auth,
  });

  final KitchenCommandController controller;
  final AuthController auth;

  @override
  State<OperationsTab> createState() => _OperationsTabState();
}

class _OperationsTabState extends State<OperationsTab> {
  final _searchController = TextEditingController();
  EnterpriseCatalogFilter _filter = EnterpriseCatalogFilter.all;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  int get _filterIndex => EnterpriseCatalogFilter.values.indexOf(_filter);

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.auth,
      builder: (context, _) {
        final systems = EnterpriseCatalogFilterEngine.filter(
          query: _searchController.text,
          category: _filter,
        ).where((system) => widget.auth.canAccessSystem(system.number)).toList();

        return _buildContent(context, systems);
      },
    );
  }

  Widget _buildContent(
    BuildContext context,
    List<EnterpriseFeatureSystem> systems,
  ) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TabScreenHeader(
                  title: 'Operations',
                  subtitle:
                      '${systems.length} modules for your role — search and open full screens',
                  icon: Icons.hub_rounded,
                  gradientColors: AppVariantContent.headerGradient,
                  chips: [
                    TabHeaderChip('${systems.length} shown', icon: Icons.apps_rounded),
                    const TabHeaderChip('49 systems', icon: Icons.layers_rounded),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Search modules by name or number…',
                    hintStyle: const TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 13,
                    ),
                    prefixIcon: const Icon(Icons.search_rounded),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                      borderSide: const BorderSide(color: AppColors.panelBorder),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                      borderSide: const BorderSide(color: AppColors.panelBorder),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                      borderSide: const BorderSide(
                        color: AppColors.premium,
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                StyledFilterChipRow(
                  options: EnterpriseCatalogFilter.values
                      .map((item) => item.label)
                      .toList(),
                  selectedIndex: _filterIndex,
                  onSelected: (index) => setState(
                    () => _filter = EnterpriseCatalogFilter.values[index],
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                HomeSectionTitle(
                  title: 'Module catalog',
                  subtitle: systems.isEmpty
                      ? 'No modules match your filters'
                      : '${systems.length} modules ready to open',
                ),
              ],
            ),
          ),
        ),
        if (systems.isEmpty)
          const SliverFillRemaining(
            hasScrollBody: false,
            child: _OpsEmptyState(),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            sliver: SliverList.separated(
              itemCount: systems.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (context, index) {
                final system = systems[index];
                final navIndex =
                    EnterpriseSystemNavRegistry.navIndexForSystem(system.number);

                final canOpen = navIndex != null &&
                    widget.auth.canAccessNav(navIndex);

                return CompactModuleCard(
                  system: system,
                  onOpen: canOpen
                      ? () => ModuleScreenBuilder.open(
                            context,
                            navIndex: navIndex,
                            controller: widget.controller,
                            auth: widget.auth,
                          )
                      : null,
                );
              },
            ),
          ),
      ],
    );
  }
}

class _OpsEmptyState extends StatelessWidget {
  const _OpsEmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.search_off_rounded,
              size: 48,
              color: AppColors.secondaryText.withValues(alpha: 0.5),
            ),
            const SizedBox(height: AppSpacing.md),
            const Text(
              'No modules found',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                color: AppColors.primaryText,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Try a different search or category filter',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.secondaryText),
            ),
          ],
        ),
      ),
    );
  }
}
