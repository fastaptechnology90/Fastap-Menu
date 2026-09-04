import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../data/enterprise_module_directory.dart';

class ModuleSwitcherButton extends StatelessWidget {
  const ModuleSwitcherButton({
    super.key,
    required this.selectedNav,
    required this.onNavSelected,
  });

  final int selectedNav;
  final ValueChanged<int> onNavSelected;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () async {
        final navIndex = await showDialog<int>(
          context: context,
          builder: (context) => ModuleSwitcherDialog(selectedNav: selectedNav),
        );
        if (navIndex != null) {
          onNavSelected(navIndex);
        }
      },
      icon: const Icon(Icons.swap_horiz, size: 18),
      label: const Text('Modules'),
    );
  }
}

class ModuleSwitcherDialog extends StatefulWidget {
  const ModuleSwitcherDialog({super.key, required this.selectedNav});

  final int selectedNav;

  @override
  State<ModuleSwitcherDialog> createState() => _ModuleSwitcherDialogState();
}

class _ModuleSwitcherDialogState extends State<ModuleSwitcherDialog> {
  final _searchController = TextEditingController();
  late List<EnterpriseModuleDestination> _results =
      EnterpriseModuleDirectory.destinations();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _updateResults() {
    setState(() {
      _results = EnterpriseModuleDirectory.search(_searchController.text);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Jump to module'),
      content: SizedBox(
        width: 520,
        height: 460,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _searchController,
              autofocus: true,
              onChanged: (_) => _updateResults(),
              decoration: InputDecoration(
                hintText: 'Search by system, title, or tab',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _searchController.clear();
                          _updateResults();
                        },
                        icon: const Icon(Icons.close),
                      ),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: _results.isEmpty
                  ? Center(
                      child: Text(
                        'No modules match your search.',
                        style: TextStyle(
                          color: AppColors.secondaryText,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  : ListView.separated(
                      itemCount: _results.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final item = _results[index];
                        final selected = item.navIndex == widget.selectedNav;

                        return ListTile(
                          selected: selected,
                          leading: CircleAvatar(
                            radius: 16,
                            backgroundColor: selected
                                ? AppColors.primary.withValues(alpha: 0.15)
                                : AppColors.panelBorder.withValues(alpha: 0.4),
                            child: Text(
                              item.systemNumber?.toString() ??
                                  '${item.navIndex}',
                              style: TextStyle(
                                color: selected
                                    ? AppColors.primary
                                    : AppColors.secondaryText,
                                fontWeight: FontWeight.w800,
                                fontSize: 11,
                              ),
                            ),
                          ),
                          title: Text(
                            item.label,
                            style: TextStyle(
                              fontWeight:
                                  selected ? FontWeight.w900 : FontWeight.w700,
                            ),
                          ),
                          subtitle: Text(
                            'Tab ${item.navIndex}',
                            style: const TextStyle(fontSize: 12),
                          ),
                          trailing: selected
                              ? Icon(
                                  Icons.check_circle,
                                  color: AppColors.primary,
                                )
                              : const Icon(Icons.chevron_right),
                          onTap: selected
                              ? null
                              : () => Navigator.of(context).pop(item.navIndex),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
      ],
    );
  }
}
