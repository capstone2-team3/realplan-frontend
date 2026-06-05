import { useState } from "react";
import { ArrowUpDown, Calendar, Clock, Edit2, Filter as FilterIcon, Folder as FolderIcon, MoreVertical, Plus, Trash2 } from "lucide-react";
import type { FilterKey, Folder, Screen, SortKey, Task } from "../types";
import { ActionSheet } from "../components/ActionSheet";
import { Btn } from "../components/Btn";
import { Card } from "../components/Card";
import { ImportancePill } from "../components/ImportancePill";
import { Pill } from "../components/Pill";
import { ProgressBar } from "../components/ProgressBar";
import { SectionLabel } from "../components/SectionLabel";
import { fmtDday, fmtMin } from "../lib/format";
import { filterTasks, sortTasks } from "../lib/tasks";
import { tone } from "../theme/tokens";
import { FILTER_LABELS, SORT_LABELS, TASK_TYPE_LABELS } from "../types";

export function TasksScreen({
  tasks,
  folders,
  onNavigate,
  onCreateTask,
  onCreateFolder,
  onEditTask,
  onDeleteTask,
}: {
  tasks: Task[];
  folders: Folder[];
  onNavigate: (s: Screen) => void;
  onCreateTask: (folderId: string) => void;
  onCreateFolder: () => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const [activeFolder, setActiveFolder] = useState(folders[0].id);
  const [sortKey, setSortKey] = useState<SortKey>("RECENT");
  const [filterKey, setFilterKey] = useState<FilterKey>("ALL");
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  const folderTasks = tasks.filter((t) => t.folderId === activeFolder);
  const filtered = filterTasks(folderTasks, filterKey);
  const sorted = sortTasks(filtered, sortKey);

  const active = sorted.filter((t) => !t.completed);
  const done = sorted.filter((t) => t.completed);

  return (
    <div>
      <div
        style={{
          padding: "20px 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700 }}>Tasks</div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="outline" size="sm" icon={<FolderIcon size={13} />} onClick={onCreateFolder}>
            폴더
          </Btn>
          <Btn size="sm" icon={<Plus size={13} />} onClick={() => onCreateTask(activeFolder)}>
            Task
          </Btn>
        </div>
      </div>

      {/* Folder tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "0 16px 12px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {folders.map((f) => {
          const isActive = activeFolder === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f.id)}
              style={{
                padding: "7px 12px",
                borderRadius: 999,
                border: `1px solid ${isActive ? tone.ink : tone.border}`,
                background: isActive ? tone.ink : tone.surface,
                color: isActive ? tone.surface : tone.ink,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
            >
              <FolderIcon size={11} />
              {f.name}
            </button>
          );
        })}
      </div>

      {/* Sort & Filter */}
      <div style={{ display: "flex", gap: 6, padding: "0 16px 14px" }}>
        <button
          onClick={() => setSortSheetOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            background: tone.surface,
            border: `1px solid ${tone.border}`,
            borderRadius: 999,
            fontSize: 11,
            color: tone.ink,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <ArrowUpDown size={11} />
          {SORT_LABELS[sortKey]}
        </button>
        <button
          onClick={() => setFilterSheetOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            background: tone.surface,
            border: `1px solid ${tone.border}`,
            borderRadius: 999,
            fontSize: 11,
            color: tone.ink,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <FilterIcon size={11} />
          {FILTER_LABELS[filterKey]}
        </button>
      </div>

      <div style={{ padding: "0 16px 24px" }}>
        {active.length > 0 && (filterKey === "ALL" || filterKey === "ACTIVE") && (
          <>
            <SectionLabel>진행 중 · {active.length}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {active.map((t) => {
                const progressPct = Math.round(
                  ((t.adjustedEstimatedMin - t.remainingMin) / t.adjustedEstimatedMin) * 100,
                );
                return (
                  <Card key={t.id} onClick={() => onNavigate({ name: "taskDetail", taskId: t.id })}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                          <Pill variant="muted" size="sm">{TASK_TYPE_LABELS[t.type]}</Pill>
                          <ImportancePill value={t.importance} />
                          {t.type === "TIME_BASED" && !t.correctionEnabled && (
                            <Pill variant="muted" size="sm">보정 OFF</Pill>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: tone.inkMuted, marginBottom: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <Clock size={11} />
                            {fmtMin(t.remainingMin)}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <Calendar size={11} />
                            {fmtDday(t.deadline)}
                          </span>
                        </div>
                        <ProgressBar percent={progressPct} />
                        <div style={{ fontSize: 10, color: tone.inkSubtle, marginTop: 4 }}>{progressPct}% 진행</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuTaskId(t.id);
                        }}
                        style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}
                      >
                        <MoreVertical size={15} color={tone.inkSubtle} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {done.length > 0 && (filterKey === "ALL" || filterKey === "COMPLETED") && (
          <>
            <SectionLabel>완료 · {done.length}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {done.map((t) => (
                <Card key={t.id} style={{ opacity: 0.6 }} onClick={() => onNavigate({ name: "taskDetail", taskId: t.id })}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, textDecoration: "line-through", color: tone.inkMuted, marginBottom: 4 }}>
                        {t.name}
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <Pill variant="accent" size="sm">완료</Pill>
                        <Pill variant="muted" size="sm">{TASK_TYPE_LABELS[t.type]}</Pill>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuTaskId(t.id);
                      }}
                      style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}
                    >
                      <MoreVertical size={15} color={tone.inkSubtle} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {sorted.length === 0 && (
          <div
            style={{
              border: `1px dashed ${tone.borderStrong}`,
              borderRadius: 14,
              padding: 36,
              textAlign: "center",
              color: tone.inkMuted,
              fontSize: 13,
            }}
          >
            <FolderIcon size={28} color={tone.inkSubtle} style={{ marginBottom: 8 }} />
            <div style={{ marginBottom: 4, color: tone.ink, fontWeight: 500 }}>
              {filterKey === "ALL" ? "이 폴더가 비어있어요" : `${FILTER_LABELS[filterKey]} Task가 없어요`}
            </div>
            <div style={{ fontSize: 11 }}>+ Task 버튼으로 새 작업을 추가하세요</div>
          </div>
        )}
      </div>

      {/* Sort sheet */}
      <ActionSheet
        open={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        actions={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
          label: SORT_LABELS[k] + (sortKey === k ? "  ✓" : ""),
          onClick: () => setSortKey(k),
        }))}
      />

      {/* Filter sheet */}
      <ActionSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        actions={(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => ({
          label: FILTER_LABELS[k] + (filterKey === k ? "  ✓" : ""),
          onClick: () => setFilterKey(k),
        }))}
      />

      {/* Task ⋮ menu */}
      <ActionSheet
        open={menuTaskId !== null}
        onClose={() => setMenuTaskId(null)}
        actions={[
          {
            label: "Task 정보 수정",
            icon: <Edit2 size={15} />,
            onClick: () => {
              if (menuTaskId) onEditTask(menuTaskId);
            },
          },
          {
            label: "Task 삭제",
            icon: <Trash2 size={15} />,
            danger: true,
            onClick: () => {
              if (menuTaskId) onDeleteTask(menuTaskId);
            },
          },
        ]}
      />
    </div>
  );
}
