import type { Notebook } from "@edgeever/shared";
import { getMobileNotebookSearchVisibleIds } from "@edgeever/shared/mobile-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  Plus,
  Search,
  Trash2,
  X,
} from "../components/icons";
import { useMobileLocale } from "../lib/mobile-locale";
import { useMobileTheme } from "../lib/mobile-theme";
import {
  filterCollapsedNotebookOptions,
  filterNotebookOptionsById,
  flattenNotebooks,
  getNotebookAncestorIds,
  getNotebookParentIdSet,
  resolveDrawerDrag,
  type DrawerDragParams,
  type NotebookOption,
} from "./workspace-utils";

export const ALL_NOTES_ID = "all";
export type MemoView = "notebook" | "trash";

export interface UseNotebookDrawerOptions {
  drawerWidth: number;
  enabled?: boolean;
}

export const useNotebookDrawer = ({ drawerWidth, enabled = true }: UseNotebookDrawerOptions) => {
  const [isOpen, setIsOpen] = useState(false);
  const translateX = useSharedValue(-drawerWidth);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isOpen) {
      translateX.value = -drawerWidth;
    }
  }, [drawerWidth, isOpen, translateX]);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    translateX.value = withSpring(0, { damping: 24, stiffness: 220, mass: 0.8 });
    backdropOpacity.value = withTiming(0.5, { duration: 220 });
  }, [backdropOpacity, translateX]);

  const closeDrawer = useCallback(() => {
    translateX.value = withTiming(-drawerWidth, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setIsOpen)(false);
      }
    });
    backdropOpacity.value = withTiming(0, { duration: 200 });
  }, [backdropOpacity, drawerWidth, translateX]);

  // Swipe right gesture on NotesView to pull out the drawer
  const notesSwipeGesture = Gesture.Pan()
    .enabled(enabled && !isOpen)
    .activeOffsetX(22) // Drag right at least 22px
    .failOffsetX(-15) // Dragging left fails immediately
    .failOffsetY([-25, 25]) // Vertical scroll > 25px takes priority for note list
    .onStart(() => {
      runOnJS(setIsOpen)(true);
    })
    .onUpdate((e) => {
      const offset = Math.max(0, Math.min(drawerWidth, e.translationX));
      translateX.value = -drawerWidth + offset;
      backdropOpacity.value = (offset / drawerWidth) * 0.5;
    })
    .onEnd((e) => {
      const willOpen = resolveDrawerDrag({
        translationX: e.translationX,
        velocityX: e.velocityX,
        drawerWidth,
        isCurrentlyOpen: false,
      });
      if (willOpen) {
        translateX.value = withSpring(0, { damping: 24, stiffness: 220, mass: 0.8 });
        backdropOpacity.value = withTiming(0.5, { duration: 200 });
        runOnJS(setIsOpen)(true);
      } else {
        translateX.value = withTiming(-drawerWidth, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(setIsOpen)(false);
          }
        });
        backdropOpacity.value = withTiming(0, { duration: 200 });
      }
    });

  // Swipe left gesture on Drawer to close it
  const drawerPanGesture = Gesture.Pan()
    .enabled(isOpen)
    .activeOffsetX(-15) // Dragging left activates dismissal
    .failOffsetX(15)
    .onUpdate((e) => {
      const offset = Math.max(-drawerWidth, Math.min(0, e.translationX));
      translateX.value = offset;
      backdropOpacity.value = ((drawerWidth + offset) / drawerWidth) * 0.5;
    })
    .onEnd((e) => {
      const willStayOpen = resolveDrawerDrag({
        translationX: e.translationX,
        velocityX: e.velocityX,
        drawerWidth,
        isCurrentlyOpen: true,
      });
      if (!willStayOpen) {
        translateX.value = withTiming(-drawerWidth, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(setIsOpen)(false);
          }
        });
        backdropOpacity.value = withTiming(0, { duration: 200 });
      } else {
        translateX.value = withSpring(0, { damping: 24, stiffness: 220, mass: 0.8 });
        backdropOpacity.value = withTiming(0.5, { duration: 200 });
      }
    });

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return {
    isOpen,
    openDrawer,
    closeDrawer,
    notesSwipeGesture,
    drawerPanGesture,
    drawerAnimatedStyle,
    backdropAnimatedStyle,
  };
};

export interface NotebookDrawerProps {
  activeNotebookId: string;
  drawerAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  backdropAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  drawerPanGesture: ReturnType<typeof Gesture.Pan>;
  drawerWidth: number;
  isOpen: boolean;
  memoView: MemoView;
  notebooks: Notebook[];
  onClose: () => void;
  onCreateNotebook?: (name: string, parentId: string | null) => Promise<string>;
  onSelectAllNotes: () => void;
  onSelectNotebook: (notebookId: string) => void;
  onSelectTrash: () => void;
  totalNotesCount?: number;
}

export const NotebookDrawer = ({
  activeNotebookId,
  backdropAnimatedStyle,
  drawerAnimatedStyle,
  drawerPanGesture,
  drawerWidth,
  isOpen,
  memoView,
  notebooks,
  onClose,
  onCreateNotebook,
  onSelectAllNotes,
  onSelectNotebook,
  onSelectTrash,
  totalNotesCount,
}: NotebookDrawerProps) => {
  const { translate } = useMobileLocale();
  const { resolvedTheme } = useMobileTheme();
  const isDark = resolvedTheme === "dark";
  const insets = useSafeAreaInsets();

  const [searchText, setSearchText] = useState("");
  const [creating, setCreating] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [newNotebookParentId, setNewNotebookParentId] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [isSavingNotebook, setIsSavingNotebook] = useState(false);
  const createInFlight = useRef(false);
  const [collapsedNotebookIds, setCollapsedNotebookIds] = useState<Set<string>>(() => new Set());

  const notebookOptions = flattenNotebooks(notebooks);
  const searchQuery = searchText.trim();
  const childNotebookIds = getNotebookParentIdSet(notebooks);
  const activeNotebookAncestorIds = getNotebookAncestorIds(notebooks, activeNotebookId);

  const visibleNotebookOptions = searchQuery
    ? filterNotebookOptionsById(notebookOptions, getMobileNotebookSearchVisibleIds(notebooks, searchText))
    : filterCollapsedNotebookOptions(notebookOptions, collapsedNotebookIds);

  const activeNotebookName = activeNotebookId === ALL_NOTES_ID
    ? "全部笔记"
    : notebooks.find((notebook) => notebook.id === activeNotebookId)?.name ?? "全部笔记";

  const allNotebookBranchesExpanded = childNotebookIds.size > 0 &&
    Array.from(childNotebookIds).every((notebookId) => !collapsedNotebookIds.has(notebookId));

  useEffect(() => {
    if (isOpen) {
      setSearchText("");
      setCreating(false);
      setNewNotebookName("");
      setNewNotebookParentId(null);
      setCreateError("");
      setCollapsedNotebookIds(new Set(Array.from(childNotebookIds).filter((id) => !activeNotebookAncestorIds.has(id))));
    }
  }, [isOpen, activeNotebookId, notebooks]);

  const submitNewNotebook = async () => {
    const name = newNotebookName.trim();
    if (!onCreateNotebook || createInFlight.current || !name || name.length > 80) {
      return;
    }
    createInFlight.current = true;
    setIsSavingNotebook(true);
    setCreateError("");
    try {
      const notebookId = await onCreateNotebook(name, newNotebookParentId);
      onSelectNotebook(notebookId);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "创建笔记本失败，请重试");
    } finally {
      createInFlight.current = false;
      setIsSavingNotebook(false);
    }
  };

  const toggleNotebookCollapsed = (notebookId: string) => {
    setCollapsedNotebookIds((current) => {
      const next = new Set(current);
      if (next.has(notebookId)) {
        next.delete(notebookId);
      } else {
        next.add(notebookId);
      }
      return next;
    });
  };

  const toggleAllNotebookBranches = () => {
    setCollapsedNotebookIds(allNotebookBranchesExpanded ? new Set(childNotebookIds) : new Set());
  };

  return (
    <View
      pointerEvents={isOpen ? "auto" : "none"}
      style={StyleSheet.absoluteFill}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
        <Pressable
          accessibilityLabel="关闭抽屉"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Drawer Container with Pan Gesture */}
      <GestureDetector gesture={drawerPanGesture}>
        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: isDark ? "#0b1324" : "#ffffff",
              borderRightColor: isDark ? "#1e293b" : "#e2e8f0",
              paddingBottom: Math.max(16, insets.bottom),
              paddingTop: Math.max(16, insets.top),
              width: drawerWidth,
            },
            drawerAnimatedStyle,
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.headerIconWrap, isDark && styles.headerIconWrapDark]}>
                <BookOpen color="#059669" size={18} />
              </View>
              <View style={styles.headerTexts}>
                <Text style={[styles.headerTitle, isDark && styles.textDark]}>
                  笔记本
                </Text>
                <Text numberOfLines={1} style={[styles.headerSubtitle, isDark && styles.mutedTextDark]}>
                  {memoView === "trash" ? "当前：回收站" : translate(`当前：${activeNotebookName}`)}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel="关闭侧边栏"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={[styles.closeButton, isDark && styles.closeButtonDark]}
            >
              <X color={isDark ? "#94a3b8" : "#64748b"} size={19} />
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, isDark && styles.searchBoxDark]}>
            <Search color={isDark ? "#64748b" : "#94a3b8"} size={16} />
            <TextInput
              accessibilityLabel="搜索笔记本"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchText}
              placeholder="搜索笔记本"
              placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
              style={[styles.searchInput, isDark && styles.textDark]}
              value={searchText}
            />
            {searchText ? (
              <Pressable hitSlop={6} onPress={() => setSearchText("")}>
                <X color={isDark ? "#64748b" : "#94a3b8"} size={15} />
              </Pressable>
            ) : null}
          </View>

          {/* Scrollable Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            {/* All Notes Row */}
            <Pressable
              accessibilityLabel={activeNotebookId === ALL_NOTES_ID && memoView === "notebook" ? "当前：全部笔记" : "切换到全部笔记"}
              accessibilityRole="button"
              onPress={onSelectAllNotes}
              style={[
                styles.navItem,
                activeNotebookId === ALL_NOTES_ID && memoView === "notebook" && (isDark ? styles.navItemActiveDark : styles.navItemActive),
              ]}
            >
              <View style={styles.navItemLeft}>
                <BookOpen
                  color={activeNotebookId === ALL_NOTES_ID && memoView === "notebook" ? "#059669" : isDark ? "#94a3b8" : "#64748b"}
                  size={18}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.navItemText,
                    isDark && styles.textDark,
                    activeNotebookId === ALL_NOTES_ID && memoView === "notebook" && styles.navItemTextActive,
                  ]}
                >
                  全部笔记
                </Text>
              </View>
              {typeof totalNotesCount === "number" ? (
                <View style={[styles.badge, isDark && styles.badgeDark]}>
                  <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
                    {totalNotesCount}
                  </Text>
                </View>
              ) : activeNotebookId === ALL_NOTES_ID && memoView === "notebook" ? (
                <Check color="#059669" size={17} />
              ) : null}
            </Pressable>

            {/* Notebooks Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDark && styles.mutedTextDark]}>
                {searchQuery ? "匹配的笔记本" : "笔记本"}
              </Text>
              <View style={styles.sectionActions}>
                {!searchQuery && childNotebookIds.size > 0 ? (
                  <Pressable
                    accessibilityLabel={allNotebookBranchesExpanded ? "收起全部笔记本" : "展开全部笔记本"}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={toggleAllNotebookBranches}
                    style={styles.actionPill}
                  >
                    <Text style={styles.actionPillText}>
                      {allNotebookBranchesExpanded ? "收起全部" : "展开全部"}
                    </Text>
                  </Pressable>
                ) : null}
                {onCreateNotebook ? (
                  <Pressable
                    accessibilityLabel="新建笔记本"
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => {
                      setCreating((v) => !v);
                      setCreateError("");
                    }}
                    style={[styles.createToggle, creating && styles.createToggleActive]}
                  >
                    <Plus color="#059669" size={16} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Inline Notebook Creation Form */}
            {creating && onCreateNotebook ? (
              <View style={[styles.createForm, isDark && styles.createFormDark]}>
                <TextInput
                  accessibilityLabel="新笔记本名称"
                  autoFocus
                  maxLength={80}
                  onChangeText={setNewNotebookName}
                  placeholder="新笔记本名称"
                  placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                  returnKeyType="done"
                  style={[styles.createInput, isDark && styles.createInputDark]}
                  value={newNotebookName}
                />
                <View style={styles.parentChoiceRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: newNotebookParentId === null }}
                    onPress={() => setNewNotebookParentId(null)}
                    style={[styles.parentChoicePill, newNotebookParentId === null && styles.parentChoicePillActive]}
                  >
                    <Text style={[styles.parentChoiceText, newNotebookParentId === null && styles.parentChoiceTextActive]}>
                      顶层笔记本
                    </Text>
                  </Pressable>
                  {activeNotebookId !== ALL_NOTES_ID ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: newNotebookParentId === activeNotebookId }}
                      onPress={() => setNewNotebookParentId(activeNotebookId)}
                      style={[styles.parentChoicePill, newNotebookParentId === activeNotebookId && styles.parentChoicePillActive]}
                    >
                      <Text numberOfLines={1} style={[styles.parentChoiceText, newNotebookParentId === activeNotebookId && styles.parentChoiceTextActive]}>
                        {translate(`放入「${activeNotebookName}」`)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {createError ? (
                  <Text accessibilityRole="alert" style={styles.createError}>
                    {createError}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityLabel="确认创建"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !newNotebookName.trim() || isSavingNotebook }}
                  disabled={!newNotebookName.trim() || isSavingNotebook}
                  onPress={() => void submitNewNotebook()}
                  style={[
                    styles.createSubmitButton,
                    (!newNotebookName.trim() || isSavingNotebook) && styles.createSubmitButtonDisabled,
                  ]}
                >
                  {isSavingNotebook ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.createSubmitButtonText}>创建笔记本</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* Notebook Tree Rows */}
            {visibleNotebookOptions.map(({ depth, notebook }: NotebookOption) => {
              const isSelected = activeNotebookId === notebook.id && memoView === "notebook";
              const hasChildren = childNotebookIds.has(notebook.id) && !searchQuery;
              const isCollapsed = collapsedNotebookIds.has(notebook.id);

              return (
                <View
                  key={notebook.id}
                  style={[
                    styles.notebookRow,
                    isSelected && (isDark ? styles.navItemActiveDark : styles.navItemActive),
                    depth > 0 && { paddingLeft: 12 + Math.min(depth * 16, 48) },
                  ]}
                >
                  {hasChildren ? (
                    <Pressable
                      accessibilityLabel={`${isCollapsed ? "展开" : "收起"} ${notebook.name}`}
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() => toggleNotebookCollapsed(notebook.id)}
                      style={styles.expandChevron}
                    >
                      {isCollapsed ? (
                        <ChevronRight color={isDark ? "#64748b" : "#94a3b8"} size={16} />
                      ) : (
                        <ChevronDown color={isDark ? "#64748b" : "#94a3b8"} size={16} />
                      )}
                    </Pressable>
                  ) : (
                    <View style={styles.expandChevronPlaceholder} />
                  )}

                  <Pressable
                    accessibilityLabel={`${isSelected ? "当前" : "切换到"} ${notebook.name}`}
                    accessibilityRole="button"
                    onPress={() => onSelectNotebook(notebook.id)}
                    style={styles.notebookSelectArea}
                  >
                    <Folder
                      color={isSelected ? "#059669" : isDark ? "#94a3b8" : "#64748b"}
                      size={17}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.notebookName,
                        isDark && styles.textDark,
                        isSelected && styles.navItemTextActive,
                      ]}
                    >
                      {notebook.name}
                    </Text>
                  </Pressable>

                  {isSelected ? <Check color="#059669" size={17} /> : null}
                </View>
              );
            })}

            {visibleNotebookOptions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Folder color={isDark ? "#334155" : "#cbd5e1"} size={32} />
                <Text style={[styles.emptyText, isDark && styles.mutedTextDark]}>
                  没有匹配的笔记本
                </Text>
              </View>
            ) : null}

            {/* Divider */}
            <View style={[styles.divider, isDark && styles.dividerDark]} />

            {/* Trash Row */}
            <Pressable
              accessibilityLabel={memoView === "trash" ? "当前：回收站" : "切换到回收站"}
              accessibilityRole="button"
              onPress={onSelectTrash}
              style={[
                styles.navItem,
                memoView === "trash" && (isDark ? styles.navItemActiveDark : styles.navItemActive),
              ]}
            >
              <View style={styles.navItemLeft}>
                <Trash2
                  color={memoView === "trash" ? "#ef4444" : isDark ? "#94a3b8" : "#64748b"}
                  size={18}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.navItemText,
                    isDark && styles.textDark,
                    memoView === "trash" && { color: "#ef4444", fontWeight: "700" },
                  ]}
                >
                  回收站
                </Text>
              </View>
              {memoView === "trash" ? <Check color="#ef4444" size={17} /> : null}
            </Pressable>
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
  },
  drawer: {
    bottom: 0,
    elevation: 20,
    left: 0,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    top: 0,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerTitleWrap: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 10,
  },
  headerIconWrap: {
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 9,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  headerIconWrapDark: {
    backgroundColor: "#064e3b",
  },
  headerTexts: {
    flex: 1,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  closeButtonDark: {
    backgroundColor: "#1e293b",
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  searchBoxDark: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
  },
  searchInput: {
    color: "#0f172a",
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  navItem: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navItemActive: {
    backgroundColor: "#ecfdf5",
  },
  navItemActiveDark: {
    backgroundColor: "#064e3b",
  },
  navItemLeft: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 10,
  },
  navItemText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "500",
  },
  navItemTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeDark: {
    backgroundColor: "#1e293b",
  },
  badgeText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  badgeTextDark: {
    color: "#94a3b8",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionPillText: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "600",
  },
  createToggle: {
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 14,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  createToggleActive: {
    backgroundColor: "#a7f3d0",
  },
  createForm: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 4,
    marginVertical: 8,
    padding: 12,
  },
  createFormDark: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
  },
  createInput: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  createInputDark: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    color: "#f8fafc",
  },
  parentChoiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  parentChoicePill: {
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  parentChoicePillActive: {
    backgroundColor: "#059669",
  },
  parentChoiceText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "500",
  },
  parentChoiceTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  createError: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 6,
  },
  createSubmitButton: {
    alignItems: "center",
    backgroundColor: "#059669",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 8,
  },
  createSubmitButtonDisabled: {
    opacity: 0.5,
  },
  createSubmitButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  notebookRow: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 1,
    minHeight: 40,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  expandChevron: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 24,
  },
  expandChevronPlaceholder: {
    width: 24,
  },
  notebookSelectArea: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
  },
  notebookName: {
    color: "#334155",
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 8,
  },
  divider: {
    backgroundColor: "#e2e8f0",
    height: 1,
    marginHorizontal: 6,
    marginVertical: 12,
  },
  dividerDark: {
    backgroundColor: "#1e293b",
  },
  textDark: {
    color: "#f8fafc",
  },
  mutedTextDark: {
    color: "#94a3b8",
  },
});
