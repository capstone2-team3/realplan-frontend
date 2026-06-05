// ───────────────────────── App (루트 컴포넌트 / 상태 + 라우팅) ─────────────────────────
// 모든 화면 상태와 데이터(tasks, folders)를 여기서 들고 자식 화면에 내려준다.
// 백엔드 연동 시: initialTasks/initialFolders 를 서버에서 받아오도록 바꾸고,
// 각 handle* 함수 안에서 서버 호출을 추가하면 된다. (src/api/ 참고)
import * as React from "react";
import { useState, useEffect } from "react";
import {
  Home as HomeIcon,
  ListTodo,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";

import type { Screen, Task, Folder, StudyRecord, User } from "./types";
import { tone, fontStack, monoStack } from "./theme/tokens";
import { api } from "./api";
import { setToken } from "./api/client";

import { PhoneFrame } from "./components/PhoneFrame";
import { TaskFormModal } from "./components/TaskFormModal";
import { CreateFolderModal } from "./components/CreateFolderModal";
import { ManualRecordModal } from "./components/ManualRecordModal";
import { ConfirmDialog } from "./components/ConfirmDialog";

import { HomeScreen } from "./screens/HomeScreen";
import { TasksScreen } from "./screens/TasksScreen";
import { TaskDetailScreen } from "./screens/TaskDetailScreen";
import { StudySessionScreen } from "./screens/StudySessionScreen";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { AuthScreen } from "./screens/AuthScreen";

export default function App() {
  // 인증 상태 (목업: 로그인/회원가입 시 user 세팅)
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  // taskDetail 진입 직전의 탭 화면 추적 (Home에서 들어왔는지 Tasks에서 들어왔는지)
  const [prevTabScreen, setPrevTabScreen] = useState<Screen["name"]>("home");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);

  // 로그인되면 서버(또는 mock)에서 폴더·태스크를 불러온다.
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    setLoading(true);
    Promise.all([api.fetchFolders(), api.fetchTasks()])
      .then(([f, t]) => {
        if (!alive) return;
        setFolders(f);
        setTasks(t);
      })
      .catch((e) => console.error("초기 데이터 로드 실패:", e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [currentUser]);

  // Modals
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [defaultFolderForCreate, setDefaultFolderForCreate] = useState("default");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [manualRecordOpen, setManualRecordOpen] = useState(false);
  const [manualRecordTaskId, setManualRecordTaskId] = useState<string | null>(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);

  // Home state (recommendation only; availability moved into HomeScreen)
  const [recommendation, setRecommendation] = useState<{ items: Task[]; total: number } | null>(null);

  const navigate = (s: Screen) => {
    // taskDetail로 진입할 때, 현재 화면이 탭 화면이면 그걸 기억
    if (s.name === "taskDetail" && (screen.name === "home" || screen.name === "tasks" || screen.name === "analytics" || screen.name === "settings")) {
      setPrevTabScreen(screen.name);
    }
    setScreen(s);
  };

  const handleCreateOrEditTask = async (
    data: Omit<Task, "id" | "records" | "createdAt">,
    editingId?: string,
  ) => {
    try {
      if (editingId) {
        const updated = await api.updateTask(editingId, data);
        setTasks((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
      } else {
        const created = await api.createTask(data);
        setTasks((prev) => [...prev, created]);
      }
    } catch (e) {
      console.error("Task 저장 실패:", e);
    } finally {
      setTaskFormOpen(false);
      setEditingTaskId(null);
    }
  };

  const handleCreateFolder = async (name: string) => {
    try {
      const folder = await api.createFolder(name);
      setFolders((prev) => [...prev, folder]);
    } catch (e) {
      console.error("폴더 생성 실패:", e);
    } finally {
      setCreateFolderOpen(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e) {
      console.error("Task 삭제 실패:", e);
    } finally {
      setDeleteConfirmTaskId(null);
      if (screen.name === "taskDetail" && screen.taskId === taskId) {
        setScreen({ name: "tasks" });
      }
    }
  };

  const handleStartSession = (taskId: string) => {
    setScreen({ name: "studySession", taskId });
  };

  const handleCompleteSession = async (
    taskId: string,
    record: {
      durationMin: number;
      progressLevel: 1 | 2 | 3 | 4 | 5;
      progressPercent: number;
      focusLevel: 1 | 2 | 3 | 4;
      notes?: string;
    },
  ) => {
    try {
      const updated = await api.addRecord(taskId, { ...record, source: "TIMER" });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (e) {
      console.error("세션 기록 저장 실패:", e);
    } finally {
      setScreen({ name: "taskDetail", taskId });
    }
  };

  const handleAddManualRecord = async (
    taskId: string,
    record: Omit<StudyRecord, "id" | "startedAt" | "endedAt" | "source">,
  ) => {
    try {
      const updated = await api.addRecord(taskId, {
        durationMin: record.durationMin,
        progressLevel: record.progressLevel,
        progressPercent: record.progressPercent,
        focusLevel: record.focusLevel,
        notes: record.notes,
        source: "MANUAL",
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (e) {
      console.error("수동 기록 저장 실패:", e);
    } finally {
      setManualRecordOpen(false);
      setManualRecordTaskId(null);
    }
  };

  const currentTask =
    screen.name === "taskDetail" || screen.name === "studySession"
      ? tasks.find((t) => t.id === (screen as any).taskId)
      : null;

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) : null;
  const deletingTask = deleteConfirmTaskId ? tasks.find((t) => t.id === deleteConfirmTaskId) : null;

  const showTabBar = ["home", "tasks", "analytics", "settings"].includes(screen.name);

  const tabs: { name: Screen["name"]; icon: React.ReactNode; label: string }[] = [
    { name: "home", icon: <HomeIcon size={19} />, label: "Home" },
    { name: "tasks", icon: <ListTodo size={19} />, label: "Tasks" },
    { name: "analytics", icon: <BarChart3 size={19} />, label: "Analytics" },
    { name: "settings", icon: <SettingsIcon size={19} />, label: "Settings" },
  ];

  return (
    <div style={{ fontFamily: fontStack }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');

        * { box-sizing: border-box; }
        html, body, #root { margin: 0; height: 100%; }
        button { font-family: inherit; }
        input, select, textarea { font-family: inherit; }
        ::-webkit-scrollbar { display: none; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      <PhoneFrame>
        {!currentUser ? (
          <AuthScreen
            onLogin={async (email, password) => {
              const user = await api.login(email, password);
              setCurrentUser(user);
              setScreen({ name: "home" });
            }}
            onSignup={async (name, email, password) => {
              const user = await api.signup(name, email, password);
              setCurrentUser(user);
              setScreen({ name: "home" });
            }}
          />
        ) : (
        <>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {screen.name === "home" && (
              <HomeScreen
                tasks={tasks}
                folders={folders}
                onNavigate={navigate}
                recommendation={recommendation}
                setRecommendation={setRecommendation}
                userName={currentUser.name}
              />
            )}
            {screen.name === "tasks" && (
              <TasksScreen
                tasks={tasks}
                folders={folders}
                onNavigate={navigate}
                onCreateTask={(folderId) => {
                  setDefaultFolderForCreate(folderId);
                  setEditingTaskId(null);
                  setTaskFormOpen(true);
                }}
                onCreateFolder={() => setCreateFolderOpen(true)}
                onEditTask={(taskId) => {
                  setEditingTaskId(taskId);
                  setTaskFormOpen(true);
                }}
                onDeleteTask={(taskId) => setDeleteConfirmTaskId(taskId)}
              />
            )}
            {screen.name === "taskDetail" && currentTask && (
              <TaskDetailScreen
                task={currentTask}
                onBack={() => navigate({ name: prevTabScreen } as Screen)}
                onStartSession={() => handleStartSession(currentTask.id)}
                onAddManualRecord={() => {
                  setManualRecordTaskId(currentTask.id);
                  setManualRecordOpen(true);
                }}
                onEditTask={() => {
                  setEditingTaskId(currentTask.id);
                  setTaskFormOpen(true);
                }}
              />
            )}
            {screen.name === "studySession" && currentTask && (
              <StudySessionScreen
                task={currentTask}
                onBack={() => navigate({ name: "taskDetail", taskId: currentTask.id })}
                onComplete={(record) => handleCompleteSession(currentTask.id, record)}
              />
            )}
            {screen.name === "analytics" && <AnalyticsScreen tasks={tasks} />}
            {screen.name === "settings" && (
              <SettingsScreen
                initialName={currentUser.name}
                initialEmail={currentUser.email}
                onLogout={() => {
                  setToken(null);
                  setCurrentUser(null);
                  setTasks([]);
                  setFolders([]);
                  setScreen({ name: "home" });
                }}
              />
            )}
          </div>

          {showTabBar && (
            <div
              style={{
                display: "flex",
                background: tone.surface,
                borderTop: `1px solid ${tone.border}`,
                padding: "8px 0 14px",
                flexShrink: 0,
              }}
            >
              {tabs.map((t) => {
                const isActive = screen.name === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => navigate({ name: t.name } as Screen)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      padding: "5px 0",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: isActive ? tone.ink : tone.inkSubtle,
                      transition: "color 0.15s",
                    }}
                  >
                    {t.icon}
                    <div style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{t.label}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <TaskFormModal
          open={taskFormOpen}
          onClose={() => {
            setTaskFormOpen(false);
            setEditingTaskId(null);
          }}
          onSubmit={handleCreateOrEditTask}
          folders={folders}
          defaultFolderId={defaultFolderForCreate}
          editingTask={editingTask}
        />

        <CreateFolderModal
          open={createFolderOpen}
          onClose={() => setCreateFolderOpen(false)}
          onCreate={handleCreateFolder}
        />

        <ManualRecordModal
          open={manualRecordOpen}
          task={tasks.find((t) => t.id === manualRecordTaskId) ?? null}
          onClose={() => {
            setManualRecordOpen(false);
            setManualRecordTaskId(null);
          }}
          onSave={(rec) => {
            if (manualRecordTaskId) handleAddManualRecord(manualRecordTaskId, rec);
          }}
        />

        <ConfirmDialog
          open={deleteConfirmTaskId !== null}
          title="Task 삭제"
          message={`'${deletingTask?.name ?? ""}' Task를 삭제할까요? 학습 기록도 함께 사라집니다.`}
          confirmLabel="삭제"
          variant="danger"
          onCancel={() => setDeleteConfirmTaskId(null)}
          onConfirm={() => deleteConfirmTaskId && handleDeleteTask(deleteConfirmTaskId)}
        />
        </>
        )}
      </PhoneFrame>
    </div>
  );
}
